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

import { b64Encode, b64Decode } from "../../core/utils.js";

/** @typedef {import("../index.js").ResearchOpsService} ResearchOpsService */

const GRID_Y = 32;
const DEFAULT_W = 240;
const DEFAULT_H = 120;
const PURPOSE_REFLEXIVE = "reflexive_journal";

/** In-process soft cache (evicted on cold starts) */
const _memCache = new Map(); // key: `${projectId}·${uid||""}·${purpose}` → { muralId, boardUrl, workspaceId, ts, primary }

/* ───────────────────────── Airtable helpers ───────────────────────── */

function _resolveAirtableToken(env) {
	const token = env.AIRTABLE_API_KEY || env.AIRTABLE_PAT;
	if (!token) {
		throw new Error("airtable_token_missing");
	}
	return token;
}

function _resolveAirtableBase(env) {
	const base = env.AIRTABLE_BASE_ID || env.AIRTABLE_BASE;
	if (!base) {
		throw new Error("airtable_base_missing");
	}
	return base;
}

function _airtableHeaders(env) {
	return {
		Authorization: `Bearer ${_resolveAirtableToken(env)}`,
		"Content-Type": "application/json"
	};
}

function _boardsTableName(env) {
	const override = typeof env.AIRTABLE_TABLE_MURAL_BOARDS === "string" ?
		env.AIRTABLE_TABLE_MURAL_BOARDS.trim() :
		"";
	return override || "Mural Boards";
}

function _projectTableName(env) {
	const override = typeof env.AIRTABLE_TABLE_PROJECTS === "string" ?
		env.AIRTABLE_TABLE_PROJECTS.trim() :
		"";
	return override || "Projects";
}

function _encodeTableUrl(env, tableName) {
	return `https://api.airtable.com/v0/${encodeURIComponent(_resolveAirtableBase(env))}/${encodeURIComponent(tableName)}`;
}

/** Escape double quotes for filterByFormula string literals */
function _esc(v) {
	return String(v ?? "").replace(/"/g, '\\"');
}

function _looksLikeAirtableId(v) {
	if (typeof v !== "string") return false;
	return /^rec[a-z0-9]{14}$/i.test(v.trim());
}

async function _lookupProjectRecordId(env, { projectId, projectName }) {
	const safeId = typeof projectId === "string" ? projectId.trim() : "";
	const safeName = typeof projectName === "string" ? projectName.trim() : "";
	if (!safeId && !safeName) return null;

	const clauses = new Set();
	if (safeId) {
		const escId = _esc(safeId);
		clauses.add(`{LocalId} = "${escId}"`);
		clauses.add(`{localId} = "${escId}"`);
		clauses.add(`{Project ID} = "${escId}"`);
		clauses.add(`{ProjectId} = "${escId}"`);
		clauses.add(`{UID} = "${escId}"`);
		clauses.add(`{Slug} = "${escId}"`);
		clauses.add(`{Slug ID} = "${escId}"`);
		clauses.add(`{ID} = "${escId}"`);
	}
	if (safeName) {
		const escName = _esc(safeName);
		clauses.add(`{Name} = "${escName}"`);
		clauses.add(`{Project Name} = "${escName}"`);
	}

	if (!clauses.size) return null;

	const filter = clauses.size === 1 ?
		clauses.values().next().value :
		`OR(${Array.from(clauses).join(",")})`;

	const url = new URL(_encodeTableUrl(env, _projectTableName(env)));
	url.searchParams.set("maxRecords", "5");
	url.searchParams.set("filterByFormula", filter);
	url.searchParams.append("fields[]", "Name");

	const res = await fetch(url.toString(), { headers: _airtableHeaders(env) });
	const js = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error("airtable_project_lookup_failed"), { status: res.status, body: js });
	}

	const records = Array.isArray(js?.records) ? js.records : [];
	if (!records.length) return null;
	const first = records[0];
	const rid = typeof first?.id === "string" ? first.id.trim() : "";
	return rid || null;
}

/** Normalise ALLOWED_ORIGINS (array or comma-separated string) and validate return URL origin. */
function _isAllowedReturn(env, urlStr) {
	try {
		const u = new URL(urlStr);
		const raw = env.ALLOWED_ORIGINS;
		const list = Array.isArray(raw) ?
			raw :
			String(raw || "")
			.split(",")
			.map(s => s.trim())
			.filter(Boolean);
		return list.includes(`${u.protocol}//${u.host}`);
	} catch {
		return false;
	}
}

/* Airtable listing: filter by uid+purpose+active, then client-side by projectId */
function _buildBoardsFilter({ uid, purpose, active = true }) {
	const ands = [];
	if (uid) ands.push(`{UID} = "${_esc(uid)}"`);
	if (purpose) ands.push(`{Purpose} = "${_esc(purpose)}"`);
	if (typeof active === "boolean") ands.push(`{Active} = ${active ? "1" : "0"}`);
	return ands.length ? `AND(${ands.join(",")})` : "";
}

async function _airtableListBoards(env, { projectId, uid, purpose, active = true, max = 25 }) {
	const url = new URL(_encodeTableUrl(env, _boardsTableName(env)));
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

	const pidRaw = String(projectId).trim();
	let pidRec = _looksLikeAirtableId(pidRaw) ? pidRaw : null;

	// If caller passed a UUID/slug/etc, try to resolve the real Airtable record id.
	if (!pidRec) {
		try {
			pidRec = await _lookupProjectRecordId(env, { projectId: pidRaw, projectName: null });
		} catch {
			// Non-fatal; keep pidRec as null
		}
	}

	// Accept when:
	//  • Project is a linked-record array containing the rec id (pidRec)
	//  • OR Project is a text field equal to the raw projectId (pidRaw)
	return records.filter(r => {
		const f = r?.fields || {};
		const proj = f["Project"];

		// Linked-record shapes:
		//  - ["recXXXXXXXXXXXXX", ...]
		//  - [{id:"recXXXXXXXXXXXXX", name?:...}, ...] (rare shape)
		if (Array.isArray(proj)) {
			if (pidRec) {
				// strings
				if (proj.some(v => typeof v === "string" && String(v).trim() === pidRec)) return true;
				// objects
				if (proj.some(v => v && typeof v === "object" && String(v.id || "").trim() === pidRec)) return true;
			}
			// As a last resort, if the array items are strings, also allow matching the raw value
			if (proj.some(v => typeof v === "string" && String(v).trim() === pidRaw)) return true;
			return false;
		}

		// Text schema fallback
		return String(proj || "").trim() === pidRaw;
	});
}

async function _airtableCreateBoard(env, {
	projectRecordId = null,
	projectRef = "",
	uid,
	purpose,
	muralId,
	boardUrl = null,
	workspaceId = null,
	primary = false,
	active = true
}) {
	const url = _encodeTableUrl(env, _boardsTableName(env));

	const safeUid = String(uid ?? "");
	const safePurpose = String(purpose ?? "");
	const safeMuralId = String(muralId ?? "");
	const safeProjectRef = String(projectRef ?? "");
	const linkRecordId = typeof projectRecordId === "string" ? projectRecordId.trim() : "";
	const sanitizedBoardUrl = typeof boardUrl === "string" && boardUrl.trim() ? boardUrl.trim() : "";
	const sanitizedWorkspaceId = typeof workspaceId === "string" && workspaceId.trim() ? workspaceId.trim() : "";

	const baseFields = {
		UID: safeUid,
		Purpose: safePurpose,
		"Mural ID": safeMuralId,
		"Board URL": sanitizedBoardUrl,
		"Primary?": !!primary,
		Active: !!active
	};
	if (sanitizedWorkspaceId) baseFields["Workspace ID"] = sanitizedWorkspaceId;

	/**
	 * @typedef {Object} AirtableAttempt
	 * @property {"linked_record"|"project_ref"|"bare"} mode
	 * @property {{ records: Array<{ fields: Object }> }} body
	 */

	/** @type {AirtableAttempt[]} */
	const attempts = [];

	if (linkRecordId) {
		attempts.push({
			mode: "linked_record",
			body: {
				typecast: true,
				records: [{
					fields: {
						...baseFields,
						Project: [{ id: linkRecordId }]
					}
				}]
			}
		});
	}

	if (safeProjectRef) {
		attempts.push({
			mode: "project_ref",
			body: {
				typecast: true,
				records: [{
					fields: {
						...baseFields,
						Project: safeProjectRef
					}
				}]
			}
		});
	}

	const fallback = { mode: "bare", body: { typecast: true, records: [{ fields: baseFields }] } };
	if (!attempts.length) {
		attempts.push(fallback);
	} else {
		const seenBodies = new Set(attempts.map(att => JSON.stringify(att.body)));
		const fallbackKey = JSON.stringify(fallback.body);
		if (!seenBodies.has(fallbackKey)) {
			attempts.push(fallback);
		}
	}

	let lastRes = null;
	let lastJs = null;
	const attempted = [];

	for (const attempt of attempts) {
		const res = await fetch(url, { method: "POST", headers: _airtableHeaders(env), body: JSON.stringify(attempt.body) });
		const js = await res.json().catch(() => ({}));
		attempted.push({ mode: attempt.mode, status: res.status, ok: res.ok });
		if (res.ok) {
			return {
				...js,
				ok: true,
				attemptMode: attempt.mode,
				attempts: attempted
			};
		}

		lastRes = res;
		lastJs = js;

		const errStr = JSON.stringify(js || {});
		const recoverable = res.status === 422 || res.status === 403 || /UNKNOWN_FIELD_NAME|INVALID_VALUE|FIELD_VALUE_INVALID|CANNOT_ACCEPT_VALUE|LINKED_RECORDS|INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(errStr);
		if (!recoverable) {
			throw Object.assign(new Error("airtable_create_failed"), { status: res.status, body: js });
		}
	}
	const error = Object.assign(new Error("airtable_create_failed"), { status: lastRes?.status || 422, body: lastJs });
	if (attempted.length) error.attempts = attempted;
	throw error;
}

async function _airtableUpdateBoard(env, recordId, fields) {
	const url = `${_encodeTableUrl(env, _boardsTableName(env))}/${recordId}`;
	const res = await fetch(url, {
		method: "PATCH",
		headers: _airtableHeaders(env),
		body: JSON.stringify({ fields, typecast: true })
	});
	const js = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw Object.assign(new Error("airtable_update_failed"), { status: res.status, body: js });
	}
	return js;
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
	} catch {
		return false;
	}
}

function _extractViewerUrl(payload) {
	if (!payload) return null;

	/**
	 * Walk through nested structures (objects/arrays) and attempt to locate a URL.
	 * We favour known keys first (url, href, viewerUrl, etc.) but fall back to a
	 * breadth-first crawl over remaining values. This defends against subtle API
	 * shape changes where the viewer URL moves deeper under `links` or `value`.
	 */
	const queue = [payload];
	const seen = new Set();

	const enqueue = (value) => {
		if (!value) return;
		queue.push(value);
	};

	while (queue.length) {
		const next = queue.shift();
		if (!next) continue;

		if (typeof next === "string") {
			if (_looksLikeMuralViewerUrl(next)) return next;
			continue;
		}

		if (typeof next !== "object") continue;
		if (seen.has(next)) continue;
		seen.add(next);

		if (Array.isArray(next)) {
			for (const entry of next) enqueue(entry);
			continue;
		}

		const candidates = [
			next.viewerUrl,
			next.viewerURL,
			next.viewLink,
			next.viewURL,
			next.openUrl,
			next.openURL,
			next._canvasLink,
			next.url,
			next.href,
			next.link,
			next.value,
			next.viewer,
			next.open,
			next.publicUrl,
			next.shareUrl,
			next.shareURL,
			next.links,
			next.links?.viewer,
			next.links?.open,
			next.links?.share,
			next.links?.public
		];

		for (const candidate of candidates) {
			if (typeof candidate === "string" && _looksLikeMuralViewerUrl(candidate)) {
				return candidate;
			}
		}

		for (const candidate of candidates) {
			if (candidate && typeof candidate === "object") enqueue(candidate);
		}

		for (const value of Object.values(next)) {
			if (!candidates.includes(value)) enqueue(value);
		}
	}

	return null;
}

/* Probe a viewer URL quickly */
async function _probeViewerUrl(env, accessToken, muralId) {
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
		if (entry.workspace.value && typeof entry.workspace.value === "object") {
			shapes.push(entry.workspace.value);
		}
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

		if (id || key || shortId) {
			candidates.push({ id, key, shortId, name, companyId });
		}
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
		return {
			id: val.id || val.workspaceId || hint,
			key: val.key || val.shortId || hint,
			name: val.name || val.title || val.displayName || null
		};
	} catch (err) {
		if (Number(err?.status || 0) && Number(err.status) !== 404) throw err;
	}

	const matches = [];
	let cursor = null;
	const maxPages = 4;

	for (let page = 0; page < maxPages; page += 1) {
		let payload;
		try {
			payload = await listUserWorkspaces(env, accessToken, { cursor });
		} catch (err) {
			if (Number(err?.status || 0) === 404) break;
			throw err;
		}

		const list = Array.isArray(payload?.value) ? payload.value :
			Array.isArray(payload?.workspaces) ? payload.workspaces : [];

		for (const entry of list) {
			matches.push(..._workspaceCandidateShapes(entry));
		}

		cursor = payload?.cursor ||
			payload?.nextCursor ||
			payload?.pagination?.nextCursor ||
			payload?.pagination?.next ||
			null;

		if (!cursor) break;
	}

	const matched = matches.find(cand => {
		const values = [cand.id, cand.key, cand.shortId]
			.filter(Boolean)
			.map(v => String(v).toLowerCase());
		return values.includes(hintLower);
	}) || matches.find(cand => {
		if (!companyId) return false;
		const cid = String(cand.companyId || "").toLowerCase();
		return Boolean(cid && cid === String(companyId).toLowerCase() && (cand.name || "").toLowerCase() === hintLower);
	});

	if (matched) {
		const idCandidate = matched.id || matched.key || matched.shortId || hint;
		try {
			const detail = await getWorkspace(env, accessToken, idCandidate);
			const val = detail?.value || detail || {};
			return {
				id: val.id || val.workspaceId || idCandidate,
				key: val.key || val.shortId || matched.key || matched.shortId || hint,
				name: val.name || val.title || val.displayName || matched.name || null
			};
		} catch (err) {
			if (Number(err?.status || 0) && Number(err.status) !== 404) throw err;
			return {
				id: idCandidate,
				key: matched.key || matched.shortId || idCandidate,
				name: matched.name || null
			};
		}
	}

	if (companyId) {
		const composite = `${String(companyId).trim()}:${hint}`;
		try {
			const detail = await getWorkspace(env, accessToken, composite);
			const val = detail?.value || detail || {};
			return {
				id: val.id || val.workspaceId || composite,
				key: val.key || val.shortId || hint,
				name: val.name || val.title || val.displayName || null
			};
		} catch (err) {
			if (Number(err?.status || 0) && Number(err.status) !== 404) throw err;
		}
	}

	return { id: hint, key: hint };
}

/* ───────────────────────── Shape helpers ───────────────────────── */

function _pickId(obj) {
	return obj?.id ||
		obj?.muralId ||
		obj?.muralID ||
		obj?.roomId ||
		obj?.folderId ||
		obj?.value?.id ||
		obj?.value?.muralId ||
		obj?.value?.muralID ||
		obj?.data?.id ||
		obj?.data?.muralId ||
		obj?.data?.muralID ||
		null;
}

function _workspaceSummary(raw, fallbackId = null) {
	const val = raw?.value || raw || {};
	const id = val.id || fallbackId || null;
	if (!id) return null;
	return {
		id,
		key: val.key || val.shortId || null,
		name: val.name || null
	};
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

	async resolveBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, explicitMuralId }) {
		if (explicitMuralId) return { muralId: String(explicitMuralId) };

		if (projectId) {
			const cacheKey = `${projectId}·${uid || ""}·${purpose}`;
			const cached = _memCache.get(cacheKey);
			if (cached && (Date.now() - cached.ts < 60_000)) {
				if (cached.deleted) return null;
				return { muralId: cached.muralId, boardUrl: cached.boardUrl, workspaceId: cached.workspaceId };
			}

			const rows = await _airtableListBoards(this.root.env, { projectId, uid, purpose, active: true, max: 25 });
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
								const inactiveFields = { Active: false };
								inactiveFields["Board URL"] = null;
								inactiveFields["Primary?"] = false;
								inactiveFields["Workspace ID"] = null;
								await _airtableUpdateBoard(this.root.env, top.id, inactiveFields);
							} catch (err) {
								this.root.log?.warn?.("mural.airtable_deactivate_failed", { message: err?.message || null });
							}
						}

						if (projectKey) {
							const clearUids = new Set();
							if (uid) clearUids.add(String(uid));
							if (recordUid) clearUids.add(recordUid);
							for (const clearUid of clearUids) {
								try {
									const key = `mural:${clearUid}:project:id::${projectKey}`;
									await this.root.env.SESSION_KV.delete(key);
								} catch { /* noop */ }
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
									if (status === 404 || status === 410) {
										boardDeleted = true;
									} else {
										this.root.log?.warn?.("mural.resolve_board_probe_failed", { status, message: err?.message || null });
									}
								}
							}
						} catch (err) {
							this.root.log?.warn?.("mural.resolve_board_token_failed", { message: err?.message || null });
						}
					}

					if (!boardDeleted && rec.boardUrl) {
						try {
							const head = await fetch(rec.boardUrl, { method: "HEAD", redirect: "manual" });
							if (head.status === 404 || head.status === 410) {
								boardDeleted = true;
							}
						} catch { /* ignore network errors */ }
					}

					if (boardDeleted) {
						await ensureInactive();
						return null;
					}

					_memCache.set(cacheKey, { ...rec, ts: Date.now(), deleted: false });
					return rec;
				}
			}

			const kv = await _kvProjectMapping(this.root.env, { uid, projectId });
			if (kv?.url) {
				const kvKey = `mural:${uid || "anon"}:project:id::${String(projectId)}`;
				const kvMuralId = kv?.muralId ? String(kv.muralId).trim() : "";

				if (!kvMuralId) {
					try { await this.root.env.SESSION_KV.delete(kvKey); } catch { /* ignore */ }
					return null;
				}

				if (_looksLikeMuralViewerUrl(kv.url)) {
					return {
						muralId: kvMuralId,
						boardUrl: kv.url,
						workspaceId: kv?.workspaceId ? String(kv.workspaceId).trim() || null : null
					};
				}

				try { await this.root.env.SESSION_KV.delete(kvKey); } catch { /* ignore */ }
			}
		}

		const envId = this.root?.env?.MURAL_REFLEXIVE_MURAL_ID;
		if (envId) {
			this.root.log?.warn?.("mural.deprecated_env_id", { note: "Migrate to Airtable 'Mural Boards'." });
			return { muralId: String(envId) };
		}

		return null;
	}

	async registerBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, muralId, boardUrl, workspaceId = null, primary = true, projectName = null }) {
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
				projectRecordId = await _lookupProjectRecordId(this.root.env, {
					projectId: safeProjectId,
					projectName: safeProjectName
				});
			} catch (err) {
				this.root.log?.warn?.("mural.project_lookup_failed", { message: err?.message || null });
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
			});
			if (Array.isArray(rows) && rows.length) {
				existing = rows.find(r => {
					const val = r?.fields?.["Mural ID"];
					return val && String(val).trim() === safeMuralId;
				}) || null;
			}
		} catch (err) {
			this.root.log?.warn?.("mural.airtable_lookup_failed", { message: err?.message || null });
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
			if (projectRecordId) {
				updateFields.Project = [{ id: projectRecordId }];
			}
			await _airtableUpdateBoard(this.root.env, existing.id, updateFields);
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
			});

			const logger = this.root?.log;
			if (logger?.info) {
				const recordId = creation?.records?.[0]?.id || null;
				logger.info("mural.airtable_board_created", {
					projectId: safeProjectId,
					projectRecordId: projectRecordId || null,
					uid: safeUid,
					purpose: safePurpose,
					muralId: safeMuralId,
					boardUrl: normalizedBoardUrl,
					workspaceId: normalizedWorkspaceId,
					primary: !!primary,
					attemptMode: creation?.attemptMode || null,
					attempts: creation?.attempts || null,
					airtableRecordId: recordId
				});
				if (typeof logger.flush === "function") {
					logger.flush();
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

	/* ───────────────────────── Routes ───────────────────────── */

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

		return Response.redirect(backUrl.toString(), 302);
	}

	async muralVerify(origin, url) {
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
				if (status === 401) {
					return this.root.json({ ok: false, error: "not_authenticated" }, 401, cors);
				}
				throw err;
			}

			if (!inWorkspace) {
				return this.root.json({ ok: false, error: "not_in_home_office_workspace" }, 403, cors);
			}

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

			return this.root.json({
				ok: true,
				uid,
				activeWorkspaceId: activeWorkspaceId || null,
				workspace,
				profile
			}, 200, cors);

		} catch (err) {
			const status = Number(err?.status || 0) || 500;
			const detail = String(err?.message || err || "verify_failed");
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
			const profile = _profileFromMe(me);
			const username = profile?.firstName || profile?.name || "Private";

			step = "ensure_room";
			try {
				room = await ensureUserRoom(this.root.env, accessToken, ws.id, {
					username,
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
			roomId = _pickId(room);
			if (!roomId) {
				this.root.log?.error?.("mural.ensure_room.no_id", { roomPreview: typeof room === "object" ? Object.keys(room || {}) : room });
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
					this.root.log?.warn?.("mural.ensure_folder.forbidden", {
						status,
						code,
						message: err?.message || null,
						roomId,
						projectId: projectId || null
					});
				} else {
					throw err;
				}
			}
			folderId = _pickId(folder);

			step = "create_mural";
			mural = await createMural(this.root.env, accessToken, {
				title: "Reflexive Journal",
				roomId,
				folderId: folderId || undefined
			});

			muralId = _pickId(mural);
			if (!muralId && mural?.muralId) muralId = mural.muralId;
			if (!muralId && mural?.value?.muralId) muralId = mural.value.muralId;
			muralId = muralId ? String(muralId) : null;

			if (!muralId) {
				this.root.log?.error?.("mural.create_mural.missing_id", {
					step,
					projectId,
					roomId,
					folderId,
					responseKeys: mural && typeof mural === "object" ? Object.keys(mural).slice(0, 10) : null
				});
				return this.root.json({
					ok: false,
					error: "mural_id_unavailable",
					step,
					message: "Mural API did not return an id for the created board"
				}, 502, cors);
			}

			// Best-effort quick probe (keep short!)
			step = "probe_viewer_url";
			let openUrl = null;
			const softDeadline = Date.now() + 9000;
			while (!openUrl && Date.now() < softDeadline) {
				openUrl = await _probeViewerUrl(this.root.env, accessToken, muralId);
				if (openUrl) break;
				await new Promise(r => setTimeout(r, 600));
			}

			const projectIdStr = projectId ? String(projectId) : null;
			if (projectIdStr) {
				try {
					await this.registerBoard({
						projectId: projectIdStr,
						uid,
						purpose: PURPOSE_REFLEXIVE,
						muralId,
						boardUrl: openUrl ?? undefined,
						workspaceId: ws?.id || null,
						primary: true,
						projectName: projectName
					});
				} catch (e) {
					this.root.log?.error?.("mural.airtable_register_failed", { status: e?.status, body: e?.body });
				}
			}

			if (openUrl && projectIdStr) {
				try {
					const kvKey = `mural:${uid}:project:id::${projectIdStr}`;
					await this.root.env.SESSION_KV.put(kvKey, JSON.stringify({
						url: openUrl,
						muralId,
						workspaceId: ws?.id || null,
						projectName: projectName,
						updatedAt: Date.now()
					}));
				} catch {}
			}

			// If link is ready, return 200 with link; if not, return 202 with pending=true
			if (openUrl) {
				return this.root.json({
					ok: true,
					workspace: ws,
					room,
					folder,
					folderDenied,
					mural: { ...mural, id: muralId, muralId, viewLink: openUrl },
					projectId: projectId || null,
					registered: Boolean(projectId),
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
				projectId: projectId || null
			}, 202, cors);

		} catch (err) {
			const status = Number(err?.status) || 500;
			const body = err?.body || null;
			const message = String(err?.message || "setup_failed");
			const context = {};
			if (step === "create_mural" || step === "ensure_folder" || step === "ensure_room") {
				context.workspaceId = ws?.id || null;
				context.workspaceKey = ws?.key || null;
				context.workspaceName = ws?.name || null;
				context.roomId = roomId || null;
				context.roomName = room?.name || null;
				context.roomVisibility = room?.visibility || room?.type || null;
				context.folderId = folderId || null;
				context.folderDenied = folderDenied;
				context.projectId = projectId ? String(projectId) : null;
				context.muralId = muralId;
			}
			if (this.root.log?.error) {
				this.root.log.error("mural.setup_failed", {
					step,
					status,
					message,
					upstreamCode: body?.code || body?.error || null,
					context
				});
			}
			const payload = { ok: false, error: "setup_failed", step, message, upstream: body };
			if (Object.values(context).some(v => v !== null && v !== undefined)) {
				payload.context = context;
			}
			return this.root.json(payload, status, cors);
		}
	}

	/**
	 * GET /api/mural/await?muralId=...&projectId=...&uid=...
	 * Short, server-side attempt to obtain a real viewer URL and register mapping.
	 */
	async muralAwait(origin, url) {
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
			openUrl = await _probeViewerUrl(this.root.env, accessToken, muralId);
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
				});
			} catch (e) {
				this.root.log?.error?.("mural.airtable_register_failed", { status: e?.status, body: e?.body });
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
