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
 * Resolution order for a board used by journal-sync / resolve:
 *   1) Explicit body.muralId
 *   2) Airtable: newest Primary?/Created match for (projectId[, uid], purpose, Active=true)
 *   3) Deprecated env.MURAL_REFLEXIVE_MURAL_ID (warning)
 */

import {
	buildAuthUrl,
	exchangeAuthCode,
	refreshAccessToken,
	verifyHomeOfficeByCompany,
	ensureUserRoom,
	ensureProjectFolder,
	createMural,
	getMe,
	getActiveWorkspaceIdFromMe,
	// widgets/tags utilities for journal sync
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

// Default purpose label (single-select in Airtable)
const PURPOSE_REFLEXIVE = "reflexive_journal";

/** Cheap in-process cache for hot resolutions (evicted on worker cold starts) */
const _memCache = new Map(); // key: `${projectId}·${uid||"-"}·${purpose}` → { muralId, boardUrl, workspaceId, primary, ts }

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

/**
 * Query Airtable for "Mural Boards".
 *
 * IMPORTANT: we DO NOT use `filterByFormula` for `Project` because:
 * - If "Project" is a linked-record field, simple equality fails or needs gnarly formulas.
 * - To be robust, we fetch a small, sorted window and filter in the Worker.
 *
 * We still keep the list small by:
 *  - sorting by Primary? desc, Created At desc
 *  - maxRecords default 25
 */
async function _airtableListBoards(env, { max = 25 } = {}) {
	const url = new URL(_encodeTableUrl(env, "Mural Boards"));
	url.searchParams.set("maxRecords", String(max));
	url.searchParams.set("sort", JSON.stringify([
		{ field: "Primary?", direction: "desc" },
		{ field: "Created At", direction: "desc" }
	]));
	const res = await fetch(url.toString(), { headers: _airtableHeaders(env) });
	const js = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error("airtable_list_failed"), { status: res.status, body: js });
	}
	return Array.isArray(js.records) ? js.records : [];
}

/** Create a board mapping row in Airtable (tolerates linked or text Project). */
async function _airtableCreateBoard(env, { projectId, uid, purpose, muralId, boardUrl = null, workspaceId = null, primary = true, active = true }) {
	const url = _encodeTableUrl(env, "Mural Boards");

	// Try to satisfy both shapes:
	// - Linked record: Project: [ "recXXXX" ]
	// - Plain text:    Project: "recXXXX"
	// Airtable will ignore shape mismatches rather than erroring on unknown fields.
	const fields = {
		"Project": [projectId], // works if it's a linked-record
		"UID": uid,
		"Purpose": purpose,
		"Mural ID": muralId,
		"Board URL": boardUrl,
		"Workspace ID": workspaceId,
		"Primary?": !!primary,
		"Active": !!active
	};

	const body = { records: [{ fields }] };
	const res = await fetch(url, { method: "POST", headers: _airtableHeaders(env), body: JSON.stringify(body) });
	const js = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error("airtable_create_failed"), { status: res.status, body: js });
	}
	return js;
}

/** Match helpers — tolerate Project as linked-record array OR string. */
function _matchesProject(f, projectId) {
	if (!projectId) return true;
	const v = f?.Project;
	if (Array.isArray(v)) return v.includes(projectId);
	return String(v || "") === String(projectId);
}

function _matchesUid(f, uid) {
	if (!uid) return true;
	return String(f?.UID || "") === String(uid);
}

function _matchesPurpose(f, purpose) {
	if (!purpose) return true;
	return String(f?.Purpose || "") === String(purpose);
}

function _isActive(f, active = true) {
	if (typeof active !== "boolean") return true;
	const v = !!f?.Active;
	return active ? v === true : v === false;
}

/* ───────────────────────── Class ───────────────────────── */

export class MuralServicePart {
	/** @param {ResearchOpsService} root */
	constructor(root) {
		this.root = root;
	}

	// ── Tokens in KV
	kvKey(uid) { return `mural:${uid}:tokens`; }

	async saveTokens(uid, tokens) {
		await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(tokens), { encryption: true });
	}

	async loadTokens(uid) {
		const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid));
		return raw ? JSON.parse(raw) : null;
	}

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
	 * Resolve a Mural board by (projectId, [uid], purpose).
	 * Priority:
	 *  1) explicitMuralId
	 *  2) Airtable "Mural Boards" (in-memory cached; tolerant filters)
	 *  3) env.MURAL_REFLEXIVE_MURAL_ID (deprecated)
	 *
	 * @param {object} p
	 * @param {string=} p.projectId
	 * @param {string=} p.uid
	 * @param {string=} p.purpose
	 * @param {string=} p.explicitMuralId
	 * @returns {Promise<{ muralId: string, boardUrl?: string, workspaceId?: string } | null>}
	 */
	async resolveBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, explicitMuralId }) {
		// 1) Explicit
		if (explicitMuralId) {
			return { muralId: String(explicitMuralId) };
		}

		const uidKey = uid && uid !== "anon" ? uid : "-";
		const cacheKey = `${projectId || "-"}·${uidKey}·${purpose || "-"}`;
		const cached = _memCache.get(cacheKey);
		if (cached && (Date.now() - cached.ts < 60_000)) {
			return { muralId: cached.muralId, boardUrl: cached.boardUrl, workspaceId: cached.workspaceId };
		}

		// 2) Airtable — fetch a small set and filter in-process.
		if (this.root?.env?.AIRTABLE_BASE_ID && (this.root?.env?.AIRTABLE_API_KEY || this.root?.env?.AIRTABLE_ACCESS_TOKEN)) {
			const rows = await _airtableListBoards(this.root.env, { max: 25 });

			// First pass: match with uid (if provided)
			let match = rows.find(r => {
				const f = r?.fields || {};
				return _matchesProject(f, projectId) && _matchesUid(f, uidKey !== "-" ? uid : "") &&
					_matchesPurpose(f, purpose) && _isActive(f, true) && !!f["Mural ID"];
			});

			// Fallback: match by project only (uid not required)
			if (!match) {
				match = rows.find(r => {
					const f = r?.fields || {};
					return _matchesProject(f, projectId) && _matchesPurpose(f, purpose) &&
						_isActive(f, true) && !!f["Mural ID"];
				});
			}

			if (match?.fields) {
				const f = match.fields;
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
		}

		// 3) Deprecated env fallback
		const envId = this.root?.env?.MURAL_REFLEXIVE_MURAL_ID;
		if (envId) {
			console.warn("[mural] using deprecated global MURAL_REFLEXIVE_MURAL_ID — migrate to Airtable 'Mural Boards'.");
			return { muralId: String(envId) };
		}

		return null;
	}

	/**
	 * Save/register a Mural board mapping to Airtable (and refresh in-memory cache).
	 */
	async registerBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, muralId, boardUrl = null, workspaceId = null, primary = true }) {
		if (!projectId || !uid || !muralId) return { ok: false, error: "missing_fields" };

		// Persist to Airtable (best-effort)
		try {
			await _airtableCreateBoard(this.root.env, {
				projectId,
				uid,
				purpose,
				muralId,
				boardUrl,
				workspaceId,
				primary,
				active: true
			});
		} catch (e) {
			// Don’t fail the UX if Airtable is temporarily unhappy; log it.
			this.root?.log?.warn?.("mural.register.airtable_fail", { err: String(e?.message || e) });
		}

		// Hot cache for immediate refresh after creation
		const uidKey = uid && uid !== "anon" ? uid : "-";
		const cacheKey = `${projectId}·${uidKey}·${purpose}`;
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
		const ret = url.searchParams.get("return");
		const safeReturn = (ret && ret.startsWith("/")) ? ret : "/pages/projects/";
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

		// code → tokens
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

		// Return to the page we came from, append mural=connected
		const safeReturn = (stateObj?.return && stateObj.return.startsWith("/")) ?
			stateObj.return : "/pages/projects/";
		const back = new URL(safeReturn, url);
		const sp = new URLSearchParams(back.search);
		sp.set("mural", "connected");
		back.search = sp.toString();

		return Response.redirect(back.toString(), 302);
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
			// Ensure company membership and get active workspace
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

			step = "ensure_folder";
			const folder = await ensureProjectFolder(this.root.env, accessToken, room.id, String(projectName).trim());

			step = "create_mural";
			const mural = await createMural(this.root.env, accessToken, {
				title: "Reflexive Journal",
				roomId: room.id,
				folderId: folder.id
			});

			// Persist mapping in Airtable if projectId is known
			if (projectId) {
				await this.registerBoard({
					projectId,
					uid,
					purpose: PURPOSE_REFLEXIVE,
					muralId: mural.id,
					boardUrl: mural?.viewLink || null,
					workspaceId: ws.id,
					primary: true
				});
			}

			return this.root.json({ ok: true, workspace: ws, room, folder, mural }, 200, cors);

		} catch (err) {
			const status = Number(err?.status) || 500;
			const body = err?.body || null;
			const message = String(err?.message || "setup_failed");
			return this.root.json({
				ok: false,
				error: "setup_failed",
				step,
				message,
				upstream: body
			}, status, cors);
		}
	}

	/**
	 * GET /api/mural/resolve?projectId=recXXXX[&uid=u07...][&purpose=reflexive_journal]
	 * Returns: { ok:true, muralId, boardUrl?, workspaceId? } or 404 { ok:false, error:"not_found" }
	 */
	async muralResolve(origin, url) {
		const cors = this.root.corsHeaders(origin);
		const projectId = url.searchParams.get("projectId") || "";
		const uid = url.searchParams.get("uid") || "";
		const purpose = url.searchParams.get("purpose") || PURPOSE_REFLEXIVE;

		if (!projectId) {
			return this.root.json({ ok: false, error: "projectId_required" }, 400, cors);
		}

		try {
			// Try with uid (if present), then without
			let rec = await this.resolveBoard({ projectId, uid, purpose });
			if (!rec && uid) rec = await this.resolveBoard({ projectId, uid: "", purpose });

			if (!rec?.muralId) {
				return this.root.json({ ok: false, error: "not_found" }, 404, cors);
			}
			return this.root.json({ ok: true, muralId: rec.muralId, boardUrl: rec.boardUrl || null, workspaceId: rec.workspaceId || null }, 200, cors);
		} catch (err) {
			const msg = String(err?.message || err);
			return this.root.json({ ok: false, error: "resolve_failed", detail: msg }, 500, cors);
		}
	}

	/**
	 * (Optional) GET /api/mural/find?projectId=… or ?title=…&projectId=…
	 * Alias for resolve; kept for compatibility with earlier client code.
	 */
	async muralFind(origin, url) {
		return this.muralResolve(origin, url);
	}

	/**
	 * POST /api/mural/journal-sync
	 * body: {
	 *   uid?: string
	 *   muralId?: string            // optional; if absent we resolve via Airtable
	 *   projectId?: string          // strongly recommended for resolver
	 *   purpose?: string            // defaults to "reflexive_journal"
	 *   studyId?: string            // (ignored here but kept for future)
	 *   category: string            // perceptions|procedures|decisions|introspections
	 *   description: string
	 *   tags?: string[]
	 * }
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
				uid,
				purpose,
				explicitMuralId: body.muralId
			});
			const muralId = resolved?.muralId || null;
			if (!muralId) {
				return this.root.json({
					ok: false,
					error: "no_mural_id",
					message: "No board found for (projectId, uid, purpose) and no explicit muralId provided."
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

			return this.root.json({
				ok: false,
				error: "journal_sync_failed",
				step,
				message,
				upstream: body
			}, status, cors);
		}
	}

	/** GET /api/mural/debug-env (TEMP) */
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

	/** GET /api/mural/debug-auth (TEMP) */
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
