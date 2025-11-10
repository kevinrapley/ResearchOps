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

/* ───────────────────────── logging helper ───────────────────────── */
function _log(root, level, event, data) {
	try {
		if (root?.log?.[level]) {
			root.log[level](event, data);
			if (typeof root.log.flush === "function" && level !== "debug") root.log.flush();
		} else if (level === "error") {
			console.error(`[${event}]`, data);
		} else {
			console.log(`[${event}]`, data);
		}
	} catch {
		// Never throw from logging
	}
}

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

async function _lookupProjectRecordId(env, { projectId, projectName }, root = null) {
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

	_log(root, "debug", "airtable.projects.lookup.request", { url: url.toString(), filter });

	const res = await fetch(url.toString(), { headers: _airtableHeaders(env) });
	const txt = await res.text().catch(() => "");
	let js = {};
	try { js = txt ? JSON.parse(txt) : {}; } catch {}
	_log(root, res.ok ? "debug" : "warn", "airtable.projects.lookup.response", {
		status: res.status,
		ok: res.ok,
		bodyPreview: txt.slice(0, 500)
	});

	if (!res.ok) {
		throw Object.assign(new Error("airtable_project_lookup_failed"), { status: res.status, body: js });
	}

	const records = Array.isArray(js?.records) ? js.records : [];
	if (!records.length) return null;
	const first = records[0];
	const rid = typeof first?.id === "string" ? first.id.trim() : "";
	return rid || null;
}

/** Normalise ALLOWED_ORIGINS and validate return URL origin. */
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

async function _airtableListBoards(env, { projectId, uid, purpose, active = true, max = 25 }, root = null) {
	const url = new URL(_encodeTableUrl(env, _boardsTableName(env)));
	const filterByFormula = _buildBoardsFilter({ uid, purpose, active });
	if (filterByFormula) url.searchParams.set("filterByFormula", filterByFormula);
	url.searchParams.set("maxRecords", String(max));
	url.searchParams.append("sort[0][field]", "Primary?");
	url.searchParams.append("sort[0][direction]", "desc");
	url.searchParams.append("sort[1][field]", "Created At");
	url.searchParams.append("sort[1][direction]", "desc");

	_log(root, "debug", "airtable.boards.list.request", {
		url: url.toString(),
		projectId
	});

	const res = await fetch(url.toString(), { headers: _airtableHeaders(env) });
	const txt = await res.text().catch(() => "");
	let js = {};
	try { js = txt ? JSON.parse(txt) : {}; } catch {}
	_log(root, res.ok ? "debug" : "warn", "airtable.boards.list.response", {
		status: res.status,
		ok: res.ok,
		bodyPreview: txt.slice(0, 500)
	});

	if (!res.ok) {
		throw Object.assign(new Error("airtable_list_failed"), { status: res.status, body: js });
	}

	const records = Array.isArray(js.records) ? js.records : [];
	if (!projectId) return records;

	const pidRaw = String(projectId).trim();
	let pidRec = _looksLikeAirtableId(pidRaw) ? pidRaw : null;

	if (!pidRec) {
		try {
			pidRec = await _lookupProjectRecordId(env, { projectId: pidRaw, projectName: null }, root);
		} catch {
			// Non-fatal
		}
	}

	return records.filter(r => {
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

async function _airtableCreateBoard(env, fieldsBundle, root = null) {
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

	/** @type {Array<{mode:"linked_record"|"project_ref"|"bare", body:any}>} */
	const attempts = [];

	if (linkRecordId) {
		attempts.push({
			mode: "linked_record",
			body: { typecast: true, records: [{ fields: { ...baseFields, Project: [{ id: linkRecordId }] } }] }
		});
	}

	if (safeProjectRef) {
		attempts.push({
			mode: "project_ref",
			body: { typecast: true, records: [{ fields: { ...baseFields, Project: safeProjectRef } }] }
		});
	}

	const fallback = { mode: "bare", body: { typecast: true, records: [{ fields: baseFields }] } };
	if (!attempts.length) {
		attempts.push(fallback);
	} else {
		const seenBodies = new Set(attempts.map(att => JSON.stringify(att.body)));
		const fallbackKey = JSON.stringify(fallback.body);
		if (!seenBodies.has(fallbackKey)) attempts.push(fallback);
	}

	let lastRes = null;
	let lastTxt = "";
	const attempted = [];

	for (const attempt of attempts) {
		_log(root, "info", "airtable.boards.create.request", {
			url,
			mode: attempt.mode,
			body: attempt.body
		});

		const res = await fetch(url, {
			method: "POST",
			headers: _airtableHeaders(env),
			body: JSON.stringify(attempt.body)
		});
		const txt = await res.text().catch(() => "");
		attempted.push({ mode: attempt.mode, status: res.status, ok: res.ok });
		_log(root, res.ok ? "info" : "warn", "airtable.boards.create.response", {
			status: res.status,
			ok: res.ok,
			mode: attempt.mode,
			bodyPreview: txt.slice(0, 800)
		});

		if (res.ok) {
			try {
				const js = txt ? JSON.parse(txt) : {};
				return { ...js, ok: true, attemptMode: attempt.mode, attempts: attempted };
			} catch {
				return { ok: true, attemptMode: attempt.mode, attempts: attempted, records: [] };
			}
		}

		lastRes = res;
		lastTxt = txt;

		const recoverable =
			res.status === 422 ||
			res.status === 403 ||
			/UNKNOWN_FIELD_NAME|INVALID_VALUE|FIELD_VALUE_INVALID|CANNOT_ACCEPT_VALUE|LINKED_RECORDS|INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(
				String(txt || "")
			);

		if (!recoverable) {
			throw Object.assign(new Error("airtable_create_failed"), {
				status: res.status,
				body: (() => { try { return JSON.parse(txt); } catch { return { raw: txt.slice(0, 800) }; } })(),
			});
		}
	}

	const body = (() => { try { return JSON.parse(lastTxt); } catch { return { raw: lastTxt.slice(0, 800) }; } })();
	const error = Object.assign(new Error("airtable_create_failed"), {
		status: lastRes?.status || 422,
		body,
	});
	if (attempted.length) error.attempts = attempted;
	throw error;
}

async function _airtableUpdateBoard(env, recordId, fields, root = null) {
	const url = `${_encodeTableUrl(env, _boardsTableName(env))}/${recordId}`;
	_log(root, "info", "airtable.boards.update.request", { url, recordId, fields });

	const res = await fetch(url, {
		method: "PATCH",
		headers: _airtableHeaders(env),
		body: JSON.stringify({ fields, typecast: true })
	});
	const txt = await res.text().catch(() => "");
	_log(root, res.ok ? "info" : "warn", "airtable.boards.update.response", {
		status: res.status,
		ok: res.ok,
		bodyPreview: txt.slice(0, 800)
	});

	if (!res.ok) {
		let js = {};
		try { js = txt ? JSON.parse(txt) : {}; } catch {}
		throw Object.assign(new Error("airtable_update_failed"), { status: res.status, body: js });
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
	} catch {
		return false;
	}
}

function _extractViewerUrl(payload) {
	if (!payload) return null;

	const queue = [payload];
	const seen = new Set();

	const enqueue = (value) => { if (!value) return;
		queue.push(value); };

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
			next.viewerUrl, next.viewerURL, next.viewLink, next.viewURL,
			next.openUrl, next.openURL, next._canvasLink, next.url, next.href, next.link,
			next.value, next.viewer, next.open, next.publicUrl, next.shareUrl, next.shareURL,
			next.links, next.links?.viewer, next.links?.open, next.links?.share, next.links?.public
		];

		for (const candidate of candidates) {
			if (typeof candidate === "string" && _looksLikeMuralViewerUrl(candidate)) return candidate;
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
async function _probeViewerUrl(env, accessToken, muralId, root = null) {
	try {
		const hydrated = await getMural(env, accessToken, muralId).catch(() => null);
		const url = _extractViewerUrl(hydrated);
		if (url) return url;
	} catch (e) {
		_log(root, "debug", "mural.probe.getMural.error", { message: e?.message || String(e) });
	}
	try {
		const links = await getMuralLinks(env, accessToken, muralId).catch(() => []);
		const best = links.find(l => _looksLikeMuralViewerUrl(l.url)) ||
			links.find(l => /viewer|view|open|public/i.test(String(l.type || "")) && l.url);
		if (best?.url && _looksLikeMuralViewerUrl(best.url)) return best.url;
	} catch (e) {
		_log(root, "debug", "mural.probe.getLinks.error", { message: e?.message || String(e) });
	}
	try {
		const created = await createViewerLink(env, accessToken, muralId);
		if (created && _looksLikeMuralViewerUrl(created)) return created;
	} catch (e) {
		_log(root, "debug", "mural.probe.createViewerLink.error", { message: e?.message || String(e) });
	}
	try {
		const hydrated2 = await getMural(env, accessToken, muralId).catch(() => null);
		const url2 = _extractViewerUrl(hydrated2);
		if (url2) return url2;
	} catch (e) {
		_log(root, "debug", "mural.probe.getMural.retry.error", { message: e?.message || String(e) });
	}
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
// (unchanged – omitted for brevity in this comment; keep the same as your current file)

/* ───────────────────────── Class ───────────────────────── */

export class MuralServicePart {
	/** @param {ResearchOpsService} root */
	constructor(root) { this.root = root; }

	// KV tokens
	kvKey(uid) { return `mural:${uid}:tokens`; }
	async saveTokens(uid, tokens) { await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(tokens), { encryption: true }); }
	async loadTokens(uid) { const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid)); return raw ? JSON.parse(raw) : null; }

	// ... keep verify/workspace helpers unchanged ...

	async resolveBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, explicitMuralId }) {
		if (explicitMuralId) return { muralId: String(explicitMuralId) };

		if (projectId) {
			const cacheKey = `${projectId}·${uid || ""}·${purpose}`;
			const cached = _memCache.get(cacheKey);
			if (cached && (Date.now() - cached.ts < 60_000)) {
				if (cached.deleted) return null;
				return { muralId: cached.muralId, boardUrl: cached.boardUrl, workspaceId: cached.workspaceId };
			}

			let rows;
			try {
				rows = await _airtableListBoards(this.root.env, { projectId, uid, purpose, active: true, max: 25 }, this.root);
			} catch (e) {
				_log(this.root, "warn", "airtable.boards.list.error", { message: e?.message, projectId, uid, purpose });
				throw e;
			}

			const top = rows?.[0];
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
								await _airtableUpdateBoard(this.root.env, top.id, inactiveFields, this.root);
							} catch (err) {
								_log(this.root, "warn", "airtable.boards.deactivate.error", { message: err?.message || null });
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
								} catch {}
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
										_log(this.root, "warn", "mural.resolve_board.probe.warn", { status, message: err?.message || null });
									}
								}
							}
						} catch (err) {
							_log(this.root, "warn", "mural.resolve_board.token.warn", { message: err?.message || null });
						}
					}

					if (!boardDeleted && rec.boardUrl) {
						try {
							const head = await fetch(rec.boardUrl, { method: "HEAD", redirect: "manual" });
							if (head.status === 404 || head.status === 410) {
								boardDeleted = true;
							}
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

			const kv = await _kvProjectMapping(this.root.env, { uid, projectId });
			if (kv?.url) {
				const kvKey = `mural:${uid || "anon"}:project:id::${String(projectId)}`;
				const kvMuralId = kv?.muralId ? String(kv.muralId).trim() : "";
				if (!kvMuralId) {
					try { await this.root.env.SESSION_KV.delete(kvKey); } catch {}
					return null;
				}
				if (_looksLikeMuralViewerUrl(kv.url)) {
					return { muralId: kvMuralId, boardUrl: kv.url, workspaceId: kv?.workspaceId ? String(kv.workspaceId).trim() || null : null };
				}
				try { await this.root.env.SESSION_KV.delete(kvKey); } catch {}
			}
		}

		const envId = this.root?.env?.MURAL_REFLEXIVE_MURAL_ID;
		if (envId) {
			_log(this.root, "warn", "mural.deprecated_env_id", { note: "Migrate to Airtable 'Mural Boards'." });
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
				}, this.root);
			} catch (err) {
				_log(this.root, "warn", "airtable.project.lookup.error", { message: err?.message || null, safeProjectId, safeProjectName });
			}
		}

		const lookupKey = projectRecordId || safeProjectId;
		_log(this.root, "info", "mural.register.begin", {
			projectId: safeProjectId,
			resolvedProjectRecordId: projectRecordId,
			lookupKey,
			uid: safeUid,
			purpose: safePurpose,
			muralId: safeMuralId,
			boardUrl: normalizedBoardUrl,
			workspaceId: normalizedWorkspaceId,
			primary
		});

		let existing = null;
		try {
			const rows = await _airtableListBoards(this.root.env, {
				projectId: lookupKey,
				uid: safeUid,
				purpose: safePurpose,
				active: true,
				max: 25
			}, this.root);
			if (Array.isArray(rows) && rows.length) {
				existing = rows.find(r => {
					const val = r?.fields?.["Mural ID"];
					return val && String(val).trim() === safeMuralId;
				}) || null;
			}
			_log(this.root, "debug", "airtable.boards.match", { count: rows?.length || 0, existingId: existing?.id || null });
		} catch (err) {
			_log(this.root, "warn", "mural.airtable_lookup_failed", { message: err?.message || null });
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

			await _airtableUpdateBoard(this.root.env, existing.id, updateFields, this.root);
			_log(this.root, "info", "mural.register.updated", { airtableRecordId: existing.id });
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
			}, this.root);

			const recordId = creation?.records?.[0]?.id || null;
			_log(this.root, "info", "mural.register.created", {
				attemptMode: creation?.attemptMode || null,
				attempts: creation?.attempts || null,
				airtableRecordId: recordId
			});
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

		_log(this.root, "info", "mural.register.done", { cacheKey });
		return { ok: true };
	}

	/* ───────────────────────── Routes (unchanged except for lightweight logs) ───────────────────────── */

	async muralAuth(origin, url) { /* unchanged */ }

	async muralCallback(origin, url) { /* unchanged */ }

	async muralVerify(origin, url) { /* unchanged */ }

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

			// Best-effort quick probe (keep short!)
			step = "probe_viewer_url";
			let openUrl = null;
			const softDeadline = Date.now() + 9000;
			while (!openUrl && Date.now() < softDeadline) {
				openUrl = await _probeViewerUrl(this.root.env, accessToken, muralId, this.root);
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
						projectName
					});
				} catch (e) {
					_log(this.root, "error", "mural.airtable_register_failed", { status: e?.status, body: e?.body });
				}
			} else {
				_log(this.root, "warn", "mural.register.skipped_no_projectId", { uid, muralId, projectName });
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
				context.step = step;
			}
			_log(this.root, "error", "mural.setup_failed", { status, message, upstream: body, context });
			const payload = { ok: false, error: "setup_failed", step, message, upstream: body };
			if (Object.keys(context).length) payload.context = context;
			return this.root.json(payload, status, cors);
		}
	}

	/** GET /api/mural/await?muralId=...&projectId=...&uid=... */
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
			openUrl = await _probeViewerUrl(this.root.env, accessToken, muralId, this.root);
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
				_log(this.root, "error", "mural.airtable_register_failed", { status: e?.status, body: e?.body });
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

	async muralResolve(origin, url) { /* unchanged */ }

	async muralJournalSync(request, origin) { /* unchanged */ }

	async muralDebugEnv(origin) { /* unchanged */ }

	async muralDebugAuth(origin, url) { /* unchanged */ }

	/** GET /api/projects/lookup-by-name?name=...  → { ok:true, id, name } | 404 */
	async projectLookupByName(origin, url) {
		const cors = this.root.corsHeaders(origin);
		const name = (url.searchParams.get("name") || "").trim();
		if (!name) return this.root.json({ ok: false, error: "missing_name" }, 400, cors);

		try {
			_log(this.root, "info", "projects.lookupByName.begin", { name });
			const { findProjectRecordIdByName } = await import("../internals/airtable.js");
			const hit = await findProjectRecordIdByName(this.root.env, name);
			if (!hit) {
				_log(this.root, "info", "projects.lookupByName.not_found", { name });
				return this.root.json({ ok: false, error: "not_found" }, 404, cors);
			}
			_log(this.root, "info", "projects.lookupByName.hit", { id: hit.id, name: hit.name });
			return this.root.json({ ok: true, id: hit.id, name: hit.name }, 200, cors);
		} catch (err) {
			const status = Number(err?.status) || 500;
			_log(this.root, "error", "projects.lookupByName.failed", { name, message: String(err?.message || err) });
			return this.root.json({ ok: false, error: "lookup_failed", detail: String(err?.message || err) }, status, cors);
		}
	}
}
