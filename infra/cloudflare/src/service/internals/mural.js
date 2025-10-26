/**
 * @file service/internals/mural.js
 * @module service/internals/mural
 * @summary Mural routes (OAuth + verify + setup + find).
 */

import {
  buildAuthUrl,
  exchangeAuthCode,
  refreshAccessToken,
  verifyHomeOfficeByCompany,
  ensureUserRoom,
  ensureProjectFolder,
  findProjectFolder,          // NEW (non-creating)
  listMuralsInFolder,         // NEW
  createMural,
  getMe,
  getActiveWorkspaceIdFromMe
} from "../../lib/mural.js";

import { b64Encode, b64Decode } from "../../core/utils.js";

/** @typedef {import("../index.js").ResearchOpsService} ResearchOpsService */

export class MuralServicePart {
  /** @param {ResearchOpsService} root */
  constructor(root) {
    this.root = root;
  }

  kvKey(uid) { return `mural:${uid}:tokens`; }

  async saveTokens(uid, tokens) {
    const enriched = { ...tokens, _obtained_at: Date.now() };
    await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(enriched), { encryption: true });
  }

  async loadTokens(uid) {
    const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid));
    return raw ? JSON.parse(raw) : null;
  }

  // Refresh-once helper
  async withToken(uid, fn) {
    let tokens = await this.loadTokens(uid);
    if (!tokens?.access_token) {
      const e = new Error("no_access_token"); e.status = 401; throw e;
    }
    try {
      return await fn(tokens.access_token);
    } catch (err) {
      const status = Number(err?.status) || 0;
      const body = err?.body || {};
      const isTokenErr = status === 401 || /invalid[_-]?token/i.test(String(body?.error || body?.message || ""));
      if (!isTokenErr || !tokens.refresh_token) throw err;
      const newTokens = await refreshAccessToken(this.root.env, tokens.refresh_token);
      const merged = { ...tokens, ...newTokens, _obtained_at: Date.now() };
      await this.saveTokens(uid, merged);
      return fn(merged.access_token);
    }
  }

  /* ───────────────────────── Routes ───────────────────────── */

  /** GET /api/mural/auth?uid=&return= */
  async muralAuth(origin, url) {
    const uid = url.searchParams.get("uid") || "anon";
    const ret = url.searchParams.get("return");
    const safeReturn = (ret && /^\/[^\s]*$/.test(ret)) ? ret : "/pages/projects/";
    const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
    const redirect = buildAuthUrl(this.root.env, state);
    return Response.redirect(redirect, 302);
  }

  /** GET /api/mural/callback?code=&state= */
  async muralCallback(origin, url) {
    const { env } = this.root;
    if (!env.MURAL_CLIENT_SECRET) {
      return this.root.json({ ok: false, error: "missing_secret", message: "MURAL_CLIENT_SECRET is not configured in Cloudflare secrets." }, 500, this.root.corsHeaders(origin));
    }

    const code = url.searchParams.get("code");
    const stateB64 = url.searchParams.get("state");
    if (!code) return this.root.json({ ok: false, error: "missing_code" }, 400, this.root.corsHeaders(origin));

    let uid = "anon";
    let stateObj = {};
    try { stateObj = JSON.parse(b64Decode(stateB64 || "")); uid = stateObj?.uid || "anon"; } catch {}

    let tokens;
    try { tokens = await exchangeAuthCode(env, code); }
    catch (err) {
      return this.root.json({ ok: false, error: "token_exchange_failed", message: err?.message || "Unable to exchange OAuth code" }, 500, this.root.corsHeaders(origin));
    }

    await this.saveTokens(uid, tokens);

    const safeReturn = (stateObj?.return && /^\/[^\s]*$/.test(stateObj.return)) ? stateObj.return : "/pages/projects/";
    const back = new URL(safeReturn, url);
    const sp = new URLSearchParams(back.search);
    sp.set("mural", "connected");
    back.search = sp.toString();

    return Response.redirect(back.toString(), 302);
  }

  /** GET /api/mural/verify?uid= */
  async muralVerify(origin, url) {
    const cors = this.root.corsHeaders(origin);
    const uid = url.searchParams.get("uid") || "anon";

    try {
      const inCompany = await this.withToken(uid, (access) => verifyHomeOfficeByCompany(this.root.env, access));
      if (!inCompany) return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, cors);

      const me = await this.withToken(uid, (access) => getMe(this.root.env, access));
      const activeWorkspaceId = getActiveWorkspaceIdFromMe(me);

      return this.root.json({ ok: true, me, activeWorkspaceId }, 200, cors);
    } catch (err) {
      const status = Number(err?.status) || 500;
      if (status === 401) return this.root.json({ ok: false, reason: "not_authenticated" }, 401, cors);
      return this.root.json({ ok: false, reason: "error", message: String(err?.message || "verify_failed") }, status, cors);
    }
  }

  /** POST /api/mural/setup  body: { uid, projectName } */
  async muralSetup(request, origin) {
    const cors = this.root.corsHeaders(origin);
    let step = "parse_input";
    let uid = "anon";

    try {
      const body = await request.json().catch(() => ({}));
      uid = body?.uid || "anon";
      const projectName = body?.projectName;
      if (!projectName || !String(projectName).trim()) {
        return this.root.json({ ok: false, error: "projectName required" }, 400, cors);
      }

      step = "verify_company";
      const inCompany = await this.withToken(uid, (access) => verifyHomeOfficeByCompany(this.root.env, access));
      if (!inCompany) return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, cors);

      step = "get_me";
      const me = await this.withToken(uid, (access) => getMe(this.root.env, access));
      const configuredWsId = (this.root.env.MURAL_HOME_OFFICE_WORKSPACE_ID || "").trim();
      const activeWsId = getActiveWorkspaceIdFromMe(me);
      const workspaceId = configuredWsId || activeWsId;
      if (!workspaceId) {
        return this.root.json({ ok: false, error: "no_workspace_id", message: "Could not resolve a workspace id" }, 400, cors);
      }

      const username = me?.value?.firstName || me?.value?.name || me?.name || "Private";

      step = "ensure_room";
      const room = await this.withToken(uid, (access) => ensureUserRoom(this.root.env, access, workspaceId, username));

      step = "ensure_folder";
      const folder = await this.withToken(uid, (access) => ensureProjectFolder(this.root.env, access, room.id, String(projectName).trim()));

      step = "create_mural";
      const muralResp = await this.withToken(uid, (access) =>
        createMural(this.root.env, access, { title: "Reflexive Journal", roomId: room.id, folderId: folder.id })
      );

      const mv = muralResp?.value || muralResp || {};
      const memberUrl =
        mv._canvasLink ||
        (mv.workspaceId && mv.id && mv.state
          ? `https://app.mural.co/t/${mv.workspaceId}/m/${mv.workspaceId}/${String(mv.id).split(".").pop()}/${mv.state}`
          : null);

      return this.root.json({ ok: true, workspace: { id: workspaceId }, room, folder, mural: { id: mv.id, url: memberUrl, title: mv.title || "Reflexive Journal" } }, 200, cors);

    } catch (err) {
      const status = Number(err?.status) || 500;
      const body = err?.body || null;
      const message = String(err?.message || "setup_failed");
      return this.root.json({ ok: false, error: "setup_failed", step, message, upstream: body }, status, cors);
    }
  }

  /** NEW: GET /api/mural/find?uid=&projectName= */
  async muralFind(origin, url) {
    const cors = this.root.corsHeaders(origin);
    const uid = url.searchParams.get("uid") || "anon";
    const projectName = (url.searchParams.get("projectName") || "").trim();
    if (!projectName) return this.root.json({ ok: false, error: "projectName required" }, 400, cors);

    try {
      // Company gate
      const inCompany = await this.withToken(uid, (access) => verifyHomeOfficeByCompany(this.root.env, access));
      if (!inCompany) return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, cors);

      // Workspace + room
      const me = await this.withToken(uid, (access) => getMe(this.root.env, access));
      const configuredWsId = (this.root.env.MURAL_HOME_OFFICE_WORKSPACE_ID || "").trim();
      const activeWsId = getActiveWorkspaceIdFromMe(me);
      const workspaceId = configuredWsId || activeWsId;
      if (!workspaceId) return this.root.json({ ok: false, error: "no_workspace_id" }, 400, cors);

      const username = me?.value?.firstName || me?.value?.name || me?.name || "Private";
      const room = await this.withToken(uid, (access) => ensureUserRoom(this.root.env, access, workspaceId, username));

      // Find (do NOT create) the project folder, then list murals and search by title
      const folder = await this.withToken(uid, (access) => findProjectFolder(this.root.env, access, room.id, projectName));
      if (!folder?.id) return this.root.json({ ok: true, found: false }, 200, cors);

      const murals = await this.withToken(uid, (access) => listMuralsInFolder(this.root.env, access, folder.id));
      const list = Array.isArray(murals?.items) ? murals.items :
                   Array.isArray(murals?.value) ? murals.value :
                   Array.isArray(murals) ? murals : [];
      const target = list.find(m => String(m?.title || "").trim().toLowerCase() === "reflexive journal");

      if (!target) return this.root.json({ ok: true, found: false }, 200, cors);

      const mv = target?.value || target || {};
      const memberUrl =
        mv._canvasLink ||
        (mv.workspaceId && mv.id && mv.state
          ? `https://app.mural.co/t/${mv.workspaceId}/m/${mv.workspaceId}/${String(mv.id).split(".").pop()}/${mv.state}`
          : mv.url || null);

      return this.root.json({ ok: true, found: true, mural: { id: mv.id, url: memberUrl } }, 200, cors);
    } catch (err) {
      const status = Number(err?.status) || 500;
      return this.root.json({ ok: false, error: "find_failed", message: String(err?.message || "find_failed") }, status, cors);
    }
  }
}
