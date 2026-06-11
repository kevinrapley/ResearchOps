import { safeText } from "../../core/utils.js";
import { listAll } from "../internals/airtable.js";
import { d1All } from "../internals/researchops-d1.js";
import { findProjectRecord } from "../projects/airtable.js";

const JOURNALS_TABLE = (service) => service.env.AIRTABLE_TABLE_JOURNAL || "Journals";
const MEMOS_TABLE = (service) => service.env.AIRTABLE_TABLE_MEMOS || "Memos";
const CODES_TABLE = (service) => service.env.AIRTABLE_TABLE_CODES || "Codes";
const TEST_PROJECT_1_LEGACY_ID = "recgdpwEI5hFO7bUZ";
const TEST_PROJECT_1_CANONICAL_ID = "recgdpwEI5hF07bUZ";

function hasD1(env) {
	return !!env?.RESEARCHOPS_D1;
}

function hasAirtable(env) {
	return !!((env?.AIRTABLE_BASE_ID || env?.AIRTABLE_BASE) && (env?.AIRTABLE_API_KEY || env?.AIRTABLE_PAT || env?.AIRTABLE_ACCESS_TOKEN));
}

function isAirtableRecordId(value) {
	return /^rec[a-zA-Z0-9]{14,}$/.test(String(value || "").trim());
}

function unique(values = []) {
	const seen = new Set();
	const out = [];
	for (const value of values) {
		const text = String(value || "").trim();
		if (!text || seen.has(text)) continue;
		seen.add(text);
		out.push(text);
	}
	return out;
}

function withProjectAliases(values = []) {
	return unique(values.flatMap((value) => {
		const text = String(value || "").trim();
		if (text === TEST_PROJECT_1_LEGACY_ID) return [text, TEST_PROJECT_1_CANONICAL_ID];
		if (text === TEST_PROJECT_1_CANONICAL_ID) return [text, TEST_PROJECT_1_LEGACY_ID];
		return [text];
	}));
}

function projectCandidates(url) {
	return withProjectAliases([url.searchParams.get("project"), url.searchParams.get("project_id"), url.searchParams.get("project_local_id"), url.searchParams.get("project_airtable_id")]);
}

function linkedValues(value) {
	if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
	const text = String(value || "").trim();
	return text ? [text] : [];
}

function linkedProjects(fields = {}) {
	return withProjectAliases([
		...linkedValues(fields.Project),
		...linkedValues(fields.Projects),
		...linkedValues(fields["Project lookup"]),
		...linkedValues(fields["Project Lookup"]),
		...linkedValues(fields["Project ID"]),
		...linkedValues(fields["Project Ref"]),
	]);
}

function includesAny(values = [], candidates = []) {
	const wanted = new Set(candidates.map(String));
	return values.some((value) => wanted.has(String(value)));
}

function normTagsArray(value) {
	if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
	if (!value) return [];
	return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function parseTags(value) {
	if (Array.isArray(value)) return normTagsArray(value);
	const text = String(value || "").trim();
	if (!text) return [];
	try {
		const parsed = JSON.parse(text);
		if (Array.isArray(parsed)) return normTagsArray(parsed);
	} catch {}
	return normTagsArray(text);
}

function placeholders(values = []) {
	return values.map(() => "?").join(", ");
}

async function d1RowsForProjects(env, table, columns, candidates, orderColumn = "createdat") {
	const ids = unique(candidates);
	if (!ids.length) return [];
	const list = placeholders(ids);
	return d1All(env, `
		SELECT ${columns}
		  FROM ${table}
		 WHERE local_project_id IN (${list})
		    OR project IN (${list})
		 ORDER BY datetime(${orderColumn}) DESC;
	`, [...ids, ...ids]);
}

async function resolveAirtableProjectIds(service, candidates = []) {
	const ids = new Set(candidates.filter(isAirtableRecordId));
	if (!hasAirtable(service.env)) return [...ids];
	for (const candidate of candidates) {
		if (!candidate || isAirtableRecordId(candidate)) continue;
		try {
			const record = await findProjectRecord(service, candidate);
			if (record?.id) ids.add(record.id);
		} catch (error) {
			service?.log?.warn?.("project_data.project_id_resolution.skip", { project: candidate, err: safeText(error?.message || error).slice(0, 160) });
		}
	}
	return [...ids];
}

function mapD1JournalEntry(row = {}) {
	return { id: row.record_id || null, project: row.project || null, category: row.category || "", content: row.content || "", tags: parseTags(row.tags), createdAt: row.createdat || null, source: "d1" };
}

function mapAirtableJournalEntry(record = {}, projectId = "") {
	const fields = record.fields || {};
	return { id: record.id, project: projectId, category: fields.Category || "—", content: fields.Content || fields.Body || fields.Notes || "", tags: normTagsArray(fields.Tags), createdAt: record.createdTime || fields.Created || "", source: "airtable" };
}

function mapD1Memo(row = {}) {
	return { id: row.record_id || row.local_memo_id || null, memoType: row.type || "memo", title: row.title || "", content: row.body || "", linkedEntries: [], createdAt: row.createdat || null, source: "d1" };
}

function mapAirtableMemo(record = {}) {
	const fields = record.fields || {};
	return {
		id: record.id,
		memoType: fields["Memo Type"] || fields.Type || "memo",
		title: fields.Title || "",
		content: fields.Content || fields.Body || fields.Notes || "",
		author: fields.Author || "",
		linkedEntries: Array.isArray(fields["Linked Entries"]) ? fields["Linked Entries"] : Array.isArray(fields.Entries) ? fields.Entries : [],
		createdAt: record.createdTime || fields.Created || "",
		source: "airtable"
	};
}

function normaliseHex8(value) {
	let text = String(value || "").trim().toLowerCase();
	if (!text.startsWith("#")) text = `#${text}`;
	if (/^#[0-9a-f]{3}$/.test(text)) text = `#${text.slice(1).split("").map((item) => item + item).join("")}`;
	if (/^#[0-9a-f]{6}$/.test(text)) return `${text}ff`;
	if (/^#[0-9a-f]{8}$/.test(text)) return text;
	return "#1d70b8ff";
}

function mapD1Code(row = {}) {
	return { id: row.record_id || row.local_code_id || null, name: row.name || row.record_id || row.local_code_id || "", description: row.description || "", colour: normaliseHex8(row.colour || "#505a5fff"), parentId: row.parentcode || null, projectId: row.project || row.local_project_id || null, tags: normTagsArray(row.tags), source: "d1" };
}

function mapAirtableCode(record = {}) {
	const fields = record.fields || {};
	return { id: record.id, name: fields.Name || fields.Code || fields["Short Name"] || "", description: fields.Description || "", colour: normaliseHex8(fields.Colour || fields.Color || "#505a5fff"), parentId: linkedValues(fields.Parent)[0] || null, projectId: linkedValues(fields.Project)[0] || null, tags: normTagsArray(fields.Tags), source: "airtable" };
}

function addCodePaths(codes = []) {
	const byId = new Map(codes.map((code) => [code.id, code]));
	const cache = new Map();
	function pathFor(id, guard = 24) {
		if (!id || !byId.has(id) || guard <= 0) return [];
		if (cache.has(id)) return cache.get(id);
		const code = byId.get(id);
		const path = pathFor(code.parentId, guard - 1).concat(code.name || code.id);
		cache.set(id, path);
		return path;
	}
	return codes.map((code) => ({ ...code, path: pathFor(code.id).join(" / ") || code.name || code.id }));
}

async function airtableRecordsForProjects(service, table, candidates, timeoutMs, { allowUnfiltered = false } = {}) {
	const records = await listAll(service.env, table, { pageSize: 100 }, timeoutMs);
	const list = Array.isArray(records?.records) ? records.records : Array.isArray(records) ? records : [];
	if (!candidates.length) return allowUnfiltered ? list : [];
	return list.filter((record) => includesAny(linkedProjects(record.fields || {}), candidates));
}

export async function listJournalEntries(service, origin, url) {
	const candidates = projectCandidates(url);
	if (!candidates.length) return service.json({ ok: true, entries: [] }, 200, service.corsHeaders(origin));
	if (hasD1(service.env)) {
		try {
			const rows = await d1RowsForProjects(service.env, "journal_entries", "record_id, project, category, content, tags, createdat, local_project_id", candidates);
			if (rows.length) return service.json({ ok: true, source: "d1", entries: rows.map(mapD1JournalEntry) }, 200, service.corsHeaders(origin));
		} catch (error) {
			service?.log?.warn?.("project_data.journals.d1.fail", { err: safeText(error?.message || error).slice(0, 200) });
		}
	}
	if (!hasAirtable(service.env)) return service.json({ ok: true, source: "empty", entries: [] }, 200, service.corsHeaders(origin));
	try {
		const airtableProjectIds = await resolveAirtableProjectIds(service, candidates);
		const records = await airtableRecordsForProjects(service, JOURNALS_TABLE(service), airtableProjectIds, service?.cfg?.TIMEOUT_MS);
		const entries = records.map((record) => mapAirtableJournalEntry(record, airtableProjectIds[0] || ""));
		entries.sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0));
		return service.json({ ok: true, source: entries.length ? "airtable" : "empty", entries }, 200, service.corsHeaders(origin));
	} catch (error) {
		const msg = safeText(error?.message || error || "");
		service?.log?.error?.("project_data.journals.airtable.fail", { err: msg.slice(0, 200) });
		return service.json({ ok: false, error: "Failed to load journal entries", detail: msg }, 500, service.corsHeaders(origin));
	}
}

export async function listMemos(service, origin, url) {
	const candidates = projectCandidates(url);
	if (!candidates.length) return service.json({ ok: true, memos: [] }, 200, service.corsHeaders(origin));
	if (hasD1(service.env)) {
		try {
			const rows = await d1RowsForProjects(service.env, "memos", "record_id, project, type, title, body, createdat, local_project_id, local_memo_id", candidates);
			if (rows.length) return service.json({ ok: true, source: "d1", memos: rows.map(mapD1Memo) }, 200, service.corsHeaders(origin));
		} catch (error) {
			service?.log?.warn?.("project_data.memos.d1.fail", { err: safeText(error?.message || error).slice(0, 200) });
		}
	}
	if (!hasAirtable(service.env)) return service.json({ ok: true, source: "empty", memos: [] }, 200, service.corsHeaders(origin));
	try {
		const airtableProjectIds = await resolveAirtableProjectIds(service, candidates);
		const records = await airtableRecordsForProjects(service, MEMOS_TABLE(service), airtableProjectIds, service?.cfg?.TIMEOUT_MS);
		const memos = records.map(mapAirtableMemo);
		return service.json({ ok: true, source: memos.length ? "airtable" : "empty", memos }, 200, service.corsHeaders(origin));
	} catch (error) {
		const msg = safeText(error?.message || error || "");
		service?.log?.error?.("project_data.memos.airtable.fail", { err: msg.slice(0, 200) });
		return service.json({ ok: false, error: "Failed to load memos", detail: msg }, 500, service.corsHeaders(origin));
	}
}

export async function listCodes(service, origin, url) {
	const candidates = projectCandidates(url);
	const nofilter = url.searchParams.get("nofilter") === "1";
	if (hasD1(service.env)) {
		try {
			const rows = nofilter || !candidates.length ? await d1All(service.env, `
				SELECT record_id, project, name, description, parentcode, colour, createdat, local_project_id, local_code_id, NULL AS tags
				  FROM codes
				 ORDER BY datetime(createdat) DESC;
			`) : await d1RowsForProjects(service.env, "codes", "record_id, project, name, description, parentcode, colour, createdat, local_project_id, local_code_id, NULL AS tags", candidates);
			if (rows.length) return service.json({ ok: true, source: "d1", codes: addCodePaths(rows.map(mapD1Code)) }, 200, service.corsHeaders(origin));
		} catch (error) {
			service?.log?.warn?.("project_data.codes.d1.fail", { err: safeText(error?.message || error).slice(0, 200) });
		}
	}
	if (!hasAirtable(service.env)) return service.json({ ok: true, source: "empty", codes: [] }, 200, service.corsHeaders(origin));
	try {
		const airtableProjectIds = nofilter ? [] : await resolveAirtableProjectIds(service, candidates);
		const records = await airtableRecordsForProjects(service, CODES_TABLE(service), airtableProjectIds, service?.cfg?.TIMEOUT_MS, { allowUnfiltered: nofilter || !candidates.length });
		const codes = addCodePaths(records.map(mapAirtableCode));
		return service.json({ ok: true, source: codes.length ? "airtable" : "empty", codes }, 200, service.corsHeaders(origin));
	} catch (error) {
		const msg = safeText(error?.message || error || "");
		service?.log?.error?.("project_data.codes.airtable.fail", { err: msg.slice(0, 200) });
		return service.json({ ok: false, error: "Internal error", detail: msg }, 500, service.corsHeaders(origin));
	}
}
