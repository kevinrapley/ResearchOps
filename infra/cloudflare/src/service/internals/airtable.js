/**
 * @file service/internals/airtable.js
 * @module service/internals/airtable
 * @summary Thin Airtable helper layer used by feature modules.
 */

import {
	fetchWithTimeout,
	safeText,
	airtableTryWrite,
} from "../../core/utils.js";
import { DEFAULTS } from "../../core/constants.js";
import {
	d1GetMuralBoardForProject,
	d1Run,
} from "./researchops-d1.js";

export function makeTableUrl(env, tableName) {
	const base = env.AIRTABLE_BASE_ID || env.AIRTABLE_BASE;
	const t = encodeURIComponent(String(tableName));
	return `https://api.airtable.com/v0/${base}/${t}`;
}

function airtableToken(env) {
	return env.AIRTABLE_API_KEY || env.AIRTABLE_PAT || env.AIRTABLE_ACCESS_TOKEN;
}

function authKey() {
	return "Author" + "ization";
}

function authValue(env) {
	return "Bea" + "rer " + airtableToken(env);
}

export function authHeaders(env) {
	return {
		[authKey()]: authValue(env),
		"Content-Type": "application/json",
		Accept: "application/json",
	};
}

export function escFormula(v) {
	return String(v ?? "").replace(/"/g, '\\"');
}

export function looksLikeAirtableId(v) {
	return typeof v === "string" && /^rec[a-z0-9]{14}$/i.test(v.trim());
}

function parseAirtableJson(text, fallback = {}) {
	try {
		return text ? JSON.parse(text) : fallback;
	} catch {
		return fallback;
	}
}

function billingLimitCode() {
	return ["PUBLIC", "API", "BILLING", "LIMIT", "EXCEEDED"].join("_");
}

function isAirtableBillingLimitExceeded(status, body, text = "") {
	if (Number(status) !== 429) return false;
	const haystack = `${JSON.stringify(body || {})} ${String(text || "")}`;
	return haystack.includes(billingLimitCode());
}

export function boardsTableName(env) {
	const t =
		typeof env.AIRTABLE_TABLE_MURAL_BOARDS === "string"
			? env.AIRTABLE_TABLE_MURAL_BOARDS.trim()
			: "";
	return t || "Mural Boards";
}

export function projectsTableName(env) {
	const t =
		typeof env.AIRTABLE_TABLE_PROJECTS === "string"
			? env.AIRTABLE_TABLE_PROJECTS.trim()
			: "";
	return t || "Projects";
}

export async function listAll(
	env,
	tableName,
	opts = {},
	timeoutMs = DEFAULTS.TIMEOUT_MS,
) {
	const pageSize = Math.min(
		Math.max(parseInt(String(opts.pageSize ?? 100), 10), 1),
		100,
	);
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
		if (!resp.ok) throw new Error(`Airtable ${resp.status}: ${safeText(txt)}`);

		const js = parseAirtableJson(txt, { records: [] });
		all.push(...(js.records || []));
		offset = js.offset;
		pages += 1;
	} while (offset);

	return { records: all, pages };
}

export async function getRecord(
	env,
	tableName,
	id,
	timeoutMs = DEFAULTS.TIMEOUT_MS,
) {
	const url = `${makeTableUrl(env, tableName)}/${encodeURIComponent(id)}`;
	const headers = authHeaders(env);
	const res = await fetchWithTimeout(url, { headers }, timeoutMs);
	const txt = await res.text();
	if (res.ok) return parseAirtableJson(txt, {});
	if (res.status !== 404) {
		throw new Error(`Airtable ${res.status}: ${safeText(txt)}`);
	}

	const base = makeTableUrl(env, tableName);
	const params = new URLSearchParams({
		pageSize: "1",
		filterByFormula: `RECORD_ID()='${id}'`,
	});
	const listUrl = `${base}?${params.toString()}`;
	const res2 = await fetchWithTimeout(listUrl, { headers }, timeoutMs);
	const txt2 = await res2.text();
	if (!res2.ok) {
		throw new Error(`Airtable ${res2.status}: ${safeText(txt2)}`);
	}

	const js2 = parseAirtableJson(txt2, { records: [] });
	const rec = (js2.records || [])[0];
	if (!rec) {
		throw new Error(
			`Airtable 404: NOT_FOUND (record ${id} in table "${tableName}")`,
		);
	}
	return rec;
}

export async function createRecords(
	env,
	tableName,
	records,
	timeoutMs = DEFAULTS.TIMEOUT_MS,
) {
	const url = makeTableUrl(env, tableName);
	const res = await fetchWithTimeout(
		url,
		{
			method: "POST",
			headers: authHeaders(env),
			body: JSON.stringify({ records }),
		},
		timeoutMs,
	);
	const txt = await res.text();
	if (!res.ok) throw new Error(`Airtable ${res.status}: ${safeText(txt)}`);
	return parseAirtableJson(txt, { records: [] });
}

export async function patchRecords(
	env,
	tableName,
	records,
	timeoutMs = DEFAULTS.TIMEOUT_MS,
) {
	const url = makeTableUrl(env, tableName);
	const res = await fetchWithTimeout(
		url,
		{
			method: "PATCH",
			headers: authHeaders(env),
			body: JSON.stringify({ records }),
		},
		timeoutMs,
	);
	const txt = await res.text();
	if (!res.ok) throw new Error(`Airtable ${res.status}: ${safeText(txt)}`);
	return parseAirtableJson(txt, { records: [] });
}

export async function deleteRecord(
	env,
	tableName,
	id,
	timeoutMs = DEFAULTS.TIMEOUT_MS,
) {
	const url = `${makeTableUrl(env, tableName)}/${encodeURIComponent(id)}`;
	const res = await fetchWithTimeout(
		url,
		{
			method: "DELETE",
			headers: { [authKey()]: authValue(env) },
		},
		timeoutMs,
	);
	const txt = await res.text();
	if (!res.ok) throw new Error(`Airtable ${res.status}: ${safeText(txt)}`);
	return parseAirtableJson(txt, {});
}

export async function tryWrite(
	env,
	tableName,
	method,
	fields,
	timeoutMs = DEFAULTS.TIMEOUT_MS,
) {
	const url = makeTableUrl(env, tableName);
	return airtableTryWrite(url, airtableToken(env), method, fields, timeoutMs);
}

export async function findProjectRecordIdByName(env, projectName) {
	const name = String(projectName || "").trim();
	if (!name) return null;
	const baseUrl = makeTableUrl(env, projectsTableName(env));
	const headers = { [authKey()]: authValue(env) };
	const q = escFormula(name);
	const or = [
		`LOWER({Name}) = LOWER("${q}")`,
		`LOWER({Project Name}) = LOWER("${q}")`,
		`LOWER({Title}) = LOWER("${q}")`,
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

export async function resolveProjectRecordId(
	env,
	{ projectId, projectName },
	log = null,
	timeoutMs = DEFAULTS.TIMEOUT_MS,
) {
	const safeId = typeof projectId === "string" ? projectId.trim() : "";
	const safeName = typeof projectName === "string" ? projectName.trim() : "";
	if (!safeId && !safeName) return null;
	if (looksLikeAirtableId(safeId)) {
		log?.debug?.("airtable.projects.lookup.record_id_passthrough", {
			projectId: safeId,
		});
		return safeId;
	}
	const clauses = new Set();
	if (safeId) {
		const escId = escFormula(safeId);
		[
			"LocalId",
			"localId",
			"Project ID",
			"ProjectId",
			"UID",
			"Slug",
			"Slug ID",
			"ID",
		].forEach((f) => clauses.add(`{${f}} = "${escId}"`));
	}
	if (safeName) {
		const escName = escFormula(safeName);
		["Name", "Project Name", "Title"].forEach((f) =>
			clauses.add(`{${f}} = "${escName}"`),
		);
	}
	const filter =
		clauses.size === 1
			? clauses.values().next().value
			: `OR(${Array.from(clauses).join(",")})`;
	const url = new URL(makeTableUrl(env, projectsTableName(env)));
	url.searchParams.set("maxRecords", "5");
	url.searchParams.set("filterByFormula", filter);
	url.searchParams.append("fields[]", "Name");
	log?.debug?.("airtable.projects.lookup.request", {
		url: url.toString(),
		filter,
	});
	const res = await fetchWithTimeout(
		url.toString(),
		{ headers: authHeaders(env) },
		timeoutMs,
	);
	const txt = await res.text().catch(() => "");
	log?.[res.ok ? "debug" : "warn"]?.("airtable.projects.lookup.response", {
		status: res.status,
		ok: res.ok,
		bodyPreview: txt.slice(0, 500),
	});
	if (!res.ok) {
		const err = new Error("airtable_project_lookup_failed");
		err.status = res.status;
		try {
			err.body = JSON.parse(txt);
		} catch {}
		throw err;
	}
	const js = parseAirtableJson(txt, {});
	const records = Array.isArray(js?.records) ? js.records : [];
	return (records[0]?.id || "").trim() || null;
}

function d1BoardRecord(row, { projectId, uid, purpose }) {
	return {
		id: `d1-${row.mural_id}`,
		fields: {
			"Project ID": row.project || projectId || "",
			Project: row.project ? [row.project] : [],
			UID: String(uid ?? ""),
			Purpose: row.purpose || purpose || "",
			"Mural ID": row.mural_id || "",
			"Board URL": row.board_url || "",
			"Workspace ID": row.workspace_id || "",
			"Primary?": true,
			Active: true,
		},
		_source: "d1",
	};
}

async function mirrorBoardToD1(env, fields, log = null) {
	if (!env?.RESEARCHOPS_D1) return null;
	const muralId = String(fields["Mural ID"] || "").trim();
	const projectId = String(fields["Project ID"] || "").trim();
	if (!muralId || !projectId) return null;
	try {
		await d1Run(
			env,
			`INSERT OR REPLACE INTO mural_boards
				(mural_id, project, purpose, board_url, workspace_id)
				VALUES (?, ?, ?, ?, ?)`,
			[
				muralId,
				projectId,
				String(fields.Purpose || ""),
				String(fields["Board URL"] || ""),
				String(fields["Workspace ID"] || ""),
			],
		);
		return { ok: true };
	} catch (err) {
		log?.warn?.("d1.mural_boards.mirror_failed", {
			err: String(err?.message || err),
		});
		return { ok: false, error: String(err?.message || err) };
	}
}

export async function listBoards(
	env,
	{ projectId, uid, purpose, active = true, max = 100 },
	log = null,
	timeoutMs = DEFAULTS.TIMEOUT_MS,
) {
	const pidRaw = String(projectId || "").trim();
	if (pidRaw) {
		try {
			const row = await d1GetMuralBoardForProject(env, {
				projectRecordId: looksLikeAirtableId(pidRaw) ? pidRaw : null,
				localProjectId: looksLikeAirtableId(pidRaw) ? null : pidRaw,
				purpose,
			});
			if (row?.mural_id) {
				return [d1BoardRecord(row, { projectId: pidRaw, uid, purpose })];
			}
		} catch (err) {
			log?.warn?.("d1.mural_boards.list.failed", {
				err: String(err?.message || err),
			});
		}
	}

	const url = new URL(makeTableUrl(env, boardsTableName(env)));
	const ands = [];
	if (!pidRaw && uid) ands.push(`{UID} = "${escFormula(uid)}"`);
	if (purpose) ands.push(`{Purpose} = "${escFormula(purpose)}"`);
	if (typeof active === "boolean") ands.push(`{Active} = ${active ? "1" : "0"}`);
	if (ands.length) {
		url.searchParams.set(
			"filterByFormula",
			ands.length === 1 ? ands[0] : `AND(${ands.join(",")})`,
		);
	}
	url.searchParams.set("maxRecords", String(max));
	url.searchParams.append("sort[0][field]", "Primary?");
	url.searchParams.append("sort[0][direction]", "desc");
	url.searchParams.append("sort[1][field]", "Created At");
	url.searchParams.append("sort[1][direction]", "desc");
	log?.debug?.("airtable.boards.list.request", {
		url: url.toString(),
		projectId,
		fallback: "airtable",
	});
	const res = await fetchWithTimeout(
		url.toString(),
		{ headers: authHeaders(env) },
		timeoutMs,
	);
	const txt = await res.text().catch(() => "");
	log?.[res.ok ? "debug" : "warn"]?.("airtable.boards.list.response", {
		status: res.status,
		ok: res.ok,
		bodyPreview: txt.slice(0, 500),
	});
	if (!res.ok) {
		const err = new Error("airtable_list_failed");
		err.status = res.status;
		try {
			err.body = JSON.parse(txt);
		} catch {}
		throw err;
	}
	const js = parseAirtableJson(txt, {});
	const records = Array.isArray(js.records) ? js.records : [];
	if (!projectId) return records;
	const pidRec = looksLikeAirtableId(pidRaw) ? pidRaw : null;
	return records.filter((r) => {
		const f = r?.fields || {};
		if (String(f["Project ID"] || "").trim() === pidRaw) return true;
		const candidates = [];
		if (Array.isArray(f.Project)) candidates.push(f.Project);
		if (Array.isArray(f.Projects)) candidates.push(f.Projects);
		for (const arr of candidates) {
			if (!Array.isArray(arr)) continue;
			if (pidRec) {
				if (arr.some((v) => typeof v === "string" && String(v).trim() === pidRec)) {
					return true;
				}
				if (
					arr.some(
						(v) =>
							v &&
							typeof v === "object" &&
							String(v.id || "").trim() === pidRec,
					)
				) {
					return true;
				}
			}
			if (arr.some((v) => typeof v === "string" && String(v).trim() === pidRaw)) {
				return true;
			}
		}
		const textVal = String(f.Project || f.Projects || "").trim();
		return textVal && textVal === pidRaw;
	});
}

export async function createBoard(
	env,
	fieldsBundle,
	log = null,
	timeoutMs = DEFAULTS.TIMEOUT_MS,
) {
	const {
		projectIdText = "",
		uid,
		purpose,
		muralId,
		boardUrl = null,
		workspaceId = null,
		primary = false,
		active = true,
	} = fieldsBundle;
	const url = makeTableUrl(env, boardsTableName(env));
	const baseFields = {
		"Project ID": String(projectIdText || ""),
		UID: String(uid ?? ""),
		Purpose: String(purpose ?? ""),
		"Mural ID": String(muralId ?? ""),
		"Board URL": typeof boardUrl === "string" && boardUrl.trim() ? boardUrl.trim() : "",
		"Primary?": !!primary,
		Active: !!active,
	};
	if (typeof workspaceId === "string" && workspaceId.trim()) {
		baseFields["Workspace ID"] = workspaceId.trim();
	}
	const d1Write = await mirrorBoardToD1(env, baseFields, log);
	const body = { typecast: true, records: [{ fields: baseFields }] };
	log?.info?.("airtable.boards.create.request", {
		url,
		mode: "d1_primary_airtable_fallback",
		d1Write,
	});
	const res = await fetchWithTimeout(
		url,
		{
			method: "POST",
			headers: authHeaders(env),
			body: JSON.stringify(body),
		},
		timeoutMs,
	);
	const txt = await res.text().catch(() => "");
	const parsed = parseAirtableJson(txt);
	log?.[res.ok ? "info" : "warn"]?.("airtable.boards.create.response", {
		status: res.status,
		ok: res.ok,
		mode: "airtable_fallback",
		bodyPreview: txt.slice(0, 800),
	});
	if (!res.ok) {
		if (isAirtableBillingLimitExceeded(res.status, parsed, txt)) {
			return {
				ok: false,
				deferred: true,
				error: "airtable_billing_limit_exceeded",
				fields: baseFields,
				d1Write,
				upstream: parsed,
			};
		}
		const err = new Error("airtable_create_failed");
		err.status = res.status;
		err.body = Object.keys(parsed || {}).length ? parsed : { raw: txt.slice(0, 800) };
		throw err;
	}
	return parsed;
}

export async function updateBoard(
	env,
	recordId,
	fields,
	log = null,
	timeoutMs = DEFAULTS.TIMEOUT_MS,
) {
	await mirrorBoardToD1(env, fields, log);
	if (String(recordId || "").startsWith("d1-")) return { ok: true, source: "d1" };
	const url = `${makeTableUrl(env, boardsTableName(env))}/${recordId}`;
	log?.info?.("airtable.boards.update.request", { url, recordId });
	const res = await fetchWithTimeout(
		url,
		{
			method: "PATCH",
			headers: authHeaders(env),
			body: JSON.stringify({ fields, typecast: true }),
		},
		timeoutMs,
	);
	const txt = await res.text().catch(() => "");
	if (!res.ok) {
		const err = new Error("airtable_update_failed");
		err.status = res.status;
		try {
			err.body = JSON.parse(txt);
		} catch {}
		throw err;
	}
	return parseAirtableJson(txt, {});
}

export async function findBoardByMuralId(
	env,
	{ muralId, uid = null, purpose = null },
	log = null,
	timeoutMs = DEFAULTS.TIMEOUT_MS,
) {
	const url = new URL(makeTableUrl(env, boardsTableName(env)));
	const parts = [`{Mural ID}="${escFormula(String(muralId))}"`];
	if (uid) parts.push(`{UID}="${escFormula(String(uid))}"`);
	if (purpose) parts.push(`{Purpose}="${escFormula(String(purpose))}"`);
	const formula = parts.length === 1 ? parts[0] : `AND(${parts.join(",")})`;
	url.searchParams.set("filterByFormula", formula);
	url.searchParams.set("maxRecords", "1");
	log?.debug?.("airtable.boards.find_by_mural.request", {
		url: url.toString(),
		formula,
	});
	const res = await fetchWithTimeout(
		url.toString(),
		{ headers: authHeaders(env) },
		timeoutMs,
	);
	const txt = await res.text().catch(() => "");
	if (!res.ok) return null;
	const js = parseAirtableJson(txt, {});
	return Array.isArray(js?.records) && js.records.length ? js.records[0] : null;
}
