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

// Resolve correct OAuth path variant for tenant
function _oauthPath(kind = "authorize") {
	const primary = kind === "authorize" ? "/oauth2/authorize" : "/oauth2/token";
	const fallback = kind === "authorize" ? "/authorization/oauth2/authorize" : "/authorization/oauth2/token";
	return { primary, fallback };
}

export function buildAuthUrl(env, state) {
	const base = apiBase(env);
	const { primary, fallback } = _oauthPath("authorize");
	const params = new URLSearchParams({
		response_type: "code",
		client_id: env.MURAL_CLIENT_ID,
		redirect_uri: env.MURAL_REDIRECT_URI,
		scope: SCOPES.join(" "),
		state
	});
	// prefer /oauth2/, fall back if env flag set
	const path = env.MURAL_OAUTH_LEGACY ? fallback : primary;
	return `${base}${path}?${params}`;
}

export async function exchangeAuthCode(env, code) {
	const base = apiBase(env);
	const { primary, fallback } = _oauthPath("token");

	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: env.MURAL_REDIRECT_URI,
		client_id: env.MURAL_CLIENT_ID,
		client_secret: env.MURAL_CLIENT_SECRET
	});

	async function tryPath(path) {
		const res = await fetch(`${base}${path}`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body
		});
		const js = await res.json().catch(() => ({}));
		if (!res.ok) {
			const msg = js?.error_description || js?.message || `HTTP ${res.status}`;
			const err = new Error(msg);
			err.status = res.status;
			err.body = js;
			throw err;
		}
		return js;
	}

	try {
		return await tryPath(primary);
	} catch (e) {
		if (Number(e?.status) === 404 || /PATH_NOT_FOUND/i.test(String(e?.body?.code || ""))) {
			return await tryPath(fallback);
		}
		throw e;
	}
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

export async function getWorkspaces(env, token) {
	return fetchJSON(`${apiBase(env)}/workspaces`, withBearer(token));
}

// Normalise /users/me payload shape
function _unwrapMe(me) {
	return (me && typeof me === "object" && me.value && typeof me.value === "object") ?
		me.value :
		me;
}

export async function getMe(env, token) {
	return fetchJSON(`${apiBase(env)}/users/me`, withBearer(token));
}

export function getActiveWorkspaceIdFromMe(meRaw) {
	const me = _unwrapMe(meRaw);
	return me?.lastActiveWorkspace || me?.activeWorkspaceId || null;
}

export async function verifyHomeOfficeByCompany(env, token) {
	const meRaw = await getMe(env, token).catch(() => null);
	const me = _unwrapMe(meRaw);

	const cid = (me?.companyId || "").toString().trim().toLowerCase();
	const cname = (me?.companyName || "").toString().trim().toLowerCase();
	const expected = (env.MURAL_COMPANY_ID || "homeofficegovuk").toLowerCase();

	// Accept either an exact companyId match or a companyName containing "home office"
	if (cid === expected) return true;
	if (cname.includes("home office")) return true;

	const err = new Error("not_in_home_office_workspace");
	err.status = 403;
	throw err;
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

/** Fetch full mural details (often contains open/viewer links that creation omits). */
export async function getMural(env, token, muralId) {
	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}`, withBearer(token));
}

/* ==========================================================================
   Mural widgets + tags helpers
   ========================================================================== */

/**
 * List all widgets on a mural.
 * @param {Env} env
 * @param {string} accessToken
 * @param {string} muralId
 * @returns {Promise<{ widgets: any[] }>}
 */
export async function getWidgets(env, accessToken, muralId) {
	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}/widgets`, {
		...withBearer(accessToken)
	});
}

/**
 * Create a sticky note widget.
 * Mural public API typically expects a "type" and a payload with geometry.
 * @param {Env} env
 * @param {string} accessToken
 * @param {string} muralId
 * @param {{ text:string, x:number, y:number, width:number, height:number, color?:string }} params
 * @returns {Promise<{ id:string }>}
 */
export async function createSticky(env, accessToken, muralId, { text, x, y, width, height, color }) {
	const body = {
		type: "stickyNote",
		text: text ?? "",
		x: Math.round(x ?? 0),
		y: Math.round(y ?? 0),
		width: Math.round(width ?? 240),
		height: Math.round(height ?? 120),
		color: color || _COLORS.blueberry
	};
	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}/widgets`, {
		method: "POST",
		...withBearer(accessToken),
		body: JSON.stringify(body)
	});
}

/**
 * Update an existing sticky note widget (partial patch).
 * @param {Env} env
 * @param {string} accessToken
 * @param {string} muralId
 * @param {string} widgetId
 * @param {{ text?:string, x?:number, y?:number, width?:number, height?:number, color?:string }} patch
 */
export async function updateSticky(env, accessToken, muralId, widgetId, patch = {}) {
	const body = {};
	if (typeof patch.text === "string") body.text = patch.text;
	if (Number.isFinite(patch.x)) body.x = Math.round(patch.x);
	if (Number.isFinite(patch.y)) body.y = Math.round(patch.y);
	if (Number.isFinite(patch.width)) body.width = Math.round(patch.width);
	if (Number.isFinite(patch.height)) body.height = Math.round(patch.height);
	if (typeof patch.color === "string") body.color = patch.color;

	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}/widgets/${encodeURIComponent(widgetId)}`, {
		method: "PATCH",
		...withBearer(accessToken),
		body: JSON.stringify(body)
	});
}

/* ---------- Tags ---------- */

/**
 * List tags for a mural.
 * @param {Env} env
 * @param {string} accessToken
 * @param {string} muralId
 * @returns {Promise<{ items: { id:string, name:string, color?:string }[] }>}
 */
async function listTags(env, accessToken, muralId) {
	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}/tags`, {
		...withBearer(accessToken)
	});
}

/**
 * Create a tag (defaults to blueberry colour).
 * @param {Env} env
 * @param {string} accessToken
 * @param {string} muralId
 * @param {string} name
 * @param {string=} color
 */
async function createTag(env, accessToken, muralId, name, color = _COLORS.blueberry) {
	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}/tags`, {
		method: "POST",
		...withBearer(accessToken),
		body: JSON.stringify({ name, color })
	});
}

/**
 * Ensure tags exist; return their IDs (creates any missing).
 * @param {Env} env
 * @param {string} accessToken
 * @param {string} muralId
 * @param {string[]} labels
 * @returns {Promise<string[]>}
 */
export async function ensureTagsBlueberry(env, accessToken, muralId, labels = []) {
	const want = (labels || []).map(s => String(s || "").trim()).filter(Boolean);
	if (!want.length) return [];

	const existing = await listTags(env, accessToken, muralId).catch(() => ({ items: [] }));
	const haveByName = new Map((existing?.items || []).map(t => [(t.name || "").toLowerCase(), t]));

	const ids = [];
	for (const name of want) {
		const key = name.toLowerCase();
		let tag = haveByName.get(key);
		if (!tag) {
			tag = await createTag(env, accessToken, muralId, name).catch(() => null);
			if (!tag) continue;
			// Some APIs return the created object; some wrap it
			const created = tag?.id ? tag : tag?.item || tag?.value || tag;
			if (created?.name) haveByName.set(created.name.toLowerCase(), created);
			tag = created;
		}
		if (tag?.id) ids.push(tag.id);
	}
	return ids;
}

/**
 * Apply tags to a widget (sticky).
 * @param {Env} env
 * @param {string} accessToken
 * @param {string} muralId
 * @param {string} widgetId
 * @param {string[]} tagIds
 */
export async function applyTagsToSticky(env, accessToken, muralId, widgetId, tagIds = []) {
	if (!tagIds.length) return { ok: true };
	// Many REST designs use PUT to set full tag list; some accept POST append.
	// We use PUT with an explicit array of IDs.
	return fetchJSON(`${apiBase(env)}/murals/${encodeURIComponent(muralId)}/widgets/${encodeURIComponent(widgetId)}/tags`, {
		method: "PUT",
		...withBearer(accessToken),
		body: JSON.stringify({ tagIds })
	});
}

/* ---------- Widget normalisation + selection ---------- */

/**
 * Convert API widgets to a lean, uniform structure.
 * Expects Mural to return each widget with type, text/content and geometry.
 * @param {any[]} widgets
 * @returns {{ id:string, type:string, text:string, x:number, y:number, width:number, height:number, tags:string[], updatedAt?:number }[]}
 */
export function normaliseWidgets(widgets = []) {
	return (widgets || [])
		.filter(w => w && (w.type === "stickyNote" || w.type === "STICKY_NOTE" || /sticky/i.test(w.type || "")))
		.map(w => {
			const geom = {
				x: Number.isFinite(w.x) ? w.x : (w.position?.x ?? 0),
				y: Number.isFinite(w.y) ? w.y : (w.position?.y ?? 0),
				width: Number.isFinite(w.width) ? w.width : (w.size?.width ?? 240),
				height: Number.isFinite(w.height) ? w.height : (w.size?.height ?? 120)
			};
			const tagsArr = Array.isArray(w.tags) ? w.tags
				.map(t => (typeof t === "string" ? t : (t?.name || "")))
				.filter(Boolean) : [];

			const updated = w.updatedOn ?? w.updatedAt ?? w.modifiedOn ?? null;
			const updatedAt = Number.isFinite(updated) ? Number(updated) :
				(updated ? Date.parse(updated) : null);

			return {
				id: String(w.id || ""),
				type: "stickyNote",
				text: String(w.text ?? w.content ?? w.title ?? ""),
				...geom,
				tags: tagsArr,
				updatedAt: Number.isFinite(updatedAt) ? updatedAt : undefined
			};
		});
}

/**
 * Find the “latest” sticky in a category (by tag name).
 * Prefers most recent updatedAt; falls back to largest (y + height) i.e., lowest on canvas.
 * @param {ReturnType<typeof normaliseWidgets>} sticks
 * @param {string} category   e.g., "perceptions"
 */
export function findLatestInCategory(sticks = [], category = "") {
	const want = String(category || "").toLowerCase();
	const pool = sticks.filter(s => (s.tags || []).some(t => String(t).toLowerCase() === want));
	if (!pool.length) return null;

	const withTime = pool.filter(s => Number.isFinite(s.updatedAt));
	if (withTime.length) {
		withTime.sort((a, b) => b.updatedAt - a.updatedAt);
		return withTime[0];
	}

	// Fallback: “lowest” on the canvas by bottom edge
	pool.sort((a, b) => (b.y + b.height) - (a.y + a.height));
	return pool[0];
}

// small export bag used by service part
export const _int = { fetchJSON, withBearer, apiBase };
