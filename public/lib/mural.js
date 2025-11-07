/**
 * @file lib/mural.js
 * @module mural
 * @summary Mural OAuth + API helpers (pure functions; no routing).
 *
 * ENV required:
 * - MURAL_CLIENT_ID
 * - MURAL_CLIENT_SECRET
 * - MURAL_REDIRECT_URI
 *
 * Optional:
 * - MURAL_COMPANY_ID
 * - MURAL_HOME_OFFICE_WORKSPACE_ID
 * - MURAL_API_BASE                  // default: https://app.mural.co/api/public/v1
 * - MURAL_SCOPES                    // space-separated; overrides defaults
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const API_TIMEOUT_MS = 15000;

/** Default scopes; can be overridden by env.MURAL_SCOPES (space-separated) */
export const DEFAULT_SCOPES = [
	"identity:read",
	"workspaces:read",
	"rooms:read",
	"rooms:write",
	"murals:read",
	"murals:write"
];

/* ------------------------------------------------------------------ */
/* Base URLs                                                          */
/* ------------------------------------------------------------------ */

const apiBase = (env) => env.MURAL_API_BASE || "https://app.mural.co/api/public/v1";

/* ------------------------------------------------------------------ */
/* JSON + Fetch helpers                                               */
/* ------------------------------------------------------------------ */

async function fetchJSON(url, opts = {}) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
	try {
		const res = await fetch(url, { ...opts, signal: ctrl.signal });
		const txt = await res.text().catch(() => "");
		let js = {};
		try { js = txt ? JSON.parse(txt) : {}; } catch { js = {}; }

		if (!res.ok) {
			const err = new Error(js?.message || js?.error_description || `HTTP ${res.status}`);
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
/* OAuth2                                                             */
/* ------------------------------------------------------------------ */

export function buildAuthUrl(env, state) {
	const scopes = (env.MURAL_SCOPES || DEFAULT_SCOPES.join(" ")).trim();
	const params = new URLSearchParams({
		response_type: "code",
		client_id: env.MURAL_CLIENT_ID,
		redirect_uri: env.MURAL_REDIRECT_URI,
		scope: scopes,
		state
	});
	// Note: public API uses /authorization/oauth2/authorize
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
	const js = await res.json().catch(() => ({}));
	if (!res.ok) throw Object.assign(new Error(js?.error_description || "Token exchange failed"), { status: res.status, body: js });
	return js; // { access_token, refresh_token?, token_type, expires_in }
}

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
	const js = await res.json().catch(() => ({}));
	if (!res.ok) throw Object.assign(new Error(js?.error_description || "Token refresh failed"), { status: res.status, body: js });
	return js;
}

/* ------------------------------------------------------------------ */
/* Profile + Workspace verification                                   */
/* ------------------------------------------------------------------ */

export async function getMe(env, token) {
	return fetchJSON(`${apiBase(env)}/users/me`, withBearer(token));
}

/** Unified accessor to last active workspace id across slightly different shapes */
export function getActiveWorkspaceIdFromMe(me) {
	return me?.value?.lastActiveWorkspace || me?.lastActiveWorkspace || null;
}

/**
 * Verify membership using company (preferred when env.MURAL_COMPANY_ID is set).
 * Fallback behaviour: accept if the company name matches /home\s*office/i.
 */
export async function verifyHomeOfficeByCompany(env, token) {
	const me = await getMe(env, token);
	const v = me?.value || me || {};
	const cid = String(v.companyId || "").trim().toLowerCase();
	const cname = String(v.companyName || "").trim().toLowerCase();

	const targetCompanyId = String(env.MURAL_COMPANY_ID || "").trim().toLowerCase();
	if (targetCompanyId) return Boolean(cid) && cid === targetCompanyId;

	return Boolean(cname && /home\s*office/.test(cname));
}

/**
 * Legacy/fallback: verify membership by workspace presence (ID or name match).
 */
export async function verifyHomeOfficeWorkspace(env, token) {
	const data = await fetchJSON(`${apiBase(env)}/workspaces`, withBearer(token)).catch(() => ({}));
	const list = Array.isArray(data?.items) ? data.items : Array.isArray(data?.value) ? data.value : [];
	if (!list.length) return null;

	const targetId = env.MURAL_HOME_OFFICE_WORKSPACE_ID ? String(env.MURAL_HOME_OFFICE_WORKSPACE_ID) : "";
	let ws = null;
	if (targetId) ws = list.find(w => `${w.id}` === targetId);
	if (!ws) ws = list.find(w => /home\s*office/i.test(String(w?.name || "")));
	return ws || null;
}

/* ------------------------------------------------------------------ */
/* Rooms • Folders • Murals                                           */
/* ------------------------------------------------------------------ */

export async function listRooms(env, token, workspaceId) {
	return fetchJSON(`${apiBase(env)}/workspaces/${workspaceId}/rooms`, withBearer(token));
}

/**
 * Create room (new public API)
 * Body: { name, workspaceId, visibility }
 */
export async function createRoom(env, token, { name, workspaceId, visibility = "private" }) {
	return fetchJSON(`${apiBase(env)}/rooms`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify({ name, workspaceId, visibility })
	});
}

/**
 * Heuristic: reuse a private room or one that includes the username; else create.
 * New API first (visibility), legacy fallback (type) if 404.
 */
export async function ensureUserRoom(env, token, workspaceId, username = "Private") {
	// Try to reuse
	const rooms = await listRooms(env, token, workspaceId).catch(() => ({ items: [], value: [] }));
	const list = Array.isArray(rooms?.items) ? rooms.items :
		Array.isArray(rooms?.value) ? rooms.value :
		Array.isArray(rooms) ? rooms : [];

	let room = list.find(r =>
		/(private)/i.test(String(r.visibility || r.type || "")) ||
		(username && String(r.name || "").toLowerCase().includes(String(username).toLowerCase()))
	);
	if (room) return room;

	// Create via new endpoint
	try {
		return await createRoom(env, token, {
			name: `${username} — Private`,
			workspaceId,
			visibility: "private"
		});
	} catch (e) {
		// If the NEW endpoint isn't available in tenant (404), try legacy shape
		if (Number(e?.status) !== 404) throw e;
	}

	// Legacy fallback: POST /workspaces/:workspaceId/rooms with { name, type: "private" }
	const legacyUrl = `${apiBase(env)}/workspaces/${workspaceId}/rooms`;
	return fetchJSON(legacyUrl, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify({ name: `${username} — Private`, type: "private" })
	});
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
		String(f?.name || "").trim().toLowerCase() === String(projectName).trim().toLowerCase()
	);
	if (found) return found;
	return createFolder(env, token, roomId, projectName);
}

/**
 * Create mural (new API allows POST /murals with { title, roomId, folderId })
 * Some tenants still expect POST /rooms/:roomId/murals — we try new first, then legacy.
 */
export async function createMural(env, token, { title, roomId, folderId }) {
	// New endpoint
	try {
		return await fetchJSON(`${apiBase(env)}/murals`, {
			method: "POST",
			...withBearer(token),
			body: JSON.stringify({ title, roomId, folderId, backgroundColor: "#FFFFFF" })
		});
	} catch (e) {
		if (Number(e?.status) !== 404) throw e;
	}

	// Legacy fallback
	return fetchJSON(`${apiBase(env)}/rooms/${roomId}/murals`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify({ title, ...(folderId ? { folderId } : {}) })
	});
}

export async function getMural(env, token, muralId) {
	return fetchJSON(`${apiBase(env)}/murals/${muralId}`, withBearer(token));
}

/* ------------------------------------------------------------------ */
/* Widgets + Tags (robust wrappers; tolerate API variance)            */
/* ------------------------------------------------------------------ */

export async function getWidgets(env, token, muralId) {
	try {
		const js = await fetchJSON(`${apiBase(env)}/murals/${muralId}/widgets`, withBearer(token));
		const arr = Array.isArray(js?.items) ? js.items :
			Array.isArray(js?.value) ? js.value :
			Array.isArray(js) ? js : [];
		return { widgets: arr };
	} catch (e) {
		if (Number(e?.status) === 404) return { widgets: [] };
		throw e;
	}
}

export async function createSticky(env, token, muralId, { text, x, y, width, height }) {
	const body = { text, x, y, width, height, shape: "rectangle" };
	const js = await fetchJSON(`${apiBase(env)}/murals/${muralId}/widgets/sticky-note`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify(body)
	});
	return { id: js?.id || js?.widgetId || js?.value?.id };
}

export async function updateSticky(env, token, muralId, stickyId, { text, x, y, width, height }) {
	const patch = {};
	if (typeof text === "string") patch.text = text;
	if (Number.isFinite(x)) patch.x = x;
	if (Number.isFinite(y)) patch.y = y;
	if (Number.isFinite(width)) patch.width = width;
	if (Number.isFinite(height)) patch.height = height;
	if (!Object.keys(patch).length) return { ok: true };

	return fetchJSON(`${apiBase(env)}/murals/${muralId}/widgets/${stickyId}`, {
		method: "PATCH",
		...withBearer(token),
		body: JSON.stringify(patch)
	});
}

export async function ensureTagsBlueberry(env, token, muralId, labels) {
	try {
		if (!Array.isArray(labels) || !labels.length) return [];
		const listed = await fetchJSON(`${apiBase(env)}/murals/${muralId}/tags`, withBearer(token)).catch(() => ({ items: [] }));
		const existing = Array.isArray(listed?.items) ? listed.items : Array.isArray(listed?.value) ? listed.value : [];
		const want = new Set(labels.map(s => String(s).trim()).filter(Boolean));

		const idByName = new Map();
		for (const t of existing) {
			const name = String(t?.name || "").trim();
			if (name) idByName.set(name.toLowerCase(), t.id);
		}

		const out = [];
		for (const name of want) {
			const key = name.toLowerCase();
			if (idByName.has(key)) { out.push(idByName.get(key)); continue; }
			const created = await fetchJSON(`${apiBase(env)}/murals/${muralId}/tags`, {
				method: "POST",
				...withBearer(token),
				body: JSON.stringify({ name, color: "Blueberry", hex: "#2e64ff" })
			}).catch(() => null);
			if (created?.id) out.push(created.id);
		}
		return out;
	} catch {
		return [];
	}
}

export async function applyTagsToSticky(env, token, muralId, stickyId, tagIds) {
	try {
		if (!Array.isArray(tagIds) || !tagIds.length) return { ok: true };
		await fetchJSON(`${apiBase(env)}/murals/${muralId}/widgets/${stickyId}/tags`, {
			method: "POST",
			...withBearer(token),
			body: JSON.stringify({ tagIds })
		});
		return { ok: true };
	} catch {
		return { ok: false };
	}
}

/* ------------------------------------------------------------------ */
/* Client-friendly helpers                                            */
/* ------------------------------------------------------------------ */

export function normaliseWidgets(raw) {
	const list = Array.isArray(raw) ? raw : [];
	return list
		.filter(w => String(w?.type || "").toLowerCase().includes("sticky"))
		.map(w => ({
			id: w.id || w.widgetId,
			text: String(w.text || w.title || "").trim(),
			x: Number(w.x ?? 0),
			y: Number(w.y ?? 0),
			width: Number(w.width ?? 240),
			height: Number(w.height ?? 120),
			tags: Array.isArray(w.tags) ? w.tags.map(t => String(t?.name || t).toLowerCase()) :
				Array.isArray(w.labels) ? w.labels.map(l => String(l?.name || l).toLowerCase()) : []
		}));
}

export function findLatestInCategory(stickies, category) {
	const cat = String(category || "").toLowerCase();
	const tagged = stickies.filter(s => (s.tags || []).includes(cat));
	const pool = tagged.length ? tagged : stickies;
	if (!pool.length) return null;

	let best = pool[0];
	let bestEdge = best.y + (best.height || 0);
	for (let i = 1; i < pool.length; i++) {
		const s = pool[i];
		const edge = (s.y || 0) + (s.height || 0);
		if (edge > bestEdge) {
			best = s;
			bestEdge = edge;
		}
	}
	return best;
}

/* ------------------------------------------------------------------ */
/* Export internals (for tests/debug)                                  */
/* ------------------------------------------------------------------ */

export const _int = { fetchJSON, withBearer, apiBase };
