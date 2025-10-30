/**
 * @file lib/mural.js
 * @summary Mural OAuth + API helpers (pure functions; no routing).
 *
 * ENV required:
 * - MURAL_CLIENT_ID
 * - MURAL_CLIENT_SECRET
 * - MURAL_REDIRECT_URI
 * - (optional) MURAL_HOME_OFFICE_WORKSPACE_ID
 * - (optional) MURAL_API_BASE   default: https://app.mural.co/api/public/v1
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const API_TIMEOUT_MS = 15000;

export const SCOPES = [
	"identity:read",
	"workspaces:read",
	"rooms:read",
	"rooms:write",
	"murals:read",
	"murals:write"
];

const apiBase = (env) => env.MURAL_API_BASE || "https://app.mural.co/api/public/v1";

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

export function buildAuthUrl(env, state) {
	const params = new URLSearchParams({
		response_type: "code",
		client_id: env.MURAL_CLIENT_ID,
		redirect_uri: env.MURAL_REDIRECT_URI,
		scope: SCOPES.join(" "),
		state
	});
	return `${apiBase(env)}/authorization/oauth2/authorize?${params}`;
}

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

export async function getMe(env, token) {
	return fetchJSON(`${apiBase(env)}/users/me`, withBearer(token));
}

export async function getWorkspaces(env, token) {
	return fetchJSON(`${apiBase(env)}/workspaces`, withBearer(token));
}

export async function verifyHomeOfficeByCompany(env, token) {
	const me = await getMe(env, token).catch(() => null);
	const company = (me?.value?.companyId || me?.companyId || "").toString().toLowerCase();
	const want = (env.MURAL_COMPANY_ID || "homeofficegovuk").toLowerCase();
	return Boolean(company) && company === want;
}

export function getActiveWorkspaceIdFromMe(me) {
	return me?.value?.lastActiveWorkspace || me?.lastActiveWorkspace || null;
}

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
	const rooms = await listRooms(env, token, workspaceId).catch(() => ({ items: [] }));
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
	const found = (existing?.items || []).find(f => (f.name || "").trim().toLowerCase() === projectName.trim().toLowerCase());
	if (found) return found;
	return createFolder(env, token, roomId, projectName);
}

export async function createMural(env, token, { title, roomId, folderId }) {
	return fetchJSON(`${apiBase(env)}/murals`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify({ title, roomId, folderId, backgroundColor: "#FFFFFF" })
	});
}

/** NEW: fetch full mural details (often contains open/viewer links that creation omits). */
export async function getMural(env, token, muralId) {
	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}`, withBearer(token));
}

/* ── widgets/tags helpers you already had (omitted here if unchanged) ── */
export async function getWidgets(env, token, muralId) {
	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}/widgets`, withBearer(token));
}

// … plus your existing createSticky / updateSticky / tagging helpers …

// small export bag used by service part
export const _int = { fetchJSON, withBearer, apiBase };
