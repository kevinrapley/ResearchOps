/**
 * @file lib/mural.js
 * @module mural
 * @summary Mural OAuth + API helpers (pure functions).
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const API_TIMEOUT_MS = 15000;

export const DEFAULT_SCOPES = [
  "identity:read",
  "workspaces:read",
  "rooms:read",
  "rooms:write",
  "murals:write"
];

/* Base URLs */
const apiBase = (env) => env.MURAL_API_BASE || "https://app.mural.co/api/public/v1";
const oauthBase = "https://app.mural.co/api/public/v1/authorization/oauth2";

/* State helpers */
export function encodeState(obj) { try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); } catch { return ""; } }
export function decodeState(str) { try { return JSON.parse(decodeURIComponent(escape(atob(str)))); } catch { return {}; } }

/* Auth URL */
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
  return `${oauthBase}/?${params}`;
}

/* Fetch helpers */
async function fetchJSON(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const txt = await res.text();
    const js = txt ? JSON.parse(txt) : {};
    if (!res.ok) {
      const err = new Error(js?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = js;
      throw err;
    }
    return js;
  } finally { clearTimeout(t); }
}

const withBearer = (token) => ({ headers: { ...JSON_HEADERS, authorization: `Bearer ${token}` } });

/* Token exchange + refresh */
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
  return js;
}

export async function refreshAccessToken(env, refresh_token) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token,
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
  return js;
}

/* User profile */
export async function getMe(env, token) { return fetchJSON(`${apiBase(env)}/users/me`, withBearer(token)); }
export function getActiveWorkspaceIdFromMe(me) { return me?.value?.lastActiveWorkspace || me?.lastActiveWorkspace || null; }

export async function verifyHomeOfficeByCompany(env, token) {
  const me = await getMe(env, token);
  const v = me?.value || me || {};
  const cid = (v.companyId || "").trim();
  const cname = (v.companyName || "").trim();
  const targetCompanyId = (env.MURAL_COMPANY_ID || "").trim();
  if (targetCompanyId) return Boolean(cid) && cid === targetCompanyId;
  return Boolean(cname && /home\s*office/i.test(cname));
}

/* Rooms + Folders */
export async function listRooms(env, token, workspaceId) {
  return fetchJSON(`${apiBase(env)}/workspaces/${workspaceId}/rooms`, withBearer(token));
}
export async function createRoom(env, token, { name, workspaceId, visibility = "private" }) {
  return fetchJSON(`${apiBase(env)}/rooms`, { method: "POST", ...withBearer(token), body: JSON.stringify({ name, workspaceId, visibility }) });
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
    room = await createRoom(env, token, { name: `${username} — Private`, workspaceId, visibility: "private" });
  }
  return room;
}

export async function listFolders(env, token, roomId) {
  return fetchJSON(`${apiBase(env)}/rooms/${roomId}/folders`, withBearer(token));
}
export async function createFolder(env, token, roomId, name) {
  return fetchJSON(`${apiBase(env)}/rooms/${roomId}/folders`, { method: "POST", ...withBearer(token), body: JSON.stringify({ name }) });
}

export async function ensureProjectFolder(env, token, roomId, projectName) {
  const existing = await listFolders(env, token, roomId).catch(() => ({ items: [], value: [] }));
  const list = Array.isArray(existing?.items) ? existing.items :
               Array.isArray(existing?.value) ? existing.value :
               Array.isArray(existing) ? existing : [];
  const found = list.find(f => (f.name || "").trim().toLowerCase() === String(projectName).trim().toLowerCase());
  if (found) return found;
  return createFolder(env, token, roomId, projectName);
}

/* NEW: find-only (non-creating) variant */
export async function findProjectFolder(env, token, roomId, projectName) {
  const existing = await listFolders(env, token, roomId).catch(() => ({ items: [], value: [] }));
  const list = Array.isArray(existing?.items) ? existing.items :
               Array.isArray(existing?.value) ? existing.value :
               Array.isArray(existing) ? existing : [];
  return list.find(f => (f.name || "").trim().toLowerCase() === String(projectName).trim().toLowerCase()) || null;
}

/* Murals */
export async function createMural(env, token, { title, roomId, folderId }) {
  return fetchJSON(`${apiBase(env)}/murals`, { method: "POST", ...withBearer(token), body: JSON.stringify({ title, roomId, folderId }) });
}

/* NEW: list murals within a folder (best-guess public API path) */
export async function listMuralsInFolder(env, token, folderId) {
  // If the API changes, adjust this path accordingly.
  return fetchJSON(`${apiBase(env)}/folders/${folderId}/murals`, withBearer(token));
}

/* Export internals */
export const _int = { apiBase, encodeState, decodeState };
