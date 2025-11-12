/**
 * @file lib/mural.js
 * @module lib/mural
 * @summary Mural API client library with OAuth2, workspace, room, and mural management.
 * @version 2.3.0
 *
 * Changes in 2.2.0:
 *  - Create murals via POST /rooms/{roomId}/murals (fixes 404 PATH_NOT_FOUND)
 *  - Create rooms via new endpoint POST /rooms (fallback to legacy)
 *  - Added ensureDefaultRoom() for consistent board creation under a known room
 *  - Safer error reporting and improved compatibility with early-2025 API updates
 *
 * Changes in 2.3.0:
 *  - Added duplicateMural() for template-based board creation (e.g. Reflexive Journal template)
 */

/* ═══════════════════════════════════════════════════════════════════════════════
 * OAuth 2.0 Flow
 * ═══════════════════════════════════════════════════════════════════════════════ */

export function buildAuthUrl(env, state) {
	const clientId = env.MURAL_CLIENT_ID;
	const redirectUri = env.MURAL_REDIRECT_URI;
	const scopes = env.MURAL_SCOPES || "identity:read murals:read murals:write offline_access";

	if (!clientId || !redirectUri) {
		const missing = [];
		if (!clientId) missing.push("MURAL_CLIENT_ID");
		if (!redirectUri) missing.push("MURAL_REDIRECT_URI");
		throw new Error(`Missing required Mural OAuth config: ${missing.join(", ")}`);
	}

	const url = new URL("https://app.mural.co/api/public/v1/authorization/oauth2");
	url.searchParams.set("client_id", clientId);
	url.searchParams.set("redirect_uri", redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", scopes);
	url.searchParams.set("state", state);
	return url.toString();
}

export async function exchangeAuthCode(env, code) {
	const clientId = env.MURAL_CLIENT_ID;
	const clientSecret = env.MURAL_CLIENT_SECRET;
	const redirectUri = env.MURAL_REDIRECT_URI;

	if (!clientId || !clientSecret || !redirectUri) {
		throw new Error("Missing Mural OAuth credentials for token exchange");
	}

	const res = await fetch("https://app.mural.co/api/public/v1/authorization/oauth2/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: redirectUri,
			client_id: clientId,
			client_secret: clientSecret
		}).toString()
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw Object.assign(new Error(`Token exchange failed: ${res.status}`), { status: res.status, body: text });
	}
	return res.json();
}

export async function refreshAccessToken(env, refreshToken) {
	const clientId = env.MURAL_CLIENT_ID;
	const clientSecret = env.MURAL_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error("Missing Mural OAuth credentials for token refresh");
	}

	const res = await fetch("https://app.mural.co/api/public/v1/authorization/oauth2/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: clientId,
			client_secret: clientSecret
		}).toString()
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw Object.assign(new Error(`Token refresh failed: ${res.status}`), { status: res.status, body: text });
	}
	return res.json();
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * Verification & Identity
 * ═══════════════════════════════════════════════════════════════════════════════ */

export async function getMe(env, accessToken) {
	const url = "https://app.mural.co/api/public/v1/users/me";
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	if (!res.ok) throw Object.assign(new Error(`GET /users/me failed: ${res.status}`), { status: res.status });
	return res.json();
}

export async function getWorkspace(env, accessToken, workspaceId) {
	const id = String(workspaceId || "").trim();
	if (!id) throw new Error("workspaceId required");

	const url = `https://app.mural.co/api/public/v1/workspaces/${id}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	const js = await res.json().catch(() => null);
	if (!res.ok) {
		throw Object.assign(new Error(`Get workspace failed: ${res.status}`), { status: res.status, body: js });
	}
	return js;
}

export async function listUserWorkspaces(env, accessToken, { cursor } = {}) {
	const url = new URL("https://app.mural.co/api/public/v1/users/me/workspaces");
	if (cursor) url.searchParams.set("cursor", cursor);
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	const js = await res.json().catch(() => null);
	if (!res.ok) {
		throw Object.assign(new Error(`List user workspaces failed: ${res.status}`), { status: res.status, body: js });
	}
	return js || {};
}

export function getActiveWorkspaceIdFromMe(me) {
	const v = me?.value || me || {};
	return (
		v.activeWorkspace?.id ||
		v.activeWorkspaceId ||
		v.lastActiveWorkspace ||
		null
	);
}

export async function verifyHomeOfficeByCompany(env, accessToken) {
	const expected = String(env.MURAL_COMPANY_ID || "homeofficegovuk").trim().toLowerCase();
	if (!expected) return true;

	const me = await getMe(env, accessToken);
	const v = me?.value || me || {};
	const companyId = String(v.companyId || v.company?.id || "").trim().toLowerCase();
	return Boolean(companyId && companyId === expected);
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * Room & Folder Management
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Ensure a room exists for a user or default policy.
 * New API (2025): POST /rooms
 * Legacy fallback: POST /workspaces/:id/rooms
 */
export async function ensureDefaultRoom(env, accessToken, workspaceId, roomName) {
	const desired = roomName || env.DEFAULT_ROOM_NAME || "ResearchOps";
	const listUrl = `https://app.mural.co/api/public/v1/workspaces/${workspaceId}/rooms`;

	const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
	if (!listRes.ok) throw Object.assign(new Error(`List rooms failed: ${listRes.status}`), { status: listRes.status });
	const js = await listRes.json();
	const rooms = js?.value || js?.rooms || [];
	const existing = rooms.find(r => (r.name || r.title || "").toLowerCase() === desired.toLowerCase());
	if (existing) return existing;

	const body = JSON.stringify({ name: desired, workspaceId });
	const headers = {
		Authorization: `Bearer ${accessToken}`,
		"Content-Type": "application/json"
	};

	// Try new endpoint first
	let createRes = await fetch("https://app.mural.co/api/public/v1/rooms", {
		method: "POST",
		headers,
		body
	});
	if (!createRes.ok && createRes.status === 404) {
		// Legacy fallback
		createRes = await fetch(listUrl, { method: "POST", headers, body: JSON.stringify({ name: desired }) });
	}
	if (!createRes.ok) {
		const text = await createRes.text().catch(() => "");
		throw Object.assign(new Error(`Create room failed: ${createRes.status}`), { status: createRes.status, body: text });
	}
	const created = await createRes.json();
	return created?.value || created;
}

export async function ensureProjectFolder(env, accessToken, roomId, folderName) {
	const listUrl = `https://app.mural.co/api/public/v1/rooms/${roomId}/folders`;
	const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
	if (!listRes.ok) throw Object.assign(new Error(`List folders failed: ${listRes.status}`), { status: listRes.status });

	const js = await listRes.json();
	const folders = js?.value || js?.folders || [];
	const existing = folders.find(f => (f.name || f.title || "").toLowerCase() === folderName.toLowerCase());
	if (existing) return existing;

	const createRes = await fetch(listUrl, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify({ name: folderName })
	});
	if (!createRes.ok) {
		const text = await createRes.text().catch(() => "");
		throw Object.assign(new Error(`Create folder failed: ${createRes.status}`), { status: createRes.status, body: text });
	}
	return (await createRes.json())?.value;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * Mural Creation and Retrieval
 * ═══════════════════════════════════════════════════════════════════════════════ */

export async function createMural(env, accessToken, { title, roomId, folderId }) {
	if (!roomId) throw new Error("roomId is required for createMural()");
	const url = `https://app.mural.co/api/public/v1/rooms/${roomId}/murals`;
	const body = { title, ...(folderId ? { folderId } : {}) };

	const res = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw Object.assign(new Error(`Create mural failed: ${res.status}`), { status: res.status, body: text });
	}

	const data = await res.json();
	return data?.value || data;
}

/**
 * Duplicate an existing mural into a target room/folder.
 * Intended for template-based boards such as the Reflexive Journal.
 *
 * @param {any} env
 * @param {string} accessToken
 * @param {string} sourceMuralId - Template mural id to duplicate
 * @param {{ title:string, roomId:string, folderId?:string }} opts
 * @returns {Promise<any>} New mural object with id
 */
export async function duplicateMural(env, accessToken, sourceMuralId, { title, roomId, folderId }) {
	if (!sourceMuralId) throw new Error("sourceMuralId is required for duplicateMural()");
	if (!roomId) throw new Error("roomId is required for duplicateMural()");

	const url = `https://app.mural.co/api/public/v1/murals/${sourceMuralId}/duplicate`;
	const body = { title, roomId, ...(folderId ? { folderId } : {}) };

	const res = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw Object.assign(new Error(`Duplicate mural failed: ${res.status}`), { status: res.status, body: text });
	}

	const data = await res.json();
	return data?.value || data;
}

export async function getMural(env, accessToken, muralId) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	if (!res.ok) throw Object.assign(new Error(`GET /murals/${muralId} failed: ${res.status}`), { status: res.status });
	return res.json();
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * Widgets & Sticky Notes
 * ═══════════════════════════════════════════════════════════════════════════════ */

export async function getWidgets(env, accessToken, muralId) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	if (!res.ok) throw Object.assign(new Error(`GET /murals/${muralId}/widgets failed: ${res.status}`), { status: res.status });
	return res.json();
}

export async function createSticky(env, accessToken, muralId, { text, x, y, width = 240, height = 120 }) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets/sticky-note`;
	const res = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify({ text, x, y, width, height })
	});
	if (!res.ok) {
		const bodyText = await res.text().catch(() => "");
		throw Object.assign(new Error(`Create sticky failed: ${res.status}`), { status: res.status, body: bodyText });
	}
	return (await res.json())?.value;
}

export async function updateSticky(env, accessToken, muralId, widgetId, patch) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets/${widgetId}`;
	const res = await fetch(url, {
		method: "PATCH",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify(patch)
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw Object.assign(new Error(`Update sticky failed: ${res.status}`), { status: res.status, body: text });
	}
	return res.json();
}

export function normaliseWidgets(widgets) {
	if (!Array.isArray(widgets)) return [];
	return widgets.map(w => ({
		id: w.id,
		type: w.type,
		text: w.text || "",
		tags: Array.isArray(w.tags) ? w.tags : [],
		x: w.x,
		y: w.y,
		width: w.width,
		height: w.height,
		createdAt: w.createdAt || w.updatedAt || null
	}));
}

export function findLatestInCategory(list, category) {
	const key = String(category || "").toLowerCase();
	const stickies = (list || []).filter(w => (w.type || "").toLowerCase().includes("sticky"));
	const filtered = stickies.filter(w => {
		const tags = (w.tags || []).map(t => String(t).toLowerCase());
		const text = String(w.text || "").toLowerCase();
		return tags.includes(key) || text.startsWith(`[${key}]`);
	});
	if (!filtered.length) return null;
	if (filtered.some(w => w.createdAt)) {
		return filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
	}
	return filtered.sort((a, b) => ((b.y || 0) - (a.y || 0)) || ((b.x || 0) - (a.x || 0)))[0];
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * Tags
 * ═══════════════════════════════════════════════════════════════════════════════ */

export async function ensureTagsBlueberry(env, accessToken, muralId, tagLabels) {
	if (!Array.isArray(tagLabels) || !tagLabels.length) return [];
	const listUrl = `https://app.mural.co/api/public/v1/murals/${muralId}/tags`;
	const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
	if (!listRes.ok) {
		console.warn("[ensureTagsBlueberry] Failed to list tags:", listRes.status);
		return [];
	}
	const listData = await listRes.json();
	const existing = listData?.value || [];
	const tagMap = new Map(existing.map(t => [(t.title || t.label || "").toLowerCase(), t.id]));

	const out = [];
	for (const label of tagLabels) {
		const lower = label.toLowerCase();
		if (tagMap.has(lower)) {
			out.push(tagMap.get(lower));
			continue;
		}
		const createRes = await fetch(listUrl, {
			method: "POST",
			headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
			body: JSON.stringify({ title: label })
		});
		if (createRes.ok) {
			const created = await createRes.json();
			const id = created?.value?.id || created?.id;
			if (id) {
				out.push(id);
				tagMap.set(lower, id);
			}
		} else {
			console.warn("[ensureTagsBlueberry] Failed to create tag:", label, createRes.status);
		}
	}
	return out;
}

export async function applyTagsToSticky(env, accessToken, muralId, widgetId, tagIds) {
	if (!Array.isArray(tagIds) || !tagIds.length) return;
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets/${widgetId}`;
	await fetch(url, {
		method: "PATCH",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify({ tags: tagIds })
	}).catch(() => {});
}
