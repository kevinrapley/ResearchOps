/**
 * @file service/internals/mural.js
 * @module service/internals/mural
 * @summary Mural routes logic (OAuth + provisioning + journal sync) with Airtable-backed board mapping.
 *
 * Airtable table expected: "Mural Boards"
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
	ensureUserRoom,
	ensureProjectFolder,
	createMural,
	getMural,
	getMe,
	getActiveWorkspaceIdFromMe,
	getWidgets,
	createSticky,
	updateSticky,
	ensureTagsBlueberry,
	applyTagsToSticky,
	normaliseWidgets,
	findLatestInCategory
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

function _encodeTableUrl(env, tableName) {
	return `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${encodeURIComponent(tableName)}`;
}

/** Escape double quotes for filterByFormula string literals */
function _esc(v) {
	return String(v ?? "").replace(/"/g, '\\"');
}

/** Validate that a return URL is on an allowed origin (defence-in-depth). */
function _isAllowedReturn(env, urlStr) {
	try {
		const u = new URL(urlStr);
		const allowed = (env.ALLOWED_ORIGINS || "")
			.split(",")
			.map(s => s.trim())
			.filter(Boolean);
		return allowed.includes(`${u.protocol}//${u.host}`);
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
	const url = new URL(_encodeTableUrl(env, "Mural Boards"));
	const filterByFormula = _buildBoardsFilter({ uid, purpose, active });
	if (filterByFormula) url.searchParams.set("filterByFormula", filterByFormula);
	url.searchParams.set("maxRecords", String(max));
	// Use Airtable-style sort params for compatibility
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
	const filtered = records.filter(r => {
		const f = r?.fields || {};
		const proj = f["Project"];
		if (Array.isArray(proj)) {
			// Linked record → array of Airtable record IDs
			return proj.includes(pid);
		}
		// Single line text
		return String(proj || "") === pid;
	});

	return filtered;
}

/** Create a board mapping row in Airtable. */
async function _airtableCreateBoard(env, { projectId, uid, purpose, muralId, boardUrl = null, workspaceId = null, primary = false, active = true }) {
	const url = _encodeTableUrl(env, "Mural Boards");
	const body = {
		records: [{
			fields: {
				"Project": projectId,
				"UID": uid,
				"Purpose": purpose,
				"Mural ID": muralId,
				"Board URL": boardUrl,
				"Workspace ID": workspaceId,
				"Primary?": !!primary,
				"Active": !!active
			}
		}]
	};
	const res = await fetch(url, { method: "POST", headers: _airtableHeaders(env), body: JSON.stringify(body) });
	const js = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error("airtable_create_failed"), { status: res.status, body: js });
	}
	return js;
}

/* ───────────────────────── KV helpers ───────────────────────── */

async function _kvProjectMapping(env, { uid, projectId }) {
	const key = `mural:${uid || "anon"}:project:id::${String(projectId || "")}`;
	const raw = await env.SESSION_KV.get(key);
	if (!raw) return null;
	try { return JSON.parse(raw); } catch { return null; }
}

/* ───────────────────────── Class ───────────────────────── */

export class MuralServicePart {
	/** @param {ResearchOpsService} root */
	constructor(root) {
		this.root = root;
	}

	// KV tokens
	kvKey(uid) { return `mural:${uid}:tokens`; }
	async saveTokens(uid, tokens) { await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(tokens), { encryption: true }); }
	async loadTokens(uid) { const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid)); return raw ? JSON.parse(raw) : null; }

	/* ───────────────────────── internal helpers ───────────────────────── */

	async _ensureWorkspace(env, accessToken) {
		const inCompany = await verifyHomeOfficeByCompany(env, accessToken);
		if (!inCompany) throw Object.assign(new Error("not_in_home_office_workspace"), { code: 403 });

		const me = await getMe(env, accessToken);
		const wsId = getActiveWorkspaceIdFromMe(me);
		if (!wsId) throw new Error("no_active_workspace");
		return { id: wsId };
	}

	/**
	 * Resolve a Mural board by (projectId[, uid], purpose).
	 * Priority:
	 *  1) explicitMuralId (if provided)
	 *  2) Airtable "Mural Boards" (cached)
	 *  2b) KV fallback (boardUrl only)
	 *  3) env.MURAL_REFLEXIVE_MURAL_ID (deprecated)
	 */
	async resolveBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, explicitMuralId }) {
		// 1) Explicit
		if (explicitMuralId) return { muralId: String(explicitMuralId) };

		// 2) Airtable lookup. We now allow uid to be absent (falls back to project-only).
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
				return { muralId: null, boardUrl: kv.url, workspaceId: null };
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

	/* ─────────────────────────────────────────────────────────────────── */
	/* Routes                                                              */
	/* ─────────────────────────────────────────────────────────────────── */

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
			return this.root.json({ ok: false, error: "missing_code" }, 400, this.root.corsHeaders(origin));
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
		} catch (err) {
			return this.root.json({
				ok: false,
				error: "token_exchange_failed",
				message: err?.message || "Unable to exchange OAuth code"
			}, 500, this.root.corsHeaders(origin));
		}

		await this.saveTokens(uid, tokens);

		// --- Build redirect target ---
		const want = stateObj?.return || "/pages/projects/";
		let backUrl;

		if (want.startsWith("http")) {
			// Absolute URL — only if allowed (from ALLOWED_ORIGINS)
			backUrl = _isAllowedReturn(env, want) ?
				new URL(want) :
				new URL("/pages/projects/", url);
		} else {
			// Relative path — safe against Worker origin
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

		return this.root.json({ ok: true, me, activeWorkspaceId },
			200,
			this.root.corsHeaders(origin)
		);
	}

	/** POST /api/mural/setup  body: { uid, projectId?, projectName } */
	async muralSetup(request, origin) {
		const cors = this.root.corsHeaders(origin);
		let step = "parse_input";

		try {
			const { uid = "anon", projectId = null, projectName } = await request.json().catch(() => ({}));
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
				ws = await this._ensureWorkspace(this.root.env, accessToken);
			} catch (err) {
				const code = Number(err?.status || err?.code || 0);
				if (code === 401 && tokens.refresh_token) {
					const refreshed = await refreshAccessToken(this.root.env, tokens.refresh_token);
					const merged = { ...tokens, ...refreshed };
					await this.saveTokens(uid, merged);
					accessToken = merged.access_token;
					ws = await this._ensureWorkspace(this.root.env, accessToken);
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
			const room = await ensureUserRoom(this.root.env, accessToken, ws.id, username);

			const roomId = room?.id || room?.roomId || room?.value?.id; // normalise here

			if (!roomId) {
				this.root.log?.warn?.("mural.ensure_room.no_id", { room });
				throw Object.assign(new Error("ROOM_NOT_FOUND"), { status: 404 });
			}

			step = "ensure_folder";
			const folder = await ensureProjectFolder(this.root.env, accessToken, roomId, String(projectName).trim());

			step = "create_mural";
			const mural = await createMural(this.root.env, accessToken, {
				title: "Reflexive Journal",
				roomId,
				folderId: folder?.id || folder?.folderId
			});

			// Hydrate to get reliable open/view link (some create responses omit it)
			let hydrated = null;
			try {
				hydrated = await getMural(this.root.env, accessToken, mural.id);
			} catch { /* non-fatal */ }

			// Derive best-effort open URL
			let openUrl =
				hydrated?.viewLink ||
				hydrated?.viewerUrl ||
				hydrated?._canvasLink ||
				mural?.viewLink ||
				mural?.viewerUrl ||
				mural?._canvasLink ||
				null;

			if (!openUrl && mural?.id && ws?.id) {
				openUrl = `https://app.mural.co/t/${ws.id}/m/${ws.id}/${mural.id}`;
				this.root.log?.info?.("mural.synthetic_view_link", { openUrl });
			}

			// Persist mapping in Airtable if projectId is known
			let registered = false;
			if (projectId) {
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
			}

			// KV backup so resolve can recover even if Airtable write lags
			try {
				const kvKey = `mural:${uid}:project:id::${String(projectId || "")}`;
				if (projectId && openUrl) {
					await this.root.env.SESSION_KV.put(kvKey, JSON.stringify({
						url: openUrl,
						projectName: projectName,
						updatedAt: Date.now()
					}));
				}
			} catch { /* non-fatal */ }

			// Return a richer payload for the UI (includes boardUrl)
			return this.root.json({
				ok: true,
				workspace: ws,
				room,
				folder,
				mural: { ...mural, viewLink: openUrl },
				projectId: projectId || null,
				registered,
				boardUrl: openUrl || null
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
	 * POST /api/mural/journal-sync  (unchanged flow, uses resolveBoard)
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
}
