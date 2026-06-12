/**
 * @file src/service/reflection/analysis.js
 * @module service/reflection/analysis
 * @summary Timeline, co-occurrence, retrieval, export payloads for CAQDAS UI.
 *
 * Routes:
 *   GET  /api/analysis/timeline?project=rec...
 *   GET  /api/analysis/cooccurrence?project=rec...
 *   GET  /api/analysis/retrieval?project=rec...&q=term
 *   GET  /api/analysis/export?project=rec...
 *
 * Data sources assumed:
 *   - D1 journal_entries cache for local/offline and seeded prototype entries
 *   - "Journals" (entries) with fields: Project (link), Body (text), Codes (link[] optional), Created time
 *   - "Codes" table as defined in codes.js
 *   - "Memos" table optional (for retrieval enrichment)
 */

import { listAll } from "../internals/airtable.js";
import { d1All } from "../internals/researchops-d1.js";
import {
	isTestProject1Id,
	TEST_PROJECT_1_CODE_APPLICATIONS,
	TEST_PROJECT_1_CODES,
	TEST_PROJECT_1_JOURNAL_ENTRIES,
} from "../internals/test-project-1-journal-seed.js";

const TEST_PROJECT_1_LEGACY_ID = "recgdpwEI5hFO7bUZ";
const TEST_PROJECT_1_CANONICAL_ID = "recgdpwEI5hF07bUZ";

/* ---------- helpers ---------- */
function ok(svc, origin, data) {
	return svc.json({ ok: true, ...data }, 200, svc.corsHeaders(origin));
}

function bad(svc, origin, msg) {
	return svc.json({ ok: false, error: msg }, 400, svc.corsHeaders(origin));
}

function err(svc, origin, status, msg) {
	svc.log?.error?.("analysis.error", { err: msg });
	return svc.json({ ok: false, error: msg }, status, svc.corsHeaders(origin));
}

function hasAirtable(svc) {
	return !!(svc?.env?.AIRTABLE_BASE_ID && (svc?.env?.AIRTABLE_API_KEY || svc?.env?.AIRTABLE_ACCESS_TOKEN));
}

function hasD1(svc) {
	return !!svc?.env?.RESEARCHOPS_D1;
}

function projectAliases(projectId) {
	const id = String(projectId || "").trim();
	if (!id) return [];
	if (id === TEST_PROJECT_1_LEGACY_ID) return [TEST_PROJECT_1_LEGACY_ID, TEST_PROJECT_1_CANONICAL_ID];
	if (id === TEST_PROJECT_1_CANONICAL_ID) return [TEST_PROJECT_1_CANONICAL_ID, TEST_PROJECT_1_LEGACY_ID];
	return [id];
}

function placeholders(values = []) {
	return values.map(() => "?").join(", ");
}

function parseTags(value) {
	if (Array.isArray(value)) return value.map(String).filter(Boolean);
	const text = String(value || "").trim();
	if (!text) return [];
	try {
		const parsed = JSON.parse(text);
		if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
	} catch {}
	return text.split(",").map((item) => item.trim()).filter(Boolean);
}

/* ---------- fetchers ---------- */
async function fetchCodesByProject(svc, projectId) {
	const d1Codes = await fetchD1CodesByProject(svc, projectId);
	if (d1Codes.size) return d1Codes;
	const airtableCodes = await fetchAirtableCodesByProject(svc, projectId);
	if (airtableCodes.size) return airtableCodes;
	return fetchSeedCodesByProject(projectId);
}

function fetchSeedCodesByProject(projectId) {
	if (!isTestProject1Id(projectId)) return new Map();
	return new Map(TEST_PROJECT_1_CODES.map((code) => [
		code.id,
		{ id: code.id, name: code.name, source: "seed" },
	]));
}

function seedCodeIdsByEntry(projectId) {
	if (!isTestProject1Id(projectId)) return new Map();
	const byEntry = new Map();
	for (const application of TEST_PROJECT_1_CODE_APPLICATIONS) {
		if (!byEntry.has(application.entry)) byEntry.set(application.entry, []);
		byEntry.get(application.entry).push(application.code);
	}
	return byEntry;
}

function seedJournalsByProject(projectId) {
	if (!isTestProject1Id(projectId)) return [];
	const codeIdsByEntry = seedCodeIdsByEntry(projectId);
	return TEST_PROJECT_1_JOURNAL_ENTRIES.map((entry) => ({
		id: entry.id,
		body: entry.content || "",
		content: entry.content || "",
		category: entry.category || "",
		codeIds: codeIdsByEntry.get(entry.id) || [],
		tags: entry.tags || [],
		createdAt: entry.createdAt || "",
		project: entry.project || "",
		localProjectId: entry.localProjectId || "",
		source: "seed",
	}));
}

async function fetchD1CodesByProject(svc, projectId) {
	if (!hasD1(svc)) return new Map();
	const ids = projectAliases(projectId);
	if (!ids.length) return new Map();
	const list = placeholders(ids);

	try {
		const rows = await d1All(svc.env, `
			SELECT record_id, local_code_id, name
			  FROM codes
			 WHERE project IN (${list})
			    OR local_project_id IN (${list})
			 ORDER BY datetime(createdat) ASC;
		`, [...ids, ...ids]);

		if (isTestProject1Id(projectId) && rows.length < TEST_PROJECT_1_CODES.length) {
			return fetchSeedCodesByProject(projectId);
		}

		const map = new Map();
		for (const row of rows) {
			const id = row.record_id || row.local_code_id;
			if (!id) continue;
			map.set(id, { id, name: row.name || id, source: "d1" });
		}
		return map;
	} catch (error) {
		svc.log?.warn?.("analysis.codes.d1.skip", { err: String(error?.message || error).slice(0, 160) });
		return new Map();
	}
}

async function fetchAirtableCodesByProject(svc, projectId) {
	if (!hasAirtable(svc)) return new Map();
	const tableRef = svc.env.AIRTABLE_TABLE_CODES || "Codes";
	const { records } = await listAll(svc.env, tableRef, { pageSize: 100 }, svc.cfg?.TIMEOUT_MS);

	const LINK_FIELDS = ["Project", "Projects"];
	const map = new Map();

	for (const r of records) {
		const f = r?.fields || {};
		const linked = LINK_FIELDS.some((lf) => Array.isArray(f[lf]) && f[lf].includes(projectId));
		if (!linked) continue;
		map.set(r.id, { id: r.id, name: f.Name || "—" });
	}

	return map;
}

async function fetchD1CodeIdsByEntry(svc, projectId) {
	if (!hasD1(svc)) return new Map();
	const ids = projectAliases(projectId);
	if (!ids.length) return new Map();
	const list = placeholders(ids);

	try {
		const rows = await d1All(svc.env, `
			SELECT entry, code
			  FROM code_applications
			 WHERE project IN (${list})
			    OR local_project_id IN (${list});
		`, [...ids, ...ids]);

		const byEntry = new Map();
		for (const row of rows) {
			const entryId = String(row.entry || "").trim();
			const codeId = String(row.code || "").trim();
			if (!entryId || !codeId) continue;
			if (!byEntry.has(entryId)) byEntry.set(entryId, []);
			byEntry.get(entryId).push(codeId);
		}
		if (isTestProject1Id(projectId) && rows.length < TEST_PROJECT_1_CODE_APPLICATIONS.length) {
			return seedCodeIdsByEntry(projectId);
		}
		return byEntry.size ? byEntry : seedCodeIdsByEntry(projectId);
	} catch (error) {
		svc.log?.warn?.("analysis.code_applications.d1.skip", { err: String(error?.message || error).slice(0, 160) });
		return seedCodeIdsByEntry(projectId);
	}
}

async function fetchD1JournalsByProject(svc, projectId) {
	if (!hasD1(svc)) return [];
	const ids = projectAliases(projectId);
	if (!ids.length) return [];
	const list = placeholders(ids);

	try {
		const codeIdsByEntry = await fetchD1CodeIdsByEntry(svc, projectId);
		const rows = await d1All(svc.env, `
			SELECT record_id, project, category, content, tags, createdat, local_project_id
			  FROM journal_entries
			 WHERE project IN (${list})
			    OR local_project_id IN (${list})
			 ORDER BY datetime(createdat) ASC;
		`, [...ids, ...ids]);

		if (isTestProject1Id(projectId) && rows.length < TEST_PROJECT_1_JOURNAL_ENTRIES.length) {
			return seedJournalsByProject(projectId);
		}

		return rows.map((row = {}) => ({
			id: row.record_id,
			body: row.content || "",
			content: row.content || "",
			category: row.category || "",
			codeIds: codeIdsByEntry.get(row.record_id) || [],
			tags: parseTags(row.tags),
			createdAt: row.createdat || "",
			project: row.project || "",
			localProjectId: row.local_project_id || "",
			source: "d1"
		}));
	} catch (error) {
		svc.log?.warn?.("analysis.timeline.d1.skip", { err: String(error?.message || error).slice(0, 160) });
		return seedJournalsByProject(projectId);
	}
}

async function fetchAirtableJournalsByProject(svc, projectId) {
	if (!hasAirtable(svc)) return [];
	const tableRef = svc.env.AIRTABLE_TABLE_JOURNAL || "Journals";
	const { records } = await listAll(svc.env, tableRef, { pageSize: 100 }, svc.cfg?.TIMEOUT_MS);

	const out = [];
	for (const r of records) {
		const f = r?.fields || {};
		const projects = Array.isArray(f.Project) ?
			f.Project :
			Array.isArray(f.Projects) ?
			f.Projects :
			Array.isArray(f["Project lookup"]) ?
			f["Project lookup"] :
			[];
		if (!projects.includes(projectId)) continue;

		out.push({
			id: r.id,
			body: f.Body || f.Content || f.Notes || "",
			content: f.Body || f.Content || f.Notes || "",
			category: f.Category || "",
			codeIds: Array.isArray(f.Codes) ? f.Codes : [],
			createdAt: r.createdTime || f.Created || "",
			source: "airtable"
		});
	}

	return out;
}

async function fetchJournalsByProject(svc, projectId) {
	const d1Entries = await fetchD1JournalsByProject(svc, projectId);
	if (d1Entries.length) return d1Entries;
	const airtableEntries = await fetchAirtableJournalsByProject(svc, projectId);
	if (airtableEntries.length) return airtableEntries;
	return seedJournalsByProject(projectId);
}

/* ---------- timeline ---------- */
export async function timeline(svc, origin, url) {
	const projectId = url.searchParams.get("project") || "";
	if (!projectId) return bad(svc, origin, "Missing ?project");

	try {
		const entries = await fetchJournalsByProject(svc, projectId);
		entries.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
		return ok(svc, origin, { timeline: entries });
	} catch (e) {
		const msg = String(e || "");
		const status = /Airtable\s+40[13]/i.test(msg) ? 502 : 500;
		return err(svc, origin, status, msg);
	}
}

/* ---------- co-occurrence ---------- */
export async function cooccurrence(svc, origin, url) {
	const projectId = url.searchParams.get("project") || "";
	if (!projectId) return bad(svc, origin, "Missing ?project");

	try {
		const [codesMap, entries] = await Promise.all([
			fetchCodesByProject(svc, projectId),
			fetchJournalsByProject(svc, projectId)
		]);

		const pairCounts = new Map();
		for (const e of entries) {
			const ids = e.codeIds.filter((id) => codesMap.has(id));
			ids.sort();
			for (let i = 0; i < ids.length; i++) {
				for (let j = i + 1; j < ids.length; j++) {
					const key = `${ids[i]}|${ids[j]}`;
					pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
				}
			}
		}

		const used = new Set();
		for (const key of pairCounts.keys()) {
			const [a, b] = key.split("|");
			used.add(a);
			used.add(b);
		}

		const nodes = Array.from(used).map((id) => ({
			id,
			label: codesMap.get(id)?.name || id
		}));

		const links = Array.from(pairCounts.entries()).map(([key, count]) => {
			const [source, target] = key.split("|");
			return { source, target, weight: count };
		});

		return ok(svc, origin, { nodes, links });
	} catch (e) {
		const msg = String(e || "");
		const status = /Airtable\s+40[13]/i.test(msg) ? 502 : 500;
		return err(svc, origin, status, msg);
	}
}

/* ---------- retrieval ---------- */
export async function retrieval(svc, origin, url) {
	const projectId = url.searchParams.get("project") || "";
	const q = (url.searchParams.get("q") || "").toLowerCase().trim();

	if (!projectId) return bad(svc, origin, "Missing ?project");
	if (!q) return ok(svc, origin, { results: [] });

	try {
		const [codesMap, entries] = await Promise.all([
			fetchCodesByProject(svc, projectId),
			fetchJournalsByProject(svc, projectId)
		]);

		const results = [];
		for (const e of entries) {
			const text = (e.body || "").toLowerCase();
			const matched = [];
			for (const id of e.codeIds) {
				const name = codesMap.get(id)?.name || "";
				if (name && (name.toLowerCase().includes(q) || text.includes(q))) {
					matched.push({ id, name });
				}
			}
			if (matched.length) {
				results.push({
					entryId: e.id,
					snippet: (e.body || "").slice(0, 240),
					codes: matched
				});
			}
		}

		return ok(svc, origin, { results });
	} catch (e) {
		const msg = String(e || "");
		const status = /Airtable\s+40[13]/i.test(msg) ? 502 : 500;
		return err(svc, origin, status, msg);
	}
}

/* ---------- export ---------- */
export async function exportAnalysis(svc, origin, url) {
	const projectId = url.searchParams.get("project") || "";
	if (!projectId) return bad(svc, origin, "Missing ?project");

	try {
		const entries = await fetchJournalsByProject(svc, projectId);
		const codesMap = await fetchCodesByProject(svc, projectId);
		const codes = Array.from(codesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
		const exportPayload = {
			projectId,
			generatedAt: new Date().toISOString(),
			codes,
			timeline: entries
		};

		return svc.json(exportPayload, 200, {
			...svc.corsHeaders(origin),
			"content-type": "application/json; charset=utf-8",
			"content-disposition": `attachment; filename="analysis-${projectId}.json"`
		});
	} catch (e) {
		const msg = String(e || "");
		const status = /Airtable\s+40[13]/i.test(msg) ? 502 : 500;
		return err(svc, origin, status, msg);
	}
}
