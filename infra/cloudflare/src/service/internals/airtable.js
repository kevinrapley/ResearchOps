/**
 * @file service/internals/airtable.js
 * @module service/internals/airtable
 * @summary Thin Airtable helper layer used by feature modules.
 *
 * Centralises URL building, headers, pagination, and resilient writes so that
 * feature modules (studies, guides, participants, sessions, mural, etc.) can
 * stay small and focused on business logic.
 */

import { fetchWithTimeout, safeText, airtableTryWrite } from "../../core/utils.js";
import { DEFAULTS } from "../../core/constants.js";

/* ──────────────────────────────────────────────────────────────────────────────
 * Core URL + headers
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Build the base Airtable REST URL for a given table.
 * @param {import("../index.js").Env} env
 * @param {string} tableName
 * @returns {string}
 */
export function makeTableUrl(env, tableName) {
	const base = env.AIRTABLE_BASE_ID || env.AIRTABLE_BASE;
	const t = encodeURIComponent(String(tableName));
	return `https://api.airtable.com/v0/${base}/${t}`;
}

/**
 * Build the Authorization + common headers for Airtable calls.
 * @param {import("../index.js").Env} env
 * @returns {Record<string,string>}
 */
export function authHeaders(env) {
	return {
		Authorization: `Bearer ${env.AIRTABLE_API_KEY || env.AIRTABLE_PAT}`,
		"Content-Type": "application/json",
		Accept: "application/json"
	};
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Generic helpers
 * ────────────────────────────────────────────────────────────────────────────── */

/** Escape double quotes for filterByFormula string literals. */
export function escFormula(v) {
	return String(v ?? "").replace(/"/g, '\\"');
}

/** Heuristic: does a string look like an Airtable record id? */
export function looksLikeAirtableId(v) {
	return typeof v === "string" && /^rec[a-z0-9]{14}$/i.test(v.trim());
}

/** Canonical table name helpers (respect env overrides) */
export function boardsTableName(env) {
	const t = typeof env.AIRTABLE_TABLE_MURAL_BOARDS === "string" ? env.AIRTABLE_TABLE_MURAL_BOARDS.trim() : "";
	return t || "Mural Boards";
}
export function projectsTableName(env) {
	const t = typeof env.AIRTABLE_TABLE_PROJECTS === "string" ? env.AIRTABLE_TABLE_PROJECTS.trim() : "";
	return t || "Projects";
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Basic table utilities
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * List *all* records from a table, automatically paging via `offset`.
 * Does not restrict fields; caller can filter after fetching.
 */
export async function listAll(env, tableName, opts = {}, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const pageSize = Math.min(Math.max(parseInt(String(opts.pageSize ?? 100), 10), 1), 100);
	const base = makeTableUrl(env, tableName);
	const headers = authHeaders(env);

	const all = [];
	let offset;
	let pages = 0;

	do {
		const params = new URLSearchParams({ pageSize: String(pageSize) });
		if (offset) params.set("offset", offset);
		if (opts.extraParams) {
			for (const [k, v] of Object.entries(opts.extraParams)) {
				if (v != null) params.set(k, String(v));
			}
		}

		const url = `${base}?${params.toString()}`;
		const resp = await fetchWithTimeout(url, { headers }, timeoutMs);
		const txt = await resp.text();

		if (!resp.ok) {
			throw new Error(`Airtable ${resp.status}: ${safeText(txt)}`);
		}

		/** @type {{records?:Array<any>, offset?:string}} */
		let js;
		try { js = JSON.parse(txt); } catch { js = { records: [] }; }
		all.push(...(js.records || []));
		offset = js.offset;
		pages += 1;
	} while (offset);

	return { records: all, pages };
}

/**
 * Read a single record by ID with a fallback list-query if the record endpoint 404s.
 */
export async function getRecord(env, tableName, id, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const url = `${makeTableUrl(env, tableName)}/${encodeURIComponent(id)}`;
	const headers = authHeaders(env);

	// Direct endpoint
	{
		const res = await fetchWithTimeout(url, { headers }, timeoutMs);
		const txt = await res.text();
		if (res.ok) {
			try { return JSON.parse(txt); } catch { return {}; }
		}
		if (res.status !== 404) throw new Error(`Airtable ${res.status}: ${safeText(txt)}`);
	}

	// Fallback via list + filterByFormula
	{
		const base = makeTableUrl(env, tableName);
		const params = new URLSearchParams({
			pageSize: "1",
			filterByFormula: `RECORD_ID()='${id}'`
		});
		const listUrl = `${base}?${params.toString()}`;
		const res2 = await fetchWithTimeout(listUrl, { headers }, timeoutMs);
		const txt2 = await res2.text();

		if (!res2.ok) throw new Error(`Airtable ${res2.status}: ${safeText(txt2)}`);

		/** @type {{records?: Array<any>}} */
		let js2;
		try { js2 = JSON.parse(txt2); } catch { js2 = { records: [] }; }
		const rec = (js2.records || [])[0];
		if (!rec) throw new Error(`Airtable 404: NOT_FOUND (record ${id} in table "${tableName}")`);
		return rec;
	}
}

/** Create records (bulk POST). */
export async function createRecords(env, tableName, records, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const url = makeTableUrl(env, tableName);
	const res = await fetchWithTimeout(url, {
		method: "POST",
		headers: authHeaders(env),
		body: JSON.stringify({ records })
	}, timeoutMs);

	const txt = await res.text();
	if (!res.ok) throw new Error(`Airtable ${res.status}: ${safeText(txt)}`);
	try { return JSON.parse(txt); } catch { return { records: [] }; }
}

/** Patch records (bulk PATCH). */
export async function patchRecords(env, tableName, records, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const url = makeTableUrl(env, tableName);
	const res = await fetchWithTimeout(url, {
		method: "PATCH",
		headers: authHeaders(env),
		body: JSON.stringify({ records })
	}, timeoutMs);

	const txt = await res.text();
	if (!res.ok) throw new Error(`Airtable ${res.status}: ${safeText(txt)}`);
	try { return JSON.parse(txt); } catch { return { records: [] }; }
}

/** Delete a single record by ID. */
export async function deleteRecord(env, tableName, id, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const url = `${makeTableUrl(env, tableName)}/${encodeURIComponent(id)}`;
	const res = await fetchWithTimeout(url, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${env.AIRTABLE_API_KEY || env.AIRTABLE_PAT}` }
	}, timeoutMs);

	const txt = await res.text();
	if (!res.ok) throw new Error(`Airtable ${res.status}: ${safeText(txt)}`);
	try { return JSON.parse(txt); } catch { return {}; }
}

/**
 * Resilient create/update helper that returns retry hints on common 422s
 * (e.g., UNKNOWN_FIELD_NAME). Thin wrapper around the shared util.
 */
export async function tryWrite(env, tableName, method, fields, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const url = makeTableUrl(env, tableName);
	return airtableTryWrite(url, env.AIRTABLE_API_KEY || env.AIRTABLE_PAT, method, fields, timeoutMs);
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Project lookups
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Find a Project record by *Name* (case-insensitive exact match).
 * Looks in common name fields: {Name}, {Project Name}, {Title}.
 */
export async function findProjectRecordIdByName(env, projectName) {
	const name = String(projectName || "").trim();
	if (!name) return null;

	const baseUrl = makeTableUrl(env, projectsTableName(env));
	const headers = { Authorization: `Bearer ${env.AIRTABLE_API_KEY || env.AIRTABLE_PAT}` };

	const q = escFormula(name);
	const or = [
		`LOWER({Name}) = LOWER("${q}")`,
		`LOWER({Project Name}) = LOWER("${q}")`,
		`LOWER({Title}) = LOWER("${q}")`
	].join(",");

	const url = new URL(baseUrl);
	url.searchParams.set("maxRecords", "1");
	url.searchParams.set("filterByFormula", `OR(${or})`);
	url.searchParams.append("fields[]", "Name");

	const res = await fetch(url.toString(), { headers });
	const js = await res.json().catch(() => ({}));
	if (!res.ok) {
		const err = new Error(`Airtable ${res.status}: project lookup failed`);
		err.status = res.status;
		err.body = js;
		throw err;
	}

	const rec = Array.isArray(js.records) ? js.records[0] : null;
	if (!rec) return null;
	return { id: rec.id, name: rec.fields?.Name || name };
}

/**
 * Resolve a Project record id using a variety of common ID/name fields.
 * Accepts either a projectId string (slug/local id) or a projectName.
 */
export async function resolveProjectRecordId(env, { projectId, projectName }, log = null, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const safeId = typeof projectId === "string" ? projectId.trim() : "";
	const safeName = typeof projectName === "string" ? projectName.trim() : "";
	if (!safeId && !safeName) return null;

	const clauses = new Set();
	if (safeId) {
		const escId = escFormula(safeId);
		["LocalId", "localId", "Project ID", "ProjectId", "UID", "Slug", "Slug ID", "ID"].forEach(f => clauses.add(`{${f}} = "${escId}"`));
	}
	if (safeName) {
		const escName = escFormula(safeName);
		["Name", "Project Name", "Title"].forEach(f => clauses.add(`{${f}} = "${escName}"`));
	}

	const filter = clauses.size === 1 ? clauses.values().next().value : `OR(${Array.from(clauses).join(",")})`;

	const url = new URL(makeTableUrl(env, projectsTableName(env)));
	url.searchParams.set("maxRecords", "5");
	url.searchParams.set("filterByFormula", filter);
	url.searchParams.append("fields[]", "Name");

	log?.debug?.("airtable.projects.lookup.request", { url: url.toString(), filter });

	const res = await fetchWithTimeout(url.toString(), { headers: authHeaders(env) }, timeoutMs);
	const txt = await res.text().catch(() => "");
	log?.[res.ok ? "debug" : "warn"]?.("airtable.projects.lookup.response", {
		status: res.status,
		ok: res.ok,
		bodyPreview: txt.slice(0, 500)
	});

	if (!res.ok) {
		const err = new Error("airtable_project_lookup_failed");
		err.status = res.status;
		try { err.body = JSON.parse(txt); } catch {}
		throw err;
	}

	let js = {};
	try { js = txt ? JSON.parse(txt) : {}; } catch {}
	const records = Array.isArray(js?.records) ? js.records : [];
	const rid = (records[0]?.id || "").trim();
	return rid || null;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Mural Boards helpers
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * List Mural Boards, filtered by uid/purpose/active, then (optionally) narrowed
 * by projectId (which may be an Airtable rec id or a project slug/id).
 */
export async function listBoards(env, { projectId, uid, purpose, active = true, max = 25 }, log = null, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const url = new URL(makeTableUrl(env, boardsTableName(env)));
	const ands = [];
	if (uid) ands.push(`{UID} = "${escFormula(uid)}"`);
	if (purpose) ands.push(`{Purpose} = "${escFormula(purpose)}"`);
	if (typeof active === "boolean") ands.push(`{Active} = ${active ? "1" : "0"}`);
	if (ands.length) url.searchParams.set("filterByFormula", `AND(${ands.join(",")})`);
	url.searchParams.set("maxRecords", String(max));
	url.searchParams.append("sort[0][field]", "Primary?");
	url.searchParams.append("sort[0][direction]", "desc");
	url.searchParams.append("sort[1][field]", "Created At");
	url.searchParams.append("sort[1][direction]", "desc");

	log?.debug?.("airtable.boards.list.request", { url: url.toString(), projectId });

	const res = await fetchWithTimeout(url.toString(), { headers: authHeaders(env) }, timeoutMs);
	const txt = await res.text().catch(() => "");
	log?.[res.ok ? "debug" : "warn"]?.("airtable.boards.list.response", {
		status: res.status,
		ok: res.ok,
		bodyPreview: txt.slice(0, 500)
	});

	if (!res.ok) {
		const err = new Error("airtable_list_failed");
		err.status = res.status;
		try { err.body = JSON.parse(txt); } catch {}
		throw err;
	}

	let js = {};
	try { js = txt ? JSON.parse(txt) : {}; } catch {}
	const records = Array.isArray(js.records) ? js.records : [];
	if (!projectId) return records;

	const pidRaw = String(projectId).trim();
	let pidRec = looksLikeAirtableId(pidRaw) ? pidRaw : null;

	if (!pidRec) {
		try {
			pidRec = await resolveProjectRecordId(env, { projectId: pidRaw, projectName: null }, log, timeoutMs);
		} catch { /* non-fatal */ }
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

/**
 * Create a Mural Boards row. Attempts:
 *  1) { Project: [{ id: recId }] }
 *  2) { Project: "<text ref>" }
 *  3) No Project field
 */
export async function createBoard(env, fieldsBundle, log = null, timeoutMs = DEFAULTS.TIMEOUT_MS) {
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

	const url = makeTableUrl(env, boardsTableName(env));
	const baseFields = {
		UID: String(uid ?? ""),
		Purpose: String(purpose ?? ""),
		"Mural ID": String(muralId ?? ""),
		"Board URL": (typeof boardUrl === "string" && boardUrl.trim()) ? boardUrl.trim() : "",
		"Primary?": !!primary,
		Active: !!active
	};
	if (typeof workspaceId === "string" && workspaceId.trim()) {
		baseFields["Workspace ID"] = workspaceId.trim();
	}

	/** attempt 1: linked record; 2: project ref text; 3: bare */
	const attempts = [];
	if (typeof projectRecordId === "string" && projectRecordId.trim()) {
		attempts.push({
			mode: "linked_record",
			body: { typecast: true, records: [{ fields: { ...baseFields, Project: [{ id: projectRecordId.trim() }] } }] }
		});
	}
	if (typeof projectRef === "string" && projectRef.trim()) {
		attempts.push({
			mode: "project_ref",
			body: { typecast: true, records: [{ fields: { ...baseFields, Project: projectRef.trim() } }] }
		});
	}
	attempts.push({ mode: "bare", body: { typecast: true, records: [{ fields: baseFields }] } });

	let lastRes = null,
		lastTxt = "";
	const attempted = [];

	for (const attempt of attempts) {
		log?.info?.("airtable.boards.create.request", { url, mode: attempt.mode });
		log?.debug?.("airtable.boards.create.payload", attempt.body);

		const res = await fetchWithTimeout(url, {
			method: "POST",
			headers: authHeaders(env),
			body: JSON.stringify(attempt.body)
		}, timeoutMs);

		const txt = await res.text().catch(() => "");
		attempted.push({ mode: attempt.mode, status: res.status, ok: res.ok });
		log?.[res.ok ? "info" : "warn"]?.("airtable.boards.create.response", {
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
		const recoverable = res.status === 422 || res.status === 403 ||
			/UNKNOWN_FIELD_NAME|INVALID_VALUE|FIELD_VALUE_INVALID|CANNOT_ACCEPT_VALUE|LINKED_RECORDS|INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(String(txt || ""));
		if (!recoverable) {
			const err = new Error("airtable_create_failed");
			err.status = res.status;
			try { err.body = JSON.parse(txt); } catch { err.body = { raw: txt.slice(0, 800) }; }
			throw err;
		}
	}

	const error = new Error("airtable_create_failed");
	error.status = lastRes?.status || 422;
	try { error.body = JSON.parse(lastTxt); } catch { error.body = { raw: String(lastTxt).slice(0, 800) }; }
	error.attempts = attempted;
	throw error;
}

/** Patch a Mural Boards row by record id. */
export async function updateBoard(env, recordId, fields, log = null, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const url = `${makeTableUrl(env, boardsTableName(env))}/${recordId}`;
	log?.info?.("airtable.boards.update.request", { url, recordId });
	log?.debug?.("airtable.boards.update.payload", { fields, typecast: true });

	const res = await fetchWithTimeout(url, {
		method: "PATCH",
		headers: authHeaders(env),
		body: JSON.stringify({ fields, typecast: true })
	}, timeoutMs);

	const txt = await res.text().catch(() => "");
	log?.[res.ok ? "info" : "warn"]?.("airtable.boards.update.response", {
		status: res.status,
		ok: res.ok,
		bodyPreview: txt.slice(0, 800)
	});

	if (!res.ok) {
		const err = new Error("airtable_update_failed");
		err.status = res.status;
		try { err.body = JSON.parse(txt); } catch {}
		throw err;
	}
	try { return JSON.parse(txt); } catch { return {}; }
}

/**
 * Find a single Mural Boards row by Mural ID (optionally also by uid/purpose).
 * Returns the first matching record or null.
 */
export async function findBoardByMuralId(env, { muralId, uid = null, purpose = null }, log = null, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const url = new URL(makeTableUrl(env, boardsTableName(env)));
	const parts = [`{Mural ID}="${escFormula(String(muralId))}"`];
	if (uid) parts.push(`{UID}="${escFormula(String(uid))}"`);
	if (purpose) parts.push(`{Purpose}="${escFormula(String(purpose))}"`);
	const formula = parts.length === 1 ? parts[0] : `AND(${parts.join(",")})`;
	url.searchParams.set("filterByFormula", formula);
	url.searchParams.set("maxRecords", "1");

	log?.debug?.("airtable.boards.find_by_mural.request", { url: url.toString(), formula });

	const res = await fetchWithTimeout(url.toString(), { headers: authHeaders(env) }, timeoutMs);
	const txt = await res.text().catch(() => "");
	log?.[res.ok ? "debug" : "warn"]?.("airtable.boards.find_by_mural.response", {
		status: res.status,
		ok: res.ok,
		bodyPreview: txt.slice(0, 800)
	});

	if (!res.ok) return null;

	let js = {};
	try { js = txt ? JSON.parse(txt) : {}; } catch {}
	return Array.isArray(js?.records) && js.records.length ? js.records[0] : null;
}

/**
 * Quick probe of the "Project" field shape in the Mural Boards table.
 * Returns one of: "linked_objects" | "linked_strings" | "text" | "array_unknown" | "unknown"
 */
export async function detectProjectFieldShape(env, log = null, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const url = new URL(makeTableUrl(env, boardsTableName(env)));
	url.searchParams.set("maxRecords", "1");
	url.searchParams.append("fields[]", "Project");

	const res = await fetchWithTimeout(url.toString(), { headers: authHeaders(env) }, timeoutMs);
	const txt = await res.text().catch(() => "");
	log?.[res.ok ? "debug" : "warn"]?.("airtable.boards.detect_project_shape.response", {
		status: res.status,
		ok: res.ok,
		bodyPreview: txt.slice(0, 400)
	});

	if (!res.ok) return "unknown";
	try {
		const js = JSON.parse(txt);
		const p = js?.records?.[0]?.fields?.Project;
		if (Array.isArray(p) && p.length && typeof p[0] === "object" && p[0]?.id) return "linked_objects";
		if (Array.isArray(p) && p.length && typeof p[0] === "string" && /^rec/i.test(p[0])) return "linked_strings";
		if (typeof p === "string") return "text";
		return Array.isArray(p) ? "array_unknown" : "unknown";
	} catch {
		return "unknown";
	}
}