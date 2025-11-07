/**
 * @file lib/mural.js
 * @module lib/mural
 * @summary Mural API client library with OAuth2, workspace management, and widget operations.
 * @version 2.1.0
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

/**
 * Retrieve metadata for a workspace by ID/key.
 * Tolerates either numeric IDs or legacy short codes.
 */
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

/** List workspaces available to the current user (single page). */
export async function listUserWorkspaces(env, accessToken, { cursor } = {}) {
  const url = new URL("https://app.mural.co/api/public/v1/users/me/workspaces");
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  const js = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(`List user workspaces failed: ${res.status}`), { status: res.status, body: js });
  }
  return js || {};
}

/**
 * Extract active workspace ID from /users/me response.
 * Supports multiple shapes: activeWorkspace.id, activeWorkspaceId, lastActiveWorkspace.
 */
export function getActiveWorkspaceIdFromMe(me) {
  const v = me?.value || me || {};
  return (
    v.activeWorkspace?.id ||
    v.activeWorkspaceId ||
    v.lastActiveWorkspace || // ← observed in your logs
    null
  );
}

/**
 * Verify user belongs to expected company (Home Office).
 * Relaxed: matches by companyId only; does NOT fail if no active workspace set.
 */
export async function verifyHomeOfficeByCompany(env, accessToken) {
  const expected = String(env.MURAL_COMPANY_ID || "homeofficegovuk").trim().toLowerCase();
  if (!expected) return true;

  const me = await getMe(env, accessToken);
  const v = me?.value || me || {};
  const companyId = String(v.companyId || v.company?.id || "").trim().toLowerCase();

  // If companyId matches, consider verified even if no workspace is active
  return Boolean(companyId && companyId === expected);
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * Workspace & Room Provisioning
 * ═══════════════════════════════════════════════════════════════════════════════ */

export async function ensureUserRoom(env, accessToken, workspaceId, username) {
  const listUrl = `https://app.mural.co/api/public/v1/workspaces/${workspaceId}/rooms`;
  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!listRes.ok) throw Object.assign(new Error(`List rooms failed: ${listRes.status}`), { status: listRes.status });

  const js = await listRes.json();
  const rooms = js?.value || js?.rooms || [];
  const name = `${username}'s Private Room`;
  const existing = rooms.find(r => (r.name || r.title || "").toLowerCase() === name.toLowerCase());
  if (existing) return existing;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  };
  const createBody = JSON.stringify({
    name,
    workspaceId,
    type: "private"
  });

  /**
   * Mural’s public API moved room creation from
   *   POST /workspaces/:workspaceId/rooms → POST /rooms
   * in early 2025. Try the new endpoint first, but fall back once for
   * tenants that might still be on the legacy path.
   */
  const newCreateUrl = "https://app.mural.co/api/public/v1/rooms";
  let createRes = await fetch(newCreateUrl, {
    method: "POST",
    headers,
    body: createBody
  });

  if (!createRes.ok && Number(createRes.status) === 404) {
    // Legacy fallback: POST /workspaces/:workspaceId/rooms with minimal body
    createRes = await fetch(listUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ name })
    });
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
  const existing = folders.find(f => (f.name || f.title || "").toLowerCase() === String(folderName).toLowerCase());
  if (existing) return existing;

  const createRes = await fetch(listUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name: folderName })
  });
  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    throw Object.assign(new Error(`Create folder failed: ${createRes.status}`), { status: createRes.status, body: text });
  }
  const created = await createRes.json();
  return created?.value || created;
}

export async function createMural(env, accessToken, { title, roomId, folderId }) {
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
    const textBody = await res.text().catch(() => "");
    throw Object.assign(new Error(`Create sticky failed: ${res.status}`), { status: res.status, body: textBody });
  }
  const data = await res.json();
  return data?.value || data;
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

/**
 * Heuristic “latest in category”: prefer most recent (createdAt), fallback to layout (y/x).
 */
export function findLatestInCategory(list, category) {
  const key = String(category || "").toLowerCase();
  const stickyList = (list || []).filter(w => (w.type || "").toLowerCase().includes("sticky"));
  const filtered = stickyList.filter(w => {
    const tags = (w.tags || []).map(t => String(t).toLowerCase());
    const text = String(w.text || "").toLowerCase();
    return tags.includes(key) || text.startsWith(`[${key}]`);
  });
  if (!filtered.length) return null;

  const withTs = filtered.some(w => w.createdAt);
  if (withTs) {
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
    const lower = String(label).toLowerCase();
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
