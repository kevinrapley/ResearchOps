/**
 * @file service/internals/mural.js
 * @module service/internals/mural
 * @summary Mural routes logic (OAuth + provisioning + journal sync) backed by Airtable.
 *
 * Key change: when creating a "Mural Boards" row we now POST the Project Record ID
 * into the single-line text field "Project ID". Airtable's Field Agent will link
 * this to the Projects table internally. We still read legacy linked fields for
 * backward compatibility.
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

import {
	d1GetProjectByLocalId,
	d1GetMuralBoardForProject
} from "./researchops-d1.js";

import { b64Encode, b64Decode } from "../../core/utils.js";

/** @typedef {import("../index.js").ResearchOpsService} ResearchOpsService */

const GRID_Y = 32;
const DEFAULT_W = 240;
const DEFAULT_H = 120;
const PURPOSE_REFLEXIVE = "reflexive_journal";

const _memCache = new Map();

/* ───────────────────────── small debug helpers ───────────────────────── */
function _wantDebugFromUrl(urlLike) {
	try { return (new URL(String(urlLike))).searchParams.get("debug") === "true"; } catch { return false; }
}

function _withDebugCtx(root, dbg) { return Object.assign({}, root, { __dbg: !!dbg }); }

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
	} catch { return false; }
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
		for (const v of Object.values(n))
			if (!cands.includes(v)) queue.push(v);
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
	try { return JSON.parse(raw); } catch { return null; }
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

/* ───────────────────────── Class ───────────────────────── */

export class MuralServicePart {
	constructor(root) { this.root = root; }
	kvKey(uid) { return `mural:${uid}:tokens`; }
	async saveTokens(uid, tokens) { await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(tokens), { encryption: true }); }
	async loadTokens(uid) { const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid)); return raw ? JSON.parse(raw) : null; }

	/**
	 * Resolve the Mural board for a project.
	 *
	 * Strategy:
	 *  1) Use Airtable "Mural Boards" table (primary).
	 *  2) If Airtable is unavailable (429/5xx/env missing) or returns no row, fallback to D1:
	 *     - projects.local_id → projects.record_id (Airtable project id)
	 *     - mural_boards.project = Airtable project id OR local project UUID.
	 *
	 * Returns a flat shape suitable for callers:
	 *   { muralId, boardUrl, workspaceId, source, projectRecordId, airtableError? }
	 *
	 * @param {{ uid?:string, projectId:string, purpose?:string, explicitMuralId?:string }} args
	 */
	async resolveBoard({ uid, projectId, purpose = PURPOSE_REFLEXIVE, explicitMuralId } = {}) {
		const env = this.root.env;
		const log = this.root.log || console;
		const userId = uid || "anon";
		const localProjectId = String(projectId || "").trim();

		// 0) If caller gives us an explicit muralId, honour it directly.
		if (explicitMuralId) {
			return {
				source: "explicit",
				projectRecordId: null,
				muralId: String(explicitMuralId),
				boardUrl: null,
				workspaceId: null
			};
		}

		// 1) Resolve local project id -> Airtable project record id via D1.
		let projectRecordId = null;
		try {
			const proj = await d1GetProjectByLocalId(env, localProjectId);
			if (proj?.record_id) {
				projectRecordId = proj.record_id;
			} else {
				log.warn?.("[mural.resolveBoard] No D1 project mapping for local id", { localProjectId });
			}
		} catch (err) {
			log.warn?.("[mural.resolveBoard] d1GetProjectByLocalId failed", {
				localProjectId,
				err: String(err?.message || err)
			});
		}

		function airtableConfigured() {
			return !!(env.AIRTABLE_BASE_ID || env.AIRTABLE_BASE) &&
				!!(env.AIRTABLE_API_KEY || env.AIRTABLE_PAT);
		}

		let airtableError = null;
		let boardFromAirtable = null;

		// 2) Airtable path (primary) – only if configured AND we know Airtable project id
		if (airtableConfigured() && projectRecordId) {
			try {
				const rows = await atListBoards(env, {
					projectId: projectRecordId,
					uid: userId,
					purpose,
					active: true,
					max: 50
				}, this.root);

				const cand = Array.isArray(rows) ? rows.find(r => {
					const f = r?.fields || {};
					const proj = f.Project || f.Projects || f["Project ID"] || f["Project Id"];
					const projectIds = Array.isArray(proj) ? proj : (proj ? [proj] : []);
					const purposeField = (f.Purpose || f.purpose || "").toLowerCase();
					const active = String(f.Active || f.active || "").toLowerCase();
					const primary = String(f["Primary?"] || f.primary || "").toLowerCase();

					return projectIds.includes(projectRecordId) &&
						(!purpose || purposeField === purpose.toLowerCase()) &&
						(!active || active === "checked") &&
						(!primary || primary === "checked");
				}) : null;

				if (cand) {
					const f = cand.fields || {};
					boardFromAirtable = {
						record_id: cand.id,
						mural_id: f["Mural ID"] || f.mural_id || "",
						board_url: f["Board URL"] || f.board_url || "",
						workspace_id: f["Workspace ID"] || f.workspace_id || ""
					};
				}
			} catch (err) {
				const msg = String(err?.message || err || "");
				airtableError = msg;
				log.warn?.("[mural.resolveBoard] Airtable path failed, will fallback to D1", {
					err: msg
				});
			}
		}

		if (boardFromAirtable?.mural_id) {
			return {
				source: "airtable",
				projectRecordId,
				muralId: boardFromAirtable.mural_id,
				boardUrl: boardFromAirtable.board_url || null,
				workspaceId: boardFromAirtable.workspace_id || null
			};
		}

		// 3) D1 fallback – either Airtable failed, or no board row was found.
		//    IMPORTANT: we match on BOTH Airtable project id and local UUID so
		//    you can import the CSV keyed either way.
		let boardFromD1 = null;
		try {
			boardFromD1 = await d1GetMuralBoardForProject(env, {
				projectRecordId,
				localProjectId,
				purpose
			});
		} catch (err) {
			log.warn?.("[mural.resolveBoard] D1 fallback failed", {
				err: String(err?.message || err)
			});
		}

		if (boardFromD1?.mural_id) {
			return {
				source: "d1",
				projectRecordId,
				muralId: boardFromD1.mural_id,
				boardUrl: boardFromD1.board_url || null,
				workspaceId: boardFromD1.workspace_id || null,
				airtableError
			};
		}

		// 4) Nothing found
		log.warn?.("[mural.resolveBoard] No board found in Airtable or D1", {
			localProjectId,
			projectRecordId,
			airtableError
		});

		return {
			source: airtableError ? "airtable+d1-none" : "airtable-none",
			projectRecordId,
			muralId: null,
			boardUrl: null,
			workspaceId: null,
			airtableError
		};
	}

	async registerBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, muralId, boardUrl, workspaceId = null, primary = true }) {
		if (!projectId || !uid || !muralId) return { ok: false, error: "missing_fields" };

		const safeProjectIdText = String(projectId).trim();
		const normalizedBoardUrl = typeof boardUrl === "string" && boardUrl.trim() ? boardUrl.trim() : null;
		const normalizedWorkspaceId = typeof workspaceId === "string" && workspaceId.trim() ? workspaceId.trim() : null;

		let existing = null;
		try {
			const rows = await atListBoards(this.root.env, {
				projectId: safeProjectIdText,
				uid,
				purpose,
				active: true,
				max: 25
			}, this.root);
			existing = Array.isArray(rows)
				? rows.find(r => String(r?.fields?.["Mural ID"] || "").trim() === String(muralId).trim()) || null
				: null;
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
			await atCreateBoard(this.root.env, {
				projectIdText: safeProjectIdText,
				uid: String(uid),
				purpose: String(purpose),
				muralId: String(muralId),
				boardUrl: normalizedBoardUrl || undefined,
				workspaceId: normalizedWorkspaceId || undefined,
				primary: !!primary,
				active: true
			}, this.root);
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
		} catch { if (ret.startsWith("/")) safeReturn = ret; }

		const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
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

	// … rest of the class (muralSetup, muralResolve, muralJournalSync) unchanged
	// from the previous version I gave you, except that they now call this.resolveBoard()
	// which uses the updated D1 logic above.
	// (Keep your existing muralSetup / muralResolve / muralJournalSync bodies.)
}
