/**
 * @file service/internals/mural.js
 * @module service/internals/mural
 * @summary Mural routes logic (OAuth + provisioning + journal sync) with Airtable-backed board mapping.
 *
 * Airtable table expected: "Mural Boards" (override with env.AIRTABLE_TABLE_MURAL_BOARDS).
 *  - Project        (Link to "Projects" or Single line text)
 *  - UID            (Single line text)
 *  - Purpose        (Single select e.g., "reflexive_journal")
 *  - Mural ID       (Single line text)
 *  - Board URL      (URL)                [optional]
 *  - Workspace ID   (Single line text)   [optional]
 *  - Primary?       (Checkbox)           [optional, default false]
 *  - Active         (Checkbox)           [optional, default true]
 *  - Created At     (Created time)
 */

import {
  buildAuthUrl,
  exchangeAuthCode,
  refreshAccessToken,
  verifyHomeOfficeByCompany,
  ensureUserRoom,
  ensureProjectFolder,
  createMural,
  getMural,
  getMe,
  getWorkspace,
  getActiveWorkspaceIdFromMe,
  listUserWorkspaces,
  getWidgets,
  createSticky,
  updateSticky,
  ensureTagsBlueberry,
  applyTagsToSticky,
  normaliseWidgets,
  findLatestInCategory,
  getMuralLinks,
  createViewerLink
} from "../../lib/mural.js";

import { b64Encode, b64Decode } from "../../core/utils.js";

/** @typedef {import("../index.js").ResearchOpsService} ResearchOpsService */

const GRID_Y = 32;
const DEFAULT_W = 240;
const DEFAULT_H = 120;
const PURPOSE_REFLEXIVE = "reflexive_journal";

/** In-process soft cache (evicted on cold starts) */
const _memCache = new Map(); // key: `${projectId}·${uid||""}·${purpose}` → { muralId, boardUrl, workspaceId, ts, primary }

/* ───────────────────────── Airtable helpers ───────────────────────── */

function _airtableHeaders(env) {
  return {
    Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
    "Content-Type": "application/json"
  };
}

function _boardsTableName(env) {
  const override = typeof env.AIRTABLE_TABLE_MURAL_BOARDS === "string" ?
    env.AIRTABLE_TABLE_MURAL_BOARDS.trim() :
    "";
  return override || "Mural Boards";
}

function _encodeTableUrl(env, tableName) {
  return `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${encodeURIComponent(tableName)}`;
}

/** Escape double quotes for filterByFormula string literals */
function _esc(v) {
  return String(v ?? "").replace(/"/g, '\\"');
}

/** Normalise ALLOWED_ORIGINS (array or comma-separated string) and validate return URL origin. */
function _isAllowedReturn(env, urlStr) {
  try {
    const u = new URL(urlStr);
    const raw = env.ALLOWED_ORIGINS;
    const list = Array.isArray(raw) ?
      raw :
      String(raw || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
    return list.includes(`${u.protocol}//${u.host}`);
  } catch {
    return false;
  }
}

/* Airtable listing: filter by uid+purpose+active, then client-side by projectId */
function _buildBoardsFilter({ uid, purpose, active = true }) {
  const ands = [];
  if (uid) ands.push(`{UID} = "${_esc(uid)}"`);
  if (purpose) ands.push(`{Purpose} = "${_esc(purpose)}"`);
  if (typeof active === "boolean") ands.push(`{Active} = ${active ? "1" : "0"}`);
  return ands.length ? `AND(${ands.join(",")})` : "";
}

async function _airtableListBoards(env, { projectId, uid, purpose, active = true, max = 25 }) {
  const url = new URL(_encodeTableUrl(env, _boardsTableName(env)));
  const filterByFormula = _buildBoardsFilter({ uid, purpose, active });
  if (filterByFormula) url.searchParams.set("filterByFormula", filterByFormula);
  url.searchParams.set("maxRecords", String(max));
  url.searchParams.append("sort[0][field]", "Primary?");
  url.searchParams.append("sort[0][direction]", "desc");
  url.searchParams.append("sort[1][field]", "Created At");
  url.searchParams.append("sort[1][direction]", "desc");

  const res = await fetch(url.toString(), { headers: _airtableHeaders(env) });
  const js = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error("airtable_list_failed"), { status: res.status, body: js });
  }

  const records = Array.isArray(js.records) ? js.records : [];
  if (!projectId) return records;

  const pid = String(projectId);
  return records.filter(r => {
    const f = r?.fields || {};
    const proj = f["Project"];
    if (Array.isArray(proj)) return proj.includes(pid);
    return String(proj || "") === pid;
  });
}

async function _airtableCreateBoard(env, { projectId, uid, purpose, muralId, boardUrl = null, workspaceId = null, primary = false, active = true }) {
  const url = _encodeTableUrl(env, _boardsTableName(env));

  const mkBodyLinked = () => ({
    records: [{
      fields: {
        "Project": [{ id: String(projectId) }],
        "UID": uid,
        "Purpose": purpose,
        "Mural ID": muralId,
        "Board URL": boardUrl,
        "Workspace ID": workspaceId,
        "Primary?": !!primary,
        "Active": !!active
      }
    }]
  });

  const mkBodyText = () => ({
    records: [{
      fields: {
        "Project": String(projectId),
        "UID": uid,
        "Purpose": purpose,
        "Mural ID": muralId,
        "Board URL": boardUrl,
        "Workspace ID": workspaceId,
        "Primary?": !!primary,
        "Active": !!active
      }
    }]
  });

  let res = await fetch(url, { method: "POST", headers: _airtableHeaders(env), body: JSON.stringify(mkBodyLinked()) });
  let js = await res.json().catch(() => ({}));
  if (res.ok) return js;

  const errStr = JSON.stringify(js || {});
  if (res.status === 422 || /UNKNOWN_FIELD_NAME|INVALID_VALUE|FIELD_VALUE_INVALID/i.test(errStr)) {
    res = await fetch(url, { method: "POST", headers: _airtableHeaders(env), body: JSON.stringify(mkBodyText()) });
    js = await res.json().catch(() => ({}));
    if (res.ok) return js;
  }

  throw Object.assign(new Error("airtable_create_failed"), { status: res.status, body: js });
}

/* ───────────────────────── URL helpers ───────────────────────── */

function _looksLikeMuralViewerUrl(u) {
  try {
    const x = new URL(u);
    return x.hostname === "app.mural.co" && /^\/t\/[^/]+\/m\/[^/]+/i.test(x.pathname);
  } catch { return false; }
}

function _extractViewerUrl(payload) {
  if (!payload) return null;
  const candidates = [
    payload.viewerUrl,
    payload.viewLink,
    payload._canvasLink,
    payload.openUrl,
    payload?.value?.viewerUrl,
    payload?.value?.viewLink,
    payload?.data?.viewerUrl,
    payload?.data?.viewLink,
    payload?.links?.viewer,
    payload?.links?.open
  ].filter(Boolean);
  const first = candidates.find(_looksLikeMuralViewerUrl);
  return first || null;
}

/* Probe a viewer URL quickly */
async function _probeViewerUrl(env, accessToken, muralId) {
  try {
    const hydrated = await getMural(env, accessToken, muralId).catch(() => null);
    const url = _extractViewerUrl(hydrated);
    if (url) return url;
  } catch {}
  try {
    const links = await getMuralLinks(env, accessToken, muralId).catch(() => []);
    const best = links.find(l => _looksLikeMuralViewerUrl(l.url))
      || links.find(l => /viewer|view|open|public/i.test(String(l.type || "")) && l.url);
    if (best?.url && _looksLikeMuralViewerUrl(best.url)) return best.url;
  } catch {}
  try {
    const created = await createViewerLink(env, accessToken, muralId);
    if (created && _looksLikeMuralViewerUrl(created)) return created;
  } catch {}
  try {
    const hydrated2 = await getMural(env, accessToken, muralId).catch(() => null);
    const url2 = _extractViewerUrl(hydrated2);
    if (url2) return url2;
  } catch {}
  return null;
}

/* ───────────────────────── KV helpers ───────────────────────── */

async function _kvProjectMapping(env, { uid, projectId }) {
  const key = `mural:${uid || "anon"}:project:id::${String(projectId || "")}`;
  const raw = await env.SESSION_KV.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/* ───────────────────────── Workspace helpers ───────────────────────── */

function _workspaceCandidateShapes(entry) {
  if (!entry || typeof entry !== "object") return [];
  const shapes = [entry];
  if (entry.value && typeof entry.value === "object") shapes.push(entry.value);
  if (entry.workspace && typeof entry.workspace === "object") {
    shapes.push(entry.workspace);
    if (entry.workspace.value && typeof entry.workspace.value === "object") {
      shapes.push(entry.workspace.value);
    }
  }

  const seen = new Set();
  const candidates = [];

  for (const shape of shapes) {
    if (!shape || typeof shape !== "object" || seen.has(shape)) continue;
    seen.add(shape);
    const id = shape.id || shape.workspaceId || shape.workspaceID || null;
    const key = shape.key || shape.shortId || shape.workspaceKey || shape.slug || null;
    const name = shape.name || shape.title || shape.displayName || null;
    const companyId = shape.companyId || shape.company?.id || null;
    const shortId = shape.shortId || null;

    if (id || key || shortId) {
      candidates.push({ id, key, shortId, name, companyId });
    }
  }

  return candidates;
}

async function _resolveWorkspace(env, accessToken, { workspaceHint, companyId } = {}) {
  const hint = String(workspaceHint || "").trim();
  if (!hint) return null;

  const hintLower = hint.toLowerCase();

  try {
    const direct = await getWorkspace(env, accessToken, hint);
    const val = direct?.value || direct || {};
    return {
      id: val.id || val.workspaceId || hint,
      key: val.key || val.shortId || hint,
      name: val.name || val.title || val.displayName || null
    };
  } catch (err) {
    if (Number(err?.status || 0) && Number(err.status) !== 404) throw err;
  }

  const matches = [];
  let cursor = null;
  const maxPages = 4;

  for (let page = 0; page < maxPages; page += 1) {
    let payload;
    try {
      payload = await listUserWorkspaces(env, accessToken, { cursor });
    } catch (err) {
      if (Number(err?.status || 0) === 404) break;
      throw err;
    }

    const list = Array.isArray(payload?.value) ? payload.value :
      Array.isArray(payload?.workspaces) ? payload.workspaces : [];

    for (const entry of list) {
      matches.push(..._workspaceCandidateShapes(entry));
    }

    cursor = payload?.cursor ||
      payload?.nextCursor ||
      payload?.pagination?.nextCursor ||
      payload?.pagination?.next ||
      null;

    if (!cursor) break;
  }

  const matched = matches.find(cand => {
    const values = [cand.id, cand.key, cand.shortId]
      .filter(Boolean)
      .map(v => String(v).toLowerCase());
    return values.includes(hintLower);
  }) || matches.find(cand => {
    if (!companyId) return false;
    const cid = String(cand.companyId || "").toLowerCase();
    return Boolean(cid && cid === String(companyId).toLowerCase() && (cand.name || "").toLowerCase() === hintLower);
  });

  if (matched) {
    const idCandidate = matched.id || matched.key || matched.shortId || hint;
    try {
      const detail = await getWorkspace(env, accessToken, idCandidate);
      const val = detail?.value || detail || {};
      return {
        id: val.id || val.workspaceId || idCandidate,
        key: val.key || val.shortId || matched.key || matched.shortId || hint,
        name: val.name || val.title || val.displayName || matched.name || null
      };
    } catch (err) {
      if (Number(err?.status || 0) && Number(err.status) !== 404) throw err;
      return {
        id: idCandidate,
        key: matched.key || matched.shortId || idCandidate,
        name: matched.name || null
      };
    }
  }

  if (companyId) {
    const composite = `${String(companyId).trim()}:${hint}`;
    try {
      const detail = await getWorkspace(env, accessToken, composite);
      const val = detail?.value || detail || {};
      return {
        id: val.id || val.workspaceId || composite,
        key: val.key || val.shortId || hint,
        name: val.name || val.title || val.displayName || null
      };
    } catch (err) {
      if (Number(err?.status || 0) && Number(err.status) !== 404) throw err;
    }
  }

  return { id: hint, key: hint };
}

/* ───────────────────────── Shape helpers ───────────────────────── */

function _pickId(obj) {
  return obj?.id ||
    obj?.roomId ||
    obj?.folderId ||
    obj?.value?.id ||
    obj?.data?.id ||
    null;
}

/* ───────────────────────── Class ───────────────────────── */

export class MuralServicePart {
  /** @param {ResearchOpsService} root */
  constructor(root) { this.root = root; }

  // KV tokens
  kvKey(uid) { return `mural:${uid}:tokens`; }
  async saveTokens(uid, tokens) { await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(tokens), { encryption: true }); }
  async loadTokens(uid) { const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid)); return raw ? JSON.parse(raw) : null; }

  async _ensureWorkspace(env, accessToken, explicitWorkspaceId) {
    const inCompany = await verifyHomeOfficeByCompany(env, accessToken);
    if (!inCompany) throw Object.assign(new Error("not_in_home_office_workspace"), { code: 403 });

    if (explicitWorkspaceId) {
      try {
        const ws = await getWorkspace(env, accessToken, explicitWorkspaceId);
        const v = ws?.value || ws || {};
        return { id: v.id || explicitWorkspaceId, key: v.key || v.shortId || null, name: v.name || null };
      } catch { /* fall back */ }
    }

    const me = await getMe(env, accessToken);
    const wsHint = getActiveWorkspaceIdFromMe(me);
    if (!wsHint) throw new Error("no_active_workspace");

    const companyId = me?.value?.companyId || me?.companyId || null;
    const resolved = await _resolveWorkspace(env, accessToken, { workspaceHint: wsHint, companyId });
    if (!resolved?.id) return { id: wsHint, key: wsHint };

    return { id: resolved.id, key: resolved.key || null, name: resolved.name || null };
  }

  async resolveBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, explicitMuralId }) {
    if (explicitMuralId) return { muralId: String(explicitMuralId) };

    if (projectId) {
      const cacheKey = `${projectId}·${uid || ""}·${purpose}`;
      const cached = _memCache.get(cacheKey);
      if (cached && (Date.now() - cached.ts < 60_000)) {
        return { muralId: cached.muralId, boardUrl: cached.boardUrl, workspaceId: cached.workspaceId };
      }

      const rows = await _airtableListBoards(this.root.env, { projectId, uid, purpose, active: true, max: 25 });
      const top = rows[0];
      if (top?.fields) {
        const f = top.fields;
        const rec = {
          muralId: String(f["Mural ID"] || ""),
          boardUrl: f["Board URL"] || null,
          workspaceId: f["Workspace ID"] || null,
          primary: !!f["Primary?"]
        };
        if (rec.muralId) {
          _memCache.set(cacheKey, { ...rec, ts: Date.now() });
          return rec;
        }
      }

      const kv = await _kvProjectMapping(this.root.env, { uid, projectId });
      if (kv?.url) {
        if (_looksLikeMuralViewerUrl(kv.url)) {
          return { muralId: null, boardUrl: kv.url, workspaceId: null };
        } else {
          try {
            const key = `mural:${uid || "anon"}:project:id::${String(projectId)}`;
            await this.root.env.SESSION_KV.delete(key);
          } catch { /* ignore */ }
        }
      }
    }

    const envId = this.root?.env?.MURAL_REFLEXIVE_MURAL_ID;
    if (envId) {
      this.root.log?.warn?.("mural.deprecated_env_id", { note: "Migrate to Airtable 'Mural Boards'." });
      return { muralId: String(envId) };
    }

    return null;
  }

  async registerBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, muralId, boardUrl = null, workspaceId = null, primary = true }) {
    if (!projectId || !uid || !muralId) return { ok: false, error: "missing_fields" };
    await _airtableCreateBoard(this.root.env, { projectId, uid, purpose, muralId, boardUrl, workspaceId, primary, active: true });
    const cacheKey = `${projectId}·${uid}·${purpose}`;
    _memCache.set(cacheKey, { muralId, boardUrl, workspaceId, ts: Date.now(), primary: !!primary });
    return { ok: true };
  }

  async _getValidAccessToken(uid) {
    const tokens = await this.loadTokens(uid);
    if (!tokens?.access_token) return { ok: false, reason: "not_authenticated" };

    let accessToken = tokens.access_token;
    try {
      await verifyHomeOfficeByCompany(this.root.env, accessToken);
      return { ok: true, token: accessToken };
    } catch (err) {
      const status = Number(err?.status || 0);
      if (status === 401 && tokens.refresh_token) {
        try {
          const refreshed = await refreshAccessToken(this.root.env, tokens.refresh_token);
          const merged = { ...tokens, ...refreshed };
          await this.saveTokens(uid, merged);
          accessToken = merged.access_token;

          await verifyHomeOfficeByCompany(this.root.env, accessToken);
          return { ok: true, token: accessToken };
        } catch {
          return { ok: false, reason: "not_authenticated" };
        }
      }
      return { ok: false, reason: "error" };
    }
  }

  /* ───────────────────────── Routes ───────────────────────── */

  async muralAuth(origin, url) {
    const uid = url.searchParams.get("uid") || "anon";
    const ret = url.searchParams.get("return") || "";
    let safeReturn = "/pages/projects/";

    if (ret && _isAllowedReturn(this.root.env, ret)) {
      safeReturn = ret; // absolute + allowed
    } else if (ret.startsWith("/")) {
      safeReturn = ret; // relative path
    }

    const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
    const redirect = buildAuthUrl(this.root.env, state);
    return Response.redirect(redirect, 302);
  }

  async muralCallback(origin, url) {
    const { env } = this.root;

    if (!env.MURAL_CLIENT_SECRET) {
      return this.root.json({
        ok: false,
        error: "missing_secret",
        message: "MURAL_CLIENT_SECRET is not configured in Cloudflare secrets."
      }, 500, this.root.corsHeaders(origin));
    }

    const code = url.searchParams.get("code");
    const stateB64 = url.searchParams.get("state");
    if (!code) {
      const fallback = "/pages/projects/";
      return Response.redirect(fallback + "#mural-auth-missing-code", 302);
    }

    let uid = "anon";
    let stateObj = {};
    try {
      stateObj = JSON.parse(b64Decode(stateB64 || ""));
      uid = stateObj?.uid || "anon";
    } catch { /* ignore */ }

    let tokens;
    try {
      tokens = await exchangeAuthCode(env, code);
    } catch (err) {
      const want = stateObj?.return || "/pages/projects/";
      return Response.redirect(`${want}#mural-token-exchange-failed`, 302);
    }

    await this.saveTokens(uid, tokens);

    const want = stateObj?.return || "/pages/projects/";
    let backUrl;
    if (want.startsWith("http")) {
      backUrl = _isAllowedReturn(env, want) ? new URL(want) : new URL("/pages/projects/", url);
    } else {
      backUrl = new URL(want, url);
    }

    const sp = new URLSearchParams(backUrl.search);
    sp.set("mural", "connected");
    backUrl.search = sp.toString();

    return Response.redirect(backUrl.toString(), 302);
  }

  /** POST /api/mural/setup  body: { uid, projectId?, projectName, workspaceId? } */
  async muralSetup(request, origin) {
    const cors = this.root.corsHeaders(origin);
    let step = "parse_input";

    try {
      const { uid = "anon", projectId = null, projectName, workspaceId: wsOverride } = await request.json().catch(() => ({}));
      if (!projectName || !String(projectName).trim()) {
        return this.root.json({ ok: false, error: "projectName required" }, 400, cors);
      }

      step = "load_tokens";
      const tokens = await this.loadTokens(uid);
      if (!tokens?.access_token) {
        return this.root.json({ ok: false, reason: "not_authenticated" }, 401, cors);
      }

      step = "verify_workspace";
      let accessToken = tokens.access_token;
      let ws;
      try {
        ws = await this._ensureWorkspace(this.root.env, accessToken, wsOverride);
      } catch (err) {
        const code = Number(err?.status || err?.code || 0);
        if (code === 401 && tokens.refresh_token) {
          const refreshed = await refreshAccessToken(this.root.env, tokens.refresh_token);
          const merged = { ...tokens, ...refreshed };
          await this.saveTokens(uid, merged);
          accessToken = merged.access_token;
          ws = await this._ensureWorkspace(this.root.env, accessToken, wsOverride);
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
      let room;
      try {
        room = await ensureUserRoom(this.root.env, accessToken, ws.id, username);
      } catch (e) {
        if (e?.code === "no_existing_room" || Number(e?.status) === 409) {
          return this.root.json({
            ok: false,
            error: "no_existing_room",
            step,
            message: "No existing room found in your Mural workspace. Create a private room in Mural, then try again."
          }, 409, cors);
        }
        throw e;
      }
      const roomId = _pickId(room);
      if (!roomId) {
        this.root.log?.error?.("mural.ensure_room.no_id", { roomPreview: typeof room === "object" ? Object.keys(room || {}) : room });
        return this.root.json({
          ok: false,
          error: "room_id_unavailable",
          step,
          message: "Could not resolve a room id from Mural response"
        }, 502, cors);
      }

      step = "ensure_folder";
      let folder = await ensureProjectFolder(this.root.env, accessToken, roomId, String(projectName).trim());
      const folderId = _pickId(folder);

      step = "create_mural";
      const mural = await createMural(this.root.env, accessToken, {
        title: "Reflexive Journal",
        roomId,
        folderId: folderId || undefined
      });

      // Best-effort quick probe (keep short!)
      step = "probe_viewer_url";
      let openUrl = null;
      const softDeadline = Date.now() + 9000;
      while (!openUrl && Date.now() < softDeadline) {
        openUrl = await _probeViewerUrl(this.root.env, accessToken, mural.id);
        if (openUrl) break;
        await new Promise(r => setTimeout(r, 600));
      }

      if (openUrl && projectId) {
        try {
          await this.registerBoard({
            projectId: String(projectId),
            uid,
            purpose: PURPOSE_REFLEXIVE,
            muralId: mural.id,
            boardUrl: openUrl,
            workspaceId: ws.id,
            primary: true
          });
        } catch (e) {
          this.root.log?.error?.("mural.airtable_register_failed", { status: e?.status, body: e?.body });
        }
        try {
          const kvKey = `mural:${uid}:project:id::${String(projectId)}`;
          await this.root.env.SESSION_KV.put(kvKey, JSON.stringify({
            url: openUrl,
            projectName: projectName,
            updatedAt: Date.now()
          }));
        } catch {}
      }

      // If link is ready, return 200 with link; if not, return 202 with pending=true
      if (openUrl) {
        return this.root.json({
          ok: true,
          workspace: ws,
          room,
          folder,
          mural: { ...mural, viewLink: openUrl },
          projectId: projectId || null,
          registered: Boolean(projectId),
          boardUrl: openUrl
        }, 200, cors);
      }

      return this.root.json({
        ok: true,
        pending: true,
        step,
        muralId: mural.id,
        workspace: ws,
        room,
        folder,
        projectId: projectId || null
      }, 202, cors);

    } catch (err) {
      const status = Number(err?.status) || 500;
      const body = err?.body || null;
      const message = String(err?.message || "setup_failed");
      return this.root.json({ ok: false, error: "setup_failed", step, message, upstream: body }, status, cors);
    }
  }

  /**
   * GET /api/mural/await?muralId=...&projectId=...&uid=...
   * Short, server-side attempt to obtain a real viewer URL and register mapping.
   */
  async muralAwait(origin, url) {
    const cors = this.root.corsHeaders(origin);
    const muralId = url.searchParams.get("muralId") || "";
    const projectId = url.searchParams.get("projectId") || "";
    const uid = url.searchParams.get("uid") || "anon";
    if (!muralId) {
      return this.root.json({ ok: false, error: "missing_muralId" }, 400, cors);
    }

    const tokenRes = await this._getValidAccessToken(uid);
    if (!tokenRes.ok) {
      const code = tokenRes.reason === "not_authenticated" ? 401 : 500;
      return this.root.json({ ok: false, error: tokenRes.reason }, code, cors);
    }
    const accessToken = tokenRes.token;

    const deadline = Date.now() + 8000;
    let openUrl = null;
    while (!openUrl && Date.now() < deadline) {
      openUrl = await _probeViewerUrl(this.root.env, accessToken, muralId);
      if (openUrl) break;
      await new Promise(r => setTimeout(r, 600));
    }

    if (!openUrl) {
      return this.root.json({ ok: true, pending: true }, 202, cors);
    }

    if (projectId) {
      try {
        await this.registerBoard({
          projectId: String(projectId),
          uid,
          purpose: PURPOSE_REFLEXIVE,
          muralId,
          boardUrl: openUrl,
          workspaceId: null,
          primary: true
        });
      } catch (e) {
        this.root.log?.error?.("mural.airtable_register_failed", { status: e?.status, body: e?.body });
      }
      try {
        const kvKey = `mural:${uid}:project:id::${String(projectId)}`;
        await this.root.env.SESSION_KV.put(kvKey, JSON.stringify({
          url: openUrl,
          projectName: "",
          updatedAt: Date.now()
        }));
      } catch {}
    }

    return this.root.json({ ok: true, boardUrl: openUrl, muralId }, 200, cors);
  }

  async muralResolve(origin, url) {
    const cors = this.root.corsHeaders(origin);
    try {
      const projectId = url.searchParams.get("projectId") || "";
      const uid = url.searchParams.get("uid") || "";
      const purpose = url.searchParams.get("purpose") || PURPOSE_REFLEXIVE;

      if (!projectId) {
        return this.root.json({ ok: false, error: "missing_projectId" }, 400, cors);
      }

      const resolved = await this.resolveBoard({ projectId, uid: uid || undefined, purpose });
      if (!resolved?.muralId && !resolved?.boardUrl) {
        return this.root.json({ ok: false, error: "not_found" }, 404, cors);
      }
      return this.root.json({
        ok: true,
        muralId: resolved.muralId || null,
        boardUrl: resolved.boardUrl || null
      }, 200, cors);
    } catch (e) {
      const msg = String(e?.message || e || "");
      return this.root.json({ ok: false, error: "resolve_failed", detail: msg }, 500, cors);
    }
  }

  async muralJournalSync(request, origin) {
    const cors = this.root.corsHeaders(origin);
    let step = "parse_input";

    try {
      const body = await request.json().catch(() => ({}));
      const uid = String(body?.uid || "anon");
      const purpose = String(body?.purpose || PURPOSE_REFLEXIVE);
      const category = String(body?.category || "").toLowerCase().trim();
      const description = String(body?.description || "").trim();
      const labels = Array.isArray(body?.tags) ? body.tags.filter(Boolean) : [];

      if (!category || !description) {
        return this.root.json({ ok: false, error: "missing_category_or_description" }, 400, cors);
      }
      if (!["perceptions", "procedures", "decisions", "introspections"].includes(category)) {
        return this.root.json({ ok: false, error: "unsupported_category" }, 400, cors);
      }

      step = "resolve_board";
      const resolved = await this.resolveBoard({
        projectId: body.projectId,
        uid: uid || undefined,
        purpose,
        explicitMuralId: body.muralId
      });
      const muralId = resolved?.muralId || null;
      if (!muralId) {
        return this.root.json({
          ok: false,
          error: "no_mural_id",
          message: "No board found for (projectId[, uid], purpose) and no explicit muralId provided."
        }, 404, cors);
      }

      step = "access_token";
      const tokenRes = await this._getValidAccessToken(uid);
      if (!tokenRes.ok) {
        const code = tokenRes.reason === "not_authenticated" ? 401 : 500;
        return this.root.json({ ok: false, error: tokenRes.reason }, code, cors);
      }
      const accessToken = tokenRes.token;

      step = "load_widgets";
      const widgetsJs = await getWidgets(this.root.env, accessToken, muralId);
      const stickyList = normaliseWidgets(widgetsJs?.widgets);
      const last = findLatestInCategory(stickyList, category);

      let stickyId = null;
      let action = "";
      let targetX = last?.x ?? 200;
      let targetY = last?.y ?? 200;
      let targetW = last?.width ?? DEFAULT_W;
      let targetH = last?.height ?? DEFAULT_H;

      step = "write_or_create";
      if (last && (last.text || "").trim().length === 0) {
        await updateSticky(this.root.env, accessToken, muralId, last.id, { text: description });
        stickyId = last.id;
        action = "updated-empty-sticky";
      } else {
        if (last) {
          targetY = (last.y || 0) + (last.height || DEFAULT_H) + GRID_Y;
          targetX = last.x || targetX;
          targetW = last.width || targetW;
          targetH = last.height || targetH;
        }
        const crt = await createSticky(this.root.env, accessToken, muralId, {
          text: description,
          x: Math.round(targetX),
          y: Math.round(targetY),
          width: Math.round(targetW),
          height: Math.round(targetH)
        });
        stickyId = crt?.id || null;
        action = "created-new-sticky";
      }

      step = "tagging";
      if (labels.length && stickyId) {
        const tagIds = await ensureTagsBlueberry(this.root.env, accessToken, muralId, labels);
        if (tagIds.length) {
          await applyTagsToSticky(this.root.env, accessToken, muralId, stickyId, tagIds);
        }
      }

      return this.root.json({ ok: true, stickyId, action, muralId }, 200, cors);

    } catch (err) {
      const status = Number(err?.status) || 500;
      const body = err?.body || null;
      const message = String(err?.message || "journal_sync_failed");
      return this.root.json({ ok: false, error: "journal_sync_failed", step, message, upstream: body }, status, cors);
    }
  }

  async muralDebugEnv(origin) {
    const env = this.root.env || {};
    return this.root.json({
      ok: true,
      has_CLIENT_ID: Boolean(env.MURAL_CLIENT_ID),
      has_CLIENT_SECRET: Boolean(env.MURAL_CLIENT_SECRET),
      redirect_uri: env.MURAL_REDIRECT_URI || "(unset)",
      scopes: env.MURAL_SCOPES || "(default)",
      company_id: env.MURAL_COMPANY_ID || "(unset)",
      airtable_base: Boolean(env.AIRTABLE_BASE_ID),
      airtable_key: Boolean(env.AIRTABLE_API_KEY)
    }, 200, this.root.corsHeaders(origin));
  }

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
