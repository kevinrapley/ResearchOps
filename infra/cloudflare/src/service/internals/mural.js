/**
 * @file service/internals/mural.js
 * @module service/internals/mural
 * @summary Mural routes logic (OAuth + provisioning + journal sync) with Airtable-backed board mapping.
 *
 * Airtable table expected: "Mural Boards" (override with env.AIRTABLE_TABLE_MURAL_BOARDS).
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
	createViewerLink
} from "../../lib/mural.js";

import {
	makeTableUrl,
	authHeaders,
	listAll,
	findProjectRecordIdByName
} from "./airtable.js";

import { b64Encode, b64Decode } from "../../core/utils.js";

/** @typedef {import("../index.js").ResearchOpsService} ResearchOpsService */

const GRID_Y = 32;
const DEFAULT_W = 240;
const DEFAULT_H = 120;
const PURPOSE_REFLEXIVE = "reflexive_journal";

/** In-process soft cache (evicted on cold starts) */
const _memCache = new Map(); // key: `${projectId}·${uid||""}·${purpose}` → { muralId, boardUrl, workspaceId, ts, primary }

/* ───────────────────────── debug + logging ───────────────────────── */
function _wantDebugFromUrl(urlLike) {
	try {
		if (!urlLike) return false;
		const u = urlLike instanceof URL ? urlLike : new URL(String(urlLike));
		return (u.searchParams.get("debug") || "").toLowerCase() === "true";
	} catch { return false; }
}
function _withDebugCtx(root, dbg) { return Object.assign({}, root, { __dbg: !!dbg }); }
function _log(root, level, event, data) {
	const dbg = !!root?.__dbg;
	const isLow = (level === "debug" || level === "info");
	if (isLow && !dbg) return;
	try {
		if (root?.log?.[level]) {
			root.log[level](event, data);
			if (typeof root.log.flush === "function" && level !== "debug") root.log.flush();
		} else if (level === "error") { console.error(`[${event}]`, data);
		} else if (level === "warn") { console.warn(`[${event}]`, data);
		} else { console.log(`[${event}]`, data); }
	} catch {}
}

/* ───────────────────────── Airtable helpers (table names, small glue) ───────────────────────── */

function _boardsTableName(env) {
	const override = typeof env.AIRTABLE_TABLE_MURAL_BOARDS === "string" ? env.AIRTABLE_TABLE_MURAL_BOARDS.trim() : "";
	return override || "Mural Boards";
}
function _projectsTableName(env) {
	const override = typeof env.AIRTABLE_TABLE_PROJECTS === "string" ? env.AIRTABLE_TABLE_PROJECTS.trim() : "";
	return override || "Projects";
}
function _esc(v) { return String(v ?? "").replace(/"/g, '\\"'); }
function _looksLikeAirtableId(v) { return typeof v === "string" && /^rec[a-z0-9]{14}$/i.test(v.trim()); }

async function _lookupProjectRecordId(env, { projectId, projectName }, logCtx = null) {
	const tbl = _projectsTableName(env);
	const name = (projectName ?? "").trim();
	const pid = (projectId ?? "").trim();

	// Fast paths
	if (_looksLikeAirtableId(pid)) return pid;
	if (name) {
		try {
			const hit = await findProjectRecordIdByName(env, name);
			if (hit?.id) return hit.id;
		} catch (e) {
			_log(logCtx, "warn", "airtable.projects.lookupByName.failed", { message: e?.message || String(e), name });
		}
	}

	// Fallback: try common ID-ish columns equal to projectId string
	if (pid) {
		const clauses = [
			`{LocalId} = "${_esc(pid)}"`,
			`{localId} = "${_esc(pid)}"`,
			`{Project ID} = "${_esc(pid)}"`,
			`{ProjectId} = "${_esc(pid)}"`,
			`{UID} = "${_esc(pid)}"`,
			`{Slug} = "${_esc(pid)}"`,
			`{Slug ID} = "${_esc(pid)}"`,
			`{ID} = "${_esc(pid)}"`
		];
		const url = new URL(makeTableUrl(env, tbl));
		url.searchParams.set("maxRecords", "1");
		url.searchParams.set("filterByFormula", clauses.length === 1 ? clauses[0] : `OR(${clauses.join(",")})`);
		url.searchParams.append("fields[]", "Name");

		_log(logCtx, "debug", "airtable.projects.lookup.fallback.request", { url: url.toString() });
		const res = await fetch(url.toString(), { headers: authHeaders(env) });
		const js = await res.json().catch(() => ({}));
		if (Array.isArray(js?.records) && js.records[0]?.id) {
			const id = String(js.records[0].id);
			_log(logCtx, "info", "airtable.projects.lookup.fallback.hit", { projectId: pid, recordId: id });
			return id;
		}
		_log(logCtx, "info", "airtable.projects.lookup.fallback.miss", { projectId: pid });
	}

	return null;
}

function _buildBoardsFilter({ uid, purpose, active = true }) {
	const ands = [];
	if (uid) ands.push(`{UID} = "${_esc(uid)}"`);
	if (purpose) ands.push(`{Purpose} = "${_esc(purpose)}"`);
	if (typeof active === "boolean") ands.push(`{Active} = ${active ? "1" : "0"}`);
	return ands.length ? `AND(${ands.join(",")})` : "";
}

async function _airtableListBoards(env, { projectId, uid, purpose, active = true, max = 25 }, logCtx = null) {
	const tbl = _boardsTableName(env);
	const filterByFormula = _buildBoardsFilter({ uid, purpose, active });

	const extraParams = {};
	if (filterByFormula) extraParams.filterByFormula = filterByFormula;
	extraParams["sort[0][field]"] = "Primary?";
	extraParams["sort[0][direction]"] = "desc";
	extraParams["sort[1][field]"] = "Created At";
	extraParams["sort[1][direction]"] = "desc";

	_log(logCtx, "debug", "airtable.boards.list.request", { table: tbl, filterByFormula, projectId });
	const { records } = await listAll(env, tbl, { pageSize: Math.min(max, 100), extraParams });
	if (!projectId) return records;

	// Filter by linked Project
	const pidRaw = String(projectId).trim();
	let pidRec = _looksLikeAirtableId(pidRaw) ? pidRaw : null;
	if (!pidRec) {
		try { pidRec = await _lookupProjectRecordId(env, { projectId: pidRaw, projectName: null }, logCtx); }
		catch {}
	}

	return (records || []).filter(r => {
		const f = r?.fields || {};
		const proj = f["Project"];
		if (Array.isArray(proj)) {
			if (pidRec) {
				if (proj.some(v => typeof v === "string" && String(v).trim() === pidRec)) return true;
				if (proj.some(v => v && typeof v === "object" && String(v.id || "").trim() === pidRec)) return true;
			}
			if (proj.some(v => typeof v === "string" && String(v).trim() === pidRaw)) return true;
			return false;
		}
		return String(proj || "").trim() === pidRaw;
	});
}

/**
 * We bypass the generic helpers here to guarantee `typecast: true` is sent,
 * and to log Airtable’s raw response on failure. We also try both payload
 * shapes for linked records: [{id:"rec..."}] then ["rec..."].
 */
async function _airtableCreateBoard(env, fieldsBundle, logCtx = null) {
	const {
		projectRecordId = null,
		projectRef = "",
		uid,
		purpose,
		muralId,
		boardUrl = null,
		workspaceId = null,
		primary = false,
		active = true
	} = fieldsBundle;

	const tbl = _boardsTableName(env);
	const url = makeTableUrl(env, tbl);
	const headers = authHeaders(env);

	const baseFields = {
		UID: String(uid ?? ""),
		Purpose: String(purpose ?? ""),
		"Mural ID": String(muralId ?? ""),
		"Primary?": !!primary,
		Active: !!active
	};
	if (typeof boardUrl === "string" && boardUrl.trim()) baseFields["Board URL"] = boardUrl.trim();
	if (typeof workspaceId === "string" && workspaceId.trim()) baseFields["Workspace ID"] = workspaceId.trim();

	/** attempt order */
	const attempts = [];

	if (projectRecordId) {
		attempts.push({
			mode: "linked_record_objects",
			body: { typecast: true, records: [{ fields: { ...baseFields, Project: [{ id: String(projectRecordId) }] } }] }
		});
		attempts.push({
			mode: "linked_record_strings",
			body: { typecast: true, records: [{ fields: { ...baseFields, Project: [String(projectRecordId)] } }] }
		});
	}

	if (projectRef) {
		attempts.push({
			mode: "project_ref_text",
			body: { typecast: true, records: [{ fields: { ...baseFields, Project: String(projectRef) } }] }
		});
	}

	// Always include a bare attempt
	attempts.push({
		mode: "bare",
		body: { typecast: true, records: [{ fields: baseFields }] }
	});

	let lastStatus = 0;
	let lastTxt = "";

	for (const a of attempts) {
		try {
			_log(logCtx, "info", "airtable.boards.create.request", {
				mode: a.mode,
				table: tbl,
				payloadPreview: JSON.stringify(a.body).slice(0, 400)
			});
			const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(a.body) });
			const txt = await res.text().catch(() => "");
			_log(logCtx, res.ok ? "info" : "warn", "airtable.boards.create.response", {
				mode: a.mode,
				status: res.status,
				ok: res.ok,
				bodyPreview: txt.slice(0, 800)
			});
			if (res.ok) { try { return JSON.parse(txt); } catch { return { records: [] }; } }
			lastStatus = res.status;
			lastTxt = txt;
		} catch (e) {
			lastStatus = Number(e?.status || 0) || 0;
			lastTxt = String(e?.message || e);
			_log(logCtx, "warn", "airtable.boards.create.threw", { mode: a.mode, message: lastTxt });
		}
	}

	const err = new Error(`airtable_create_failed (${tbl})`);
	err.status = lastStatus || 422;
	err.body = { raw: (lastTxt || "").slice(0, 800) };
	throw err;
}

async function _airtableUpdateBoard(env, recordId, fields, logCtx = null) {
	const tbl = _boardsTableName(env);
	const url = makeTableUrl(env, tbl);
	const headers = authHeaders(env);

	const payload = { typecast: true, records: [{ id: recordId, fields }] };
	_log(logCtx, "info", "airtable.boards.update.request", {
		table: tbl, recordId, fieldsPreview: JSON.stringify(fields).slice(0, 400)
	});
	const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(payload) });
	const txt = await res.text().catch(() => "");
	_log(logCtx, res.ok ? "info" : "warn", "airtable.boards.update.response", {
		status: res.status, ok: res.ok, bodyPreview: txt.slice(0, 800)
	});
	if (!res.ok) {
		const err = new Error("airtable_update_failed");
		err.status = res.status;
		try { err.body = JSON.parse(txt); } catch { err.body = { raw: txt.slice(0, 800) }; }
		throw err;
	}
	try { return JSON.parse(txt); } catch { return {}; }
}

/* ───────────────────────── URL helpers ───────────────────────── */

function _looksLikeMuralViewerUrl(u) {
	try {
		const x = new URL(u);
		if (x.hostname !== "app.mural.co") return false;
		const path = x.pathname || "";
		if (/^\/t\/[^/]+\/m\/[^/]+/i.test(path)) return true;
		if (/^\/invitation\/mural\/[a-z0-9.-]+/i.test(path)) return true;
		if (/^\/viewer\//i.test(path)) return true;
		if (/^\/share\/[^/]+\/mural\/[a-z0-9.-]+/i.test(path)) return true;
		return false;
	} catch { return false; }
}

function _extractViewerUrl(payload) {
	if (!payload) return null;
	const queue = [payload];
	const seen = new Set();
	const enqueue = v => { if (v) queue.push(v); };
	while (queue.length) {
		const next = queue.shift();
		if (!next) continue;
		if (typeof next === "string") { if (_looksLikeMuralViewerUrl(next)) return next; continue; }
		if (typeof next !== "object") continue;
		if (seen.has(next)) continue;
		seen.add(next);

		if (Array.isArray(next)) { for (const e of next) enqueue(e); continue; }

		const candidates = [
			next.viewerUrl, next.viewerURL, next.viewLink, next.viewURL,
			next.openUrl, next.openURL, next._canvasLink, next.url, next.href, next.link,
			next.value, next.viewer, next.open, next.publicUrl, next.shareUrl, next.shareURL,
			next.links, next.links?.viewer, next.links?.open, next.links?.share, next.links?.public
		];

		for (const c of candidates) if (typeof c === "string" && _looksLikeMuralViewerUrl(c)) return c;
		for (const c of candidates) if (c && typeof c === "object") enqueue(c);
		for (const v of Object.values(next)) if (!candidates.includes(v)) enqueue(v);
	}
	return null;
}

async function _probeViewerUrl(env, accessToken, muralId, logCtx = null) {
	try {
		const hydrated = await getMural(env, accessToken, muralId).catch(() => null);
		const url = _extractViewerUrl(hydrated);
		if (url) return url;
	} catch (e) { _log(logCtx, "debug", "mural.probe.getMural.error", { message: e?.message || String(e) }); }
	try {
		const links = await getMuralLinks(env, accessToken, muralId).catch(() => []);
		const best = links.find(l => _looksLikeMuralViewerUrl(l.url)) ||
			links.find(l => /viewer|view|open|public/i.test(String(l.type || "")) && l.url);
		if (best?.url && _looksLikeMuralViewerUrl(best.url)) return best.url;
	} catch (e) { _log(logCtx, "debug", "mural.probe.getLinks.error", { message: e?.message || String(e) }); }
	try {
		const created = await createViewerLink(env, accessToken, muralId);
		if (created && _looksLikeMuralViewerUrl(created)) return created;
	} catch (e) { _log(logCtx, "debug", "mural.probe.createViewerLink.error", { message: e?.message || String(e) }); }
	try {
		const hydrated2 = await getMural(env, accessToken, muralId).catch(() => null);
		const url2 = _extractViewerUrl(hydrated2);
		if (url2) return url2;
	} catch (e) { _log(logCtx, "debug", "mural.probe.getMural.retry.error", { message: e?.message || String(e) }); }
	return null;
}

/* ───────────────────────── KV helpers ───────────────────────── */

async function _kvProjectMapping(env, { uid, projectId }) {
	const key = `mural:${uid || "anon"}:project:id::${String(projectId || "")}`;
	const raw = await env.SESSION_KV.get(key);
	if (!raw) return null;
	try { return JSON.parse(raw); } catch { return null; }
}

/* ───────────────────────── Workspace helpers ───────────────────────── */

function _workspaceCandidateShapes(entry) {
	if (!entry || typeof entry !== "object") return [];
	const shapes = [entry];
	if (entry.value && typeof entry.value === "object") shapes.push(entry.value);
	if (entry.workspace && typeof entry.workspace === "object") {
		shapes.push(entry.workspace);
		if (entry.workspace.value && typeof entry.workspace.value === "object") shapes.push(entry.workspace.value);
	}

	const seen = new Set();
	const candidates = [];
	for (const shape of shapes) {
		if (!shape || typeof shape !== "object" || seen.has(shape)) continue;
		seen.add(shape);
		const id = shape.id || shape.workspaceId || shape.workspaceID || null;
		const key = shape.key || shape.shortId || shape.workspaceKey || shape.slug || null;
		const name = shape.name || shape.title || shape.displayName || null;
		const companyId = shape.companyId || shape.company?.id || null;
		const shortId = shape.shortId || null;
		if (id || key || shortId) candidates.push({ id, key, shortId, name, companyId });
	}
	return candidates;
}

async function _resolveWorkspace(env, accessToken, { workspaceHint, companyId } = {}) {
	const hint = String(workspaceHint || "").trim();
	if (!hint) return null;
	const hintLower = hint.toLowerCase();

	try {
		const direct = await getWorkspace(env, accessToken, hint);
		const val = direct?.value || direct || {};
		return { id: val.id || val.workspaceId || hint, key: val.key || val.shortId || hint, name: val.name || val.title || val.displayName || null };
	} catch (err) {
		if (Number(err?.status || 0) && Number(err.status) !== 404) throw err;
	}

	const matches = [];
	let cursor = null;
	const maxPages = 4;
	for (let page = 0; page < maxPages; page += 1) {
		let payload;
		try { payload = await listUserWorkspaces(env, accessToken, { cursor }); }
		catch (err) { if (Number(err?.status || 0) === 404) break; throw err; }
		const list = Array.isArray(payload?.value) ? payload.value : Array.isArray(payload?.workspaces) ? payload.workspaces : [];
		for (const entry of list) matches.push(..._workspaceCandidateShapes(entry));
		cursor = payload?.cursor || payload?.nextCursor || payload?.pagination?.nextCursor || payload?.pagination?.next || null;
		if (!cursor) break;
	}

	const matched =
		matches.find(c => [c.id, c.key, c.shortId].filter(Boolean).map(v => String(v).toLowerCase()).includes(hintLower)) ||
		matches.find(c => companyId && String(c.companyId || "").toLowerCase() === String(companyId).toLowerCase() && (c.name || "").toLowerCase() === hintLower);

	if (matched) {
		const idCandidate = matched.id || matched.key || matched.shortId || hint;
		try {
			const detail = await getWorkspace(env, accessToken, idCandidate);
			const val = detail?.value || detail || {};
			return { id: val.id || val.workspaceId || idCandidate, key: val.key || val.shortId || matched.key || matched.shortId || hint, name: val.name || val.title || val.displayName || matched.name || null };
		} catch (err) {
			if (Number(err?.status || 0) && Number(err.status) !== 404) throw err;
			return { id: idCandidate, key: matched.key || matched.shortId || idCandidate, name: matched.name || null };
		}
	}

	if (companyId) {
		const composite = `${String(companyId).trim()}:${hint}`;
		try {
			const detail = await getWorkspace(env, accessToken, composite);
			const val = detail?.value || detail || {};
			return { id: val.id || val.workspaceId || composite, key: val.key || val.shortId || hint, name: val.name || val.title || val.displayName || null };
		} catch (err) {
			if (Number(err?.status || 0) && Number(err.status) !== 404) throw err;
		}
	}

	return { id: hint, key: hint };
}

/* ───────────────────────── Shape helpers ───────────────────────── */

function _workspaceSummary(raw, fallbackId = null) {
	const val = raw?.value || raw || {};
	const id = val.id || fallbackId || null;
	if (!id) return null;
	return { id, key: val.key || val.shortId || null, name: val.name || null };
}
function _profileFromMe(me) {
	const val = me?.value || me || {};
	return {
		id: val.id || null,
		name: val.displayName || val.name || null,
		firstName: val.firstName || null,
		lastName: val.lastName || null,
		email: val.email || val.primaryEmail || null,
		companyId: val.companyId || null,
		companyName: val.companyName || null
	};
}

/* ───────────────────────── Force-link helper ───────────────────────── */
/**
 * Given a Mural ID and a project name/id, PATCH the Mural Boards row so
 * Project = [{ id: <Projects.recId> }]. Tries both payload shapes and logs full detail.
 */
async function _forceLinkProjectToBoard(env, { muralId, projectName, projectId }, logCtx) {
	if (!muralId) return { ok: false, reason: "missing_muralId" };

	// Resolve Projects rec id
	let projectRecId = null;
	const maybeId = typeof projectId === "string" ? projectId.trim() : "";
	if (_looksLikeAirtableId(maybeId)) {
		projectRecId = maybeId;
	} else if (projectName && String(projectName).trim()) {
		try {
			projectRecId = await _lookupProjectRecordId(env, { projectId: null, projectName: String(projectName).trim() }, logCtx);
		} catch (e) {
			_log(logCtx, "warn", "airtable.projects.lookup.fail", { message: e?.message || String(e), projectName });
		}
	}

	if (!projectRecId) {
		_log(logCtx, "warn", "airtable.boards.force_link.skip_no_projectRec", { muralId, projectName, projectId });
		return { ok: false, reason: "no_project_rec" };
	}

	// Find the "Mural Boards" row by Mural ID
	const tbl = _boardsTableName(env);
	const formula = `{Mural ID}="${_esc(String(muralId))}"`;
	const { records } = await listAll(env, tbl, {
		pageSize: 1,
		extraParams: { filterByFormula: formula, maxRecords: "1" }
	});
	const hit = Array.isArray(records) ? records[0] : null;
	const boardRecId = hit?.id || null;
	if (!boardRecId) {
		_log(logCtx, "warn", "airtable.boards.force_link.no_board_row", { muralId });
		return { ok: false, reason: "no_board_row" };
	}

	// PATCH "Project" linked record — try object shape then string shape
	const patchUrl = makeTableUrl(env, tbl);
	const headers = authHeaders(env);

	const attempts = [
		{ mode: "objects", payload: { typecast: true, records: [{ id: boardRecId, fields: { Project: [{ id: projectRecId }] } }] } },
		{ mode: "strings", payload: { typecast: true, records: [{ id: boardRecId, fields: { Project: [projectRecId] } }] } }
	];

	for (const a of attempts) {
		try {
			_log(logCtx, "info", "airtable.boards.force_link.request", {
				mode: a.mode, boardRecId, projectRecId, payloadPreview: JSON.stringify(a.payload).slice(0, 400)
			});
			const res = await fetch(patchUrl, { method: "PATCH", headers, body: JSON.stringify(a.payload) });
			const txt = await res.text().catch(() => "");
			_log(logCtx, res.ok ? "info" : "warn", "airtable.boards.force_link.response", {
				mode: a.mode, status: res.status, ok: res.ok, bodyPreview: txt.slice(0, 800)
			});
			if (res.ok) return { ok: true, mode: a.mode, status: res.status };
		} catch (e) {
			_log(logCtx, "warn", "airtable.boards.force_link.threw", { mode: a.mode, message: String(e?.message || e) });
		}
	}

	return { ok: false, reason: "patch_failed" };
}

/* ───────────────────────── Class ───────────────────────── */

export class MuralServicePart {
	/** @param {ResearchOpsService} root */
	constructor(root) { this.root = root; }

	// KV tokens
	kvKey(uid) { return `mural:${uid}:tokens`; }
	async saveTokens(uid, tokens) { await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(tokens), { encryption: true }); }
	async loadTokens(uid) { const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid)); return raw ? JSON.parse(raw) : null; }

	async _ensureWorkspace(env, accessToken, explicitWorkspaceId) {
		const inCompany = await verifyHomeOfficeByCompany(env, accessToken);
		if (!inCompany) throw Object.assign(new Error("not_in_home_office_workspace"), { code: 403 });

		if (explicitWorkspaceId) {
			try {
				const ws = await getWorkspace(env, accessToken, explicitWorkspaceId);
				const v = ws?.value || ws || {};
				return { id: v.id || explicitWorkspaceId, key: v.key || v.shortId || null, name: v.name || null };
			} catch { /* fall back */ }
		}

		const me = await getMe(env, accessToken);
		const wsHint = getActiveWorkspaceIdFromMe(me);
		if (!wsHint) throw new Error("no_active_workspace");

		const companyId = me?.value?.companyId || me?.companyId || null;
		const resolved = await _resolveWorkspace(env, accessToken, { workspaceHint: wsHint, companyId });
		if (!resolved?.id) return { id: wsHint, key: wsHint };

		return { id: resolved.id, key: resolved.key || null, name: resolved.name || null };
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

	/* ───────────────────────── Core lookups (debug-aware) ───────────────────────── */

	async resolveBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, explicitMuralId }, logCtx = this.root) {
		if (explicitMuralId) return { muralId: String(explicitMuralId) };

		if (projectId) {
			const cacheKey = `${projectId}·${uid || ""}·${purpose}`;
			const cached = _memCache.get(cacheKey);
			if (cached && (Date.now() - cached.ts < 60_000)) {
				if (cached.deleted) return null;
				return { muralId: cached.muralId, boardUrl: cached.boardUrl, workspaceId: cached.workspaceId };
			}

			const rows = await _airtableListBoards(this.root.env, { projectId, uid, purpose, active: true, max: 25 }, logCtx);
			const top = rows[0];
			if (top?.fields) {
				const f = top.fields;
				const recordUid = typeof f["UID"] === "string" ? f["UID"].trim() : "";
				const rec = {
					muralId: String(f["Mural ID"] || ""),
					boardUrl: f["Board URL"] || null,
					workspaceId: f["Workspace ID"] || null,
					primary: !!f["Primary?"]
				};
				if (rec.muralId) {
					const projectKey = projectId ? String(projectId) : "";
					const ensureInactive = async () => {
						_memCache.set(cacheKey, { deleted: true, ts: Date.now() });
						if (top.id) {
							try {
								const inactiveFields = { Active: false, "Board URL": null, "Primary?": false, "Workspace ID": null };
								await _airtableUpdateBoard(this.root.env, top.id, inactiveFields, logCtx);
							} catch (err) {
								_log(logCtx, "warn", "mural.airtable_deactivate_failed", { message: err?.message || null });
							}
						}
						if (projectKey) {
							const clearUids = new Set();
							if (uid) clearUids.add(String(uid));
							if (recordUid) clearUids.add(recordUid);
							for (const clearUid of clearUids) {
								try { await this.root.env.SESSION_KV.delete(`mural:${clearUid}:project:id::${projectKey}`); } catch {}
							}
						}
					};

					let boardDeleted = false;
					const verifyUid = uid || recordUid;
					if (verifyUid) {
						try {
							const tokenRes = await this._getValidAccessToken(verifyUid);
							if (tokenRes.ok) {
								try {
									await getMural(this.root.env, tokenRes.token, rec.muralId);
								} catch (err) {
									const status = Number(err?.status || err?.code || 0);
									if (status === 404 || status === 410) boardDeleted = true;
									else _log(logCtx, "warn", "mural.resolve_board_probe_failed", { status, message: err?.message || null });
								}
							}
						} catch (err) {
							_log(logCtx, "warn", "mural.resolve_board_token_failed", { message: err?.message || null });
						}
					}

					if (!boardDeleted && rec.boardUrl) {
						try {
							const head = await fetch(rec.boardUrl, { method: "HEAD", redirect: "manual" });
							if (head.status === 404 || head.status === 410) boardDeleted = true;
						} catch {}
					}

					if (boardDeleted) {
						await ensureInactive();
						return null;
					}

					_memCache.set(cacheKey, { ...rec, ts: Date.now(), deleted: false });
					return rec;
				}
			}

			// KV-backed lookup
			const kv = await _kvProjectMapping(this.root.env, { uid, projectId });
			if (kv?.url) {
				const kvKey = `mural:${uid || "anon"}:project:id::${String(projectId)}`;
				const kvMuralId = kv?.muralId ? String(kv.muralId).trim() : "";
				const kvUrl = String(kv.url || "").trim();

				if (!kvMuralId || !_looksLikeMuralViewerUrl(kvUrl)) {
					try { await this.root.env.SESSION_KV.delete(kvKey); } catch {}
					_log(logCtx, "info", "mural.kv.resolve.invalid_shape", { kvHasId: !!kvMuralId, looksLikeUrl: _looksLikeMuralViewerUrl(kvUrl) });
					return null;
				}

				// Light validation
				let deleted = false;
				try {
					const tokenRes = await this._getValidAccessToken(uid || "anon");
					if (tokenRes.ok) {
						try { await getMural(this.root.env, tokenRes.token, kvMuralId); }
						catch (err) {
							const status = Number(err?.status || err?.code || 0);
							if (status === 404 || status === 410) deleted = true;
							else _log(logCtx, "warn", "mural.kv.resolve.probe_failed", { status, message: err?.message || null });
						}
					}
				} catch (err) {
					_log(logCtx, "warn", "mural.kv.resolve.token_failed", { message: err?.message || null });
				}

				if (!deleted) {
					try {
						const head = await fetch(kvUrl, { method: "HEAD", redirect: "manual" });
						if (head.status === 404 || head.status === 410) deleted = true;
					} catch {}
				}

				if (deleted) {
					_log(logCtx, "info", "mural.kv.resolve.stale", { projectId, kvMuralId });
					try { await this.root.env.SESSION_KV.delete(kvKey); } catch {}
					return null;
				}

				const rec = {
					muralId: kvMuralId,
					boardUrl: kvUrl,
					workspaceId: kv?.workspaceId ? String(kv.workspaceId).trim() || null : null,
					primary: true
				};
				_memCache.set(`${projectId}·${uid || ""}·${purpose}`, { ...rec, ts: Date.now(), deleted: false });
				_log(logCtx, "debug", "mural.kv.resolve.valid", { projectId, kvMuralId });
				return rec;
			}
		}

		const envId = this.root?.env?.MURAL_REFLEXIVE_MURAL_ID;
		if (envId) {
			_log(logCtx, "warn", "mural.deprecated_env_id", { note: "Migrate to Airtable 'Mural Boards'." });
			return { muralId: String(envId) };
		}

		return null;
	}

	async registerBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, muralId, boardUrl, workspaceId = null, primary = true, projectName = null }, logCtx = this.root) {
		if (!projectId || !uid || !muralId) return { ok: false, error: "missing_fields" };

		const safeProjectId = String(projectId);
		const safeUid = String(uid);
		const safePurpose = String(purpose || PURPOSE_REFLEXIVE);
		const safeMuralId = String(muralId);
		const normalizedBoardUrl = typeof boardUrl === "string" && boardUrl.trim() ? boardUrl.trim() : null;
		const normalizedWorkspaceId = typeof workspaceId === "string" && workspaceId.trim() ? workspaceId.trim() : null;
		const safeProjectName = typeof projectName === "string" ? projectName.trim() : "";

		let projectRecordId = null;
		if (_looksLikeAirtableId(safeProjectId)) {
			projectRecordId = safeProjectId;
		} else {
			try {
				projectRecordId = await _lookupProjectRecordId(this.root.env, { projectId: safeProjectId, projectName: safeProjectName }, logCtx);
			} catch (err) {
				_log(logCtx, "warn", "mural.project_lookup_failed", { message: err?.message || null });
			}
		}

		const lookupKey = projectRecordId || safeProjectId;

		let existing = null;
		try {
			const rows = await _airtableListBoards(this.root.env, {
				projectId: lookupKey,
				uid: safeUid,
				purpose: safePurpose,
				active: true,
				max: 25
			}, logCtx);
			if (Array.isArray(rows) && rows.length) {
				existing = rows.find(r => {
					const val = r?.fields?.["Mural ID"];
					return val && String(val).trim() === safeMuralId;
				}) || null;
			}
			_log(logCtx, "debug", "airtable.boards.match", { count: rows?.length || 0, existingId: existing?.id || null });
		} catch (err) {
			_log(logCtx, "warn", "mural.airtable_lookup_failed", { message: err?.message || null });
		}

		if (existing) {
			const updateFields = {
				UID: safeUid,
				Purpose: safePurpose,
				"Mural ID": safeMuralId,
				"Primary?": !!primary,
				Active: true
			};
			if (normalizedBoardUrl) updateFields["Board URL"] = normalizedBoardUrl;
			if (normalizedWorkspaceId) updateFields["Workspace ID"] = normalizedWorkspaceId;
			if (projectRecordId) updateFields.Project = [{ id: projectRecordId }];

			await _airtableUpdateBoard(this.root.env, existing.id, updateFields, logCtx);
			_log(logCtx, "info", "mural.register.updated", { airtableRecordId: existing.id, linkedProjectId: projectRecordId || null });
		} else {
			const creation = await _airtableCreateBoard(this.root.env, {
				projectRecordId,
				projectRef: safeProjectId,
				uid: safeUid,
				purpose: safePurpose,
				muralId: safeMuralId,
				boardUrl: normalizedBoardUrl,
				workspaceId: normalizedWorkspaceId,
				primary,
				active: true
			}, logCtx);

			const recordId = creation?.records?.[0]?.id || null;
			_log(logCtx, "info", "mural.register.created", {
				airtableRecordId: recordId,
				linkedProjectId: projectRecordId || null
			});

			// Safety net: if Project wasn't linked by create, force-link now
			if (recordId && projectRecordId) {
				try {
					await _airtableUpdateBoard(this.root.env, recordId, { Project: [{ id: projectRecordId }] }, logCtx);
					_log(logCtx, "info", "mural.register.created.force_link_ok", { recordId, projectRecordId });
				} catch (e) {
					_log(logCtx, "warn", "mural.register.created.force_link_fail", { recordId, projectRecordId, message: String(e?.message || e) });
				}
			}
		}

		const cacheKey = `${safeProjectId}·${safeUid}·${safePurpose}`;
		_memCache.set(cacheKey, {
			muralId: safeMuralId,
			boardUrl: normalizedBoardUrl,
			workspaceId: normalizedWorkspaceId,
			ts: Date.now(),
			primary: !!primary,
			deleted: false
		});
		_log(logCtx, "info", "mural.register.done", { cacheKey });

		return { ok: true };
	}

	/* ───────────────────────── Routes (debug-aware) ───────────────────────── */

	async muralAuth(origin, url) {
		const dbg = _wantDebugFromUrl(url);
		const logCtx = _withDebugCtx(this.root, dbg);

		const uid = url.searchParams.get("uid") || "anon";
		const ret = url.searchParams.get("return") || "";
		let safeReturn = "/pages/projects/";

		if (ret && _isAllowedReturn(this.root.env, ret)) {
			safeReturn = ret;
		} else if (ret.startsWith("/")) {
			safeReturn = ret;
		}

		const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
		const redirect = buildAuthUrl(this.root.env, state);
		_log(logCtx, "info", "mural.auth.redirect", { redirect });
		return Response.redirect(redirect, 302);
	}

	async muralCallback(origin, url) {
		const dbg = _wantDebugFromUrl(url);
		const logCtx = _withDebugCtx(this.root, dbg);

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
			const fallback = "/pages/projects/";
			return Response.redirect(fallback + "#mural-auth-missing-code", 302);
		}

		let uid = "anon";
		let stateObj = {};
		try {
			stateObj = JSON.parse(b64Decode(stateB64 || ""));
			uid = stateObj?.uid || "anon";
		} catch {}

		let tokens;
		try {
			tokens = await exchangeAuthCode(env, code);
		} catch (err) {
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

		_log(logCtx, "info", "mural.callback.redirect", { backUrl: backUrl.toString() });
		return Response.redirect(backUrl.toString(), 302);
	}

	async muralVerify(origin, url) {
		const dbg = _wantDebugFromUrl(url);
		const logCtx = _withDebugCtx(this.root, dbg);

		const cors = this.root.corsHeaders(origin);
		const uid = url.searchParams.get("uid") || "anon";
		const workspaceOverride = (url.searchParams.get("workspaceId") || "").trim();

		try {
			const tokenRes = await this._getValidAccessToken(uid);
			if (!tokenRes.ok) {
				const code = tokenRes.reason === "not_authenticated" ? 401 : 500;
				return this.root.json({ ok: false, error: tokenRes.reason }, code, cors);
			}
			const accessToken = tokenRes.token;

			let inWorkspace = false;
			try {
				inWorkspace = await verifyHomeOfficeByCompany(this.root.env, accessToken);
			} catch (err) {
				const status = Number(err?.status || 0);
				if (status === 401) return this.root.json({ ok: false, error: "not_authenticated" }, 401, cors);
				throw err;
			}
			if (!inWorkspace) return this.root.json({ ok: false, error: "not_in_home_office_workspace" }, 403, cors);

			const me = await getMe(this.root.env, accessToken).catch(() => null);
			const profile = _profileFromMe(me);

			let activeWorkspaceId = workspaceOverride || getActiveWorkspaceIdFromMe(me) || null;
			if (!activeWorkspaceId && this.root.env.MURAL_HOME_OFFICE_WORKSPACE_ID) {
				const hinted = String(this.root.env.MURAL_HOME_OFFICE_WORKSPACE_ID || "").trim();
				activeWorkspaceId = hinted || activeWorkspaceId;
			}

			let workspace = null;
			if (activeWorkspaceId) {
				try {
					const ws = await getWorkspace(this.root.env, accessToken, activeWorkspaceId);
					workspace = _workspaceSummary(ws, activeWorkspaceId);
					activeWorkspaceId = workspace?.id || activeWorkspaceId;
				} catch (err) {
					if (workspaceOverride && Number(err?.status || 0) === 404) {
						return this.root.json({ ok: false, error: "workspace_not_found" }, 404, cors);
					}
					workspace = _workspaceSummary(null, activeWorkspaceId);
				}
			}

			_log(logCtx, "info", "mural.verify.ok", { uid, activeWorkspaceId, profileEmail: profile?.email || null });
			return this.root.json({ ok: true, uid, activeWorkspaceId: activeWorkspaceId || null, workspace, profile }, 200, cors);

		} catch (err) {
			const status = Number(err?.status || 0) || 500;
			const detail = String(err?.message || err || "verify_failed");
			_log(logCtx, "error", "mural.verify.failed", { status, detail });
			return this.root.json({ ok: false, error: "verify_failed", detail }, status, cors);
		}
	}

	/** POST /api/mural/setup  body: { uid, projectId?, projectName, workspaceId? } */
	async muralSetup(request, origin) {
		const cors = this.root.corsHeaders(origin);
		let step = "parse_input";
		let uid = "anon";
		let projectId = null;
		let projectName;
		let wsOverride;
		let ws = null;
		let room = null;
		let roomId = null;
		let folder = null;
		let folderId = null;
		let folderDenied = false;
		let mural = null;
		let muralId = null;

		try {
			const body = await request.json().catch(() => ({}));
			uid = body?.uid ?? "anon";
			projectId = body?.projectId ?? null;
			projectName = body?.projectName;
			wsOverride = body?.workspaceId;
			_log(this.root, "info", "mural.setup.begin", { uid, projectId, projectName, wsOverride });

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
			try {
				ws = await this._ensureWorkspace(this.root.env, accessToken, wsOverride);
			} catch (err) {
				const code = Number(err?.status || err?.code || 0);
				if (code === 401 && tokens.refresh_token) {
					const refreshed = await refreshAccessToken(this.root.env, tokens.refresh_token);
					const merged = { ...tokens, ...refreshed };
					await this.saveTokens(uid, merged);
					accessToken = merged.access_token;
					ws = await this._ensureWorkspace(this.root.env, accessToken, wsOverride);
				} else if (String(err?.message) === "not_in_home_office_workspace") {
					return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, cors);
				} else {
					throw err;
				}
			}

			step = "get_me";
			const me = await getMe(this.root.env, accessToken).catch(() => null);
			const profile = {
				id: me?.value?.id || me?.id || null,
				email: me?.value?.email || me?.email || null
			};

			step = "ensure_room";
			try {
				room = await ensureUserRoom(this.root.env, accessToken, ws.id, {
					username: me?.value?.firstName || me?.value?.displayName || "Private",
					userId: profile?.id,
					userEmail: profile?.email
				});
			} catch (e) {
				if (e?.code === "no_existing_room" || Number(e?.status) === 409) {
					return this.root.json({
						ok: false,
						error: "no_existing_room",
						step,
						message: "No existing room found in your Mural workspace. Create a private room in Mural, then try again."
					}, 409, cors);
				}
				throw e;
			}
			roomId = room?.id || room?.value?.id || room?.data?.id || null;
			if (!roomId) {
				_log(this.root, "error", "mural.ensure_room.no_id", { roomPreview: typeof room === "object" ? Object.keys(room || {}) : room });
				return this.root.json({
					ok: false,
					error: "room_id_unavailable",
					step,
					message: "Could not resolve a room id from Mural response"
				}, 502, cors);
			}

			step = "ensure_folder";
			try {
				folder = await ensureProjectFolder(this.root.env, accessToken, roomId, String(projectName).trim());
			} catch (err) {
				const status = Number(err?.status || 0);
				const code = String(err?.body?.code || err?.code || "");
				if (status === 403) {
					folderDenied = true;
					_log(this.root, "warn", "mural.ensure_folder.forbidden", { status, code, roomId, projectId: projectId || null });
				} else {
					throw err;
				}
			}
			folderId = folder?.id || folder?.value?.id || folder?.data?.id || null;

			step = "create_mural";
			mural = await createMural(this.root.env, accessToken, {
				title: "Reflexive Journal",
				roomId,
				folderId: folderId || undefined
			});

			muralId = mural?.id || mural?.muralId || mural?.value?.muralId || mural?.value?.id || null;
			muralId = muralId ? String(muralId) : null;

			if (!muralId) {
				_log(this.root, "error", "mural.create_mural.missing_id", { step, projectId, roomId, folderId });
				return this.root.json({
					ok: false,
					error: "mural_id_unavailable",
					step,
					message: "Mural API did not return an id for the created board"
				}, 502, cors);
			}

			// Best-effort quick probe for a viewer URL
			step = "probe_viewer_url";
			let openUrl = null;
			const softDeadline = Date.now() + 9000;
			while (!openUrl && Date.now() < softDeadline) {
				openUrl = await _probeViewerUrl(this.root.env, accessToken, muralId, this.root);
				if (openUrl) break;
				await new Promise(r => setTimeout(r, 600));
			}

			// Resolve the exact Projects record id
			step = "resolve_project_record";
			let resolvedProjectRecordId = null;
			try {
				if (projectId && _looksLikeAirtableId(String(projectId))) {
					resolvedProjectRecordId = String(projectId).trim();
				} else {
					resolvedProjectRecordId = await _lookupProjectRecordId(
						this.root.env,
						{ projectId: projectId ? String(projectId) : null, projectName: projectName || null },
						this.root
					);
				}
				_log(this.root, "info", "mural.projects.resolved", {
					inputProjectId: projectId || null,
					projectName: projectName || null,
					resolvedProjectRecordId
				});
			} catch (e) {
				_log(this.root, "warn", "mural.project.resolve.failed", { message: e?.message || String(e), projectId, projectName });
			}

			// Register (create/update Airtable row)
			step = "register_board";
			try {
				await this.registerBoard({
					projectId: resolvedProjectRecordId || String(projectId || ""),
					uid,
					purpose: PURPOSE_REFLEXIVE,
					muralId,
					boardUrl: openUrl ?? undefined,
					workspaceId: ws?.id || null,
					primary: true,
					projectName
				});
			} catch (e) {
				_log(this.root, "error", "mural.airtable_register_failed", { status: e?.status, body: e?.body });
			}

			// Enforce the linked record in "Project" using Projects.recId
			step = "force_link_project";
			const forceRes = await _forceLinkProjectToBoard(this.root.env, { muralId, projectName, projectId: resolvedProjectRecordId || projectId || null }, this.root);
			_log(this.root, forceRes.ok ? "info" : "warn", "mural.force_link.result", forceRes);

			// Cache viewer link for the project (best effort)
			if (openUrl && (resolvedProjectRecordId || projectId)) {
				try {
					const projectKey = String(resolvedProjectRecordId || projectId);
					const kvKey = `mural:${uid}:project:id::${projectKey}`;
					await this.root.env.SESSION_KV.put(kvKey, JSON.stringify({
						url: openUrl,
						muralId,
						workspaceId: ws?.id || null,
						projectName,
						updatedAt: Date.now()
					}));
				} catch {}
			}

			// Respond
			if (openUrl) {
				return this.root.json({
					ok: true,
					workspace: ws,
					room,
					folder,
					folderDenied,
					mural: { ...mural, id: muralId, muralId, viewLink: openUrl },
					projectId: resolvedProjectRecordId || projectId || null,
					registered: true,
					boardUrl: openUrl
				}, 200, cors);
			}

			return this.root.json({
				ok: true,
				pending: true,
				step,
				muralId,
				workspace: ws,
				room,
				folder,
				folderDenied,
				projectId: resolvedProjectRecordId || projectId || null
			}, 202, cors);

		} catch (err) {
			const status = Number(err?.status) || 500;
			const body = err?.body || null;
			const message = String(err?.message || "setup_failed");
			const context = {};
			if (step === "create_mural" || step === "ensure_folder" || step === "ensure_room") context.step = step;
			_log(this.root, "error", "mural.setup_failed", { status, message, upstream: body, context });
			const payload = { ok: false, error: "setup_failed", step, message, upstream: body };
			if (Object.keys(context).length) payload.context = context;
			return this.root.json(payload, status, cors);
		}
	}

	/**
	 * GET /api/mural/await?muralId=...&projectId=...&uid=...&debug=true
	 * Short, server-side attempt to obtain a real viewer URL and register mapping.
	 */
	async muralAwait(origin, url) {
		const dbg = _wantDebugFromUrl(url);
		const logCtx = _withDebugCtx(this.root, dbg);

		const cors = this.root.corsHeaders(origin);
		const muralId = url.searchParams.get("muralId") || "";
		const projectId = url.searchParams.get("projectId") || "";
		const uid = url.searchParams.get("uid") || "anon";
		if (!muralId) {
			return this.root.json({ ok: false, error: "missing_muralId" }, 400, cors);
		}

		const tokenRes = await this._getValidAccessToken(uid);
		if (!tokenRes.ok) {
			const code = tokenRes.reason === "not_authenticated" ? 401 : 500;
			return this.root.json({ ok: false, error: tokenRes.reason }, code, cors);
		}
		const accessToken = tokenRes.token;

		const deadline = Date.now() + 8000;
		let openUrl = null;
		while (!openUrl && Date.now() < deadline) {
			openUrl = await _probeViewerUrl(this.root.env, accessToken, muralId, logCtx);
			if (openUrl) break;
			await new Promise(r => setTimeout(r, 600));
		}

		if (!openUrl) {
			return this.root.json({ ok: true, pending: true }, 202, cors);
		}

		if (projectId) {
			try {
				await this.registerBoard({
					projectId: String(projectId),
					uid,
					purpose: PURPOSE_REFLEXIVE,
					muralId,
					boardUrl: openUrl,
					workspaceId: null,
					primary: true
				}, logCtx);
			} catch (e) {
				_log(logCtx, "error", "mural.airtable_register_failed", { status: e?.status, body: e?.body });
			}
			try {
				const kvKey = `mural:${uid}:project:id::${String(projectId)}`;
				await this.root.env.SESSION_KV.put(kvKey, JSON.stringify({
					url: openUrl,
					muralId,
					workspaceId: null,
					projectName: "",
					updatedAt: Date.now()
				}));
			} catch {}
		}

		return this.root.json({ ok: true, boardUrl: openUrl, muralId }, 200, cors);
	}

	async muralResolve(origin, url) {
		const dbg = _wantDebugFromUrl(url);
		const logCtx = _withDebugCtx(this.root, dbg);

		const cors = this.root.corsHeaders(origin);
		try {
			const projectId = url.searchParams.get("projectId") || "";
			const uid = url.searchParams.get("uid") || "";
			const purpose = url.searchParams.get("purpose") || PURPOSE_REFLEXIVE;

			if (!projectId) {
				return this.root.json({ ok: false, error: "missing_projectId" }, 400, cors);
			}

			const resolved = await this.resolveBoard({ projectId, uid: uid || undefined, purpose }, logCtx);
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

	async muralJournalSync(request, origin) {
		const url = new URL(request.url);
		const dbg = _wantDebugFromUrl(url);
		const logCtx = _withDebugCtx(this.root, dbg);

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
			}, logCtx);
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
				if (tagIds.length) await applyTagsToSticky(this.root.env, accessToken, muralId, stickyId, tagIds);
			}

			_log(logCtx, "info", "mural.journal_sync.ok", { muralId, stickyId, action });
			return this.root.json({ ok: true, stickyId, action, muralId }, 200, cors);

		} catch (err) {
			const status = Number(err?.status) || 500;
			const body = err?.body || null;
			const message = String(err?.message || "journal_sync_failed");
			_log(logCtx, "error", "mural.journal_sync.failed", { status, message, upstream: body, step });
			return this.root.json({ ok: false, error: "journal_sync_failed", step, message, upstream: body }, status, cors);
		}
	}

	async muralDebugEnv(origin, url) {
		const dbg = _wantDebugFromUrl(url);
		const logCtx = _withDebugCtx(this.root, dbg);

		const env = this.root.env || {};
		_log(logCtx, "info", "mural.debug.env", { has_CLIENT_ID: !!env.MURAL_CLIENT_ID, has_CLIENT_SECRET: !!env.MURAL_CLIENT_SECRET });
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
		const dbg = _wantDebugFromUrl(url);
		const logCtx = _withDebugCtx(this.root, dbg);

		const uid = url.searchParams.get("uid") || "anon";
		const ret = url.searchParams.get("return");
		const safeReturn = (ret && ret.startsWith("/")) ? ret : "/pages/projects/";
		const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
		const authUrl = buildAuthUrl(this.root.env, state);
		_log(logCtx, "info", "mural.debug.auth", { redirect_uri: this.root.env.MURAL_REDIRECT_URI, scopes: this.root.env.MURAL_SCOPES || "(default)", auth_url: authUrl });
		return this.root.json({ redirect_uri: this.root.env.MURAL_REDIRECT_URI, scopes: this.root.env.MURAL_SCOPES || "(default)", auth_url: authUrl }, 200, this.root.corsHeaders(origin));
	}

	/** GET /api/projects/lookup-by-name?name=...  → { ok:true, id, name } | 404 */
	async projectLookupByName(origin, url) {
		const dbg = _wantDebugFromUrl(url);
		const logCtx = _withDebugCtx(this.root, dbg);

		const cors = this.root.corsHeaders(origin);
		const name = (url.searchParams.get("name") || "").trim();
		if (!name) return this.root.json({ ok: false, error: "missing_name" }, 400, cors);

		try {
			_log(logCtx, "info", "projects.lookupByName.begin", { name });
			const hit = await findProjectRecordIdByName(this.root.env, name);
			if (!hit) {
				_log(logCtx, "info", "projects.lookupByName.not_found", { name });
				return this.root.json({ ok: false, error: "not_found" }, 404, cors);
			}
			_log(logCtx, "info", "projects.lookupByName.hit", { id: hit.id, name: hit.name });
			return this.root.json({ ok: true, id: hit.id, name: hit.name }, 200, cors);
		} catch (err) {
			const status = Number(err?.status) || 500;
			_log(logCtx, "error", "projects.lookupByName.failed", { name, message: String(err?.message || err) });
			return this.root.json({ ok: false, error: "lookup_failed", detail: String(err?.message || err) }, status, cors);
		}
	}
}

/* ───────────────────────── Misc helpers ───────────────────────── */
function _isAllowedReturn(env, urlStr) {
	try {
		const u = new URL(urlStr);
		const raw = env.ALLOWED_ORIGINS;
		const list = Array.isArray(raw) ? raw : String(raw || "").split(",").map(s => s.trim()).filter(Boolean);
		return list.includes(`${u.protocol}//${u.host}`);
	} catch { return false; }
}
