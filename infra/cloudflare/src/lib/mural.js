/**
 * @file lib/mural.js
 * @module lib/mural
 * @summary Mural API client library with OAuth2, workspace, room, and mural management.
 * @version 2.4.0
 *
 * 2.4.0:
 *  - Remove any fallback to shared "ResearchOps Boards" style rooms.
 *  - Introduce ensureUserRoom(): always use a room OWNED by the authenticated user.
 *  - Fix createMural() to use POST /murals with roomId in the body (per Mural public API).
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
	const id = workspaceId || env.MURAL_WORKSPACE_ID;
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

/**
 * Light-touch check that we are in the expected Home Office workspace.
 */
export async function verifyHomeOfficeByCompany(env, accessToken) {
	const wsId = env.MURAL_WORKSPACE_ID;
	if (!wsId) {
		return { ok: true, reason: "no_workspace_id_configured" };
	}

	const workspace = await getWorkspace(env, accessToken, wsId);
	const companyId = workspace?.companyId || workspace?.value?.companyId;
	const companyName = workspace?.companyName || workspace?.value?.companyName;

	const isHomeOffice = typeof companyId === "string" && companyId.toLowerCase().includes("homeoffice");
	return {
		ok: isHomeOffice,
		workspaceId: wsId,
		companyId,
		companyName
	};
}

/* ───────────────── Rooms & folders ───────────────── */

/**
 * Ensure we are using a room that is OWNED by the authenticated user.
 *
 * This matches the Mural API requirement for POST /murals:
 * "Create a mural in a room owned by the authenticated user".  [oai_citation:1‡developers.mural.co](https://developers.mural.co/public/reference/createmural?utm_source=chatgpt.com)
 *
 * Flow:
 *  - Get current user (users/me)
 *  - List rooms for the workspace
 *  - Prefer a room whose owner/createdBy matches this user
 *  - If none found, create a new room in this workspace for them
 */
export async function ensureUserRoom(env, accessToken, workspaceId, roomName) {
	const wsId = workspaceId || env.MURAL_WORKSPACE_ID;
	if (!wsId) throw new Error("workspaceId is required for ensureUserRoom()");

	const me = await getMe(env, accessToken);
	const mv = me?.value || me || {};
	const userId = String(mv.id || mv.userId || "").toLowerCase();
	const userLabel = `${mv.firstName || ""} ${mv.lastName || ""}`.trim() || mv.email || "User";

	const roomsUrl = `https://app.mural.co/api/public/v1/workspaces/${wsId}/rooms`;
	const listRes = await fetch(roomsUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
	const listJs = await listRes.json().catch(() => ({}));
	if (!listRes.ok) {
		throw Object.assign(new Error(`List rooms failed: ${listRes.status}`), { status: listRes.status, body: listJs });
	}

	const rooms = listJs?.value || listJs?.rooms || [];
	console.log("[mural.ensureUserRoom] Rooms in workspace", {
		workspaceId: wsId,
		count: rooms.length
	});

	// 1) Prefer a room clearly owned by this user.
	const ownedRoom = rooms.find(r => {
		const ownerId = String(
			r.ownerId ||
			r.owner?.id ||
			r.createdBy?.id ||
			r.createdByUserId ||
			""
		).toLowerCase();

		return userId && ownerId && ownerId === userId;
	});

	if (ownedRoom) {
		console.log("[mural.ensureUserRoom] Using existing owned room", {
			roomId: ownedRoom.id,
			name: ownedRoom.name || ownedRoom.title
		});
		return ownedRoom;
	}

	// 2) Optional: soft hint by name, if caller provided roomName.
	if (roomName) {
		const byName = rooms.find(r => (r.name || r.title || "").toLowerCase() === roomName.toLowerCase());
		if (byName) {
			console.log("[mural.ensureUserRoom] Using room by name (no explicit owner match)", {
				roomId: byName.id,
				name: byName.name || byName.title
			});
			return byName;
		}
	}

	// 3) No suitable room: create one that will be owned by this user.
	const desiredName =
		roomName ||
		env.MURAL_DEFAULT_PERSONAL_ROOM_NAME ||
		`${userLabel} – ResearchOps`;

	console.log("[mural.ensureUserRoom] Creating personal room for user", {
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
 * Ensure a folder for a given project exists inside a room.
 * We simply name the folder after the project.
 */
export async function ensureProjectFolder(env, accessToken, roomId, folderName) {
	if (!roomId) throw new Error("roomId is required for ensureProjectFolder()");
	if (!folderName) throw new Error("folderName (usually project name) is required for ensureProjectFolder()");

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

	console.log("[mural.ensureProjectFolder] Creating folder in room", {
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

/* ───────────────── Mural creation / duplication ───────────────── */

/**
 * Create a *blank* mural in a room/folder.
 *
 * Official endpoint:
 *   POST https://app.mural.co/api/public/v1/murals
 * with body: { title, roomId, folderId? }  [oai_citation:2‡developers.mural.co](https://developers.mural.co/public/reference/createmural?utm_source=chatgpt.com)
 */
export async function createMural(env, accessToken, { title, roomId, folderId }) {
	if (!roomId) throw new Error("roomId is required for createMural()");

	const url = "https://app.mural.co/api/public/v1/murals";
	const body = {
		title,
		roomId,
		...(folderId ? { folderId } : {})
	};

	console.log("[mural.createMural] Creating blank mural", { title, roomId, folderId });

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
			body: data
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
 * Template id defaults to env.MURAL_TEMPLATE_REFLEXIVE.
 * In your case this maps to:
 *   https://app.mural.co/t/pppt6786/m/pppt6786/1761511827081/76da04f30edfebd1ac5b595ad2953629b41c1c7d
 * where the final slug is the mural id.
 */
export async function duplicateMural(env, accessToken, { roomId, folderId, title }) {
	const templateId = env.MURAL_TEMPLATE_REFLEXIVE || "76da04f30edfebd1ac5b595ad2953629b41c1c7d";
	if (!templateId) throw new Error("No template mural id configured for duplication");
	if (!roomId) throw new Error("roomId is required for duplicateMural()");

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
		title: body.title
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
		bodyKeys: Object.keys(js || {})
	});

	if (!res.ok) {
		throw Object.assign(new Error(`Duplicate mural failed: ${res.status}`), {
			status: res.status,
			body: js
		});
	}

	const result = js?.value || js;
	console.log("[mural.duplicateMural] SUCCESS", {
		muralId: result?.id
	});
	return result;
}

/* ───────────────── Widgets & areas ───────────────── */

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

/**
 * Normalise a widgets array into a simple structure.
 */
export function normaliseWidgets(widgets) {
	const all = Array.isArray(widgets) ? widgets : [];
	const byId = new Map();
	const byType = new Map();

	for (const w of all) {
		if (!w || !w.id) continue;
		byId.set(w.id, w);
		const type = w.type || "unknown";
		if (!byType.has(type)) byType.set(type, []);
		byType.get(type).push(w);
	}

	return { all, byId, byType };
}

/**
 * Find the most recent widget in a category-like group using a predicate.
 */
export function findLatestInCategory(widgets, predicate) {
	const all = Array.isArray(widgets) ? widgets : [];
	let latest = null;
	for (const w of all) {
		if (!predicate(w)) continue;
		if (!latest || (w.createdOn || 0) > (latest.createdOn || 0)) {
			latest = w;
		}
	}
	return latest;
}

/**
 * Update the title of the first "area" widget to match "Reflexive Journal: <Project-Name>".
 * This helps make the board self-identifying once duplicated.
 */
export async function updateAreaTitle(env, accessToken, muralId, projectName) {
	if (!projectName) return null;

	const widgets = await getWidgets(env, accessToken, muralId);
	const areas = widgets.filter(w => w.type === "area");
	const first = areas[0];
	if (!first) {
		console.warn("[mural.updateAreaTitle] No area widgets found");
		return null;
	}

	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets/${first.id}`;
	const res = await fetch(url, {
		method: "PATCH",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify({ title: `Reflexive Journal: ${projectName}` })
	});
	const js = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error(`Update area title failed: ${res.status}`), {
			status: res.status,
			body: js
		});
	}
	return js;
}

/* ───────────────── Tags ───────────────── */

export async function ensureTagsBlueberry(env, accessToken, muralId, tagLabels) {
	if (!Array.isArray(tagLabels) || !tagLabels.length) return [];

	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/tags`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	const js = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error(`Get tags failed: ${res.status}`), {
			status: res.status,
			body: js
		});
	}

	const existing = js?.value || js?.tags || [];
	const created = [];
	const byLabel = new Map(existing.map(t => [(t.text || t.title || "").toLowerCase(), t]));

	for (const label of tagLabels) {
		const key = label.toLowerCase();
		const found = byLabel.get(key);
		if (found) {
			created.push(found);
			continue;
		}

		const createRes = await fetch(url, {
			method: "POST",
			headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
			body: JSON.stringify({ text: label })
		});
		const createJs = await createRes.json().catch(() => ({}));
		if (!createRes.ok) {
			throw Object.assign(new Error(`Create tag failed: ${createRes.status}`), {
				status: createRes.status,
				body: createJs
			});
		}
		const tag = createJs?.value || createJs;
		created.push(tag);
		byLabel.set(key, tag);
	}

	return created;
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
