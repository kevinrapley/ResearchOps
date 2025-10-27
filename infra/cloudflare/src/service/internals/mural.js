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
      const err = new Error(js?.message || js?.error || `HTTP ${res.status}`);
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
/* Widgets + Tags (for Reflexive Journal sync)                        */
/* ------------------------------------------------------------------ */

/**
 * List widgets on a mural. API returns { widgets: [...] }.
 */
export async function getWidgets(env, token, muralId) {
  return fetchJSON(`${apiBase(env)}/murals/${muralId}/widgets`, withBearer(token));
}

/**
 * Create a sticky note widget.
 * Minimal payload: { text, x, y, width, height }.
 */
export async function createSticky(env, token, muralId, { text, x, y, width, height }) {
  return fetchJSON(`${apiBase(env)}/murals/${muralId}/widgets`, {
    method: "POST",
    ...withBearer(token),
    body: JSON.stringify({
      type: "sticky_note",
      text,
      x, y, width, height
    })
  });
}

/**
 * Update a sticky note (text/position/size).
 */
export async function updateSticky(env, token, muralId, widgetId, patch) {
  // PATCH is supported; fall back to PUT if needed
  return fetchJSON(`${apiBase(env)}/murals/${muralId}/widgets/${widgetId}`, {
    method: "PATCH",
    ...withBearer(token),
    body: JSON.stringify(patch || {})
  });
}

/**
 * Ensure a set of tags exist in the mural, with the "Blueberry" colour.
 * Returns the array of tag IDs (existing or newly created).
 */
export async function ensureTagsBlueberry(env, token, muralId, labels = []) {
  const want = (labels || []).map(s => String(s || "").trim()).filter(Boolean);
  if (!want.length) return [];

  // 1) list existing tags
  const existing = await fetchJSON(`${apiBase(env)}/murals/${muralId}/tags`, withBearer(token)).catch(() => ({}));
  const list = Array.isArray(existing?.items) ? existing.items :
               Array.isArray(existing?.value) ? existing.value :
               Array.isArray(existing) ? existing : [];

  const blueberry = "Blueberry"; // Mural’s standard name in your spec
  const byName = Object.create(null);
  for (const t of list) {
    const name = String(t?.name || "").trim().toLowerCase();
    byName[name] = t;
  }

  const tagIds = [];
  for (const label of want) {
    const key = label.toLowerCase();
    if (byName[key]) {
      tagIds.push(byName[key].id);
      continue;
    }
    // create the tag with requested name and Blueberry colour
    const created = await fetchJSON(`${apiBase(env)}/murals/${muralId}/tags`, {
      method: "POST",
      ...withBearer(token),
      body: JSON.stringify({
        name: label,
        color: blueberry
      })
    });
    if (created?.id) tagIds.push(created.id);
  }
  return tagIds;
}

/**
 * Apply the given tag IDs to a widget (sticky).
 */
export async function applyTagsToSticky(env, token, muralId, widgetId, tagIds) {
  if (!Array.isArray(tagIds) || !tagIds.length) return;
  // some APIs support POST to /widgets/{id}/tags, others PATCH widget with tags array.
  // Prefer a dedicated endpoint if available; otherwise PATCH widget:
  return fetchJSON(`${apiBase(env)}/murals/${muralId}/widgets/${widgetId}`, {
    method: "PATCH",
    ...withBearer(token),
    body: JSON.stringify({ tagIds })
  });
}

/* ------------------------------------------------------------------ */
/* Client-side normalisers used by service layer                      */
/* ------------------------------------------------------------------ */

/**
 * Normalise the raw widget list to a thin array of stickies we care about.
 */
export function normaliseWidgets(raw) {
  const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
  const out = [];
  for (const w of arr) {
    const type = (w?.type || w?.widgetType || "").toLowerCase();
    if (type !== "sticky_note" && type !== "sticky" && type !== "stickynote") continue;

    // Try to get a plain-text version for reliable category heuristics
    const text = (typeof w?.text === "string" ? w.text
                : typeof w?.content === "string" ? w.content
                : w?.data?.text || "");

    out.push({
      id: w.id,
      type: "sticky_note",
      text: String(text || ""),
      x: Number(w?.x ?? w?.position?.x ?? 0),
      y: Number(w?.y ?? w?.position?.y ?? 0),
      width: Number(w?.width ?? w?.size?.width ?? 240),
      height: Number(w?.height ?? w?.size?.height ?? 120),
      raw: w
    });
  }
  return out;
}

/**
 * Heuristic: classify a sticky into one of the 4 RJ categories based on:
 * - explicit tag match (if widget already has a tag with that name), OR
 * - text prefix like "[perceptions]" / "#perceptions", OR
 * - fallback to column-like layout if your mural columns are aligned by X ranges (optional extension)
 *
 * For now we use a simple text-based heuristic so it works with any board.
 */
function detectCategoryForSticky(sticky) {
  const t = (sticky?.text || "").toLowerCase();

  // Bracket or hash markers (users can add these in the title/first line)
  if (/^\s*(\[|\#)\s*perceptions/.test(t)) return "perceptions";
  if (/^\s*(\[|\#)\s*procedures/.test(t)) return "procedures";
  if (/^\s*(\[|\#)\s*decisions/.test(t)) return "decisions";
  if (/^\s*(\[|\#)\s*introspections/.test(t)) return "introspections";

  // If tags already present in raw:
  const tagNames = (sticky?.raw?.tags || sticky?.raw?.tagNames || [])
    .map(x => String(x?.name || x).toLowerCase());
  if (tagNames.includes("perceptions")) return "perceptions";
  if (tagNames.includes("procedures")) return "procedures";
  if (tagNames.includes("decisions")) return "decisions";
  if (tagNames.includes("introspections")) return "introspections";

  return null;
}

/**
 * Find the latest sticky within a given category.
 * “Latest” = greatest Y within that category, falling back to any sticky if none match.
 */
export function findLatestInCategory(stickies, category) {
  const list = Array.isArray(stickies) ? stickies : [];
  let best = null;
  for (const s of list) {
    const cat = detectCategoryForSticky(s);
    if (cat !== category) continue;
    if (!best || Number(s.y) > Number(best.y)) best = s;
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Export internals (for tests/debug)                                  */
/* ------------------------------------------------------------------ */

export const _int = {
  fetchJSON,
  withBearer,
  apiBase,
  encodeState,
  decodeState
};
