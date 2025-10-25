/**
 * @file lib/mural.js
 * @module mural
 * @summary Mural OAuth + API helpers (pure functions; no routing).
 *
 * ENV required:
 * - MURAL_CLIENT_ID
 * - MURAL_CLIENT_SECRET
 * - MURAL_REDIRECT_URI  (must exactly match your registered redirect URI in Mural)
 * - (optional) MURAL_HOME_OFFICE_WORKSPACE_ID
 * - (optional) MURAL_API_BASE    default: https://app.mural.co/api/public/v1
 * - (optional) MURAL_SCOPES      space-separated, e.g. "identity:read workspaces:read rooms:read rooms:write murals:write"
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const API_TIMEOUT_MS = 15000;

/* ------------------------------------------------------------------ */
/* Base URLs                                                          */
/* ------------------------------------------------------------------ */

const apiBase = (env) => env.MURAL_API_BASE || "https://app.mural.co/api/public/v1";
const oauthBase = "https://app.mural.co/api/public/v1/authorization/oauth2";

/* ------------------------------------------------------------------ */
/* Helpers: safe state encode/decode                                  */
/* ------------------------------------------------------------------ */

export function encodeState(obj) {
	try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); } catch { return ""; }
}

export function decodeState(str) {
	try { return JSON.parse(decodeURIComponent(escape(atob(str)))); } catch { return {}; }
}

/* ------------------------------------------------------------------ */
/* Scopes                                                             */
/* ------------------------------------------------------------------ */

/**
 * Resolve the OAuth scopes to request.
 * - If env.MURAL_SCOPES is set, use that (space-separated).
 * - Otherwise default to minimal read-only scopes that typically work everywhere.
 * @param {Env} env
 * @returns {string[]} scopes
 */
export function getScopes(env) {
	const raw = (env.MURAL_SCOPES || "").trim();
	if (raw) return raw.split(/\s+/).filter(Boolean);
	return ["identity:read", "workspaces:read"]; // minimal default
}

/* ------------------------------------------------------------------ */
/* OAuth2: Authorization URL builder                                  */
/* ------------------------------------------------------------------ */

/**
 * Builds the Mural OAuth2 authorization URL (browser redirect target).
 * @param {Env} env
 * @param {object} stateObj - e.g., { uid, return }
 * @returns {string}
 */
export function buildAuthUrl(env, stateObj) {
	const state = encodeState(stateObj);
	const scopes = getScopes(env);
	const params = new URLSearchParams({
		response_type: "code",
		client_id: env.MURAL_CLIENT_ID,
		redirect_uri: env.MURAL_REDIRECT_URI, // must match app config exactly
		scope: scopes.join(" "),
		state
	});
	return `${oauthBase}/?${params}`; // note trailing slash; no "/authorize"
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
			err.status = res.status;
			err.body = js;
			throw err;
		}
		return js;
	} finally { clearTimeout(t); }
}

const withBearer = (token) => ({
	headers: { ...JSON_HEADERS, authorization: `Bearer ${token}` }
});

/* ------------------------------------------------------------------ */
/* OAuth2: Token exchange                                             */
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

/* ------------------------------------------------------------------ */
/* User + Workspace helpers                                           */
/* ------------------------------------------------------------------ */

export async function getMe(env, token) {
	return fetchJSON(`${apiBase(env)}/users/me`, withBearer(token));
}

export async function getWorkspaces(env, token) {
	return fetchJSON(`${apiBase(env)}/workspaces`, withBearer(token));
}

export async function verifyHomeOfficeWorkspace(env, token) {
	const data = await getWorkspaces(env, token);
	const targetId = env.MURAL_HOME_OFFICE_WORKSPACE_ID;
	let ws = null;
	if (targetId) ws = (data?.items || []).find(w => `${w.id}` === `${targetId}`);
	if (!ws) ws = (data?.items || []).find(w => /home office/i.test(w?.name || ""));
	return ws || null;
}

/* ------------------------------------------------------------------ */
/* Rooms + Folders                                                    */
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
	const rooms = await listRooms(env, token, workspaceId);
	let room = (rooms?.items || []).find(r =>
		/(private)/i.test(r.visibility || "") ||
		(username && r.name?.toLowerCase().includes(username.toLowerCase()))
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
	return fetchJSON(`${apiBase(env)}/rooms/${roomId}/folders`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify({ name })
	});
}

export async function ensureProjectFolder(env, token, roomId, projectName) {
	const existing = await listFolders(env, token, roomId).catch(() => ({ items: [] }));
	const found = (existing?.items || []).find(
		f => (f.name || "").trim().toLowerCase() === projectName.trim().toLowerCase()
	);
	if (found) return found;
	return createFolder(env, token, roomId, projectName);
}

/* ------------------------------------------------------------------ */
/* Murals                                                             */
/* ------------------------------------------------------------------ */

export async function createMural(env, token, { title, roomId, folderId }) {
	return fetchJSON(`${apiBase(env)}/murals`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify({ title, roomId, folderId, backgroundColor: "#FFFFFF" })
	});
}

/* ------------------------------------------------------------------ */
/* Export internals                                                   */
/* ------------------------------------------------------------------ */

export const _int = { fetchJSON, withBearer, apiBase, encodeState, decodeState, getScopes };
