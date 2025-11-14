/**
 * @file lib/mural.js
 * @module lib/mural
 * @summary Mural API client library with OAuth2, workspace, room, and mural management.
 * @version 2.4.0
 *
 * 2.4.0:
 *  - Fix createMural() to use POST /murals with roomId in the body (Mural Public API shape).
 *  - Add findUserPrivateRoom() helper that prefers the logged-in user's private room,
 *    falling back to a named room (e.g. "ResearchOps Boards") via ensureDefaultRoom().
 *
 * 2.3.0:
 *  - Added duplicateMural() to copy from a template board
 *  - Added updateAreaTitle() to rename the "Reflexive Journal: <Project-Name>" area
 */

/* ───────────────── OAuth helpers ───────────────── */

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

/* ───────────────── Identity & workspace ───────────────── */

export async function getMe(env, accessToken) {
	const url = "https://app.mural.co/api/public/v1/users/me";
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	if (!res.ok) throw Object.assign(new Error(`GET /users/me failed: ${res.status}`), { status: res.status });
	return res.json();
}

export async function getWorkspace(env, accessToken, id) {
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

/* ───────────────── Rooms & folders ───────────────── */

/**
 * Ensure a named room exists in a workspace (used as a generic fallback).
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

	let createRes = await fetch("https://app.mural.co/api/public/v1/rooms", {
		method: "POST",
		headers,
		body
	});
	if (!createRes.ok && createRes.status === 404) {
		// Older API shape (deprecated but kept as a fallback)
		createRes = await fetch(listUrl, { method: "POST", headers, body: JSON.stringify({ name: desired }) });
	}
	if (!createRes.ok) {
		const text = await createRes.text().catch(() => "");
		throw Object.assign(new Error(`Create room failed: ${createRes.status}`), { status: createRes.status, body: text });
	}
	const created = await createRes.json();
	return created?.value || created;
}

/**
 * Prefer the logged-in user's private room in a workspace.
 * If not found, fall back to a named room (e.g. "ResearchOps Boards").
 *
 * This keeps the mental model:
 *  - Template lives in Kevin's private room.
 *  - Copies for others live in *their* private room.
 *  - As a safety net, we still have a shared "ResearchOps Boards" room.
 */
export async function findUserPrivateRoom(env, accessToken, workspaceId, roomName) {
	const targetName = roomName || env.MURAL_ROOM_NAME || "ResearchOps Boards";
	const listUrl = `https://app.mural.co/api/public/v1/workspaces/${workspaceId}/rooms`;

	const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
	if (!listRes.ok) {
		throw Object.assign(new Error(`List rooms failed: ${listRes.status}`), { status: listRes.status });
	}

	const js = await listRes.json().catch(() => ({}));
	const rooms = js?.value || js?.rooms || [];

	let userId = null;
	try {
		const me = await getMe(env, accessToken);
		const v = me?.value || me || {};
		userId = v.id || v.userId || null;
	} catch {
		// If this fails we still try heuristics below.
	}

	// 1) Prefer an explicit "private" / "personal" style room owned by the user.
	const privateRoom = rooms.find(r => {
		const type = String(r.type || r.roomType || "").toLowerCase();
		const visibility = String(r.visibility || "").toLowerCase();
		const ownerId =
			String(r.ownerId || r.owner?.id || r.createdBy?.id || "").toLowerCase();
		const matchesUser = userId && ownerId === String(userId).toLowerCase();

		return (
			visibility === "private" ||
			type === "private" ||
			type === "personal" ||
			(matchesUser && !["open", "public"].includes(visibility))
		);
	});

	if (privateRoom) return privateRoom;

	// 2) Fallback: named room (e.g. "ResearchOps Boards").
	const named = rooms.find(r => (r.name || r.title || "").toLowerCase() === targetName.toLowerCase());
	if (named) return named;

	// 3) Last resort: create / ensure a named shared room.
	return ensureDefaultRoom(env, accessToken, workspaceId, targetName);
}

/**
 * Ensure a folder for a project exists in a given room.
 */
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

/* ───────────────── Mural creation / duplication ───────────────── */

/**
 * Create a *blank* mural in a room / folder.
 *
 * Important: per Mural Public API, the endpoint is POST /murals
 * with roomId and optional folderId in the JSON body.
 */
export async function createMural(env, accessToken, { title, roomId, folderId }) {
	if (!roomId) throw new Error("roomId is required for createMural()");

	const url = "https://app.mural.co/api/public/v1/murals";
	const body = {
		title,
		roomId,
		...(folderId ? { folderId } : {})
	};

	console.log("[mural.createMural] Creating blank mural", { title, roomId, folderId, endpoint: url });

	const res = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		console.error("[mural.createMural] Failed", {
			status: res.status,
			statusText: res.statusText,
			body: text.slice(0, 1000)
		});
		throw Object.assign(new Error(`Create mural failed: ${res.status}`), { status: res.status, body: text });
	}

	const data = await res.json().catch(() => ({}));
	const result = data?.value || data;
	console.log("[mural.createMural] Success", { muralId: result?.id });
	return result;
}

export async function getMural(env, accessToken, muralId) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	if (!res.ok) throw Object.assign(new Error(`GET /murals/${muralId} failed: ${res.status}`), { status: res.status });
	return res.json();
}

/**
 * Duplicate a mural from a template into a room/folder.
 * We assume a template mural id configured in env.MURAL_TEMPLATE_REFLEXIVE,
 * falling back to the hash from the provided template URL.
 */
export async function duplicateMural(env, accessToken, { roomId, folderId, title }) {
	const templateId = env.MURAL_TEMPLATE_REFLEXIVE || "76da04f30edfebd1ac5b595ad2953629b41c1c7d";
	if (!templateId) {
		console.error("[mural.duplicateMural] No template ID configured");
		throw new Error("No template mural id configured for duplication");
	}
	if (!roomId) {
		console.error("[mural.duplicateMural] No roomId provided");
		throw new Error("roomId is required for duplicateMural()");
	}

	const url = `https://app.mural.co/api/public/v1/murals/${templateId}/duplicate`;
	const body = {
		title: title || "Reflexive Journal",
		roomId,
		...(folderId ? { folderId } : {})
	};

	console.log("[mural.duplicateMural] Attempting template duplication", {
		templateId,
		roomId,
		folderId,
		title: body.title,
		endpoint: url
	});

	const res = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});

	console.log("[mural.duplicateMural] Response received", {
		status: res.status,
		statusText: res.statusText,
		ok: res.ok,
		headers: Object.fromEntries(res.headers.entries())
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		console.error("[mural.duplicateMural] FAILED", {
			status: res.status,
			statusText: res.statusText,
			templateId,
			endpoint: url,
			responseBody: text.slice(0, 1000),
			requestBody: body
		});

		throw Object.assign(new Error(`Duplicate mural failed: ${res.status}`), {
			status: res.status,
			body: text,
			templateId,
			endpoint: url
		});
	}

	const js = await res.json().catch(() => ({}));
	const result = js?.value || js;
	console.log("[mural.duplicateMural] SUCCESS", {
		muralId: result?.id,
		hasValue: !!js?.value,
		responseKeys: Object.keys(js)
	});
	return result;
}

/* ───────────────── Widgets & areas ───────────────── */

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

/**
 * After duplication, find the area that has a title like
 * "Reflexive Journal: ..." and rename it to include the actual project name.
 */
export async function updateAreaTitle(env, accessToken, muralId, projectName) {
	if (!projectName) return;
	const widgets = await getWidgets(env, accessToken, muralId);
	const list = normaliseWidgets(widgets?.widgets);

	const target = list.find(w => {
		const t = String(w.text || "").trim();
		return t.toLowerCase().startsWith("reflexive journal:");
	});

	if (!target) return;

	const newTitle = `Reflexive Journal: ${projectName}`;
	await updateSticky(env, accessToken, muralId, target.id, { text: newTitle });
}

/* ───────────────── Tags ───────────────── */

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

/* ───────────────── Links ───────────────── */

export async function getMuralLinks(env, accessToken, muralId) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/links`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	if (!res.ok) return [];
	const js = await res.json().catch(() => ({}));
	return js?.value || js?.links || [];
}

export async function createViewerLink(env, accessToken, muralId) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/links`;
	const res = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify({ type: "viewer" })
	});
	if (!res.ok) return null;
	const js = await res.json().catch(() => ({}));
	return js?.url || js?.value?.url || null;
}
