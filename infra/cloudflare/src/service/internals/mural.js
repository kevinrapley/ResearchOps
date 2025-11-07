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
	// listWorkspaces (optional in some SDKs; we derive from getMe when absent)
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

/** Normalise ALLOWED_ORIGINS (array or comma-separated string) and validate return URL origin. */
function _isAllowedReturn(env, urlStr) {
	try {
		const u = new URL(urlStr);
		const raw = env.ALLOWED_ORIGINS;
		const list = Array.isArray(raw)
			? raw
			: String(raw || "")
				.split(",")
				.map(s => s.trim())
				.filter(Boolean);
		return list.includes(`${u.protocol}//${u.host}`);
	} catch {
		return false;
	}
}

/* ───────────────────────── Airtable “Mural Boards” access ───────────────────────── */

/**
 * Build Airtable filter for UID / Purpose / Active only (projectId filtered client-side).
 */
function _buildBoardsFilter({ uid, purpose, active = true }) {
	const ands = [];
	if (uid) ands.push(`{UID} = "${_esc(uid)}"`);
	if (purpose) ands.push(`{Purpose} = "${_esc(purpose)}"`);
	if (typeof active === "boolean") ands.push(`{Active} = ${active ? "1" : "0"}`);
	return ands.length ? `AND(${ands.join(",")})` : "";
}

/**
 * Query Airtable for Mural Boards records (no projectId clause).
 * Sorted by Primary? desc, Created At desc. Then filter for projectId client-side.
 */
async function _airtableListBoards(env, { projectId, uid, purpose, active = true, max = 25 }) {
	const url = new URL(_encodeTableUrl(env, "Mural Boards"));
	const filterByFormula = _buildBoardsFilter({ uid, purpose, active });
	if (filterByFormula) url.searchParams.set("filterByFormula", filterByFormula);
	url.searchParams.set("maxRecords", String(max));
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

	const pid = String(projectId);
	return records.filter(r => {
		const f = r?.fields || {};
		const proj = f["Project"];
		if (Array.isArray(proj)) return proj.includes(pid);
		return String(proj || "") === pid;
	});
}

/** Create a board mapping row in Airtable. */
async function _airtableCreateBoard(env, { projectId, uid, purpose, muralId, boardUrl = null, workspaceId = null, primary = false, active = true }) {
	const url = _encodeTableUrl(env, "Mural Boards");

	const mkBodyLinked = () => ({
		records: [{
			fields: {
				"Project": [{ id: String(projectId) }],
				"UID": uid,
				"Purpose": purpose,
				"Mural ID": muralId,
				"Board URL": boardUrl,
				"Workspace ID": workspaceId,
				"Primary?": !!primary,
				"Active": !!active
			}
		}]
	});

	const mkBodyText = () => ({
		records: [{
			fields: {
				"Project": String(projectId),
				"UID": uid,
				"Purpose": purpose,
				"Mural ID": muralId,
				"Board URL": boardUrl,
				"Workspace ID": workspaceId,
				"Primary?": !!primary,
				"Active": !!active
			}
		}]
	});

	let res = await fetch(url, { method: "POST", headers: _airtableHeaders(env), body: JSON.stringify(mkBodyLinked()) });
	let js = await res.json().catch(() => ({}));
	if (res.ok) return js;

	const errStr = JSON.stringify(js || {});
	if (res.status === 422 || /UNKNOWN_FIELD_NAME|INVALID_VALUE|FIELD_VALUE_INVALID/i.test(errStr)) {
		res = await fetch(url, { method: "POST", headers: _airtableHeaders(env), body: JSON.stringify(mkBodyText()) });
		js = await res.json().catch(() => ({}));
		if (res.ok) return js;
	}

	throw Object.assign(new Error("airtable_create_failed"), { status: res.status, body: js });
}

/* ───────────────────────── URL helpers ───────────────────────── */

function _looksLikeMuralViewerUrl(u) {
	try {
		const x = new URL(u);
		return x.hostname === "app.mural.co" && /^\/t\/[^/]+\/m\/[^/]+/i.test(x.pathname);
	} catch { return false; }
}

/** Normalise possible response shapes to a single viewer URL. */
function _extractViewerUrl(payload) {
	if (!payload) return null;
	const candidates = [
		payload.viewerUrl,
		payload.viewLink,
		payload._canvasLink,
		payload.openUrl,
		payload?.value?.viewerUrl,
		payload?.value?.viewLink,
		payload?.data?.viewerUrl,
		payload?.data?.viewLink,
		payload?.links?.viewer,
		payload?.links?.open
	].filter(Boolean);

	const first = candidates.find(_looksLikeMuralViewerUrl);
	return first || null;
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
	constructor(root) { this.root = root; }

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

	async resolveBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, explicitMuralId }) {
		if (explicitMuralId) return { muralId: String(explicitMuralId) };

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

			const kv = await _kvProjectMapping(this.root.env, { uid, projectId });
			if (kv?.url) {
				if (_looksLikeMuralViewerUrl(kv.url)) {
					return { muralId: null, boardUrl: kv.url, workspaceId: null };
				} else {
					try {
						const key = `mural:${uid || "anon"}:project:id::${String(projectId)}`;
						await this.root.env.SESSION_KV.delete(key);
					} catch { /* ignore */ }
				}
			}
		}

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

	/* ───────────────────────── Routes ───────────────────────── */

	async muralAuth(origin, url) {
		const uid = url.searchParams.get("uid") || "anon";
		const ret = url.searchParams.get("return") || "";
		let safeReturn = "/pages/projects/";

		if (ret && _isAllowedReturn(this.root.env, ret)) {
			safeReturn = ret;
		} else if (ret.startsWith("/")) {
			safeReturn = ret;
		}

		if (!this.root.env.MURAL_CLIENT_ID || !this.root.env.MURAL_CLIENT_SECRET || !this.root.env.MURAL_REDIRECT_URI) {
			return this.root.json(
				{ ok: false, error: "missing_config", message: "Missing required Mural OAuth config: MURAL_CLIENT_ID/MURAL_CLIENT_SECRET/MURAL_REDIRECT_URI" },
				500,
				this.root.corsHeaders(origin)
			);
		}

		const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
		const redirect = buildAuthUrl(this.root.env, state);
		return Response.redirect(redirect, 302);
	}

	async muralCallback(origin, url) {
		const { env } = this.root;

		if (!env.MURAL_CLIENT_SECRET || !env.MURAL_CLIENT_ID || !env.MURAL_REDIRECT_URI) {
			return this.root.json({
				ok: false,
				error: "missing_secret",
				message: "MURAL_CLIENT_ID / MURAL_CLIENT_SECRET / MURAL_REDIRECT_URI must be configured."
			}, 500, this.root.corsHeaders(origin));
		}

		const code = url.searchParams.get("code");
		const stateB64 = url.searchParams.get("state");
		if (!code) {
			const fallback = "/pages/projects/";
			return Response.redirect(fallback + "#mural-auth-missing-code", 302);
		}

		let uid = "anon";
		let stateObj = {};
		try {
			stateObj = JSON.parse(b64Decode(stateB64 || ""));
			uid = stateObj?.uid || "anon";
		} catch { /* ignore */ }

		let tokens;
		try {
			tokens = await exchangeAuthCode(env, code);
		} catch (_err) {
			const want = stateObj?.return || "/pages/projects/";
			return Response.redirect(`${want}#mural-token-exchange-failed`, 302);
		}

		await this.saveTokens(uid, tokens);

		const want = stateObj?.return || "/pages/projects/";
		let backUrl;

		if (want.startsWith("http")) {
			backUrl = _isAllowedReturn(env, want) ? new URL(want) : new URL("/pages/projects/", url);
		} else {
			backUrl = new URL(want, url);
		}

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

		return this.root.json({ ok: true, me, activeWorkspaceId }, 200, this.root.corsHeaders(origin));
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
			const roomId = room?.id || room?.roomId || room?.value?.id;
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

			let hydrated = null;
			try { hydrated = await getMural(this.root.env, accessToken, mural.id); } catch { /* non-fatal */ }

			const openUrl = _extractViewerUrl(hydrated) || _extractViewerUrl(mural) || null;

			let registered = false;
			if (projectId) {
				try {
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
				} catch (e) {
					this.root.log?.error?.("mural.airtable_register_failed", {
						status: e?.status,
						body: e?.body
					});
				}
			}

			try {
				if (projectId && openUrl && _looksLikeMuralViewerUrl(openUrl)) {
					const kvKey = `mural:${uid}:project:id::${String(projectId)}`;
					await this.root.env.SESSION_KV.put(kvKey, JSON.stringify({
						url: openUrl,
						projectName: projectName,
						updatedAt: Date.now()
					}));
				}
			} catch { /* non-fatal */ }

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
	 * POST /api/mural/journal-sync
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

	/** GET /api/mural/me */
	async muralMe(origin, url) {
		const uid = url.searchParams.get("uid") || "anon";
		const cors = this.root.corsHeaders(origin);

		const tokenRes = await this._getValidAccessToken(uid);
		if (!tokenRes.ok) {
			const code = tokenRes.reason === "not_authenticated" ? 401 : 500;
			return this.root.json({ ok: false, error: tokenRes.reason }, code, cors);
		}

		const accessToken = tokenRes.token;
		const me = await getMe(this.root.env, accessToken).catch(() => null);
		const activeWorkspaceId = getActiveWorkspaceIdFromMe(me) || null;

		return this.root.json({ ok: true, me, activeWorkspaceId }, 200, cors);
	}

	/** GET /api/mural/workspaces */
	async muralListWorkspaces(origin, url) {
		const uid = url.searchParams.get("uid") || "anon";
		const cors = this.root.corsHeaders(origin);

		const tokenRes = await this._getValidAccessToken(uid);
		if (!tokenRes.ok) {
			const code = tokenRes.reason === "not_authenticated" ? 401 : 500;
			return this.root.json({ ok: false, error: tokenRes.reason }, code, cors);
		}

		const accessToken = tokenRes.token;
		const me = await getMe(this.root.env, accessToken).catch(() => null);

		const workspaces = [];
		const memberships = me?.value?.memberships || me?.memberships || [];
		for (const m of memberships) {
			const ws = m?.workspace || m?.value?.workspace || m?.workspaceId ? {
				id: m.workspaceId || m?.workspace?.id || m?.value?.workspace?.id || null,
				name: m?.workspace?.name || m?.value?.workspace?.name || null,
				role: m?.role || m?.value?.role || null
			} : null;
			if (ws?.id) workspaces.push(ws);
		}

		const activeWorkspaceId = getActiveWorkspaceIdFromMe(me) || null;
		return this.root.json({ ok: true, workspaces, activeWorkspaceId }, 200, cors);
	}

	/** GET /api/mural/find (alias that delegates to resolve) */
	async muralFind(origin, url) {
		return this.muralResolve(origin, url);
	}

	/** Debug */
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
