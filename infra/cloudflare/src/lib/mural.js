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
		const js = txt ? JSON.parse(txt) : {};
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
/* User profile + helpers                                            */
/* ------------------------------------------------------------------ */

export async function getMe(env, token) {
	return fetchJSON(`${apiBase(env)}/users/me`, withBearer(token));
}

export function getActiveWorkspaceIdFromMe(me) {
	return me?.value?.lastActiveWorkspace || me?.lastActiveWorkspace || null;
}

/**
 * Company (tenant) membership check. This is the **only** gate we use.
 * True if the current user belongs to the expected company.
 */
export async function verifyHomeOfficeByCompany(env, token) {
	const me = await getMe(env, token);
	const v = me?.value || me || {};
	const cid = (v.companyId || "").trim();
	const cname = (v.companyName || "").trim();

	const targetCompanyId = (env.MURAL_COMPANY_ID || "").trim(); // e.g. "homeofficegovuk"
	if (targetCompanyId) return Boolean(cid) && cid === targetCompanyId;

	// Fallback by name if you don't want to set MURAL_COMPANY_ID
	return Boolean(cname && /home\s*office/i.test(cname));
}

/* ------------------------------------------------------------------ */
/* Rooms + Folders + Murals                                           */
/* ------------------------------------------------------------------ */

export async function listRooms(env, token, workspaceId) {
	return fetchJSON(`${apiBase(env)}/workspaces/${workspaceId}/rooms`, withBearer(token));
}

export async function createRoom(env, token, { name, workspaceId }) {
	/**
	 * Mural API (2025): /rooms no longer accepts “visibility”.
	 * Required keys: { name, workspaceId } only.
	 * Optional: { description, type }.
	 */
	return fetchJSON(`${apiBase(env)}/rooms`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify({
			name,
			workspaceId,
			type: "private" // optional, still accepted; omit if error persists
		})
	});
}

export async function ensureUserRoom(env, token, workspaceId, username = "Private") {
	const rooms = await listRooms(env, token, workspaceId).catch(() => ({ items: [], value: [] }));
	const list = Array.isArray(rooms?.items) ? rooms.items :
		Array.isArray(rooms?.value) ? rooms.value :
		Array.isArray(rooms) ? rooms : [];

	let room = list.find(r =>
		(username && (r.name || "").toLowerCase().includes(String(username).toLowerCase()))
	);

	if (!room) {
		room = await createRoom(env, token, {
			name: `${username} — Private`,
			workspaceId
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
	// Minimal payload that your tenant accepts on create.
	const payload = { title, roomId, folderId };

	return fetchJSON(`${apiBase(env)}/murals`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify(payload)
	});
}

/* ------------------------------------------------------------------ */
/* Export internals (for tests/debug)                                  */
/* ------------------------------------------------------------------ */

export const _int = { fetchJSON, withBearer, apiBase, encodeState, decodeState };
