/**
 * @file lib/mural.js
 * @module lib/mural
 * @summary Mural API client library with OAuth2, workspace management, and widget operations.
 * @version 2.0.0
 *
 * Key functions:
 * - OAuth: buildAuthUrl, exchangeAuthCode, refreshAccessToken
 * - Verification: verifyHomeOfficeByCompany
 * - Provisioning: ensureUserRoom, ensureProjectFolder, createMural
 * - Operations: getWidgets, createSticky, updateSticky, ensureTagsBlueberry, applyTagsToSticky
 */

/* ═══════════════════════════════════════════════════════════════════════════════
 * OAuth 2.0 Flow
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Build Mural OAuth authorization URL.
 * @param {any} env - Environment variables
 * @param {string} state - Opaque state parameter (base64 JSON)
 * @returns {string} Full authorization URL
 * @throws {Error} If CLIENT_ID or REDIRECT_URI missing
 */
export function buildAuthUrl(env, state) {
  const clientId = env.MURAL_CLIENT_ID;
  const redirectUri = env.MURAL_REDIRECT_URI;
  const scopes = env.MURAL_SCOPES || "identity:read murals:read murals:write";
  
  // Critical: throw error instead of returning "/" to prevent worker root redirect
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
  
  console.log("[buildAuthUrl] Generated OAuth URL:", url.toString());
  return url.toString();
}

/**
 * Exchange authorization code for access/refresh tokens.
 * @param {any} env
 * @param {string} code
 * @returns {Promise<{access_token:string, refresh_token:string, expires_in:number}>}
 */
export async function exchangeAuthCode(env, code) {
  const clientId = env.MURAL_CLIENT_ID;
  const clientSecret = env.MURAL_CLIENT_SECRET;
  const redirectUri = env.MURAL_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Mural OAuth credentials for token exchange");
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
    body: body.toString()
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`Token exchange failed: ${res.status}`), {
      status: res.status,
      body: text
    });
  }

  return res.json();
}

/**
 * Refresh access token using refresh token.
 * @param {any} env
 * @param {string} refreshToken
 * @returns {Promise<{access_token:string, refresh_token:string, expires_in:number}>}
 */
export async function refreshAccessToken(env, refreshToken) {
  const clientId = env.MURAL_CLIENT_ID;
  const clientSecret = env.MURAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Mural OAuth credentials for token refresh");
  }

  const url = "https://app.mural.co/api/public/v1/authorization/oauth2/token";
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`Token refresh failed: ${res.status}`), {
      status: res.status,
      body: text
    });
  }

  return res.json();
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * Verification & Identity
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Get current user's profile.
 * @param {any} env
 * @param {string} accessToken
 * @returns {Promise<any>}
 */
export async function getMe(env, accessToken) {
  const url = "https://app.mural.co/api/public/v1/users/me";
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw Object.assign(new Error(`GET /users/me failed: ${res.status}`), {
      status: res.status
    });
  }

  return res.json();
}

/**
 * Extract active workspace ID from /users/me response.
 * @param {any} me
 * @returns {string|null}
 */
export function getActiveWorkspaceIdFromMe(me) {
  return me?.value?.defaultWorkspaceId || me?.defaultWorkspaceId || null;
}

/**
 * Verify user belongs to Home Office company/workspace.
 * @param {any} env
 * @param {string} accessToken
 * @returns {Promise<boolean>}
 */
export async function verifyHomeOfficeByCompany(env, accessToken) {
  const companyId = env.MURAL_COMPANY_ID;
  if (!companyId) {
    console.warn("[verifyHomeOfficeByCompany] No MURAL_COMPANY_ID set; skipping verification");
    return true; // Permissive if not configured
  }

  const me = await getMe(env, accessToken);
  const workspaceId = getActiveWorkspaceIdFromMe(me);
  
  if (!workspaceId) {
    console.warn("[verifyHomeOfficeByCompany] No active workspace in user profile");
    return false;
  }

  // GET /workspaces/:id to check companyId
  const url = `https://app.mural.co/api/public/v1/workspaces/${workspaceId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw Object.assign(new Error(`GET /workspaces/${workspaceId} failed: ${res.status}`), {
      status: res.status
    });
  }

  const ws = await res.json();
  const wsCompanyId = ws?.value?.companyId || ws?.companyId;
  
  const verified = wsCompanyId === companyId;
  console.log("[verifyHomeOfficeByCompany]", { 
    workspaceId, 
    wsCompanyId, 
    expectedCompanyId: companyId,
    verified 
  });
  
  return verified;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * Workspace & Room Provisioning
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Ensure user has a private room in the workspace.
 * Creates "{username}'s Private Room" if not found.
 * @param {any} env
 * @param {string} accessToken
 * @param {string} workspaceId
 * @param {string} username
 * @returns {Promise<any>} Room object with id
 */
export async function ensureUserRoom(env, accessToken, workspaceId, username) {
  const roomName = `${username}'s Private Room`;
  
  // List existing rooms
  const listUrl = `https://app.mural.co/api/public/v1/workspaces/${workspaceId}/rooms`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!listRes.ok) {
    throw Object.assign(new Error(`List rooms failed: ${listRes.status}`), {
      status: listRes.status
    });
  }

  const listData = await listRes.json();
  const rooms = listData?.value || [];
  const existing = rooms.find(r => r.name === roomName || r.title === roomName);
  
  if (existing) {
    console.log("[ensureUserRoom] Found existing room:", existing.id);
    return existing;
  }

  // Create new room
  const createUrl = `https://app.mural.co/api/public/v1/workspaces/${workspaceId}/rooms`;
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name: roomName })
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    throw Object.assign(new Error(`Create room failed: ${createRes.status}`), {
      status: createRes.status,
      body: text
    });
  }

  const created = await createRes.json();
  console.log("[ensureUserRoom] Created new room:", created?.value?.id || created?.id);
  return created?.value || created;
}

/**
 * Ensure project folder exists in room.
 * @param {any} env
 * @param {string} accessToken
 * @param {string} roomId
 * @param {string} folderName
 * @returns {Promise<any>} Folder object with id
 */
export async function ensureProjectFolder(env, accessToken, roomId, folderName) {
  // List folders in room
  const listUrl = `https://app.mural.co/api/public/v1/rooms/${roomId}/folders`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!listRes.ok) {
    throw Object.assign(new Error(`List folders failed: ${listRes.status}`), {
      status: listRes.status
    });
  }

  const listData = await listRes.json();
  const folders = listData?.value || [];
  const existing = folders.find(f => f.name === folderName || f.title === folderName);
  
  if (existing) {
    console.log("[ensureProjectFolder] Found existing folder:", existing.id);
    return existing;
  }

  // Create folder
  const createUrl = `https://app.mural.co/api/public/v1/rooms/${roomId}/folders`;
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name: folderName })
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    throw Object.assign(new Error(`Create folder failed: ${createRes.status}`), {
      status: createRes.status,
      body: text
    });
  }

  const created = await createRes.json();
  console.log("[ensureProjectFolder] Created new folder:", created?.value?.id || created?.id);
  return created?.value || created;
}

/**
 * Create a new mural board.
 * @param {any} env
 * @param {string} accessToken
 * @param {{title:string, roomId:string, folderId?:string}} opts
 * @returns {Promise<any>} Mural object with id
 */
export async function createMural(env, accessToken, opts) {
  const { title, roomId, folderId } = opts;
  
  const url = `https://app.mural.co/api/public/v1/rooms/${roomId}/murals`;
  const body = { title };
  if (folderId) body.folderId = folderId;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`Create mural failed: ${res.status}`), {
      status: res.status,
      body: text
    });
  }

  const data = await res.json();
  console.log("[createMural] Created mural:", data?.value?.id || data?.id);
  return data?.value || data;
}

/**
 * Get mural details by ID.
 * @param {any} env
 * @param {string} accessToken
 * @param {string} muralId
 * @returns {Promise<any>}
 */
export async function getMural(env, accessToken, muralId) {
  const url = `https://app.mural.co/api/public/v1/murals/${muralId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw Object.assign(new Error(`GET /murals/${muralId} failed: ${res.status}`), {
      status: res.status
    });
  }

  return res.json();
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * Widgets & Sticky Notes
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Get all widgets in a mural.
 * @param {any} env
 * @param {string} accessToken
 * @param {string} muralId
 * @returns {Promise<any>}
 */
export async function getWidgets(env, accessToken, muralId) {
  const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw Object.assign(new Error(`GET /murals/${muralId}/widgets failed: ${res.status}`), {
      status: res.status
    });
  }

  return res.json();
}

/**
 * Create a sticky note widget.
 * @param {any} env
 * @param {string} accessToken
 * @param {string} muralId
 * @param {{text:string, x:number, y:number, width?:number, height?:number}} opts
 * @returns {Promise<any>}
 */
export async function createSticky(env, accessToken, muralId, opts) {
  const { text, x, y, width = 240, height = 120 } = opts;
  
  const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets/sticky-note`;
  const body = { text, x, y, width, height };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`Create sticky failed: ${res.status}`), {
      status: res.status,
      body: text
    });
  }

  const data = await res.json();
  return data?.value || data;
}

/**
 * Update sticky note text.
 * @param {any} env
 * @param {string} accessToken
 * @param {string} muralId
 * @param {string} widgetId
 * @param {{text:string}} opts
 * @returns {Promise<any>}
 */
export async function updateSticky(env, accessToken, muralId, widgetId, opts) {
  const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets/${widgetId}`;
  
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(opts)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`Update sticky failed: ${res.status}`), {
      status: res.status,
      body: text
    });
  }

  return res.json();
}

/**
 * Normalize widget list from API response.
 * @param {any} widgets
 * @returns {Array<{id:string, type:string, text?:string, tags?:string[], x?:number, y?:number, width?:number, height?:number}>}
 */
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
    height: w.height
  }));
}

/**
 * Find the latest sticky note in a category (by tag or text prefix).
 * @param {Array} stickyList
 * @param {string} category - e.g. "perceptions", "procedures"
 * @returns {any|null}
 */
export function findLatestInCategory(stickyList, category) {
  const filtered = stickyList.filter(w => {
    if (w.type !== "sticky note" && w.type !== "sticky-note") return false;
    const tags = (w.tags || []).map(t => t.toLowerCase());
    if (tags.includes(category.toLowerCase())) return true;
    const text = (w.text || "").toLowerCase();
    return text.startsWith(`[${category.toLowerCase()}]`);
  });

  if (!filtered.length) return null;
  
  // Sort by y (descending), then x (descending)
  filtered.sort((a, b) => {
    const yDiff = (b.y || 0) - (a.y || 0);
    if (Math.abs(yDiff) > 1) return yDiff;
    return (b.x || 0) - (a.x || 0);
  });

  return filtered[0];
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * Tags
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Ensure tags exist on mural (creates if missing).
 * Returns array of tag IDs.
 * @param {any} env
 * @param {string} accessToken
 * @param {string} muralId
 * @param {string[]} tagLabels
 * @returns {Promise<string[]>}
 */
export async function ensureTagsBlueberry(env, accessToken, muralId, tagLabels) {
  if (!tagLabels.length) return [];

  // Get existing tags
  const listUrl = `https://app.mural.co/api/public/v1/murals/${muralId}/tags`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!listRes.ok) {
    console.warn("[ensureTagsBlueberry] Failed to list tags:", listRes.status);
    return [];
  }

  const listData = await listRes.json();
  const existing = listData?.value || [];
  const tagMap = new Map(existing.map(t => [t.title?.toLowerCase() || t.label?.toLowerCase(), t.id]));

  const tagIds = [];
  
  for (const label of tagLabels) {
    const lower = label.toLowerCase();
    if (tagMap.has(lower)) {
      tagIds.push(tagMap.get(lower));
    } else {
      // Create tag
      const createUrl = `https://app.mural.co/api/public/v1/murals/${muralId}/tags`;
      const createRes = await fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: label })
      });

      if (createRes.ok) {
        const created = await createRes.json();
        const id = created?.value?.id || created?.id;
        if (id) {
          tagIds.push(id);
          tagMap.set(lower, id);
        }
      } else {
        console.warn("[ensureTagsBlueberry] Failed to create tag:", label, createRes.status);
      }
    }
  }

  return tagIds;
}

/**
 * Apply tags to a sticky note widget.
 * @param {any} env
 * @param {string} accessToken
 * @param {string} muralId
 * @param {string} widgetId
 * @param {string[]} tagIds
 * @returns {Promise<void>}
 */
export async function applyTagsToSticky(env, accessToken, muralId, widgetId, tagIds) {
  if (!tagIds.length) return;

  const url = `https://app.mural.co/api/public/v1/murals/${muralId}/widgets/${widgetId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ tags: tagIds })
  });

  if (!res.ok) {
    console.warn("[applyTagsToSticky] Failed to apply tags:", res.status);
  }
}
