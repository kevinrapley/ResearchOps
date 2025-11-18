/**
 * @file service/internals/mural.js
 * @module service/internals/mural
 * @summary Mural routes logic (OAuth + provisioning + journal sync) backed by Airtable,
 *          with D1 as a read-through fallback for board lookups when Airtable is unavailable.
 *
 * Key ideas:
 *  - Airtable remains the source of truth for “Mural Boards” metadata.
 *  - D1 is used as a non-breaking fallback when Airtable is rate-limited/unavailable.
 *  - Journal → Mural sync must still work when Airtable 429s, as long as a board
 *    mapping exists in D1 for the project.
 */

import {
	buildAuthUrl,
	exchangeAuthCode,
	refreshAccessToken,
	verifyHomeOfficeByCompany,
	ensureUserRoom,
	ensureProjectFolder,
	createMural,
	duplicateMural,
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
	createViewerLink,
	updateAreaTitle
} from "../../lib/mural.js";

import {
	listBoards as atListBoards,
	createBoard as atCreateBoard,
	updateBoard as atUpdateBoard,
	resolveProjectRecordId as atResolveProjectRecordId
} from "./airtable.js";

import { d1GetProjectByLocalId, d1Get } from "./researchops-d1.js";

import { b64Encode, b64Decode } from "../../core/utils.js";

/** @typedef {import("../index.js").ResearchOpsService} ResearchOpsService */

const GRID_Y = 32;
const DEFAULT_W = 240;
const DEFAULT_H = 120;
const PURPOSE_REFLEXIVE = "reflexive_journal";

const _memCache = new Map();
const resolveBoardCache = new Map();

/* ───────────────────────── small debug helpers ───────────────────────── */
function _wantDebugFromUrl(urlLike) {
	try {
		return (new URL(String(urlLike))).searchParams.get("debug") === "true";
	} catch {
		return false;
	}
}

function _withDebugCtx(root, dbg) {
	return Object.assign({}, root, { __dbg: !!dbg });
}

function _log(root, level, event, data) {
	const dbg = !!root?.__dbg;
	const low = level === "debug" || level === "info";
	if (low && !dbg) return;
	try {
		const log = root?.log;
		if (log?.[level]) log[level](event, data);
		else if (level === "error") console.error(`[${event}]`, data);
		else if (level === "warn") console.warn(`[${event}]`, data);
		else console.log(`[${event}]`, data);
	} catch {}
}

/* ───────────────────────── URL helpers ───────────────────────── */

function _looksLikeMuralViewerUrl(u) {
	try {
		const x = new URL(u);
		if (x.hostname !== "app.mural.co") return false;
		const p = x.pathname || "";
		return (
			/^\/t\/[^/]+\/m\/[^/]+/i.test(p) ||
			/^\/invitation\/mural\/[a-z0-9.-]+/i.test(p) ||
			/^\/viewer\//i.test(p) ||
			/^\/share\/[^/]+\/mural\/[a-z0-9.-]+/i.test(p)
		);
	} catch {
		return false;
	}
}

function _extractViewerUrl(payload) {
	if (!payload) return null;
	const seen = new Set();
	const queue = [payload];

	while (queue.length) {
		const n = queue.shift();
		if (!n || seen.has(n)) continue;
		seen.add(n);

		if (typeof n === "string" && _looksLikeMuralViewerUrl(n)) return n;
		if (typeof n !== "object") continue;

		const cands = [
			n.viewerUrl, n.viewerURL, n.viewLink, n.viewURL,
			n.openUrl, n.openURL, n._canvasLink, n.url, n.href, n.link,
			n.value, n.links, n.links?.viewer, n.links?.open, n.links?.share, n.links?.public
		].filter(Boolean);

		for (const c of cands) {
			if (typeof c === "string" && _looksLikeMuralViewerUrl(c)) return c;
			if (c && typeof c === "object") queue.push(c);
		}
		for (const v of Object.values(n)) {
			if (!cands.includes(v)) queue.push(v);
		}
	}
	return null;
}

async function _probeViewerUrl(env, accessToken, muralId, rootLike = null) {
	try {
		const hydrated = await getMural(env, accessToken, muralId).catch(() => null);
		const url = _extractViewerUrl(hydrated);
		if (url) return url;
	} catch {}
	try {
		const links = await getMuralLinks(env, accessToken, muralId).catch(() => []);
		const best = links.find(l => _looksLikeMuralViewerUrl(l.url)) ||
			links.find(l => /viewer|view|open|public/i.test(String(l.type || "")) && l.url);
		if (best?.url && _looksLikeMuralViewerUrl(best.url)) return best.url;
	} catch {}
	try {
		const created = await createViewerLink(env, accessToken, muralId);
		if (created && _looksLikeMuralViewerUrl(created)) return created;
	} catch {}
	try {
		const hydrated2 = await getMural(env, accessToken, muralId).catch(() => null);
		const url2 = _extractViewerUrl(hydrated2);
		if (url2) return url2;
	} catch {}
	return null;
}

/**
 * Resolve a room that is OWNED by the current Mural user and log ownership info.
 */
async function resolveUserOwnedRoomForSetup(env, accessToken, workspaceId) {
	const me = await getMe(env, accessToken);
	const mv = me?.value || me || {};
	const currentUserId = String(mv.id || mv.userId || "").toLowerCase();
	const currentUserName =
		`${mv.firstName || ""} ${mv.lastName || ""}`.trim() ||
		mv.email ||
		mv.id ||
		"Unknown user";

	const room = await ensureUserRoom(env, accessToken, workspaceId);

	const roomOwnerId = currentUserId;
	const roomOwnerName = currentUserName;

	console.log("[mural.setup] Using user-owned room", {
		roomId: room.id,
		roomName: room.name || room.title,
		roomOwnerId,
		roomOwnerName,
		currentUserId,
		currentUserName
	});

	return room;
}

/* ───────────────────────── KV helpers ───────────────────────── */

async function _kvProjectMapping(env, { uid, projectId }) {
	const key = `mural:${uid || "anon"}:project:id::${String(projectId || "")}`;
	const raw = await env.SESSION_KV.get(key);
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

/* ───────────────────────── Workspace helpers ───────────────────────── */

async function _ensureWorkspace(root, accessToken, explicitWorkspaceId) {
	const inCompany = await verifyHomeOfficeByCompany(root.env, accessToken);
	if (!inCompany) throw Object.assign(new Error("not_in_home_office_workspace"), { code: 403 });

	if (explicitWorkspaceId) {
		try {
			const ws = await getWorkspace(root.env, accessToken, explicitWorkspaceId);
			const v = ws?.value || ws || {};
			return { id: v.id || explicitWorkspaceId, key: v.key || v.shortId || null, name: v.name || null };
		} catch {}
	}

	const me = await getMe(root.env, accessToken);
	const wsHint = getActiveWorkspaceIdFromMe(me);
	if (!wsHint) throw new Error("no_active_workspace");

	return { id: wsHint, key: null, name: null };
}

async function _getValidAccessToken(self, uid) {
	const tokens = await self.loadTokens(uid);
	if (!tokens?.access_token) return { ok: false, reason: "not_authenticated" };

	let accessToken = tokens.access_token;
	try {
		await verifyHomeOfficeByCompany(self.root.env, accessToken);
		return { ok: true, token: accessToken };
	} catch (err) {
		const status = Number(err?.status || 0);
		if (status === 401 && tokens.refresh_token) {
			try {
				const refreshed = await refreshAccessToken(self.root.env, tokens.refresh_token);
				const merged = { ...tokens, ...refreshed };
				await self.saveTokens(uid, merged);
				accessToken = merged.access_token;
				await verifyHomeOfficeByCompany(self.root.env, accessToken);
				return { ok: true, token: accessToken };
			} catch {
				return { ok: false, reason: "not_authenticated" };
			}
		}
		return { ok: false, reason: "error" };
	}
}

/* ───────────────────────── D1 helpers for mural boards ───────────────────────── */

/**
 * Best-effort lookup of a Mural board in D1 for a given project.
 * Airtable remains primary; D1 is only used when Airtable fails or has no row.
 *
 * Schema assumption for `mural_boards` table (from imported CSV):
 *  - project_record_id   TEXT   (Airtable Project ID, e.g. "rec010B6…")
 *  - local_project_id    TEXT   (local UUID, if present)
 *  - purpose             TEXT   (e.g. "reflexive_journal")
 *  - mural_id            TEXT
 *  - board_url           TEXT
 *  - workspace_id        TEXT
 *  - updated_at          TEXT   (ISO datetime; used for ordering)
 *
 * We tolerate missing columns by catching SQL errors and returning null.
 *
 * @param {Env} env
 * @param {{ projectRecordId?:string|null, localProjectId?:string|null, purpose?:string }} args
 * @returns {Promise<null | {
 *   mural_id:string,
 *   board_url:string|null,
 *   workspace_id:string|null,
 *   project_record_id:string|null,
 *   local_project_id:string|null
 * }>}
 */
async function d1ResolveMuralBoard(env, { projectRecordId, localProjectId, purpose }) {
	const purposeLower = (purpose || "").toLowerCase().trim();
	const hasProjectRecordId = !!projectRecordId;
	const hasLocalProjectId = !!localProjectId;

	// If there is no D1 binding at all, just bail.
	if (!env || !env.RESEARCHOPS_D1) return null;

	// Try a couple of likely schemas in order; swallow errors and move on.
	const attempts = [];

	if (hasProjectRecordId) {
		attempts.push({
			sql: `
				SELECT mural_id,
				       board_url,
				       workspace_id,
				       project_record_id,
				       local_project_id
				  FROM mural_boards
				 WHERE project_record_id = ?1
				   ${purposeLower ? "AND (LOWER(purpose) = ?2)" : ""}
				 ORDER BY datetime(updated_at) DESC
				 LIMIT 1;
			`,
			params: purposeLower ? [projectRecordId, purposeLower] : [projectRecordId]
		});
	}

	if (!hasProjectRecordId && hasLocalProjectId) {
		attempts.push({
			sql: `
				SELECT mural_id,
				       board_url,
				       workspace_id,
				       project_record_id,
				       local_project_id
				  FROM mural_boards
				 WHERE local_project_id = ?1
				   ${purposeLower ? "AND (LOWER(purpose) = ?2)" : ""}
				 ORDER BY datetime(updated_at) DESC
				 LIMIT 1;
			`,
			params: purposeLower ? [localProjectId, purposeLower] : [localProjectId]
		});
	}

	// Fallback: some imports may only have a generic "project_id" column
	if (!hasProjectRecordId && hasLocalProjectId) {
		attempts.push({
			sql: `
				SELECT mural_id,
				       board_url,
				       workspace_id,
				       project_record_id,
				       local_project_id
				  FROM mural_boards
				 WHERE project_id = ?1
				   ${purposeLower ? "AND (LOWER(purpose) = ?2)" : ""}
				 ORDER BY datetime(updated_at) DESC
				 LIMIT 1;
			`,
			params: purposeLower ? [localProjectId, purposeLower] : [localProjectId]
		});
	}

	for (const attempt of attempts) {
		try {
			const row = await d1Get(env, attempt.sql, attempt.params);
			if (row && row.mural_id) {
				return {
					mural_id: row.mural_id,
					board_url: row.board_url || null,
					workspace_id: row.workspace_id || null,
					project_record_id: row.project_record_id || null,
					local_project_id: row.local_project_id || null
				};
			}
		} catch (err) {
			// Do not hard-fail on SQL errors; just move to next attempt.
			console.warn("[mural.d1ResolveMuralBoard] D1 lookup attempt failed", {
				message: String(err?.message || err)
			});
		}
	}

	return null;
}

/* ───────────────────────── Class ───────────────────────── */

export class MuralServicePart {
	/**
	 * @param {ResearchOpsService} root
	 */
	constructor(root) {
		this.root = root;
	}

	kvKey(uid) {
		return `mural:${uid}:tokens`;
	}

	async saveTokens(uid, tokens) {
		await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(tokens), { encryption: true });
	}

	async loadTokens(uid) {
		const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid));
		return raw ? JSON.parse(raw) : null;
	}

	/**
	 * Resolve the Mural board for a project.
	 *
	 * Strategy (Airtable-first, D1 fallback):
	 *  1) If explicitMuralId is provided, use it directly (caller knows best).
	 *  2) Try in-memory cache (1-minute TTL).
	 *  3) Determine project identity:
	 *     - If projectId looks like recXXXX, treat as Airtable project id.
	 *     - Else treat as local project UUID and try D1 → Airtable mapping.
	 *     - If still unknown and Airtable is available, use atResolveProjectRecordId.
	 *  4) Query Airtable “Mural Boards” (primary source of truth).
	 *  5) If Airtable fails (429/5xx/env missing) or finds nothing, query D1 mural_boards.
	 *  6) If still nothing, fall back to KV cache, then env.MURAL_REFLEXIVE_MURAL_ID.
	 *
	 * D1 is *never* used to replace Airtable as the primary registry; it only makes
	 * journal → Mural sync resilient when Airtable is having a bad day.
	 *
	 * @param {{ projectId:string, uid?:string, purpose?:string, explicitMuralId?:string|null }} args
	 * @returns {Promise<{ muralId:string|null, boardUrl:string|null, workspaceId:string|null, projectRecordId:string|null, source:string }>}
	 */
	async resolveBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, explicitMuralId }) {
		// 1) Explicit override from caller
		if (explicitMuralId) {
			return {
				muralId: String(explicitMuralId),
				boardUrl: null,
				workspaceId: null,
				projectRecordId: null,
				source: "explicit"
			};
		}

		const rawProjectId = String(projectId || "").trim();
		const cacheKey = `${rawProjectId}·${purpose || ""}·${uid || ""}`;
		const now = Date.now();

		// 2) In-memory cache (short TTL to avoid stale mappings)
		const cached = resolveBoardCache.get(cacheKey);
		if (cached && now - cached.ts < 60_000) {
			return {
				muralId: cached.muralId || null,
				boardUrl: cached.boardUrl || null,
				workspaceId: cached.workspaceId || null,
				projectRecordId: cached.projectRecordId || null,
				source: cached.source || "cache"
			};
		}

		const env = this.root.env;
		const log = this.root.log || console;
		const airtableConfigured = !!(env.AIRTABLE_BASE_ID || env.AIRTABLE_BASE) &&
			!!(env.AIRTABLE_API_KEY || env.AIRTABLE_PAT);

		let localProjectId = null;
		let projectRecordId = null;

		// 3) Work out local vs Airtable project IDs
		if (rawProjectId && rawProjectId.startsWith("rec")) {
			// Looks like an Airtable project record id
			projectRecordId = rawProjectId;
		} else if (rawProjectId) {
			localProjectId = rawProjectId;
		}

		// 3a) If we have a local project id, first try D1 to get its Airtable record id.
		if (localProjectId) {
			try {
				const proj = await d1GetProjectByLocalId(env, localProjectId);
				if (proj?.record_id) {
					projectRecordId = proj.record_id;
					log.info?.("[mural.resolveBoard] D1 mapped local project id → Airtable record id", {
						localProjectId,
						projectRecordId
					});
				}
			} catch (err) {
				log.warn?.("[mural.resolveBoard] D1 project mapping failed", {
					localProjectId,
					err: String(err?.message || err)
				});
			}
		}

		// 3b) If Airtable is configured and we *still* don't know the Airtable id,
		//      fallback to the existing Airtable helper.
		let airtableError = null;
		if (!projectRecordId && airtableConfigured && rawProjectId) {
			try {
				projectRecordId = await atResolveProjectRecordId(env, rawProjectId);
			} catch (err) {
				airtableError = String(err?.message || err);
				log.warn?.("[mural.resolveBoard] atResolveProjectRecordId failed", {
					rawProjectId,
					err: airtableError
				});
			}
		}

		let boardFromAirtable = null;

		// 4) Airtable remains primary when available
		if (airtableConfigured && (projectRecordId || rawProjectId)) {
			try {
				const rows = await atListBoards(
					env, {
						projectId: projectRecordId || rawProjectId,
						uid,
						purpose,
						active: true,
						max: 25
					},
					this.root
				);

				if (Array.isArray(rows) && rows.length) {
					// Prefer explicit primary, otherwise any match
					const primaryRow = rows.find(r => {
						const f = r?.fields || {};
						return f["Primary?"] === true || String(f["Primary?"] || "").toLowerCase() === "true";
					}) || rows[0];

					const f = primaryRow.fields || {};
					const muralId = f["Mural ID"] || f.mural_id || null;
					const boardUrl = f["Board URL"] || f.board_url || null;
					const workspaceId = f["Workspace ID"] || f.workspace_id || null;

					if (muralId) {
						boardFromAirtable = {
							muralId,
							boardUrl,
							workspaceId,
							projectRecordId: projectRecordId || null
						};
					}
				}
			} catch (err) {
				airtableError = String(err?.message || err);
				log.warn?.("[mural.resolveBoard] Airtable listBoards failed; will consider D1 fallback", {
					err: airtableError
				});
			}
		}

		// 4b) If Airtable gave us a board, that’s the winner.
		if (boardFromAirtable?.muralId) {
			const result = {
				muralId: boardFromAirtable.muralId,
				boardUrl: boardFromAirtable.boardUrl || null,
				workspaceId: boardFromAirtable.workspaceId || null,
				projectRecordId: boardFromAirtable.projectRecordId || projectRecordId || null,
				source: "airtable"
			};
			resolveBoardCache.set(cacheKey, { ...result, ts: now });
			return result;
		}

		// 5) D1 fallback – only reached if Airtable failed or had no board row.
		let boardFromD1 = null;
		try {
			boardFromD1 = await d1ResolveMuralBoard(env, {
				projectRecordId,
				localProjectId,
				purpose
			});
		} catch (err) {
			log.warn?.("[mural.resolveBoard] D1 mural_boards lookup failed", {
				err: String(err?.message || err)
			});
		}

		if (boardFromD1?.mural_id) {
			const result = {
				muralId: boardFromD1.mural_id,
				boardUrl: boardFromD1.board_url || null,
				workspaceId: boardFromD1.workspace_id || null,
				projectRecordId: boardFromD1.project_record_id || projectRecordId || null,
				source: "d1"
			};
			resolveBoardCache.set(cacheKey, { ...result, ts: now });
			return result;
		}

		// 6) KV cache fallback – older sessions may have cached viewer URL
		let kv = null;
		try {
			kv = await _kvProjectMapping(env, { uid: uid || "anon", projectId: rawProjectId });
		} catch (err) {
			log.warn?.("[mural.resolveBoard] KV project mapping lookup failed", {
				err: String(err?.message || err)
			});
		}

		if (kv?.muralId) {
			const result = {
				muralId: kv.muralId,
				boardUrl: kv.url || kv.boardUrl || null,
				workspaceId: kv.workspaceId || null,
				projectRecordId: projectRecordId || null,
				source: "kv"
			};
			resolveBoardCache.set(cacheKey, { ...result, ts: now });
			return result;
		}

		// 7) Absolute last-ditch fallback: static env id (mostly for debugging)
		const fallbackMuralId = env.MURAL_REFLEXIVE_MURAL_ID || null;
		const result = {
			muralId: fallbackMuralId,
			boardUrl: null,
			workspaceId: null,
			projectRecordId: projectRecordId || null,
			source: fallbackMuralId ? "env" : (airtableError ? "airtable+d1-none" : "none")
		};
		resolveBoardCache.set(cacheKey, { ...result, ts: now });
		return result;
	}

	async registerBoard({
		projectId,
		uid,
		purpose = PURPOSE_REFLEXIVE,
		muralId,
		boardUrl,
		workspaceId = null,
		primary = true
	}) {
		if (!projectId || !uid || !muralId) return { ok: false, error: "missing_fields" };

		const safeProjectIdText = String(projectId).trim();
		const normalizedBoardUrl = typeof boardUrl === "string" && boardUrl.trim() ? boardUrl.trim() : null;
		const normalizedWorkspaceId = typeof workspaceId === "string" && workspaceId.trim() ? workspaceId.trim() : null;

		let existing = null;
		try {
			const rows = await atListBoards(
				this.root.env, { projectId: safeProjectIdText, uid, purpose, active: true, max: 25 },
				this.root
			);
			existing = rows.find(r => String(r?.fields?.["Mural ID"] || "").trim() === String(muralId).trim()) || null;
		} catch {}

		if (existing) {
			const updateFields = {
				"Project ID": safeProjectIdText,
				"UID": String(uid),
				"Purpose": String(purpose),
				"Mural ID": String(muralId),
				"Primary?": !!primary,
				"Active": true
			};
			if (normalizedBoardUrl) updateFields["Board URL"] = normalizedBoardUrl;
			if (normalizedWorkspaceId) updateFields["Workspace ID"] = normalizedWorkspaceId;

			await atUpdateBoard(this.root.env, existing.id, updateFields, this.root);
		} else {
			await atCreateBoard(
				this.root.env, {
					projectIdText: safeProjectIdText,
					uid: String(uid),
					purpose: String(purpose),
					muralId: String(muralId),
					boardUrl: normalizedBoardUrl || undefined,
					workspaceId: normalizedWorkspaceId || undefined,
					primary: !!primary,
					active: true
				},
				this.root
			);
		}

		const cacheKey = `${safeProjectIdText}·${uid || ""}·${purpose}`;
		_memCache.set(cacheKey, {
			muralId: String(muralId),
			boardUrl: normalizedBoardUrl,
			workspaceId: normalizedWorkspaceId,
			ts: Date.now(),
			primary: !!primary,
			deleted: false
		});
		return { ok: true };
	}

	async muralAuth(origin, url) {
		const dbg = _wantDebugFromUrl(url);
		const uid = url.searchParams.get("uid") || "anon";
		const ret = url.searchParams.get("return") || "";
		let safeReturn = "/pages/projects/";
		try {
			if (ret && new URL(ret).origin === new URL(origin).origin) safeReturn = ret;
		} catch {
			if (ret.startsWith("/")) safeReturn = ret;
		}

		const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn, dbg }));
		const redirect = buildAuthUrl(this.root.env, state);
		return Response.redirect(redirect, 302);
	}

	async muralCallback(origin, url) {
		const code = url.searchParams.get("code");
		const stateB64 = url.searchParams.get("state");
		if (!code) return Response.redirect("/pages/projects/#mural-auth-missing-code", 302);

		let uid = "anon";
		let stateObj = {};
		try {
			stateObj = JSON.parse(b64Decode(stateB64 || ""));
			uid = stateObj?.uid || "anon";
		} catch {}

		let tokens;
		try {
			tokens = await exchangeAuthCode(this.root.env, code);
		} catch {
			return Response.redirect(`${stateObj?.return || "/pages/projects/"}#mural-token-exchange-failed`, 302);
		}

		await this.saveTokens(uid, tokens);

		const want = stateObj?.return || "/pages/projects/";
		const back = want.startsWith("http") ? want : new URL(want, url).toString();
		const u = new URL(back);
		u.searchParams.set("mural", "connected");
		return Response.redirect(u.toString(), 302);
	}

	async muralVerify(origin, url) {
		const cors = this.root.corsHeaders(origin);
		const uid = url.searchParams.get("uid") || "anon";
		try {
			const tokenRes = await _getValidAccessToken(this, uid);
			if (!tokenRes.ok) {
				return this.root.json({ ok: false, error: tokenRes.reason },
					tokenRes.reason === "not_authenticated" ? 401 : 500,
					cors
				);
			}
			const accessToken = tokenRes.token;

			const me = await getMe(this.root.env, accessToken).catch(() => null);
			const activeWorkspaceId = getActiveWorkspaceIdFromMe(me) || null;
			return this.root.json({ ok: true, me, activeWorkspaceId }, 200, cors);
		} catch (err) {
			return this.root.json({ ok: false, error: "verify_failed", detail: String(err?.message || err) },
				500,
				cors
			);
		}
	}

	async muralSetup(request, origin) {
		const cors = this.root.corsHeaders(origin);
		let step = "parse_input";

		try {
			const body = await request.json().catch(() => ({}));
			const uid = body?.uid ?? "anon";
			const projectId = body?.projectId ?? null;
			const projectName = body?.projectName;
			const wsOverride = body?.workspaceId;

			console.log("[mural.setup] Starting", { uid, projectId, projectName, hasWorkspaceOverride: !!wsOverride });

			if (!projectName || !String(projectName).trim()) {
				console.error("[mural.setup] Missing projectName");
				return this.root.json({ ok: false, error: "projectName required" }, 400, cors);
			}
			if (!projectId) {
				console.error("[mural.setup] Missing projectId");
				return this.root.json({ ok: false, error: "projectId required" }, 400, cors);
			}

			step = "load_tokens";
			const tokens = await this.loadTokens(uid);
			if (!tokens?.access_token) {
				console.error("[mural.setup] No access token for uid", { uid });
				return this.root.json({ ok: false, reason: "not_authenticated" }, 401, cors);
			}

			step = "verify_workspace";
			let accessToken = tokens.access_token;
			let ws;
			try {
				ws = await _ensureWorkspace(this.root, accessToken, wsOverride);
				console.log("[mural.setup] Workspace verified", { workspaceId: ws.id, workspaceName: ws.name });
			} catch (err) {
				const code = Number(err?.status || err?.code || 0);
				if (code === 401 && tokens.refresh_token) {
					console.log("[mural.setup] Token expired, refreshing");
					const refreshed = await refreshAccessToken(this.root.env, tokens.refresh_token);
					const merged = { ...tokens, ...refreshed };
					await this.saveTokens(uid, merged);
					accessToken = merged.access_token;
					ws = await _ensureWorkspace(this.root, accessToken, wsOverride);
					console.log("[mural.setup] Workspace verified after refresh", { workspaceId: ws.id });
				} else if (String(err?.message) === "not_in_home_office_workspace") {
					console.error("[mural.setup] Not in Home Office workspace");
					return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, cors);
				} else {
					throw err;
				}
			}

			step = "get_me";
			const me = await getMe(this.root.env, accessToken).catch(() => null);
			const username = me?.value?.firstName || me?.name || "Private";
			console.log("[mural.setup] User identity", { username, userId: me?.value?.id });

			step = "resolve_user_room";
			const room = await resolveUserOwnedRoomForSetup(this.root.env, accessToken, ws.id);
			const roomId = room?.id || room?.value?.id;
			if (!roomId) {
				console.error("[mural.setup] No user-owned room ID obtained", { room });
				return this.root.json({ ok: false, error: "user_room_not_found", step }, 502, cors);
			}
			console.log("[mural.setup] Target room resolved", {
				roomId,
				roomName: room?.name || room?.title
			});

			step = "ensure_folder";
			let folder = null;
			try {
				folder = await ensureProjectFolder(this.root.env, accessToken, roomId, String(projectName).trim());
				console.log("[mural.setup] Folder ensured", { folderId: folder?.id, folderName: folder?.name });
			} catch (e) {
				console.warn("[mural.setup] Folder creation failed (non-critical)", { error: e?.message, status: e?.status });
			}

			step = "duplicate_or_create_mural";
			let mural = null;
			let muralId = null;
			let templateCopied = true;

			const templateId = this.root.env.MURAL_TEMPLATE_REFLEXIVE || "76da04f30edfebd1ac5b595ad2953629b41c1c7d";
			const muralTitle = `Reflexive Journal: ${projectName}`;
			console.log("[mural.setup] Starting mural creation", {
				templateId,
				roomId,
				folderId: folder?.id,
				muralTitle,
				willAttemptDuplication: true
			});

			try {
				mural = await duplicateMural(this.root.env, accessToken, {
					title: muralTitle,
					roomId,
					folderId: folder?.id || folder?.value?.id
				});
				muralId = mural?.id || mural?.value?.id;
				console.log("[mural.setup] Template duplication SUCCEEDED", { muralId });
			} catch (e) {
				templateCopied = false;

				console.error("[mural.setup] Template duplication FAILED", {
					error: e?.message,
					status: e?.status,
					body: e?.body,
					templateId: e?.templateId,
					endpoint: e?.endpoint,
					willFallbackToBlank: e?.status === 404
				});

				if (e?.status === 404) {
					console.log("[mural.setup] Fallback: Creating blank mural (404 - endpoint not found)");
					mural = await createMural(this.root.env, accessToken, {
						title: muralTitle,
						roomId,
						folderId: folder?.id || folder?.value?.id
					});
					muralId = mural?.id || mural?.value?.id;
					console.log("[mural.setup] Blank mural created", { muralId });
				} else {
					console.error("[mural.setup] NOT creating blank mural - non-404 error", { status: e?.status });
					throw Object.assign(
						new Error(`Template duplication failed: ${e?.message || "Unknown error"}`), {
							code: "TEMPLATE_COPY_FAILED",
							status: e?.status,
							originalError: e
						}
					);
				}
			}

			if (!muralId) {
				console.error("[mural.setup] No mural ID after creation attempts");
				return this.root.json({ ok: false, error: "mural_id_unavailable", step }, 502, cors);
			}

			// Update the title widget on the duplicated mural
			step = "update_area_title";
			try {
				console.log("[mural.setup] Updating reflexive journal title widget", {
					muralId,
					projectName
				});
				await updateAreaTitle(this.root.env, accessToken, muralId, projectName);
				console.log("[mural.setup] Title widget update completed", {
					muralId,
					projectName
				});
			} catch (e) {
				console.warn("[mural.setup] Title widget update failed (non-critical)", {
					muralId,
					projectName,
					error: e?.message,
					status: e?.status
				});
			}

			step = "probe_viewer_url";
			let openUrl = null;
			const deadline = Date.now() + 9000;
			let attempts = 0;
			while (!openUrl && Date.now() < deadline) {
				attempts++;
				openUrl = await _probeViewerUrl(this.root.env, accessToken, muralId, this.root);
				if (!openUrl) {
					await new Promise(r => setTimeout(r, 600));
				}
			}
			console.log("[mural.setup] Viewer URL probe", { openUrl, attempts, found: !!openUrl });

			step = "register_board";
			await this.registerBoard({
				projectId,
				uid,
				purpose: PURPOSE_REFLEXIVE,
				muralId,
				boardUrl: openUrl ?? undefined,
				workspaceId: ws?.id || null,
				primary: true
			});
			console.log("[mural.setup] Board registered in Airtable");

			if (openUrl) {
				const kvKey = `mural:${uid}:project:id::${String(projectId)}`;
				try {
					await this.root.env.SESSION_KV.put(
						kvKey,
						JSON.stringify({
							url: openUrl,
							muralId,
							workspaceId: ws?.id || null,
							projectName,
							updatedAt: Date.now()
						})
					);
					console.log("[mural.setup] KV cache updated");
				} catch (e) {
					console.warn("[mural.setup] KV cache update failed (non-critical)", { error: e?.message });
				}
			}

			console.log("[mural.setup] COMPLETE", {
				muralId,
				boardUrl: openUrl,
				templateCopied,
				folderCreated: !!folder?.id
			});

			return this.root.json({
					ok: true,
					workspace: ws,
					room,
					folder,
					mural: { ...mural, id: muralId, viewLink: openUrl || null },
					projectId,
					registered: true,
					boardUrl: openUrl || null,
					templateCopied
				},
				200,
				cors
			);
		} catch (err) {
			const status = Number(err?.status) || 500;
			const body = err?.body || null;
			const message = String(err?.message || "setup_failed");
			const code = err?.code || null;

			console.error("[mural.setup] FAILED", {
				step,
				status,
				code,
				message,
				body: body?.slice?.(0, 500) || body
			});

			return this.root.json({ ok: false, error: "setup_failed", step, message, code, upstream: body },
				status,
				cors
			);
		}
	}

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
					boardUrl: resolved.boardUrl || null,
					projectRecordId: resolved.projectRecordId || null,
					source: resolved.source || null
				},
				200,
				cors
			);
		} catch (e) {
			return this.root.json({ ok: false, error: "resolve_failed", detail: String(e?.message || e) },
				500,
				cors
			);
		}
	}

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
				return this.root.json({ ok: false, error: "no_mural_id" }, 404, cors);
			}

			step = "access_token";
			const tokenRes = await _getValidAccessToken(this, uid);
			if (!tokenRes.ok) {
				return this.root.json({ ok: false, error: tokenRes.reason },
					tokenRes.reason === "not_authenticated" ? 401 : 500,
					cors
				);
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
			return this.root.json({ ok: false, error: "journal_sync_failed", step, message, upstream: body },
				status,
				cors
			);
		}
	}

	async muralListWorkspaces(origin, url) {
		const cors = this.root.corsHeaders(origin);
		const uid = url.searchParams.get("uid") || "anon";

		try {
			const tokenRes = await _getValidAccessToken(this, uid);
			if (!tokenRes.ok) {
				return this.root.json({ ok: false, error: tokenRes.reason },
					tokenRes.reason === "not_authenticated" ? 401 : 500,
					cors
				);
			}
			const accessToken = tokenRes.token;

			const list = await listUserWorkspaces(this.root.env, accessToken);
			return this.root.json({ ok: true, workspaces: list }, 200, cors);
		} catch (err) {
			return this.root.json({ ok: false, error: "workspaces_failed", detail: String(err?.message || err) },
				500,
				cors
			);
		}
	}

	async muralMe(origin, url) {
		const cors = this.root.corsHeaders(origin);
		const uid = url.searchParams.get("uid") || "anon";

		try {
			const tokenRes = await _getValidAccessToken(this, uid);
			if (!tokenRes.ok) {
				return this.root.json({ ok: false, error: tokenRes.reason },
					tokenRes.reason === "not_authenticated" ? 401 : 500,
					cors
				);
			}
			const accessToken = tokenRes.token;

			const me = await getMe(this.root.env, accessToken);
			return this.root.json({ ok: true, me }, 200, cors);
		} catch (err) {
			return this.root.json({ ok: false, error: "me_failed", detail: String(err?.message || err) },
				500,
				cors
			);
		}
	}

	async muralDebugEnv(origin) {
		const cors = this.root.corsHeaders(origin);
		const env = this.root.env;
		return this.root.json({
				ok: true,
				env: {
					hasMuralClientId: !!env.MURAL_CLIENT_ID,
					hasMuralClientSecret: !!env.MURAL_CLIENT_SECRET,
					muralRedirectUri: env.MURAL_REDIRECT_URI || "(not set)",
					muralApiBase: env.MURAL_API_BASE || "(default)",
					muralTemplateReflexive: env.MURAL_TEMPLATE_REFLEXIVE || "(default)"
				}
			},
			200,
			cors
		);
	}
}
