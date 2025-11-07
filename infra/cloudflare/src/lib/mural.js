Got it — the viewer link still isn’t surfacing quickly enough after create, so I’ve added explicit “link creation” fallbacks (try listing links, and if none exist, actively create a viewer/share link), before and during the wait loop. Below are two complete files you can drop in:

⸻

/lib/mural.js

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
 * - MURAL_COMPANY_ID                // prefer company verification
 * - MURAL_HOME_OFFICE_WORKSPACE_ID  // fallback: verify by workspace id/name
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
		const txt = await res.text();
		const js = (() => { try { return txt ? JSON.parse(txt) : {}; } catch { return {}; } })();

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

/**
 * Build the user authorization URL.
 * Expects `state` to be a string (already encoded by caller).
 */
export function buildAuthUrl(env, state) {
	const scopes = (env.MURAL_SCOPES || DEFAULT_SCOPES.join(" ")).trim();
	const params = new URLSearchParams({
		response_type: "code",
		client_id: env.MURAL_CLIENT_ID,
		redirect_uri: env.MURAL_REDIRECT_URI,
		scope: scopes,
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

export async function createRoom(env, token, { name, workspaceId, visibility = "private" }) {
	return fetchJSON(`${apiBase(env)}/rooms`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify({ name, workspaceId, visibility })
	});
}

/**
 * Heuristic: reuse a private room or one that includes the username; else create.
 * (Your service chooses whether to *create* or only *find*.)
 */
export async function ensureUserRoom(env, token, workspaceId, username = "Private") {
	const rooms = await listRooms(env, token, workspaceId).catch(() => ({ items: [], value: [] }));
	const list = Array.isArray(rooms?.items) ? rooms.items :
		Array.isArray(rooms?.value) ? rooms.value :
		Array.isArray(rooms) ? rooms : [];

	let room = list.find(r =>
		/(private)/i.test(String(r.visibility || "")) ||
		(username && String(r.name || "").toLowerCase().includes(String(username).toLowerCase()))
	);

	if (!room) {
		// If the caller doesn’t want to *create*, they should catch this and handle gracefully.
		throw Object.assign(new Error("no_existing_room"), { code: "no_existing_room" });
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
		String(f?.name || "").trim().toLowerCase() === String(projectName).trim().toLowerCase()
	);
	if (found) return found;
	return createFolder(env, token, roomId, projectName);
}

export async function createMural(env, token, { title, roomId, folderId }) {
	return fetchJSON(`${apiBase(env)}/murals`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify({ title, roomId, folderId })
	});
}

export async function getMural(env, token, muralId) {
	return fetchJSON(`${apiBase(env)}/murals/${muralId}`, withBearer(token));
}

/* ------------------------------------------------------------------ */
/* Links (viewer/share)                                               */
/* ------------------------------------------------------------------ */

/**
 * Try to list existing links for a mural (public API varies across tenants).
 * Returns a normalized array of link-like objects: { url, rel?, type?, kind? }
 */
export async function getMuralLinks(env, token, muralId) {
	try {
		const js = await fetchJSON(`${apiBase(env)}/murals/${muralId}/links`, withBearer(token));
		const arr = Array.isArray(js?.items) ? js.items :
			Array.isArray(js?.value) ? js.value :
			Array.isArray(js) ? js : [];
		return arr.map(x => ({
			url: x.url || x.href || x.viewerUrl || x.openUrl || x.viewLink || null,
			rel: x.rel || x.relationship || null,
			type: x.type || null,
			kind: x.kind || null
		})).filter(l => l.url);
	} catch {
		return [];
	}
}

/**
 * Actively create a viewer/share link if none exists yet.
 * Tries a couple of payload shapes seen in different tenants.
 * Returns a URL string or null.
 */
export async function createViewerLink(env, token, muralId) {
	// Attempt 1: POST /murals/:id/links { type: "view" }
	try {
		const js = await fetchJSON(`${apiBase(env)}/murals/${muralId}/links`, {
			method: "POST",
			...withBearer(token),
			body: JSON.stringify({ type: "view" })
		});
		const url = js?.url || js?.href || js?.viewerUrl || js?.openUrl || js?.viewLink || null;
		if (url) return url;
	} catch { /* try alt shape */ }

	// Attempt 2: POST /murals/:id/share-links { access: "viewer" } or { role: "viewer" }
	try {
		const js = await fetchJSON(`${apiBase(env)}/murals/${muralId}/share-links`, {
			method: "POST",
			...withBearer(token),
			body: JSON.stringify({ access: "viewer" })
		});
		const url = js?.url || js?.href || js?.viewerUrl || js?.openUrl || js?.viewLink || null;
		if (url) return url;
	} catch { /* try role */ }

	try {
		const js = await fetchJSON(`${apiBase(env)}/murals/${muralId}/share-links`, {
			method: "POST",
			...withBearer(token),
			body: JSON.stringify({ role: "viewer" })
		});
		const url = js?.url || js?.href || js?.viewerUrl || js?.openUrl || js?.viewLink || null;
		if (url) return url;
	} catch { /* give up */ }

	return null;
}

/* ------------------------------------------------------------------ */
/* Widgets + Tags (robust wrappers; tolerate API variance)            */
/* ------------------------------------------------------------------ */

/**
 * List widgets on a mural. Returns { widgets: [...] }.
 * Falls back to { widgets: [] } on 404.
 */
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

/** Create a sticky note widget. Returns { id, ... }. */
export async function createSticky(env, token, muralId, { text, x, y, width, height }) {
	const body = { text, x, y, width, height, shape: "rectangle" };
	const js = await fetchJSON(`${apiBase(env)}/murals/${muralId}/widgets/sticky-note`, {
		method: "POST",
		...withBearer(token),
		body: JSON.stringify(body)
	});
	return { id: js?.id || js?.widgetId || js?.value?.id };
}

/** Patch a sticky note (text and/or geometry). */
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

/**
 * Ensure labels (tags) exist (Blueberry-like). Returns tag IDs.
 * If tagging endpoints are unavailable, returns [].
 */
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

/** Apply tag IDs to a sticky. Silently tolerates failure (returns {ok:false}). */
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
			tags: Array.isArray(w.tags) ? w.tags.map(t => String(t?.name || t).toLowerCase()) : Array.isArray(w.labels) ? w.labels.map(l => String(l?.name || l).toLowerCase()) : []
		}));
}

/**
 * Pick an anchor sticky within a category.
 * Preference: stickies tagged with the category; else the lowest (max y) sticky.
 */
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


⸻

/service/internals/mural.js

/**
 * @file service/internals/mural.js
 * @module service/internals/mural
 * @summary Mural routes logic (OAuth + provisioning + journal sync) with Airtable-backed board mapping.
 *
 * Airtable table expected: "Mural Boards" (override with env.AIRTABLE_TABLE_MURAL_BOARDS).
 *  - Project        (Link to "Projects" or Single line text)
 *  - UID            (Single line text)
 *  - Purpose        (Single select e.g., "reflexive_journal")
 *  - Mural ID       (Single line text)
 *  - Board URL      (URL)                [optional]
 *  - Workspace ID   (Single line text)   [optional]
 *  - Primary?       (Checkbox)           [optional, default false]
 *  - Active         (Checkbox)           [optional, default true]
 *  - Created At     (Created time)
 *
 * Resolution order for a board used by journal-sync:
 *   1) Explicit body.muralId
 *   2) Airtable: first record for (projectId[, uid], purpose, Active=true) sorted by {Primary? desc}, {Created At desc}
 *   3) KV fallback written at create time (boardUrl only)
 *   4) Deprecated env.MURAL_REFLEXIVE_MURAL_ID (warning)
 */

import {
	buildAuthUrl,
	exchangeAuthCode,
	refreshAccessToken,
	verifyHomeOfficeByCompany,
	ensureUserRoom,           // find existing only (no create)
	ensureProjectFolder,
	createMural,
	getMural,
	getMe,
	getWorkspace,
	getActiveWorkspaceIdFromMe,
	listUserWorkspaces,
	getWidgets,
	createSticky,
	updateSticky,
	ensureTagsBlueberry,
	applyTagsToSticky,
	normaliseWidgets,
	findLatestInCategory,
	getMuralLinks,
	createViewerLink
} from "../../lib/mural.js";

import { b64Encode, b64Decode } from "../../core/utils.js";

/**
 * @typedef {import("../index.js").ResearchOpsService} ResearchOpsService
 */

const GRID_Y = 32;
const DEFAULT_W = 240;
const DEFAULT_H = 120;
const PURPOSE_REFLEXIVE = "reflexive_journal";

/** In-process soft cache (evicted on cold starts) */
const _memCache = new Map(); // key: `${projectId}·${uid||""}·${purpose}` → { muralId, boardUrl, workspaceId, ts, primary }

/* ───────────────────────── Airtable helpers ───────────────────────── */

function _airtableHeaders(env) {
	return {
		Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
		"Content-Type": "application/json"
	};
}

function _boardsTableName(env) {
	const override = typeof env.AIRTABLE_TABLE_MURAL_BOARDS === "string" ?
		env.AIRTABLE_TABLE_MURAL_BOARDS.trim() :
		"";
	return override || "Mural Boards";
}

function _encodeTableUrl(env, tableName) {
	return `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${encodeURIComponent(tableName)}`;
}

/** Escape double quotes for filterByFormula string literals */
function _esc(v) {
	return String(v ?? "").replace(/"/g, '\\"');
}

/** Normalise ALLOWED_ORIGINS (array or comma-separated string) and validate return URL origin. */
function _isAllowedReturn(env, urlStr) {
	try {
		const u = new URL(urlStr);
		const raw = env.ALLOWED_ORIGINS;
		const list = Array.isArray(raw) ?
			raw :
			String(raw || "")
			.split(",")
			.map(s => s.trim())
			.filter(Boolean);
		return list.includes(`${u.protocol}//${u.host}`);
	} catch {
		return false;
	}
}

/**
 * Build Airtable filter for UID / Purpose / Active only (PROJECT FILTER REMOVED).
 * We filter by projectId **client-side** after fetching to avoid schema-dependent formula errors.
 */
function _buildBoardsFilter({ /* projectId intentionally omitted */ uid, purpose, active = true }) {
	const ands = [];
	if (uid) ands.push(`{UID} = "${_esc(uid)}"`);
	if (purpose) ands.push(`{Purpose} = "${_esc(purpose)}"`);
	if (typeof active === "boolean") ands.push(`{Active} = ${active ? "1" : "0"}`);
	return ands.length ? `AND(${ands.join(",")})` : "";
}

/**
 * Query Airtable for Mural Boards records (without projectId clause).
 * Sorted by Primary? desc, Created At desc.
 * Then filter rows in code for projectId matching either:
 *  - linked-record array of IDs (includes projectId)
 *  - single-line text (=== projectId)
 */
async function _airtableListBoards(env, { projectId, uid, purpose, active = true, max = 25 }) {
	const url = new URL(_encodeTableUrl(env, _boardsTableName(env)));
	const filterByFormula = _buildBoardsFilter({ uid, purpose, active });
	if (filterByFormula) url.searchParams.set("filterByFormula", filterByFormula);
	url.searchParams.set("maxRecords", String(max));
	// Airtable-style sort params
	url.searchParams.append("sort[0][field]", "Primary?");
	url.searchParams.append("sort[0][direction]", "desc");
	url.searchParams.append("sort[1][field]", "Created At");
	url.searchParams.append("sort[1][direction]", "desc");

	const res = await fetch(url.toString(), { headers: _airtableHeaders(env) });
	const js = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error("airtable_list_failed"), { status: res.status, body: js });
	}

	const records = Array.isArray(js.records) ? js.records : [];
	if (!projectId) return records;

	// Client-side filter by projectId that works for both schemas
	const pid = String(projectId);
	return records.filter(r => {
		const f = r?.fields || {};
		const proj = f["Project"];
		if (Array.isArray(proj)) return proj.includes(pid);
		return String(proj || "") === pid;
	});
}

/** Create a board mapping row in Airtable. */
async function _airtableCreateBoard(env, { projectId, uid, purpose, muralId, boardUrl = null, workspaceId = null, primary = false, active = true }) {
	const url = _encodeTableUrl(env, _boardsTableName(env));

	const mkBodyLinked = () => ({
		records: [{
			fields: {
				"Project": [{ id: String(projectId) }],
				"UID": uid,
				"Purpose": purpose,
				"Mural ID": muralId,
				"Board URL": boardUrl,
				"Workspace ID": workspaceId,
				"Primary?": !!primary,
				"Active": !!active
			}
		}]
	});

	const mkBodyText = () => ({
		records: [{
			fields: {
				"Project": String(projectId),
				"UID": uid,
				"Purpose": purpose,
				"Mural ID": muralId,
				"Board URL": boardUrl,
				"Workspace ID": workspaceId,
				"Primary?": !!primary,
				"Active": !!active
			}
		}]
	});

	// Try linked-record, then fallback to text
	let res = await fetch(url, { method: "POST", headers: _airtableHeaders(env), body: JSON.stringify(mkBodyLinked()) });
	let js = await res.json().catch(() => ({}));
	if (res.ok) return js;

	const errStr = JSON.stringify(js || {});
	if (res.status === 422 || /UNKNOWN_FIELD_NAME|INVALID_VALUE|FIELD_VALUE_INVALID/i.test(errStr)) {
		res = await fetch(url, { method: "POST", headers: _airtableHeaders(env), body: JSON.stringify(mkBodyText()) });
		js = await res.json().catch(() => ({}));
		if (res.ok) return js;
	}

	throw Object.assign(new Error("airtable_create_failed"), { status: res.status, body: js });
}

/* ───────────────────────── URL helpers ───────────────────────── */

function _looksLikeMuralViewerUrl(u) {
	try {
		const x = new URL(u);
		return x.hostname === "app.mural.co" && /^\/t\/[^/]+\/m\/[^/]+/i.test(x.pathname);
	} catch { return false; }
}

/** Normalise possible response shapes to a single viewer URL. */
function _extractViewerUrl(payload) {
	if (!payload) return null;
	const candidates = [
		payload.viewerUrl,
		payload.viewLink,
		payload._canvasLink,
		payload.openUrl,
		payload?.value?.viewerUrl,
		payload?.value?.viewLink,
		payload?.data?.viewerUrl,
		payload?.data?.viewLink,
		payload?.links?.viewer,
		payload?.links?.open
	].filter(Boolean);

	const first = candidates.find(_looksLikeMuralViewerUrl);
	return first || null;
}

/**
 * Try progressively harder to obtain a concrete viewer URL:
 *  1) hydrate GET /murals/:id
 *  2) GET /murals/:id/links
 *  3) POST /murals/:id/links or /share-links to create a viewer link
 * …and loop for up to ~45s.
 */
async function _waitForViewerUrl(env, accessToken, muralId, { maxWaitMs = 45000, intervalMs = 1000 } = {}) {
	let waited = 0;
	let createdOnce = false;

	while (waited < maxWaitMs) {
		// 1) hydrate
		try {
			const hydrated = await getMural(env, accessToken, muralId).catch(() => null);
			const url = _extractViewerUrl(hydrated);
			if (url) return url;
		} catch { /* ignore transient */ }

		// 2) list links
		try {
			const links = await getMuralLinks(env, accessToken, muralId).catch(() => []);
			const link = links.find(l =>
				LooksLikeViewer(l.url) ||
				["viewer", "view", "open"].includes(String(l.rel || l.type || l.kind || "").toLowerCase())
			);
			if (link?.url && _looksLikeMuralViewerUrl(link.url)) return link.url;
		} catch { /* ignore */ }

		// 3) actively create once
		if (!createdOnce) {
			try {
				const createdUrl = await createViewerLink(env, accessToken, muralId);
				if (createdUrl && _looksLikeMuralViewerUrl(createdUrl)) return createdUrl;
				createdOnce = true;
			} catch { /* ignore */ }
		}

		await new Promise(r => setTimeout(r, intervalMs));
		waited += intervalMs;
	}

	function LooksLikeViewer(u) {
		try {
			const x = new URL(u);
			return x.hostname === "app.mural.co" && /\/m\//.test(x.pathname);
		} catch { return false; }
	}

	return null;
}

/* ───────────────────────── KV helpers ───────────────────────── */

async function _kvProjectMapping(env, { uid, projectId }) {
	const key = `mural:${uid || "anon"}:project:id::${String(projectId || "")}`;
	const raw = await env.SESSION_KV.get(key);
	if (!raw) return null;
	try { return JSON.parse(raw); } catch { return null; }
}

/* ───────────────────────── Workspace helpers ───────────────────────── */

function _workspaceCandidateShapes(entry) {
	if (!entry || typeof entry !== "object") return [];
	const shapes = [entry];
	if (entry.value && typeof entry.value === "object") shapes.push(entry.value);
	if (entry.workspace && typeof entry.workspace === "object") {
		shapes.push(entry.workspace);
		if (entry.workspace.value && typeof entry.workspace.value === "object") {
			shapes.push(entry.workspace.value);
		}
	}

	const seen = new Set();
	const candidates = [];

	for (const shape of shapes) {
		if (!shape || typeof shape !== "object" || seen.has(shape)) continue;
		seen.add(shape);
		const id = shape.id || shape.workspaceId || shape.workspaceID || null;
		const key = shape.key || shape.shortId || shape.workspaceKey || shape.slug || null;
		const name = shape.name || shape.title || shape.displayName || null;
		const companyId = shape.companyId || shape.company?.id || null;
		const shortId = shape.shortId || null;

		if (id || key || shortId) {
			candidates.push({ id, key, shortId, name, companyId });
		}
	}

	return candidates;
}

async function _resolveWorkspace(env, accessToken, { workspaceHint, companyId } = {}) {
	const hint = String(workspaceHint || "").trim();
	if (!hint) return null;

	const hintLower = hint.toLowerCase();

	// First attempt: treat hint as actual workspace id.
	try {
		const direct = await getWorkspace(env, accessToken, hint);
		const val = direct?.value || direct || {};
		return {
			id: val.id || val.workspaceId || hint,
			key: val.key || val.shortId || hint,
			name: val.name || val.title || val.displayName || null
		};
	} catch (err) {
		if (Number(err?.status || 0) && Number(err.status) !== 404) throw err;
	}

	// Fallback: list workspaces available to user and match against hint.
	const matches = [];
	let cursor = null;
	const maxPages = 4;

	for (let page = 0; page < maxPages; page += 1) {
		let payload;
		try {
			payload = await listUserWorkspaces(env, accessToken, { cursor });
		} catch (err) {
			if (Number(err?.status || 0) === 404) break;
			throw err;
		}

		const list = Array.isArray(payload?.value) ?
			payload.value :
			Array.isArray(payload?.workspaces) ?
			payload.workspaces :
			[];

		for (const entry of list) {
			for (const cand of _workspaceCandidateShapes(entry)) {
				matches.push(cand);
			}
		}

		cursor = payload?.cursor ||
			payload?.nextCursor ||
			payload?.pagination?.nextCursor ||
			payload?.pagination?.next ||
			null;

		if (!cursor) break;
	}

	const matched = matches.find(cand => {
		const values = [cand.id, cand.key, cand.shortId]
			.filter(Boolean)
			.map(v => String(v).toLowerCase());
		return values.includes(hintLower);
	}) || matches.find(cand => {
		if (!companyId) return false;
		const cid = String(cand.companyId || "").toLowerCase();
		return Boolean(cid && cid === String(companyId).toLowerCase() && (cand.name || "").toLowerCase() === hintLower);
	});

	if (matched) {
		const idCandidate = matched.id || matched.key || matched.shortId || hint;
		try {
			const detail = await getWorkspace(env, accessToken, idCandidate);
			const val = detail?.value || detail || {};
			return {
				id: val.id || val.workspaceId || idCandidate,
				key: val.key || val.shortId || matched.key || matched.shortId || hint,
				name: val.name || val.title || val.displayName || matched.name || null
			};
		} catch (err) {
			if (Number(err?.status || 0) && Number(err.status) !== 404) throw err;
			return {
				id: idCandidate,
				key: matched.key || matched.shortId || idCandidate,
				name: matched.name || null
			};
		}
	}

	// Final attempt: composite "company:workspace" id (observed in some tenants).
	if (companyId) {
		const composite = `${String(companyId).trim()}:${hint}`;
		try {
			const detail = await getWorkspace(env, accessToken, composite);
			const val = detail?.value || detail || {};
			return {
				id: val.id || val.workspaceId || composite,
				key: val.key || val.shortId || hint,
				name: val.name || val.title || val.displayName || null
			};
		} catch (err) {
			if (Number(err?.status || 0) && Number(err.status) !== 404) throw err;
		}
	}

	return { id: hint, key: hint };
}

/* ───────────────────────── Shape helpers ───────────────────────── */

// Coerce an ID out of many possible Mural shapes
function _pickId(obj) {
	return obj?.id ||
		obj?.roomId ||
		obj?.folderId ||
		obj?.value?.id ||
		obj?.data?.id ||
		null;
}

/* ───────────────────────── Class ───────────────────────── */

export class MuralServicePart {
	/** @param {ResearchOpsService} root */
	constructor(root) { this.root = root; }

	// KV tokens
	kvKey(uid) { return `mural:${uid}:tokens`; }
	async saveTokens(uid, tokens) { await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(tokens), { encryption: true }); }
	async loadTokens(uid) { const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid)); return raw ? JSON.parse(raw) : null; }

	/* ───────────────────────── internal helpers ───────────────────────── */

	async _ensureWorkspace(env, accessToken, explicitWorkspaceId) {
		const inCompany = await verifyHomeOfficeByCompany(env, accessToken);
		if (!inCompany) throw Object.assign(new Error("not_in_home_office_workspace"), { code: 403 });

		if (explicitWorkspaceId) {
			// Validate the explicit workspace id if passed from client
			try {
				const ws = await getWorkspace(env, accessToken, explicitWorkspaceId);
				const v = ws?.value || ws || {};
				return { id: v.id || explicitWorkspaceId, key: v.key || v.shortId || null, name: v.name || null };
			} catch {
				// Fall back to active
			}
		}

		const me = await getMe(env, accessToken);
		const wsHint = getActiveWorkspaceIdFromMe(me);
		if (!wsHint) throw new Error("no_active_workspace");

		const companyId = me?.value?.companyId || me?.companyId || null;
		const resolved = await _resolveWorkspace(env, accessToken, { workspaceHint: wsHint, companyId });
		if (!resolved?.id) {
			return { id: wsHint, key: wsHint };
		}

		return {
			id: resolved.id,
			key: resolved.key || null,
			name: resolved.name || null
		};
	}

	/**
	 * Resolve a Mural board by (projectId[, uid], purpose).
	 * Priority:
	 *  1) explicitMuralId (if provided)
	 *  2) Airtable mapping (cached)
	 *  2b) KV fallback (Airtable not yet visible)
	 *  3) env.MURAL_REFLEXIVE_MURAL_ID (deprecated)
	 */
	async resolveBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, explicitMuralId }) {
		// 1) Explicit
		if (explicitMuralId) return { muralId: String(explicitMuralId) };

		// 2) Airtable lookup (allow uid to be absent)
		if (projectId) {
			const cacheKey = `${projectId}·${uid || ""}·${purpose}`;
			const cached = _memCache.get(cacheKey);
			if (cached && (Date.now() - cached.ts < 60_000)) {
				return { muralId: cached.muralId, boardUrl: cached.boardUrl, workspaceId: cached.workspaceId };
			}

			const rows = await _airtableListBoards(this.root.env, { projectId, uid, purpose, active: true, max: 25 });
			const top = rows[0];
			if (top?.fields) {
				const f = top.fields;
				const rec = {
					muralId: String(f["Mural ID"] || ""),
					boardUrl: f["Board URL"] || null,
					workspaceId: f["Workspace ID"] || null,
					primary: !!f["Primary?"]
				};
				if (rec.muralId) {
					_memCache.set(cacheKey, { ...rec, ts: Date.now() });
					return rec;
				}
			}

			// 2b) KV fallback (Airtable not yet visible)
			const kv = await _kvProjectMapping(this.root.env, { uid, projectId });
			if (kv?.url) {
				if (_looksLikeMuralViewerUrl(kv.url)) {
					return { muralId: null, boardUrl: kv.url, workspaceId: null };
				} else {
					// Clean stale/bad KV so we stop returning /not-found
					try {
						const key = `mural:${uid || "anon"}:project:id::${String(projectId)}`;
						await this.root.env.SESSION_KV.delete(key);
					} catch { /* ignore */ }
				}
			}
		}

		// 3) Deprecated env fallback
		const envId = this.root?.env?.MURAL_REFLEXIVE_MURAL_ID;
		if (envId) {
			this.root.log?.warn?.("mural.deprecated_env_id", { note: "Migrate to Airtable 'Mural Boards'." });
			return { muralId: String(envId) };
		}

		return null;
	}

	async registerBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, muralId, boardUrl = null, workspaceId = null, primary = true }) {
		if (!projectId || !uid || !muralId) return { ok: false, error: "missing_fields" };
		await _airtableCreateBoard(this.root.env, { projectId, uid, purpose, muralId, boardUrl, workspaceId, primary, active: true });
		const cacheKey = `${projectId}·${uid}·${purpose}`;
		_memCache.set(cacheKey, { muralId, boardUrl, workspaceId, ts: Date.now(), primary: !!primary });
		return { ok: true };
	}

	async _getValidAccessToken(uid) {
		const tokens = await this.loadTokens(uid);
		if (!tokens?.access_token) return { ok: false, reason: "not_authenticated" };

		let accessToken = tokens.access_token;
		try {
			await verifyHomeOfficeByCompany(this.root.env, accessToken);
			return { ok: true, token: accessToken };
		} catch (err) {
			const status = Number(err?.status || 0);
			if (status === 401 && tokens.refresh_token) {
				try {
					const refreshed = await refreshAccessToken(this.root.env, tokens.refresh_token);
					const merged = { ...tokens, ...refreshed };
					await this.saveTokens(uid, merged);
					accessToken = merged.access_token;

					await verifyHomeOfficeByCompany(this.root.env, accessToken);
					return { ok: true, token: accessToken };
				} catch {
					return { ok: false, reason: "not_authenticated" };
				}
			}
			return { ok: false, reason: "error" };
		}
	}

	/* ───────────────────────── Routes ───────────────────────── */

	async muralAuth(origin, url) {
		const uid = url.searchParams.get("uid") || "anon";
		const ret = url.searchParams.get("return") || "";
		let safeReturn = "/pages/projects/";

		if (ret && _isAllowedReturn(this.root.env, ret)) {
			safeReturn = ret; // absolute + allowed
		} else if (ret.startsWith("/")) {
			safeReturn = ret; // relative path
		}

		const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
		const redirect = buildAuthUrl(this.root.env, state);
		return Response.redirect(redirect, 302);
	}

	async muralCallback(origin, url) {
		const { env } = this.root;

		if (!env.MURAL_CLIENT_SECRET) {
			return this.root.json({
				ok: false,
				error: "missing_secret",
				message: "MURAL_CLIENT_SECRET is not configured in Cloudflare secrets."
			}, 500, this.root.corsHeaders(origin));
		}

		const code = url.searchParams.get("code");
		const stateB64 = url.searchParams.get("state");
		if (!code) {
			const fallback = "/pages/projects/";
			return Response.redirect(fallback + "#mural-auth-missing-code", 302);
		}

		let uid = "anon";
		let stateObj = {};
		try {
			stateObj = JSON.parse(b64Decode(stateB64 || ""));
			uid = stateObj?.uid || "anon";
		} catch { /* ignore */ }

		// Exchange code → tokens
		let tokens;
		try {
			tokens = await exchangeAuthCode(env, code);
		} catch {
			const want = stateObj?.return || "/pages/projects/";
		 return Response.redirect(`${want}#mural-token-exchange-failed`, 302);
		}

		await this.saveTokens(uid, tokens);

		// Build redirect target
		const want = stateObj?.return || "/pages/projects/";
		let backUrl;

		if (want.startsWith("http")) {
			backUrl = _isAllowedReturn(env, want) ? new URL(want) : new URL("/pages/projects/", url);
		} else {
			backUrl = new URL(want, url);
		}

		// Append mural=connected param
		const sp = new URLSearchParams(backUrl.search);
		sp.set("mural", "connected");
		backUrl.search = sp.toString();

		return Response.redirect(backUrl.toString(), 302);
  }

	async muralVerify(origin, url) {
		const uid = url.searchParams.get("uid") || "anon";
		const tokens = await this.loadTokens(uid);
		if (!tokens?.access_token) {
			return this.root.json({ ok: false, reason: "not_authenticated" }, 401, this.root.corsHeaders(origin));
		}

		const { env } = this.root;
		let accessToken = tokens.access_token;

		// Try company/workspace check; if 401, refresh once and retry
		try {
			const inCompany = await verifyHomeOfficeByCompany(env, accessToken);
			if (!inCompany) {
			 return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, this.root.corsHeaders(origin));
			}
		} catch (err) {
			const status = Number(err?.status || 0);
			if (status === 401 && tokens.refresh_token) {
				try {
					const refreshed = await refreshAccessToken(env, tokens.refresh_token);
					const merged = { ...tokens, ...refreshed };
					await this.saveTokens(uid, merged);
					accessToken = merged.access_token;

					const inCompany = await verifyHomeOfficeByCompany(env, accessToken);
					if (!inCompany) {
						return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, this.root.corsHeaders(origin));
					}
				} catch {
					return this.root.json({ ok: false, reason: "not_authenticated" }, 401, this.root.corsHeaders(origin));
				}
			} else {
				return this.root.json({ ok: false, reason: "error", detail: String(err?.message || err) }, 500, this.root.corsHeaders(origin));
			}
		}

		const me = await getMe(env, accessToken).catch(() => null);
		const activeWorkspaceId = getActiveWorkspaceIdFromMe(me);

		return this.root.json({ ok: true, me, activeWorkspaceId }, 200, this.root.corsHeaders(origin));
	}

	/** GET /api/mural/me  (debug helper) */
	async muralMe(origin, url) {
		const cors = this.root.corsHeaders(origin);
		const uid = url.searchParams.get("uid") || "anon";
		const tokens = await this.loadTokens(uid);
		if (!tokens?.access_token) {
			return this.root.json({ ok: false, reason: "not_authenticated" }, 401, cors);
		}
		try {
			const me = await getMe(this.root.env, tokens.access_token);
			return this.root.json({
				ok: true,
				me,
				activeWorkspaceId: getActiveWorkspaceIdFromMe(me)
			}, 200, cors);
		} catch (e) {
			const status = Number(e?.status) || 500;
			const detail = String(e?.message || e);
			if (status === 401) {
				return this.root.json({ ok: false, reason: "not_authenticated", detail }, 401, cors);
			}
			return this.root.json({ ok: false, error: "me_failed", detail }, status, cors);
		}
	}

	/** POST /api/mural/setup  body: { uid, projectId?, projectName, workspaceId? } */
	async muralSetup(request, origin) {
		const cors = this.root.corsHeaders(origin);
		let step = "parse_input";

		try {
			const { uid = "anon", projectId = null, projectName, workspaceId: wsOverride } = await request.json().catch(() => ({}));
			if (!projectName || !String(projectName).trim()) {
				return this.root.json({ ok: false, error: "projectName required" }, 400, cors);
			}

			step = "load_tokens";
			const tokens = await this.loadTokens(uid);
			if (!tokens?.access_token) {
				return this.root.json({ ok: false, reason: "not_authenticated" }, 401, cors);
			}

			step = "verify_workspace";
			let accessToken = tokens.access_token;
			let ws;
			try {
				ws = await this._ensureWorkspace(this.root.env, accessToken, wsOverride);
			} catch (err) {
				const code = Number(err?.status || err?.code || 0);
				if (code === 401 && tokens.refresh_token) {
					const refreshed = await refreshAccessToken(this.root.env, tokens.refresh_token);
					const merged = { ...tokens, ...refreshed };
					await this.saveTokens(uid, merged);
					accessToken = merged.access_token;
					ws = await this._ensureWorkspace(this.root.env, accessToken, wsOverride);
				} else if (String(err?.message) === "not_in_home_office_workspace") {
					return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, cors);
				} else {
					throw err;
				}
			}

			step = "get_me";
			const me = await getMe(this.root.env, accessToken).catch(() => null);
			const username = me?.value?.firstName || me?.name || "Private";

			step = "ensure_room";
			let room;
			try {
				room = await ensureUserRoom(this.root.env, accessToken, ws.id, username);
			} catch (e) {
				// If no room exists, stop here with a helpful message (don’t attempt to create rooms).
				if (e?.code === "no_existing_room" || Number(e?.status) === 409) {
					return this.root.json({
						ok: false,
						error: "no_existing_room",
						step,
						message: "No existing room found in your Mural workspace. Create a private room in Mural, then try again."
					}, 409, cors);
				}
				throw e;
			}
			const roomId = _pickId(room);
			if (!roomId) {
				this.root.log?.error?.("mural.ensure_room.no_id", { roomPreview: typeof room === "object" ? Object.keys(room || {}) : room });
				return this.root.json({
					ok: false,
					error: "room_id_unavailable",
					step,
					message: "Could not resolve a room id from Mural response"
				}, 502, cors);
			}

			step = "ensure_folder";
			let folder = await ensureProjectFolder(this.root.env, accessToken, roomId, String(projectName).trim());
			const folderId = _pickId(folder);
			if (!folderId) {
				this.root.log?.warn?.("mural.ensure_folder.no_id", { folderPreview: typeof folder === "object" ? Object.keys(folder || {}) : folder });
			}

			// Create mural, then obtain a REAL viewer URL (no synthetic links)
			step = "create_mural";
			const mural = await createMural(this.root.env, accessToken, {
				title: "Reflexive Journal",
				roomId,
				folderId: folderId || undefined
			});

			step = "await_viewer_url";
			const openUrl = await _waitForViewerUrl(this.root.env, accessToken, mural.id, {
				maxWaitMs: 45000,
				intervalMs: 1000
			});

			if (!openUrl) {
				return this.root.json({
					ok: false,
					error: "viewer_link_unavailable",
					step,
					message: "The board was created but its open link isn’t ready yet. Please try again in a moment from the dashboard."
				}, 502, cors);
			}

			// Persist mapping
			let registered = false;
			if (projectId) {
				try {
					await this.registerBoard({
						projectId: String(projectId),
						uid,
						purpose: PURPOSE_REFLEXIVE,
						muralId: mural.id,
						boardUrl: openUrl,
						workspaceId: ws.id,
						primary: true
					});
					registered = true;
				} catch (e) {
					this.root.log?.error?.("mural.airtable_register_failed", {
						status: e?.status,
						body: e?.body
					});
				}
			}

			// KV backup only for valid viewer URLs
			try {
				if (projectId && openUrl && _looksLikeMuralViewerUrl(openUrl)) {
					const kvKey = `mural:${uid}:project:id::${String(projectId)}`;
					await this.root.env.SESSION_KV.put(kvKey, JSON.stringify({
						url: openUrl,
						projectName: projectName,
						updatedAt: Date.now()
					}));
				}
			} catch { /* non-fatal */ }

			return this.root.json({
				ok: true,
				workspace: ws,
				room,
				folder,
				mural: { ...mural, viewLink: openUrl },
				projectId: projectId || null,
				registered,
				boardUrl: openUrl
			}, 200, cors);

		} catch (err) {
			const status = Number(err?.status) || 500;
			const body = err?.body || null;
			const message = String(err?.message || "setup_failed");
			return this.root.json({ ok: false, error: "setup_failed", step, message, upstream: body }, status, cors);
		}
	}

	/**
	 * GET /api/mural/resolve?projectId=rec...&uid=anon&purpose=reflexive_journal
	 * Returns { ok:true, muralId, boardUrl? } or 404 {ok:false,error:"not_found"}.
	 * uid is optional (falls back to project-only resolution).
	 */
	async muralResolve(origin, url) {
		const cors = this.root.corsHeaders(origin);
		try {
			const projectId = url.searchParams.get("projectId") || "";
			const uid = url.searchParams.get("uid") || "";
			const purpose = url.searchParams.get("purpose") || PURPOSE_REFLEXIVE;

			if (!projectId) {
				return this.root.json({ ok: false, error: "missing_projectId" }, 400, cors);
			}

			const resolved = await this.resolveBoard({ projectId, uid: uid || undefined, purpose });
			if (!resolved?.muralId && !resolved?.boardUrl) {
				return this.root.json({ ok: false, error: "not_found" }, 404, cors);
			}
			return this.root.json({
				ok: true,
				muralId: resolved.muralId || null,
				boardUrl: resolved.boardUrl || null
			}, 200, cors);
		} catch (e) {
			const msg = String(e?.message || e || "");
			return this.root.json({ ok: false, error: "resolve_failed", detail: msg }, 500, cors);
		}
	}

	/**
	 * POST /api/mural/journal-sync
	 */
	async muralJournalSync(request, origin) {
		const cors = this.root.corsHeaders(origin);
		let step = "parse_input";

		try {
			const body = await request.json().catch(() => ({}));
			const uid = String(body?.uid || "anon");
			const purpose = String(body?.purpose || PURPOSE_REFLEXIVE);
			const category = String(body?.category || "").toLowerCase().trim();
			const description = String(body?.description || "").trim();
			const labels = Array.isArray(body?.tags) ? body.tags.filter(Boolean) : [];

			if (!category || !description) {
				return this.root.json({ ok: false, error: "missing_category_or_description" }, 400, cors);
			}
			if (!["perceptions", "procedures", "decisions", "introspections"].includes(category)) {
				return this.root.json({ ok: false, error: "unsupported_category" }, 400, cors);
			}

			step = "resolve_board";
			const resolved = await this.resolveBoard({
				projectId: body.projectId,
				uid: uid || undefined,
				purpose,
				explicitMuralId: body.muralId
			});
			const muralId = resolved?.muralId || null;
			if (!muralId) {
				return this.root.json({
					ok: false,
					error: "no_mural_id",
					message: "No board found for (projectId[, uid], purpose) and no explicit muralId provided."
				}, 404, cors);
			}

			step = "access_token";
			const tokenRes = await this._getValidAccessToken(uid);
			if (!tokenRes.ok) {
				const code = tokenRes.reason === "not_authenticated" ? 401 : 500;
				return this.root.json({ ok: false, error: tokenRes.reason }, code, cors);
			}
			const accessToken = tokenRes.token;

			step = "load_widgets";
			const widgetsJs = await getWidgets(this.root.env, accessToken, muralId);
			const stickyList = normaliseWidgets(widgetsJs?.widgets);
			const last = findLatestInCategory(stickyList, category);

			let stickyId = null;
			let action = "";
			let targetX = last?.x ?? 200;
			let targetY = last?.y ?? 200;
			let targetW = last?.width ?? DEFAULT_W;
			let targetH = last?.height ?? DEFAULT_H;

			step = "write_or_create";
			if (last && (last.text || "").trim().length === 0) {
				await updateSticky(this.root.env, accessToken, muralId, last.id, { text: description });
				stickyId = last.id;
				action = "updated-empty-sticky";
			} else {
				if (last) {
					targetY = (last.y || 0) + (last.height || DEFAULT_H) + GRID_Y;
					targetX = last.x || targetX;
					targetW = last.width || targetW;
					targetH = last.height || targetH;
				}
				const crt = await createSticky(this.root.env, accessToken, muralId, {
					text: description,
					x: Math.round(targetX),
					y: Math.round(targetY),
					width: Math.round(targetW),
					height: Math.round(targetH)
				});
				stickyId = crt?.id || null;
				action = "created-new-sticky";
			}

			step = "tagging";
			if (labels.length && stickyId) {
				const tagIds = await ensureTagsBlueberry(this.root.env, accessToken, muralId, labels);
				if (tagIds.length) {
					await applyTagsToSticky(this.root.env, accessToken, muralId, stickyId, tagIds);
				}
			}

			return this.root.json({ ok: true, stickyId, action, muralId }, 200, cors);

		} catch (err) {
			const status = Number(err?.status) || 500;
			const body = err?.body || null;
			const message = String(err?.message || "journal_sync_failed");

			return this.root.json({ ok: false, error: "journal_sync_failed", step, message, upstream: body }, status, cors);
		}
	}

	/** TEMP debug */
	async muralDebugEnv(origin) {
		const env = this.root.env || {};
		return this.root.json({
			ok: true,
			has_CLIENT_ID: Boolean(env.MURAL_CLIENT_ID),
			has_CLIENT_SECRET: Boolean(env.MURAL_CLIENT_SECRET),
			redirect_uri: env.MURAL_REDIRECT_URI || "(unset)",
			scopes: env.MURAL_SCOPES || "(default)",
			company_id: env.MURAL_COMPANY_ID || "(unset)",
			airtable_base: Boolean(env.AIRTABLE_BASE_ID),
			airtable_key: Boolean(env.AIRTABLE_API_KEY)
		}, 200, this.root.corsHeaders(origin));
	}

	async muralDebugAuth(origin, url) {
		const uid = url.searchParams.get("uid") || "anon";
		const ret = url.searchParams.get("return");
		const safeReturn = (ret && ret.startsWith("/")) ? ret : "/pages/projects/";
		const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
		const authUrl = buildAuthUrl(this.root.env, state);
		return this.root.json({
			redirect_uri: this.root.env.MURAL_REDIRECT_URI,
			scopes: this.root.env.MURAL_SCOPES || "(default)",
			auth_url: authUrl
		}, 200, this.root.corsHeaders(origin));
	}
}e
