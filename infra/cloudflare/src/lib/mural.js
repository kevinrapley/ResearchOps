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
 *
 * Also exports low-level Widgets/Tags utilities for server-side orchestration:
 *  - getWidgets(env, token, muralId)
 *  - createSticky(env, token, muralId, init)
 *  - updateSticky(env, token, muralId, widgetId, patch)
 *  - listTags(env, token, muralId)
 *  - createTag(env, token, muralId, { text, color })
 *  - updateTag(env, token, muralId, tagId, patch)
 *  - ensureTagsBlueberry(env, token, muralId, labels[])
 *  - applyTagsToSticky(env, token, muralId, widgetId, tagIds[])
 *  - normaliseWidgets(widgets[])
 *  - sortNewestFirst(a, b)
 *  - findLatestInCategory(stickies[], category)
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const API_TIMEOUT_MS = 15000;

// Defaults for visual/layout fallbacks in normalisers
const DEFAULT_W = 240;
const DEFAULT_H = 120;
const TAG_COLOUR = "blueberry";

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
    const js = txt ? JSON.parse(txt) : {};
    if (!res.ok) {
      const err = new Error(js?.message || `HTTP ${res.status}`);
      // annotate for our callers
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
  const list = Array.isArray(rooms?.items) ? rooms.items :
    Array.isArray(rooms?.value) ? rooms.value :
    Array.isArray(rooms) ? rooms : [];

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
  const list = Array.isArray(existing?.items) ? existing.items :
    Array.isArray(existing?.value) ? existing.value :
    Array.isArray(existing) ? existing : [];
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
/* Widgets (sticky notes) + Tags (Blueberry)                          */
/* ------------------------------------------------------------------ */

/** List all widgets for a mural. */
export async function getWidgets(env, token, muralId) {
  return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}/widgets`, withBearer(token));
}

/** Create a sticky note. init = { text, x, y, width, height } */
export async function createSticky(env, token, muralId, init) {
  const payload = { stickyNotes: [init] };
  const js = await fetchJSON(
    `${apiBase(env)}/murals/${encodeURIComponent(muralId)}/widgets/sticky-note`,
    { method: "POST", ...withBearer(token), body: JSON.stringify(payload) }
  );
  const id = js?.stickyNotes?.[0]?.id || null;
  if (!id) throw new Error("Create sticky: missing id in response");
  return { id, raw: js };
}

/** Update a sticky note. patch = { text?, x?, y?, width?, height?, tagIds? } */
export async function updateSticky(env, token, muralId, widgetId, patch) {
  return fetchJSON(
    `${apiBase(env)}/murals/${encodeURIComponent(muralId)}/widgets/sticky-note/${encodeURIComponent(widgetId)}`,
    { method: "PATCH", ...withBearer(token), body: JSON.stringify(patch) }
  );
}

/** Get mural-level tags. */
export async function listTags(env, token, muralId) {
  return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}/tags`, withBearer(token));
}

/** Create a new tag. */
export async function createTag(env, token, muralId, { text, color }) {
  return fetchJSON(
    `${apiBase(env)}/murals/${encodeURIComponent(muralId)}/tags`,
    { method: "POST", ...withBearer(token), body: JSON.stringify({ text, color }) }
  );
}

/** Update an existing tag. */
export async function updateTag(env, token, muralId, tagId, patch) {
  return fetchJSON(
    `${apiBase(env)}/murals/${encodeURIComponent(muralId)}/tags/${encodeURIComponent(tagId)}`,
    { method: "PATCH", ...withBearer(token), body: JSON.stringify(patch) }
  );
}

/**
 * Ensure a list of tag labels exist with Blueberry colour and return their ids.
 * Idempotent: updates colour if tag exists with a different colour.
 */
export async function ensureTagsBlueberry(env, token, muralId, labels) {
  if (!Array.isArray(labels) || labels.length === 0) return [];
  const js = await listTags(env, token, muralId);
  const existing = Array.isArray(js?.tags) ? js.tags : [];
  const byText = new Map(existing.map(t => [String(t.text || "").toLowerCase(), t]));
  const tagIds = [];

  for (const raw of labels) {
    const label = String(raw || "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    let tag = byText.get(key);

    if (!tag) {
      const mk = await createTag(env, token, muralId, { text: label, color: TAG_COLOUR });
      if (mk?.id) {
        tag = { id: mk.id, text: label, color: TAG_COLOUR };
        byText.set(key, tag);
      }
    } else if (String(tag.color || "").toLowerCase() !== TAG_COLOUR) {
      await updateTag(env, token, muralId, tag.id, { color: TAG_COLOUR });
    }

    if (tag?.id) tagIds.push(tag.id);
  }
  return tagIds;
}

/** Apply tag ids to a sticky note. */
export async function applyTagsToSticky(env, token, muralId, widgetId, tagIds) {
  if (!Array.isArray(tagIds) || tagIds.length === 0) return null;
  return updateSticky(env, token, muralId, widgetId, { tagIds });
}

/* ------------------------------------------------------------------ */
/* Utilities for service orchestration                                */
/* ------------------------------------------------------------------ */

/** Normalise raw widgets into sticky-note shape with safe defaults. */
export function normaliseWidgets(widgets) {
  const list = Array.isArray(widgets) ? widgets : [];
  return list
    .filter(w => {
      const t = String(w?.type || "").toLowerCase();
      return t === "sticky_note" || t === "sticky-note" || t === "sticky";
    })
    .map(w => ({
      id: w.id,
      type: w.type,
      text: String(w.text || "").trim(),
      x: Number.isFinite(w.x) ? w.x : 200,
      y: Number.isFinite(w.y) ? w.y : 200,
      width: Number.isFinite(w.width) ? w.width : DEFAULT_W,
      height: Number.isFinite(w.height) ? w.height : DEFAULT_H,
      tags: Array.isArray(w.tags) ? w.tags : [],
      updatedAt: w.updatedAt || w.updated_at || null,
      createdAt: w.createdAt || w.created_at || null
    }));
}

/** Sort helper: newest first by updatedAt/createdAt. */
export function sortNewestFirst(a, b) {
  const ak = Date.parse(a.updatedAt || a.createdAt || 0);
  const bk = Date.parse(b.updatedAt || b.createdAt || 0);
  return bk - ak;
}

/**
 * Return the most recent sticky in the category "column" (defined by tag text == category).
 */
export function findLatestInCategory(stickies, category) {
  const key = String(category || "").toLowerCase();
  const inCol = (stickies || []).filter(s =>
    (s.tags || []).map(t => String(t?.text || "").toLowerCase()).includes(key)
  );
  inCol.sort(sortNewestFirst);
  return inCol[0] || null;
}

/* ------------------------------------------------------------------ */
/* Export internals (for tests/debug)                                  */
/* ------------------------------------------------------------------ */

export const _int = { fetchJSON, withBearer, apiBase, encodeState, decodeState };
