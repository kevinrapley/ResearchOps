/**
 * @file lib/mural.js
 * @module lib/mural
 * @summary Mural API client library with OAuth2, workspace, room, and mural management.
 * @version 2.5.1
 *
 * 2.5.1:
 *  - Resolve template mural id from MURAL_TEMPLATE_REFLEXIVE without using the trailing hash.
 *    If a URL is provided, use the second-to-last path segment as the mural id.
 *  - Keep updateAreaTitle() using the /areas endpoint only (no widget fallback).
 *
 * 2.4.1:
 *  - Log current Mural user and room owner in duplicateMural() and createMural().
 *  - keep ensureUserRoom()/ensureDefaultRoom() so creation happens in a room
 *    owned by the authenticated user.
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
	if (state) url.searchParams.set("state", state);

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

/* ───────────────── Identity & workspaces ───────────────── */

export async function getMe(env, accessToken) {
	const url = "https://app.mural.co/api/public/v1/users/me";
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	const js = await res.json().catch(() => null);
	if (!res.ok) {
		throw Object.assign(new Error(`GET /users/me failed: ${res.status}`), { status: res.status, body: js });
	}
	return js;
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

/* ───────────────── Internal: room ownership helper ───────────────── */

/**
 * Look up room owner info for logging.
 * Uses env.MURAL_WORKSPACE_ID to list rooms and match by id.
 */
async function getRoomOwnerInfo(env, accessToken, roomId) {
	const workspaceId = env.MURAL_WORKSPACE_ID;
	if (!workspaceId || !roomId) {
		return null;
	}

	const listUrl = `https://app.mural.co/api/public/v1/workspaces/${workspaceId}/rooms`;
	try {
		const res = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
		const js = await res.json().catch(() => ({}));
		if (!res.ok) {
			console.warn("[mural.getRoomOwnerInfo] List rooms failed", {
				status: res.status,
				bodyKeys: Object.keys(js || {})
			});
			return null;
		}

		const rooms = js?.value || js?.rooms || [];
		const room = rooms.find(r => r.id === roomId);
		if (!room) {
			console.warn("[mural.getRoomOwnerInfo] Room not found in workspace", {
				workspaceId,
				roomId,
				roomCount: rooms.length
			});
			return { workspaceId, roomId, ownerId: null, ownerName: null, visibility: null };
		}

		const ownerId =
			room.ownerId ||
			room.owner?.id ||
			room.createdBy?.id ||
			room.createdByUserId ||
			null;

		const ownerName =
			room.owner?.fullName ||
			room.owner?.name ||
			room.owner?.email ||
			room.createdBy?.fullName ||
			room.createdBy?.name ||
			room.createdBy?.email ||
			null;

		const visibility = room.visibility || room.type || null;

		return {
			workspaceId,
			roomId,
			ownerId,
			ownerName,
			visibility
		};
	} catch (err) {
		console.warn("[mural.getRoomOwnerInfo] Error", { roomId, error: String(err?.message || err) });
		return null;
	}
}

/* ───────────────── Rooms & folders ───────────────── */

/**
 * Ensure we return a room that is OWNED by the authenticated user.
 */
export async function ensureUserRoom(env, accessToken, workspaceId, roomName) {
	const wsId = String(workspaceId || env.MURAL_WORKSPACE_ID || "").trim();
	if (!wsId) throw new Error("workspaceId is required for ensureUserRoom()");

	const me = await getMe(env, accessToken);
	const mv = me?.value || me || {};
	const userId = String(mv.id || mv.userId || "").toLowerCase();
	const userLabel = `${mv.firstName || ""} ${mv.lastName || ""}`.trim() || mv.email || mv.id || "Unknown user";

	const roomsUrl = `https://app.mural.co/api/public/v1/workspaces/${wsId}/rooms`;
	const listRes = await fetch(roomsUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
	const listJs = await listRes.json().catch(() => ({}));

	if (!listRes.ok) {
		throw Object.assign(new Error(`List rooms failed: ${listRes.status}`), {
			status: listRes.status,
			body: listJs
		});
	}

	const rooms = listJs?.value || listJs?.rooms || [];
	console.log("[mural.ensureUserRoom] Rooms in workspace", {
		workspaceId: wsId,
		roomCount: rooms.length,
		userId,
		userLabel
	});

	// 1) Prefer an owned room that matches the requested name (if provided).
	if (roomName) {
		const ownedNamed = rooms.find(r => {
			const ownerId = String(
				r.ownerId ||
				r.owner?.id ||
				r.createdBy?.id ||
				r.createdByUserId ||
				""
			).toLowerCase();
			const name = (r.name || r.title || "").toLowerCase();
			return ownerId === userId && name === roomName.toLowerCase();
		});
		if (ownedNamed) {
			console.log("[mural.ensureUserRoom] Using existing owned room (by name)", {
				roomId: ownedNamed.id,
				name: ownedNamed.name || ownedNamed.title
			});
			return ownedNamed;
		}
	}

	// 2) Otherwise, any room clearly owned by this user.
	const ownedAny = rooms.find(r => {
		const ownerId = String(
			r.ownerId ||
			r.owner?.id ||
			r.createdBy?.id ||
			r.createdByUserId ||
			""
		).toLowerCase();
		return ownerId && ownerId === userId;
	});

	if (ownedAny) {
		console.log("[mural.ensureUserRoom] Using existing owned room", {
			roomId: ownedAny.id,
			name: ownedAny.name || ownedAny.title
		});
		return ownedAny;
	}

	// 3) No owned rooms found: create a personal room for this user.
	const desiredName =
		roomName ||
		env.MURAL_DEFAULT_PERSONAL_ROOM_NAME ||
		`${userLabel} – ResearchOps`;

	console.log("[mural.ensureUserRoom] Creating personal room", {
		workspaceId: wsId,
		name: desiredName
	});

	const createRes = await fetch("https://app.mural.co/api/public/v1/rooms", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			name: desiredName,
			workspaceId: wsId
		})
	});
	const createJs = await createRes.json().catch(() => ({}));

	if (!createRes.ok) {
		throw Object.assign(new Error(`Create room failed: ${createRes.status}`), {
			status: createRes.status,
			body: createJs
		});
	}

	const created = createJs?.value || createJs;
	console.log("[mural.ensureUserRoom] Created personal room", {
		roomId: created.id,
		name: created.name || created.title
	});
	return created;
}

/**
 * Backwards-compatible wrapper: older code calls ensureDefaultRoom().
 * It delegates to ensureUserRoom(), so you only ever get user-owned rooms.
 */
export async function ensureDefaultRoom(env, accessToken, workspaceId, roomName) {
	return ensureUserRoom(env, accessToken, workspaceId, roomName);
}

/**
 * Ensure a folder for the project exists inside the given room.
 * Folder name is usually the project name.
 */
export async function ensureProjectFolder(env, accessToken, roomId, folderName) {
	if (!roomId) throw new Error("roomId is required for ensureProjectFolder()");
	if (!folderName) throw new Error("folderName is required for ensureProjectFolder()");

	const listUrl = `https://app.mural.co/api/public/v1/rooms/${roomId}/folders`;
	const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
	const listJs = await listRes.json().catch(() => ({}));

	if (!listRes.ok) {
		throw Object.assign(new Error(`List folders failed: ${listRes.status}`), {
			status: listRes.status,
			body: listJs
		});
	}

	const folders = listJs?.value || listJs?.folders || [];
	const existing = folders.find(f => (f.name || f.title || "").toLowerCase() === folderName.toLowerCase());
	if (existing) {
		console.log("[mural.ensureProjectFolder] Found existing folder", {
			roomId,
			folderId: existing.id,
			name: existing.name || existing.title
		});
		return existing;
	}

	console.log("[mural.ensureProjectFolder] Creating folder", {
		roomId,
		name: folderName
	});

	const createRes = await fetch(listUrl, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify({ name: folderName })
	});
	const createJs = await createRes.json().catch(() => ({}));

	if (!createRes.ok) {
		throw Object.assign(new Error(`Create folder failed: ${createRes.status}`), {
			status: createRes.status,
			body: createJs
		});
	}

	const created = createJs?.value || createJs;
	console.log("[mural.ensureProjectFolder] Created folder", {
		roomId,
		folderId: created.id,
		name: created.name || created.title
	});
	return created;
}

/* ───────────────── Template mural id helper ───────────────── */

/**
 * Resolve the template mural id from configuration.
 *
 * Expected configs:
 *  - MURAL_TEMPLATE_REFLEXIVE = "<mural-id>"
 *    e.g. "1761511827081" or "pppt6786.1761511827081"
 *
 *  - MURAL_TEMPLATE_REFLEXIVE = full board URL
 *    e.g. "https://app.mural.co/t/.../m/.../<mural-id>/<key>"
 *
 * For URLs we take the SECOND-TO-LAST path segment as the mural id,
 * not the trailing hash/key.
 */
function resolveTemplateMuralId(env) {
	const raw = String(env.MURAL_TEMPLATE_REFLEXIVE || "").trim();

	if (!raw) {
		throw new Error("MURAL_TEMPLATE_REFLEXIVE is not configured (template mural id or URL required)");
	}

	if (/^https?:\/\//i.test(raw)) {
		try {
			const u = new URL(raw);
			const parts = u.pathname.split("/").filter(Boolean);
			if (parts.length < 2) {
				throw new Error("Not enough path segments to derive mural id");
			}
			// For /t/<tenant>/m/<ws>/<mural-id>/<key> → take second-to-last segment
			const muralId = parts[parts.length - 2];
			console.log("[mural.resolveTemplateMuralId] Derived mural id from URL", {
				raw,
				muralId
			});
			return muralId;
		} catch (err) {
			console.error("[mural.resolveTemplateMuralId] Failed to parse MURAL_TEMPLATE_REFLEXIVE URL", {
				raw,
				error: String(err?.message || err)
			});
			throw new Error("Could not derive mural id from MURAL_TEMPLATE_REFLEXIVE URL");
		}
	}

	// Non-URL: assume it's directly the mural id (no hash inference).
	console.log("[mural.resolveTemplateMuralId] Using configured mural id", { muralId: raw });
	return raw;
}

/* ───────────────── Mural creation / duplication ───────────────── */

export async function createMural(env, accessToken, { title, roomId, folderId }) {
	if (!roomId) throw new Error("roomId is required for createMural()");

	let currentUser = null;
	let ownerInfo = null;

	try {
		const me = await getMe(env, accessToken);
		const mv = me?.value || me || {};
		currentUser = {
			id: mv.id || mv.userId || null,
			name: `${mv.firstName || ""} ${mv.lastName || ""}`.trim() || mv.email || null
		};
	} catch (err) {
		console.warn("[mural.createMural] Failed to fetch current user for logging", {
			error: String(err?.message || err)
		});
	}

	try {
		ownerInfo = await getRoomOwnerInfo(env, accessToken, roomId);
	} catch (err) {
		console.warn("[mural.createMural] Failed to fetch room owner info", {
			roomId,
			error: String(err?.message || err)
		});
	}

	console.log("[mural.createMural] Creating blank mural", {
		title,
		roomId,
		folderId: folderId || null,
		currentUser,
		roomOwner: ownerInfo
	});

	const url = "https://app.mural.co/api/public/v1/murals";
	const body = {
		title,
		roomId,
		...(folderId ? { folderId } : {})
	};

	const res = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});

	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		console.error("[mural.createMural] Failed", {
			status: res.status,
			statusText: res.statusText,
			body: data,
			currentUser,
			roomOwner: ownerInfo
		});
		throw Object.assign(new Error(`Create mural failed: ${res.status}`), {
			status: res.status,
			body: data
		});
	}

	const result = data?.value || data;
	console.log("[mural.createMural] Success", { muralId: result?.id });
	return result;
}

export async function getMural(env, accessToken, muralId) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	const js = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error(`GET /murals/${muralId} failed: ${res.status}`), {
			status: res.status,
			body: js
		});
	}
	return js;
}

/**
 * Duplicate a mural from a template into a room/folder.
 *
 * Template id is derived from env.MURAL_TEMPLATE_REFLEXIVE:
 *  - either a direct mural id, or
 *  - a full board URL (second-to-last path segment is used as the id).
 */
export async function duplicateMural(env, accessToken, { roomId, folderId, title }) {
	if (!roomId) {
		console.error("[mural.duplicateMural] No roomId provided");
		throw new Error("roomId is required for duplicateMural()");
	}

	const templateId = resolveTemplateMuralId(env);

	let currentUser = null;
	let ownerInfo = null;

	try {
		const me = await getMe(env, accessToken);
		const mv = me?.value || me || {};
		currentUser = {
			id: mv.id || mv.userId || null,
			name: `${mv.firstName || ""} ${mv.lastName || ""}`.trim() || mv.email || null
		};
	} catch (err) {
		console.warn("[mural.duplicateMural] Failed to fetch current user for logging", {
			error: String(err?.message || err)
		});
	}

	try {
		ownerInfo = await getRoomOwnerInfo(env, accessToken, roomId);
	} catch (err) {
		console.warn("[mural.duplicateMural] Failed to fetch room owner info", {
			roomId,
			error: String(err?.message || err)
		});
	}

	const url = `https://app.mural.co/api/public/v1/murals/${templateId}/duplicate`;
	const body = {
		title: title || "Reflexive Journal",
		roomId,
		...(folderId ? { folderId } : {})
	};

	console.log("[mural.duplicateMural] Attempting template duplication", {
		rawTemplateConfig: env.MURAL_TEMPLATE_REFLEXIVE || null,
		templateId,
		title: body.title,
		roomId,
		folderId: folderId || null,
		currentUser,
		roomOwner: ownerInfo
	});

	const res = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});

	const js = await res.json().catch(() => ({}));

	console.log("[mural.duplicateMural] Response", {
		status: res.status,
		statusText: res.statusText,
		ok: res.ok,
		bodyKeys: Object.keys(js || {}),
		currentUser,
		roomOwner: ownerInfo
	});

	if (!res.ok) {
		console.error("[mural.duplicateMural] FAILED", {
			status: res.status,
			body: js,
			templateId,
			roomId,
			currentUser,
			roomOwner: ownerInfo
		});
		throw Object.assign(new Error(`Duplicate mural failed: ${res.status}`), {
			status: res.status,
			body: js
		});
	}

	const result = js?.value || js;
	console.log("[mural.duplicateMural] SUCCESS", {
		muralId: result?.id,
		templateId,
		roomId
	});
	return result;
}

/* ───────────────── Widgets ───────────────── */

export async function getWidgets(env, accessToken, muralId) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	const js = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error(`GET /murals/${muralId}/widgets failed: ${res.status}`), {
			status: res.status,
			body: js
		});
	}
	return js?.value || js?.widgets || [];
}

export async function createSticky(env, accessToken, muralId, { text, x, y, width = 240, height = 120 }) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets`;
	const body = {
		type: "sticky-note",
		text,
		geometry: { x, y, width, height }
	};

	const res = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});

	const js = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error(`Create sticky failed: ${res.status}`), {
			status: res.status,
			body: js
		});
	}
	return js;
}

export async function updateSticky(env, accessToken, muralId, widgetId, patch) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets/${widgetId}`;
	const res = await fetch(url, {
		method: "PATCH",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify(patch)
	});
	const js = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error(`Update sticky failed: ${res.status}`), {
			status: res.status,
			body: js
		});
	}
	return js;
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

/* ───────────────── Areas: title update via /areas ───────────────── */

export async function getAreasForMural(env, accessToken, muralId) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/areas`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	const js = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error(`GET /murals/${muralId}/areas failed: ${res.status}`), {
			status: res.status,
			body: js
		});
	}
	return js?.value || js?.areas || [];
}

export async function patchArea(env, accessToken, muralId, areaId, patch) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/areas/${areaId}`;
	const res = await fetch(url, {
		method: "PATCH",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify(patch)
	});
	const js = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error(`PATCH /murals/${muralId}/areas/${areaId} failed: ${res.status}`), {
			status: res.status,
			body: js
		});
	}
	return js?.value || js;
}

/**
 * After duplication, find the area that has a title like
 * "Reflexive Journal: <Project-Name>" and rename it to include the actual project name.
 *
 * This *only* uses the /areas endpoint (no widget fallback).
 */
export async function updateAreaTitle(env, accessToken, muralId, projectName) {
	if (!projectName) return;

	const trimmedName = String(projectName).trim();
	if (!trimmedName) return;

	console.log("[mural.updateAreaTitle] Resolving areas for mural", {
		muralId,
		projectName: trimmedName
	});

	const areas = await getAreasForMural(env, accessToken, muralId);
	const debugAreas = areas.map(a => ({
		id: a.id,
		title: a.title || a.name || "",
		type: a.type || null
	}));
	console.log("[mural.updateAreaTitle] Areas fetched", {
		muralId,
		count: areas.length,
		areas: debugAreas
	});

	const needlePrefix = "reflexive journal:";
	const needlePlaceholder = "<project-name>";

	let target = null;

	for (const a of areas) {
		const title = String(a.title || a.name || "").trim();
		const lower = title.toLowerCase();
		if (lower.startsWith(needlePrefix) || lower.includes(needlePlaceholder)) {
			target = a;
			break;
		}
	}

	if (!target) {
		console.warn("[mural.updateAreaTitle] No matching area title found", {
			muralId,
			projectName: trimmedName
		});
		return;
	}

	const newTitle = `Reflexive Journal: ${trimmedName}`;
	console.log("[mural.updateAreaTitle] Patching area title", {
		muralId,
		areaId: target.id,
		oldTitle: target.title || target.name || "",
		newTitle
	});

	const patched = await patchArea(env, accessToken, muralId, target.id, { title: newTitle });

	console.log("[mural.updateAreaTitle] Area title updated", {
		muralId,
		areaId: target.id,
		finalTitle: patched.title || patched.name || newTitle
	});
}

/* ───────────────── Tags ───────────────── */

export async function ensureTagsBlueberry(env, accessToken, muralId, tagLabels) {
	if (!Array.isArray(tagLabels) || !tagLabels.length) return [];
	const listUrl = `https://app.mural.co/api/public/v1/murals/${muralId}/tags`;
	const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
	const listData = await listRes.json().catch(() => ({}));
	if (!listRes.ok) {
		console.warn("[ensureTagsBlueberry] Failed to list tags:", listRes.status);
		return [];
	}
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
			const created = await createRes.json().catch(() => ({}));
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
	const js = await res.json().catch(() => ({}));
	if (!res.ok) return [];
	return js?.value || js?.links || [];
}

export async function createViewerLink(env, accessToken, muralId) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/links`;
	const res = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify({ type: "viewer" })
	});
	const js = await res.json().catch(() => ({}));
	if (!res.ok) return null;
	return js?.url || js?.value?.url || null;
}
