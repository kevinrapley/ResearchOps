/**
 * @file service/internals/mural.js
 * @module service/internals/mural
 * @summary Service part that encapsulates Mural routes logic (OAuth + provisioning).
 */

import {
  buildAuthUrl,
  exchangeAuthCode,
  refreshAccessToken,
  verifyHomeOfficeByCompany,
  ensureUserRoom,
  ensureProjectFolder,
  createMural,
  getMe,
  getActiveWorkspaceIdFromMe
} from "../../lib/mural.js";

import { b64Encode, b64Decode } from "../../core/utils.js";

/**
 * @typedef {import("../index.js").ResearchOpsService} ResearchOpsService
 */

export class MuralServicePart {
  /** @param {ResearchOpsService} root */
  constructor(root) {
    this.root = root;
  }

  kvKey(uid) { return `mural:${uid}:tokens`; }

  async saveTokens(uid, tokens) {
    await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(tokens), { encryption: true });
  }

  async loadTokens(uid) {
    const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid));
    return raw ? JSON.parse(raw) : null;
  }

  /* ───────────────────────── internal helpers ───────────────────────── */

  /**
   * Verify company membership and return { id } for the active workspace.
   * Throws if company check fails or no active workspace found.
   */
  async _ensureWorkspace(env, accessToken) {
    const inCompany = await verifyHomeOfficeByCompany(env, accessToken);
    if (!inCompany) throw Object.assign(new Error("not_in_home_office_workspace"), { code: 403 });

    const me = await getMe(env, accessToken);
    const wsId = getActiveWorkspaceIdFromMe(me);
    if (!wsId) throw new Error("no_active_workspace");
    return { id: wsId };
  }

  /* ─────────────────────────────────────────────────────────────────── */
  /* Routes                                                              */
  /* ─────────────────────────────────────────────────────────────────── */

  /** GET /api/mural/auth?uid=:uid[&return=:path] */
  async muralAuth(origin, url) {
    const uid = url.searchParams.get("uid") || "anon";
    const ret = url.searchParams.get("return");
    const safeReturn = (ret && ret.startsWith("/")) ? ret : "/pages/projects/";
    const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
    const redirect = buildAuthUrl(this.root.env, state);
    return Response.redirect(redirect, 302);
  }

  /** GET /api/mural/callback?code=&state= */
  async muralCallback(origin, url) {
    const { env } = this.root;

    if (!env.MURAL_CLIENT_SECRET) {
      return this.root.json({
        ok: false, error: "missing_secret",
        message: "MURAL_CLIENT_SECRET is not configured in Cloudflare secrets."
      }, 500, this.root.corsHeaders(origin));
    }

    const code = url.searchParams.get("code");
    const stateB64 = url.searchParams.get("state");
    if (!code) {
      return this.root.json({ ok: false, error: "missing_code" }, 400, this.root.corsHeaders(origin));
    }

    let uid = "anon";
    let stateObj = {};
    try {
      stateObj = JSON.parse(b64Decode(stateB64 || ""));
      uid = stateObj?.uid || "anon";
    } catch { /* ignore */ }

    // code → tokens
    let tokens;
    try {
      tokens = await exchangeAuthCode(env, code);
    } catch (err) {
      return this.root.json({
        ok: false, error: "token_exchange_failed", message: err?.message || "Unable to exchange OAuth code"
      }, 500, this.root.corsHeaders(origin));
    }

    await this.saveTokens(uid, tokens);

    // Return to the page we came from, append mural=connected
    const safeReturn = (stateObj?.return && stateObj.return.startsWith("/")) ?
      stateObj.return : "/pages/projects/";
    const back = new URL(safeReturn, url);
    const sp = new URLSearchParams(back.search);
    sp.set("mural", "connected");
    back.search = sp.toString();

    return Response.redirect(back.toString(), 302);
  }

  /** GET /api/mural/verify?uid=:uid */
  async muralVerify(origin, url) {
    const uid = url.searchParams.get("uid") || "anon";
    const tokens = await this.loadTokens(uid);
    if (!tokens?.access_token) {
      return this.root.json({ ok: false, reason: "not_authenticated" }, 401, this.root.corsHeaders(origin));
    }

    const { env } = this.root;
    let accessToken = tokens.access_token;

    // Try company/workspace check; if 401, refresh once and retry
    try {
      const inCompany = await verifyHomeOfficeByCompany(env, accessToken);
      if (!inCompany) {
        return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, this.root.corsHeaders(origin));
      }
    } catch (err) {
      const status = Number(err?.status || 0);
      if (status === 401 && tokens.refresh_token) {
        try {
          const refreshed = await refreshAccessToken(env, tokens.refresh_token);
          const merged = { ...tokens, ...refreshed };
          await this.saveTokens(uid, merged);
          accessToken = merged.access_token;

          const inCompany = await verifyHomeOfficeByCompany(env, accessToken);
          if (!inCompany) {
            return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, this.root.corsHeaders(origin));
          }
        } catch {
          return this.root.json({ ok: false, reason: "not_authenticated" }, 401, this.root.corsHeaders(origin));
        }
      } else {
        // Not an auth issue; surface as generic error (so client shows an error pill)
        return this.root.json({ ok: false, reason: "error", detail: String(err?.message || err) }, 500, this.root.corsHeaders(origin));
      }
    }

    const me = await getMe(env, accessToken).catch(() => null);
    const activeWorkspaceId = getActiveWorkspaceIdFromMe(me);

    return this.root.json({ ok: true, me, activeWorkspaceId },
      200,
      this.root.corsHeaders(origin)
    );
  }

  /** POST /api/mural/setup  body: { uid, projectName } */
  async muralSetup(request, origin) {
    const cors = this.root.corsHeaders(origin);
    /** helpful step marker for error reporting */
    let step = "parse_input";

    try {
      const { uid = "anon", projectName } = await request.json().catch(() => ({}));
      if (!projectName || !String(projectName).trim()) {
        return this.root.json({ ok: false, error: "projectName required" }, 400, cors);
      }

      step = "load_tokens";
      const tokens = await this.loadTokens(uid);
      if (!tokens?.access_token) {
        return this.root.json({ ok: false, reason: "not_authenticated" }, 401, cors);
      }

      step = "verify_workspace";
      // Ensure company membership and get active workspace
      let accessToken = tokens.access_token;
      let ws;
      try {
        ws = await this._ensureWorkspace(this.root.env, accessToken);
      } catch (err) {
        const code = Number(err?.status || err?.code || 0);
        if (code === 401 && tokens.refresh_token) {
          // refresh then retry once
          const refreshed = await refreshAccessToken(this.root.env, tokens.refresh_token);
          const merged = { ...tokens, ...refreshed };
          await this.saveTokens(uid, merged);
          accessToken = merged.access_token;
          ws = await this._ensureWorkspace(this.root.env, accessToken);
        } else if (String(err?.message) === "not_in_home_office_workspace") {
          return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, cors);
        } else {
          throw err;
        }
      }

      step = "get_me";
      const me = await getMe(this.root.env, accessToken).catch(() => null);
      const username = me?.value?.firstName || me?.name || "Private";

      step = "ensure_room";
      const room = await ensureUserRoom(this.root.env, accessToken, ws.id, username);

      step = "ensure_folder";
      const folder = await ensureProjectFolder(this.root.env, accessToken, room.id, String(projectName).trim());

      step = "create_mural";
      const mural = await createMural(this.root.env, accessToken, {
        title: "Reflexive Journal",
        roomId: room.id,
        folderId: folder.id
      });

      return this.root.json({ ok: true, workspace: ws, room, folder, mural }, 200, cors);

    } catch (err) {
      // Unwrap our library’s enriched errors if present
      const status = Number(err?.status) || 500;
      const body = err?.body || null;
      const message = String(err?.message || "setup_failed");

      // Never throw — surface as JSON so the client can show it
      return this.root.json({
        ok: false,
        error: "setup_failed",
        step,
        message,
        upstream: body
      }, status, cors);
    }
  }

  /** GET /api/mural/debug-env (TEMP) */
  async muralDebugEnv(origin) {
    const env = this.root.env || {};
    return this.root.json({
      ok: true,
      has_CLIENT_ID: Boolean(env.MURAL_CLIENT_ID),
      has_CLIENT_SECRET: Boolean(env.MURAL_CLIENT_SECRET),
      redirect_uri: env.MURAL_REDIRECT_URI || "(unset)",
      scopes: env.MURAL_SCOPES || "(default)",
      company_id: env.MURAL_COMPANY_ID || "(unset)"
    }, 200, this.root.corsHeaders(origin));
  }

  /** GET /api/mural/debug-auth (TEMP) */
  async muralDebugAuth(origin, url) {
    const uid = url.searchParams.get("uid") || "anon";
    const ret = url.searchParams.get("return");
    const safeReturn = (ret && ret.startsWith("/")) ? ret : "/pages/projects/";
    const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
    const authUrl = buildAuthUrl(this.root.env, state);
    return this.root.json({
      redirect_uri: this.root.env.MURAL_REDIRECT_URI,
      scopes: this.root.env.MURAL_SCOPES || "(default)",
      auth_url: authUrl
    }, 200, this.root.corsHeaders(origin));
  }
}
