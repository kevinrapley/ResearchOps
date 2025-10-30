/**
 * @file lib/mural.js
 * @summary Mural OAuth + API helpers (pure functions; no routing).
 *
 * ENV required:
 * - MURAL_CLIENT_ID
 * - MURAL_CLIENT_SECRET
 * - MURAL_REDIRECT_URI
 * - (optional) MURAL_COMPANY_ID            default: homeofficegovuk
 * - (optional) MURAL_API_BASE              default: https://app.mural.co/api/public/v1
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

export const _COLORS = {
	blueberry: "#4456FF"
};

export const _int = {
	fetchJSON,
	withBearer,
	apiBase
};

function apiBase(env) {
	return env.MURAL_API_BASE || "https://app.mural.co/api/public/v1";
}

async function fetchJSON(url, opts = {}) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
	try {
		const res = await fetch(url, { ...opts, signal: ctrl.signal });
		const txt = await res.text().catch(() => "");
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

function withBearer(token) {
	return { headers: { ...JSON_HEADERS, authorization: `Bearer ${token}` } };
}

/* ───────────────────────── OAuth / Identity ───────────────────────── */

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

export function getActiveWorkspaceIdFromMe(me) {
	return me?.value?.lastActiveWorkspace || me?.lastActiveWorkspace || null;
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

/* ───────────────────────── Rooms / Folders / Murals ───────────────────────── */

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

/** Fetch full mural details (often includes open/view links that creation omits). */
export async function getMural(env, token, muralId) {
	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}`, withBearer(token));
}

/* ───────────────────────── Widgets / Tags helpers ───────────────────────── */
/* These names are required by service/internals/mural.js imports.            */

export async function getWidgets(env, token, muralId) {
	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}/widgets`, withBearer(token));
}

export async function createSticky(env, token, muralId, { text, x, y, width, height, color = _COLORS.blueberry } = {}) {
	// API shape: POST /murals/:id/widgets  → { type, ...props }
	const payload = {
		type: "sticky-note",
		text: text ?? "",
		x: Number.isFinite(x) ? Math.round(x) : 0,
		y: Number.isFinite(y) ? Math.round(y) : 0,
		width: Number.isFinite(width) ? Math.round(width) : 240,
		height: Number.isFinite(height) ? Math.round(height) : 120,
		color
	};
	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}/widgets`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify(payload)
	});
}

export async function updateSticky(env, token, muralId, widgetId, patch) {
	// API shape: PATCH /murals/:id/widgets/:widgetId
	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}/widgets/${encodeURIComponent(widgetId)}`, {
		method: "PATCH",
		...withBearer(token),
		body: JSON.stringify(patch || {})
	});
}

async function listTags(env, token, muralId) {
	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}/tags`, withBearer(token));
}

async function createTag(env, token, muralId, { name, color = _COLORS.blueberry }) {
	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}/tags`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify({ name, color })
	});
}

export async function ensureTagsBlueberry(env, token, muralId, labels = []) {
	const names = labels
		.map(s => String(s || "").trim())
		.filter(Boolean);
	if (!names.length) return [];

	const existing = await listTags(env, token, muralId).catch(() => ({ items: [] }));
	const have = new Map((existing?.items || []).map(t => [String(t.name).toLowerCase(), t]));

	const ids = [];
	for (const nm of names) {
		const key = nm.toLowerCase();
		let tag = have.get(key);
		if (!tag) {
			tag = await createTag(env, token, muralId, { name: nm }).catch(() => null);
		}
		if (tag?.id) ids.push(tag.id);
	}
	return ids;
}

export async function applyTagsToSticky(env, token, muralId, widgetId, tagIds = []) {
	if (!Array.isArray(tagIds) || !tagIds.length) return { ok: true };
	// API shape: POST /murals/:id/widgets/:widgetId/tags  body: { tagIds: [...] }
	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}/widgets/${encodeURIComponent(widgetId)}/tags`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify({ tagIds })
	});
}

/* ───────────────────────── Client-side-normalisation helpers ───────────── */

export function normaliseWidgets(widgets) {
	const list = Array.isArray(widgets) ? widgets : [];
	return list.map(w => ({
		id: w?.id,
		type: w?.type || "",
		text: (w?.text ?? w?.content ?? "").toString(),
		x: Number(w?.x ?? 0),
		y: Number(w?.y ?? 0),
		width: Number(w?.width ?? 0),
		height: Number(w?.height ?? 0),
		color: w?.color || null,
		category: inferCategoryFromText((w?.text ?? "").toString())
	}));
}

function inferCategoryFromText(txt) {
	// Cheap classifier by leading token (you already gate by category server-side)
	const t = (txt || "").trim().toLowerCase();
	if (!t) return "";
	if (t.startsWith("[perceptions]")) return "perceptions";
	if (t.startsWith("[procedures]")) return "procedures";
	if (t.startsWith("[decisions]")) return "decisions";
	if (t.startsWith("[introspections]")) return "introspections";
	return "";
}

export function findLatestInCategory(widgets, category) {
	const cat = String(category || "").toLowerCase();
	const pool = (Array.isArray(widgets) ? widgets : []).filter(w => w.category === cat || cat === "");
	// “Latest” by visual Y position then X as tiebreaker
	return pool.sort((a, b) => (a.y - b.y) || (a.x - b.x)).slice(-1)[0] || null;
}
