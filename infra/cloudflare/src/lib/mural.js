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
 * - (optional) MURAL_API_BASE   default: https://app.mural.co/api/public/v1
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const API_TIMEOUT_MS = 15000;

/** @constant {string[]} SCOPES - OAuth2 scopes requested for the integration. */
export const SCOPES = [
	"identity:read",
	"workspaces:read",
	"rooms:read",
	"rooms:write",
	"murals:write"
];

/* ------------------------------------------------------------------ */
/* Base URLs                                                          */
/* ------------------------------------------------------------------ */

/**
 * Returns the base API endpoint for Mural REST calls.
 * @param {Env} env
 * @returns {string}
 */
const apiBase = (env) => env.MURAL_API_BASE || "https://app.mural.co/api/public/v1";

/**
 * Base endpoint for Mural OAuth authorization.
 * @constant {string}
 */
const oauthBase = "https://app.mural.co/api/public/v1/authorization/oauth2";

/* ------------------------------------------------------------------ */
/* Helpers: safe state encode/decode                                  */
/* ------------------------------------------------------------------ */

/**
 * Encodes an object into a base64 state string.
 * @param {Record<string, any>} obj
 * @returns {string}
 */
export function encodeState(obj) {
	try {
		return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
	} catch {
		return "";
	}
}

/**
 * Decodes a base64 state string into an object.
 * @param {string} str
 * @returns {Record<string, any>}
 */
export function decodeState(str) {
	try {
		return JSON.parse(decodeURIComponent(escape(atob(str))));
	} catch {
		return {};
	}
}

/* ------------------------------------------------------------------ */
/* OAuth2: Authorization URL builder                                  */
/* ------------------------------------------------------------------ */

/**
 * Builds the Mural OAuth2 authorization URL.
 * This URL must be visited by the browser (redirect), not fetched via XHR.
 * @param {Env} env - Worker environment variables.
 * @param {object} stateObj - Arbitrary state data (e.g., { uid, return }).
 * @returns {string} Full OAuth2 authorization URL.
 */
export function buildAuthUrl(env, stateObj) {
	const state = encodeState(stateObj);
	const params = new URLSearchParams({
		response_type: "code",
		client_id: env.MURAL_CLIENT_ID,
		redirect_uri: env.MURAL_REDIRECT_URI, // MUST match Mural app config
		scope: SCOPES.join(" "),
		state
	});
	// Correct endpoint: no "/authorize" suffix
	return `${oauthBase}/?${params}`;
}

/* ------------------------------------------------------------------ */
/* JSON + Fetch helpers                                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch JSON with timeout and error wrapping.
 * @param {string} url
 * @param {RequestInit} [opts]
 * @returns {Promise<any>}
 */
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

/**
 * Returns fetch options with a Bearer token header.
 * @param {string} token
 * @returns {RequestInit}
 */
const withBearer = (token) => ({
	headers: { ...JSON_HEADERS, authorization: `Bearer ${token}` }
});

/* ------------------------------------------------------------------ */
/* OAuth2: Token exchange                                             */
/* ------------------------------------------------------------------ */

/**
 * Exchanges an authorization code for an access token.
 * @param {Env} env
 * @param {string} code
 * @returns {Promise<{access_token:string,refresh_token?:string,token_type:string,expires_in:number}>}
 */
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

/**
 * Returns current user profile from Mural.
 * @param {Env} env
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function getMe(env, token) {
	return fetchJSON(`${apiBase(env)}/users/me`, withBearer(token));
}

/**
 * Lists workspaces visible to the authenticated user.
 * @param {Env} env
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function getWorkspaces(env, token) {
	return fetchJSON(`${apiBase(env)}/workspaces`, withBearer(token));
}

/**
 * Checks whether the user belongs to the Home Office workspace.
 * @param {Env} env
 * @param {string} token
 * @returns {Promise<object|null>} Matching workspace or null.
 */
export async function verifyHomeOfficeWorkspace(env, token) {
	const data = await getWorkspaces(env, token);
	const targetId = env.MURAL_HOME_OFFICE_WORKSPACE_ID;
	let ws = null;
	if (targetId) ws = (data?.items || []).find((w) => `${w.id}` === `${targetId}`);
	if (!ws) ws = (data?.items || []).find((w) => /home office/i.test(w?.name || ""));
	return ws || null;
}

/* ------------------------------------------------------------------ */
/* Rooms + Folders                                                    */
/* ------------------------------------------------------------------ */

/**
 * Lists rooms for a given workspace.
 * @param {Env} env
 * @param {string} token
 * @param {string} workspaceId
 */
export async function listRooms(env, token, workspaceId) {
	return fetchJSON(`${apiBase(env)}/workspaces/${workspaceId}/rooms`, withBearer(token));
}

/**
 * Creates a new private room.
 * @param {Env} env
 * @param {string} token
 * @param {{name:string,workspaceId:string,visibility?:string}} args
 */
export async function createRoom(env, token, { name, workspaceId, visibility = "private" }) {
	return fetchJSON(`${apiBase(env)}/rooms`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify({ name, workspaceId, visibility })
	});
}

/**
 * Ensures a user has a private room, creating one if needed.
 * @param {Env} env
 * @param {string} token
 * @param {string} workspaceId
 * @param {string} [username]
 */
export async function ensureUserRoom(env, token, workspaceId, username = "Private") {
	const rooms = await listRooms(env, token, workspaceId);
	let room = (rooms?.items || []).find(
		(r) =>
		/(private)/i.test(r.visibility || "") ||
		(username && r.name?.toLowerCase().includes(username.toLowerCase()))
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

/**
 * Lists folders in a room.
 * @param {Env} env
 * @param {string} token
 * @param {string} roomId
 */
export async function listFolders(env, token, roomId) {
	return fetchJSON(`${apiBase(env)}/rooms/${roomId}/folders`, withBearer(token));
}

/**
 * Creates a new folder in a room.
 * @param {Env} env
 * @param {string} token
 * @param {string} roomId
 * @param {string} name
 */
export async function createFolder(env, token, roomId, name) {
	return fetchJSON(`${apiBase(env)}/rooms/${roomId}/folders`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify({ name })
	});
}

/**
 * Ensures a folder exists for a project name.
 * @param {Env} env
 * @param {string} token
 * @param {string} roomId
 * @param {string} projectName
 */
export async function ensureProjectFolder(env, token, roomId, projectName) {
	const existing = await listFolders(env, token, roomId).catch(() => ({ items: [] }));
	const found = (existing?.items || []).find(
		(f) => (f.name || "").trim().toLowerCase() === projectName.trim().toLowerCase()
	);
	if (found) return found;
	return createFolder(env, token, roomId, projectName);
}

/* ------------------------------------------------------------------ */
/* Murals                                                             */
/* ------------------------------------------------------------------ */

/**
 * Creates a Mural board in a given folder/room.
 * @param {Env} env
 * @param {string} token
 * @param {{title:string,roomId:string,folderId:string}} args
 */
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

export const _int = { fetchJSON, withBearer, apiBase, encodeState, decodeState };
