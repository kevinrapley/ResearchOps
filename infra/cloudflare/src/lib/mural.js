/**
 * @file lib/mural.js
 * @module lib/mural
 * @summary Mural API client library with OAuth2, workspace, room, and mural management.
 * @version 2.3.1
 *
 * 2.3.0:
 *  - Added duplicateMural() to copy from a template board
 *  - Added updateAreaTitle() to rename the "Reflexive Journal: <Project-Name>" area
 */

export function buildAuthUrl(env, state) {
	const clientId = env.MURAL_CLIENT_ID;
	const redirectUri = env.MURAL_REDIRECT_URI;
	const scopes = env.MURAL_SCOPES || "identity:read murals:read murals:write offline_access";

	if (!clientId || !redirectUri) {
		throw new Error("Mural OAuth environment (MURAL_CLIENT_ID / MURAL_REDIRECT_URI) not configured");
	}

	const url = new URL("https://app.mural.co/api/public/v1/authorization/oauth2/");
	url.searchParams.set("client_id", clientId);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("redirect_uri", redirectUri);
	url.searchParams.set("scope", scopes);
	if (state) url.searchParams.set("state", state);

	return url.toString();
}

export async function exchangeAuthCode(env, code) {
	const clientId = env.MURAL_CLIENT_ID;
	const clientSecret = env.MURAL_CLIENT_SECRET;
	const redirectUri = env.MURAL_REDIRECT_URI;

	if (!clientId || !clientSecret || !redirectUri) {
		throw new Error("MURAL_CLIENT_ID, MURAL_CLIENT_SECRET, and MURAL_REDIRECT_URI must be configured");
	}

	const url = "https://app.mural.co/api/public/v1/authorization/oauth2/token";
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: redirectUri,
		client_id: clientId,
		client_secret: clientSecret
	});

	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body
	});

	const js = await res.json().catch(() => null);

	if (!res.ok) {
		throw Object.assign(new Error(`Mural token exchange failed: ${res.status}`), {
			status: res.status,
			body: js
		});
	}

	return js;
}

export async function refreshAccessToken(env, refreshToken) {
	const clientId = env.MURAL_CLIENT_ID;
	const clientSecret = env.MURAL_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error("MURAL_CLIENT_ID and MURAL_CLIENT_SECRET must be configured");
	}

	const url = "https://app.mural.co/api/public/v1/authorization/oauth2/refresh";
	const body = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: refreshToken,
		client_id: clientId,
		client_secret: clientSecret
	});

	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body
	});

	const js = await res.json().catch(() => null);

	if (!res.ok) {
		throw Object.assign(new Error(`Mural token refresh failed: ${res.status}`), {
			status: res.status,
			body: js
		});
	}

	return js;
}

/* ───────────────── Identity & workspaces ───────────────── */

export async function getMe(env, accessToken) {
	const url = "https://app.mural.co/api/public/v1/users/me";
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	const js = await res.json().catch(() => null);
	if (!res.ok) {
		throw Object.assign(new Error(`Get me failed: ${res.status}`), { status: res.status, body: js });
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
 * Verify the authenticated user is in Home Office workspace by company slug.
 */
export async function verifyHomeOfficeByCompany(env, accessToken) {
	const workspaceId = env.MURAL_WORKSPACE_ID;
	if (!workspaceId) {
		console.warn("[mural.verifyHomeOfficeByCompany] No MURAL_WORKSPACE_ID configured; skipping strict company check");
		return { ok: true, reason: "no_workspace_id_configured" };
	}

	const workspace = await getWorkspace(env, accessToken, workspaceId);
	const companyId = workspace?.companyId || workspace?.value?.companyId;
	const companyName = workspace?.companyName || workspace?.value?.companyName;

	const isHomeOffice = typeof companyId === "string" && companyId.toLowerCase().includes("homeoffice");
	return {
		ok: isHomeOffice,
		workspaceId,
		companyId,
		companyName
	};
}

/* ───────────────── Rooms & folders ───────────────── */

export async function ensureDefaultRoom(env, accessToken, workspaceId, roomName) {
	const wsId = workspaceId || env.MURAL_WORKSPACE_ID;
	if (!wsId) throw new Error("workspaceId is required for ensureDefaultRoom()");

	const targetName = roomName || env.MURAL_ROOM_NAME || "ResearchOps Boards";

	const url = new URL(`https://app.mural.co/api/public/v1/workspaces/${wsId}/rooms`);
	url.searchParams.set("limit", "100");

	console.log("[mural.ensureDefaultRoom] Listing rooms", { workspaceId: wsId });

	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	const js = await res.json().catch(() => null);
	if (!res.ok) {
		throw Object.assign(new Error(`List rooms failed: ${res.status}`), { status: res.status, body: js });
	}

	const rooms = Array.isArray(js?.value) ? js.value : js?.rooms || [];
	const existing = rooms.find(r => (r.name || "").trim() === targetName.trim());

	if (existing) {
		console.log("[mural.ensureDefaultRoom] Found existing room", { roomId: existing.id, name: existing.name });
		return existing;
	}

	console.log("[mural.ensureDefaultRoom] Creating room", { name: targetName });

	const createUrl = "https://app.mural.co/api/public/v1/rooms";
	const createRes = await fetch(createUrl, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify({ name: targetName, workspaceId: wsId })
	});
	const created = await createRes.json().catch(() => null);
	if (!createRes.ok) {
		throw Object.assign(new Error(`Create room failed: ${createRes.status}`), {
			status: createRes.status,
			body: created
		});
	}
	console.log("[mural.ensureDefaultRoom] Created room", { roomId: created?.id, name: created?.name });
	return created;
}

export async function ensureProjectFolder(env, accessToken, roomId, folderName) {
	if (!roomId) throw new Error("roomId is required for ensureProjectFolder()");

	const targetName = folderName || "ResearchOps Projects";

	const listUrl = `https://app.mural.co/api/public/v1/rooms/${roomId}/folders`;
	const listRes = await fetch(listUrl, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (!listRes.ok) {
		const text = await listRes.text().catch(() => "");
		throw Object.assign(new Error(`List room folders failed: ${listRes.status}`), {
			status: listRes.status,
			body: text
		});
	}
	const listJs = await listRes.json().catch(() => ({}));
	const folders = Array.isArray(listJs?.value) ? listJs.value : listJs?.folders || [];
	const existing = folders.find(f => (f.name || "").trim() === targetName.trim());
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

export async function createMural(env, accessToken, { title, roomId, folderId }) {
	if (!roomId) throw new Error("roomId is required for createMural()");
	// Updated to use the public /murals endpoint with room placement via body.roomId
	const url = "https://app.mural.co/api/public/v1/murals";
	const body = { title, roomId, ...(folderId ? { folderId } : {}) };

	console.log("[mural.createMural] Creating blank mural", { title, roomId, folderId });

	const res = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		console.error("[mural.createMural] Failed", { status: res.status, body: text });
		throw Object.assign(new Error(`Create mural failed: ${res.status}`), { status: res.status, body: text });
	}

	const data = await res.json();
	const result = data?.value || data;
	console.log("[mural.createMural] Success", { muralId: result?.id });
	return result;
}

/**
 * GET /murals/{muralId}
 */
export async function getMural(env, accessToken, muralId) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw Object.assign(new Error(`Get mural failed: ${res.status}`), { status: res.status, body: text });
	}
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

	console.log("[mural.duplicateMural] Attempting duplication", { templateId, roomId, folderId, title: body.title });

	const res = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		console.error("[mural.duplicateMural] FAILED", { status: res.status, body: text });
		throw Object.assign(new Error(`Duplicate mural failed: ${res.status}`), {
			status: res.status,
			body: text
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
	const url = new URL(`https://app.mural.co/api/public/v1/murals/${muralId}/widgets`);
	url.searchParams.set("limit", "1000");
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	const js = await res.json().catch(() => null);
	if (!res.ok) {
		throw Object.assign(new Error(`Get widgets failed: ${res.status}`), { status: res.status, body: js });
	}
	return Array.isArray(js?.value) ? js.value : js?.widgets || [];
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

	const js = await res.json().catch(() => null);
	if (!res.ok) {
		throw Object.assign(new Error(`Create sticky failed: ${res.status}`), { status: res.status, body: js });
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
	const js = await res.json().catch(() => null);
	if (!res.ok) {
		throw Object.assign(new Error(`Update sticky failed: ${res.status}`), { status: res.status, body: js });
	}
	return js;
}

/**
 * Normalise Mural widgets array into a lookup structure by type and category-like tags.
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
 */
export async function updateAreaTitle(env, accessToken, muralId, projectName) {
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
	const js = await res.json().catch(() => null);
	if (!res.ok) {
		throw Object.assign(new Error(`Update area title failed: ${res.status}`), { status: res.status, body: js });
	}
	return js;
}

/* ───────────────── Tags ───────────────── */

export async function ensureTagsBlueberry(env, accessToken, muralId, tagLabels) {
	const url = `https://app.mural.co/api/public/v1/murals/${muralId}/tags`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
	const js = await res.json().catch(() => null);
	if (!res.ok) {
		throw Object.assign(new Error(`Get tags failed: ${res.status}`), { status: res.status, body: js });
	}
	const existing = Array.isArray(js?.value) ? js.value : js?.tags || [];
	const created = [];

	for (const label of tagLabels) {
		const already = existing.find(t => (t.text || "").toLowerCase() === label.toLowerCase());
		if (already) {
			created.push(already);
			continue;
		}

		const createRes = await fetch(url, {
			method: "POST",
			headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
			body: JSON.stringify({ text: label })
		});
		const createJs = await createRes.json().catch(() => null);
		if (!createRes.ok) {
			throw Object.assign(new Error(`Create tag failed: ${createRes.status}`), {
				status: createRes.status,
				body: createJs
			});
		}
		created.push(createJs);
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
