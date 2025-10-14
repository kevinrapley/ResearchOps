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
 *   - "Journals" (entries) with fields: Project (link), Body (text), Codes (link[] optional), Created time
 *   - "Codes" table as defined in codes.js
 *   - "Memos" table optional (for retrieval enrichment)
 */

import { listAll } from "../internals/airtable.js";
const isTableId = (s) => typeof s === "string" && /^tbl[a-zA-Z0-9]{14,}$/.test(s);

function ok(svc, origin, data) { return svc.json({ ok: true, ...data }, 200, svc.corsHeaders(origin)); }

function bad(svc, origin, msg) { return svc.json({ ok: false, error: msg }, 400, svc.corsHeaders(origin)); }

function err(svc, origin, status, msg) {
	svc.log?.error?.("analysis.error", { err: msg });
	return svc.json({ ok: false, error: msg }, status, svc.corsHeaders(origin));
}

async function fetchCodesByProject(svc, projectId) {
	const tableRef = isTableId(svc.env.AIRTABLE_TABLE_CODES_ID) ? svc.env.AIRTABLE_TABLE_CODES_ID : (svc.env.AIRTABLE_TABLE_CODES || "Codes");
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

async function fetchJournalsByProject(svc, projectId) {
	const tableRef = isTableId(svc.env.AIRTABLE_TABLE_JOURNALS_ID) ? svc.env.AIRTABLE_TABLE_JOURNALS_ID : (svc.env.AIRTABLE_TABLE_JOURNALS || "Journals");
	const { records } = await listAll(svc.env, tableRef, { pageSize: 100 }, svc.cfg?.TIMEOUT_MS);
	const out = [];
	for (const r of records) {
		const f = r?.fields || {};
		const projects = Array.isArray(f.Project) ? f.Project : Array.isArray(f.Projects) ? f.Projects : [];
		if (!projects.includes(projectId)) continue;
		out.push({
			id: r.id,
			body: f.Body || f.Notes || "",
			codeIds: Array.isArray(f.Codes) ? f.Codes : [],
			createdAt: r.createdTime || f.Created || ""
		});
	}
	return out;
}

/* ─────────────── Timeline ─────────────── */
export async function timeline(svc, origin, url) {
	const projectId = url.searchParams.get("project") || "";
	if (!projectId) return bad(svc, origin, "Missing ?project");

	if (!svc?.env?.AIRTABLE_BASE_ID || !(svc?.env?.AIRTABLE_API_KEY || svc?.env?.AIRTABLE_ACCESS_TOKEN)) {
		return ok(svc, origin, { timeline: [] });
	}

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

/* ─────────────── Co-occurrence ─────────────── */
export async function cooccurrence(svc, origin, url) {
	const projectId = url.searchParams.get("project") || "";
	if (!projectId) return bad(svc, origin, "Missing ?project");

	if (!svc?.env?.AIRTABLE_BASE_ID || !(svc?.env?.AIRTABLE_API_KEY || svc?.env?.AIRTABLE_ACCESS_TOKEN)) {
		return ok(svc, origin, { nodes: [], links: [] });
	}

	try {
		const [codesMap, entries] = await Promise.all([
			fetchCodesByProject(svc, projectId),
			fetchJournalsByProject(svc, projectId)
		]);

		// Build pairs within each entry
		const pairCounts = new Map(); // key "a|b" sorted
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

		// Nodes (codes used at least once)
		const used = new Set();
		for (const key of pairCounts.keys()) {
			const [a, b] = key.split("|");
			used.add(a);
			used.add(b);
		}
		const nodes = Array.from(used).map((id) => ({ id, label: codesMap.get(id)?.name || id }));

		// Links
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

/* ─────────────── Retrieval ─────────────── */
export async function retrieval(svc, origin, url) {
	const projectId = url.searchParams.get("project") || "";
	const q = (url.searchParams.get("q") || "").toLowerCase().trim();

	if (!projectId) return bad(svc, origin, "Missing ?project");
	if (!q) return ok(svc, origin, { results: [] });

	if (!svc?.env?.AIRTABLE_BASE_ID || !(svc?.env?.AIRTABLE_API_KEY || svc?.env?.AIRTABLE_ACCESS_TOKEN)) {
		return ok(svc, origin, { results: [] });
	}

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

/* ─────────────── Export ─────────────── */
export async function exportAnalysis(svc, origin, url) {
	const projectId = url.searchParams.get("project") || "";
	if (!projectId) return bad(svc, origin, "Missing ?project");

	if (!svc?.env?.AIRTABLE_BASE_ID || !(svc?.env?.AIRTABLE_API_KEY || svc?.env?.AIRTABLE_ACCESS_TOKEN)) {
		return ok(svc, origin, { export: { projectId, generatedAt: new Date().toISOString(), codes: [], timeline: [] } });
	}

	try {
		const [codesMap, entries] = await Promise.all([
			fetchCodesByProject(svc, projectId),
			fetchJournalsByProject(svc, projectId)
		]);

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