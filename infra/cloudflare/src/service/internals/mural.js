/**
 * @file lib/mural.js
 * @module mural
 * @summary Mural OAuth + API helpers (pure functions; no routing).
 *
 * ENV required:
 * - MURAL_CLIENT_ID
 * - MURAL_CLIENT_SECRET
 * - MURAL_REDIRECT_URI  (must exactly match your registered redirect URI in Mural)
 * - (optional) MURAL_COMPANY_ID                     // e.g. "homeofficegovuk"
 * - (optional) MURAL_API_BASE   default: https://app.mural.co/api/public/v1
 * - (optional) MURAL_SCOPES     default: identity:read workspaces:read rooms:read rooms:write murals:write
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const API_TIMEOUT_MS = 15000;

// Default scopes; can be overridden by env.MURAL_SCOPES (space-separated)
export const DEFAULT_SCOPES = [
  "identity:read",
  "workspaces:read",
  "rooms:read",
  "rooms:write",
  "murals:write"
];

/* ------------------------------------------------------------------ */
/* Base URLs                                                          */
/* ------------------------------------------------------------------ */

const apiBase = (env) => env.MURAL_API_BASE || "https://app.mural.co/api/public/v1";
const oauthBase = "https://app.mural.co/api/public/v1/authorization/oauth2";

/* ------------------------------------------------------------------ */
/* Helpers: state encode/decode                                       */
/* ------------------------------------------------------------------ */

export function encodeState(obj) {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); } catch { return ""; }
}

export function decodeState(str) {
  try { return JSON.parse(decodeURIComponent(escape(atob(str)))); } catch { return {}; }
}

/* ------------------------------------------------------------------ */
/* OAuth2: Authorization URL builder                                  */
/* ------------------------------------------------------------------ */

export function buildAuthUrl(env, stateObj) {
  const state = encodeState(stateObj);
  const scopes = (env.MURAL_SCOPES || DEFAULT_SCOPES.join(" ")).trim();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.MURAL_CLIENT_ID,
    redirect_uri: env.MURAL_REDIRECT_URI,
    scope: scopes,
    state
  });
  // Correct endpoint: no "/authorize" suffix
  return `${oauthBase}/?${params}`;
}

/* ------------------------------------------------------------------ */
/* JSON + Fetch helpers                                               */
/* ------------------------------------------------------------------ */

async function fetchJSON(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const txt = await res.text();
    let js = {};
    try { js = txt ? JSON.parse(txt) : {}; } catch { js = {}; }
    if (!res.ok) {
      const err = new Error(js?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = js;
      throw err;
    }
    return js;
  } finally {
    clearTimeout(t);
  }
}

const withBearer = (token) => ({
  headers: { ...JSON_HEADERS, authorization: `Bearer ${token}` }
});

/* Normalise list payloads that may come as {items}, {value}, or [] */
function _asArray(x) {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.items)) return x.items;
  if (Array.isArray(x?.value)) return x.value;
  return [];
}

/* ------------------------------------------------------------------ */
/* OAuth2: Token exchange / refresh                                   */
/* ------------------------------------------------------------------ */

export async function exchangeAuthCode(env, code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.MURAL_REDIRECT_URI,
    client_id: env.MURAL_CLIENT_ID,
    client_secret: env.MURAL_CLIENT_SECRET
  });
  const res = await fetch(`${apiBase(env)}/authorization/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  const js = await res.json();
  if (!res.ok) throw new Error(js?.error_description || "Token exchange failed");
  return js; // { access_token, refresh_token?, token_type, expires_in }
}

/** Refresh an expired access token using the refresh_token. */
export async function refreshAccessToken(env, refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.MURAL_CLIENT_ID,
    client_secret: env.MURAL_CLIENT_SECRET
  });
  const res = await fetch(`${apiBase(env)}/authorization/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  const js = await res.json();
  if (!res.ok) throw new Error(js?.error_description || "Token refresh failed");
  return js; // { access_token, refresh_token?, expires_in, token_type }
}

/* ------------------------------------------------------------------ */
/* User profile + helpers                                             */
/* ------------------------------------------------------------------ */

export async function getMe(env, token) {
  return fetchJSON(`${apiBase(env)}/users/me`, withBearer(token));
}

export function getActiveWorkspaceIdFromMe(me) {
  return me?.value?.lastActiveWorkspace || me?.lastActiveWorkspace || null;
}

/**
 * Company (tenant) membership check.
 * True if the current user belongs to the expected company.
 * - robust against stray whitespace and case differences.
 */
export async function verifyHomeOfficeByCompany(env, token) {
  const me = await getMe(env, token);
  const v = me?.value || me || {};
  const cid = String(v.companyId || "").trim().toLowerCase();
  const cname = String(v.companyName || "").trim().toLowerCase();

  const targetCompanyId = String(env.MURAL_COMPANY_ID || "").trim().toLowerCase(); // e.g. "homeofficegovuk"
  if (targetCompanyId) return Boolean(cid) && cid === targetCompanyId;

  // Fallback by name if you don't want to set MURAL_COMPANY_ID
  return Boolean(cname && /home\s*office/.test(cname));
}

/* ------------------------------------------------------------------ */
/* Rooms + Folders + Murals                                           */
/* ------------------------------------------------------------------ */

export async function listRooms(env, token, workspaceId) {
  return fetchJSON(`${apiBase(env)}/workspaces/${workspaceId}/rooms`, withBearer(token));
}

export async function createRoom(env, token, { name, workspaceId, visibility = "private" }) {
  return fetchJSON(`${apiBase(env)}/rooms`, {
    method: "POST",
    ...withBearer(token),
    body: JSON.stringify({ name, workspaceId, visibility })
  });
}

export async function ensureUserRoom(env, token, workspaceId, username = "Private") {
  const rooms = await listRooms(env, token, workspaceId).catch(() => ({ items: [], value: [] }));
  const list = _asArray(rooms);

  let room = list.find(r =>
    /(private)/i.test(r.visibility || "") ||
    (username && (r.name || "").toLowerCase().includes(String(username).toLowerCase()))
  );

  if (!room) {
    room = await createRoom(env, token, {
      name: `${username} — Private`,
      workspaceId,
      visibility: "private"
    });
  }
  return room;
}

export async function listFolders(env, token, roomId) {
  return fetchJSON(`${apiBase(env)}/rooms/${roomId}/folders`, withBearer(token));
}

export async function createFolder(env, token, roomId, name) {
  return fetchJSON(`${apiBase(env)}/rooms/${roomId}/folders`, {
    method: "POST",
    ...withBearer(token),
    body: JSON.stringify({ name })
  });
}

export async function ensureProjectFolder(env, token, roomId, projectName) {
  const existing = await listFolders(env, token, roomId).catch(() => ({ items: [], value: [] }));
  const list = _asArray(existing);
  const found = list.find(f =>
    (f.name || "").trim().toLowerCase() === String(projectName).trim().toLowerCase()
  );
  if (found) return found;
  return createFolder(env, token, roomId, projectName);
}

export async function createMural(env, token, { title, roomId, folderId }) {
  // Keep payload minimal & compliant; avoid unsupported fields.
  return fetchJSON(`${apiBase(env)}/murals`, {
    method: "POST",
    ...withBearer(token),
    body: JSON.stringify({ title, roomId, folderId })
  });
}

/* ------------------------------------------------------------------ */
/* Widgets + Tags (for Reflexive Journal sync)                        */
/* ------------------------------------------------------------------ */

/**
 * Fetch widgets in a mural.
 * Tries the canonical endpoint and falls back to a common variant if needed.
 */
export async function getWidgets(env, token, muralId) {
  // Canonical
  const urlA = `${apiBase(env)}/murals/${muralId}/widgets`;
  try {
    return await fetchJSON(urlA, withBearer(token));
  } catch (e) {
    // Some tenants expose a slightly different path; try a safe fallback once
    const urlB = `${apiBase(env)}/murals/${muralId}/content/widgets`;
    if (Number(e?.status) === 404) {
      return await fetchJSON(urlB, withBearer(token));
    }
    throw e;
  }
}

/**
 * Create a sticky note.
 * Mural commonly supports POST /murals/{id}/widgets with type "sticky_note".
 * Some older variants expose /widgets/sticky-notes.
 */
export async function createSticky(env, token, muralId, { text, x, y, width, height, color }) {
  const payload = {
    type: "sticky_note",
    text: String(text || ""),
    position: { x: Number(x || 0), y: Number(y || 0) },
    size: { width: Number(width || 240), height: Number(height || 120) },
    // colour is optional; omit if not provided to avoid 422s on strict schemas
    ...(color ? { color } : {})
  };

  const urlA = `${apiBase(env)}/murals/${muralId}/widgets`;
  try {
    return await fetchJSON(urlA, {
      method: "POST",
      ...withBearer(token),
      body: JSON.stringify(payload)
    });
  } catch (e) {
    if (Number(e?.status) === 404) {
      // Fallback endpoint used by some versions
      const urlB = `${apiBase(env)}/murals/${muralId}/widgets/sticky-notes`;
      return await fetchJSON(urlB, {
        method: "POST",
        ...withBearer(token),
        body: JSON.stringify({
          text: payload.text,
          x: payload.position.x,
          y: payload.position.y,
          width: payload.size.width,
          height: payload.size.height,
          ...(color ? { color } : {})
        })
      });
    }
    throw e;
  }
}

/** Patch a sticky by id (text and/or geometry). */
export async function updateSticky(env, token, muralId, widgetId, patch) {
  // Accept either flat {text, x, y, width, height} or {text, position:{}, size:{}}
  const body = {};
  if (typeof patch?.text === "string") body.text = patch.text;

  const hasFlatGeom = ["x","y","width","height"].some(k => k in (patch||{}));
  if (hasFlatGeom) {
    body.position = {
      x: Number(patch.x ?? 0),
      y: Number(patch.y ?? 0)
    };
    body.size = {
      width: Number(patch.width ?? 240),
      height: Number(patch.height ?? 120)
    };
  } else {
    if (patch?.position) body.position = { x: Number(patch.position.x||0), y: Number(patch.position.y||0) };
    if (patch?.size) body.size = { width: Number(patch.size.width||240), height: Number(patch.size.height||120) };
  }

  const url = `${apiBase(env)}/murals/${muralId}/widgets/${widgetId}`;
  return fetchJSON(url, {
    method: "PATCH",
    ...withBearer(token),
    body: JSON.stringify(body)
  });
}

/** Get all tags in a mural. */
export async function getTags(env, token, muralId) {
  const url = `${apiBase(env)}/murals/${muralId}/tags`;
  return fetchJSON(url, withBearer(token));
}

/** Create a tag in a mural (returns created tag). */
export async function createTag(env, token, muralId, name, colorName = "Blueberry") {
  const url = `${apiBase(env)}/murals/${muralId}/tags`;
  // Many tenants accept name + color. If your tenant requires hex, adapt here.
  const payload = { name: String(name), color: colorName };
  return fetchJSON(url, {
    method: "POST",
    ...withBearer(token),
    body: JSON.stringify(payload)
  });
}

/**
 * Ensure a set of tags exist with the Mural colour “Blueberry”.
 * Returns an array of tag ids in the same order as `names`.
 */
export async function ensureTagsBlueberry(env, token, muralId, names) {
  const want = (Array.isArray(names) ? names : []).map(s => String(s).trim()).filter(Boolean);
  if (!want.length) return [];

  const existing = _asArray(await getTags(env, token, muralId));
  const byName = Object.create(null);
  for (const t of existing) {
    const n = String(t?.name || "").trim().toLowerCase();
    if (n) byName[n] = t;
  }

  const outIds = [];
  for (const nm of want) {
    const key = nm.toLowerCase();
    if (byName[key]) {
      outIds.push(byName[key].id);
      continue;
    }
    const created = await createTag(env, token, muralId, nm, "Blueberry");
    outIds.push(created?.id);
  }
  return outIds.filter(Boolean);
}

/** Apply an array of tag ids to a widget. */
export async function applyTagsToSticky(env, token, muralId, widgetId, tagIds) {
  const ids = (Array.isArray(tagIds) ? tagIds : []).filter(Boolean);
  if (!ids.length) return { ok: true, applied: 0 };

  // Common endpoint: PUT widget tags with { tagIds: [...] }
  const urlA = `${apiBase(env)}/murals/${muralId}/widgets/${widgetId}/tags`;
  try {
    return await fetchJSON(urlA, {
      method: "PUT",
      ...withBearer(token),
      body: JSON.stringify({ tagIds: ids })
    });
  } catch (e) {
    if (Number(e?.status) === 404) {
      // Fallback: POST add tags (tenant variant)
      const urlB = `${apiBase(env)}/murals/${muralId}/widgets/${widgetId}/tags/add`;
      return await fetchJSON(urlB, {
        method: "POST",
        ...withBearer(token),
        body: JSON.stringify({ tagIds: ids })
      });
    }
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Normalisers + heuristics                                           */
/* ------------------------------------------------------------------ */

/**
 * normaliseWidgets: flattens raw widgets to a compact sticky array.
 * We only keep stickies; other widget types are ignored for journal sync.
 * Attempts to pick up tags and geometry across API variants.
 */
export function normaliseWidgets(raw) {
  const arr = _asArray(raw);
  const out = [];
  for (const w of arr) {
    const type = (w?.type || w?.widgetType || "").toLowerCase();
    if (!/sticky/.test(type)) continue;

    // geometry variants
    const pos = w.position || {};
    const size = w.size || {};
    const geom = {
      x: Number(pos.x ?? w.x ?? 0),
      y: Number(pos.y ?? w.y ?? 0),
      width: Number(size.width ?? w.width ?? 240),
      height: Number(size.height ?? w.height ?? 120)
    };

    // timestamps (best-effort)
    const createdAt = w.createdAt || w.created_at || w.createdTime || null;
    const updatedAt = w.updatedAt || w.updated_at || null;

    // tags (either names or objects)
    let tags = [];
    if (Array.isArray(w.tags)) {
      tags = w.tags.map(t => (typeof t === "string" ? t : (t?.name || t?.label || ""))).filter(Boolean);
    } else if (Array.isArray(w.labels)) {
      tags = w.labels.map(t => (typeof t === "string" ? t : (t?.name || t?.label || ""))).filter(Boolean);
    }

    out.push({
      id: w.id,
      type: "sticky_note",
      text: String(w.text || w.content || w.note || "").trim(),
      tags,
      createdAt,
      updatedAt,
      ...geom
    });
  }
  return out;
}

/**
 * findLatestInCategory:
 * Strategy:
 * 1) prefer stickies whose tags include the category name (case-insensitive).
 * 2) among matches, prefer most recent by updatedAt, then createdAt.
 * 3) fallback by largest y (visual “latest” down the column).
 */
export function findLatestInCategory(stickies, category) {
  const list = Array.isArray(stickies) ? stickies : [];
  const cat = String(category || "").trim().toLowerCase();
  if (!cat) return null;

  const matches = list.filter(s => {
    const tagHit = (Array.isArray(s.tags) ? s.tags : []).some(t => String(t).trim().toLowerCase() === cat);
    return tagHit;
  });

  const pool = matches.length ? matches : list; // if no tag match, consider all (best-effort)

  function tsOf(s) {
    const u = s.updatedAt ? Date.parse(s.updatedAt) : NaN;
    const c = s.createdAt ? Date.parse(s.createdAt) : NaN;
    if (!Number.isNaN(u)) return u;
    if (!Number.isNaN(c)) return c;
    return null;
  }

  let best = null;
  for (const s of pool) {
    if (!best) { best = s; continue; }
    const a = tsOf(s);
    const b = tsOf(best);
    if (a != null && b != null) {
      if (a > b) best = s;
      continue;
    }
    if (a != null && b == null) { best = s; continue; }
    // fallback by y (lower is earlier, higher is later)
    if ((s.y || 0) > (best.y || 0)) best = s;
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Export internals (for tests/debug)                                  */
/* ------------------------------------------------------------------ */

export const _int = { fetchJSON, withBearer, apiBase, encodeState, decodeState };
