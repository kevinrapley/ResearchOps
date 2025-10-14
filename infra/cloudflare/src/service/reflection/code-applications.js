/**
 * @file src/service/reflection/code-applications.js
 * @module service/reflection/code-applications
 * @summary List Code Applications linked to a Project (CAQDAS support).
 *
 * Route: GET /api/code-applications?project=<AirtableProjectId>
 *
 * Response (200):
 *   { ok:true, applications: [{ id, name, vendor, status, createdAt }] }
 */

import { listAll } from "../internals/airtable.js";

/**
 * Handler: GET /api/code-applications
 * @param {import("../index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function listCodeApplications(svc, origin, url) {
	const projectId = url.searchParams.get("project") || "";

	if (!projectId) {
		return svc.json({ ok: false, error: "Missing ?project" }, 400, svc.corsHeaders(origin));
	}

	// Dev-friendly: if Airtable bindings are missing, succeed with empty payload.
	if (!svc?.env?.AIRTABLE_API_KEY || !svc?.env?.AIRTABLE_BASE_ID) {
		return svc.json({ ok: true, applications: [] }, 200, svc.corsHeaders(origin));
	}

	const tableName = svc.env.AIRTABLE_TABLE_CODE_APPS || "Code Applications";

	// Pull (paged) records. Filtering is done client-side for reliability across link-field variants.
	const { records } = await listAll(svc.env, tableName, { pageSize: 100 }, svc.cfg.TIMEOUT_MS);

	const LINK_FIELDS = ["Project", "Projects"]; // tolerate single or multi link field names
	const out = [];

	for (const r of records) {
		const f = r?.fields || {};

		// Identify matching links to the given projectId, across "Project" or "Projects" variants.
		let linked = false;
		for (const lf of LINK_FIELDS) {
			const v = f[lf];
			if (Array.isArray(v) && v.includes(projectId)) {
				linked = true;
				break;
			}
		}
		if (!linked) continue;

		out.push({
			id: r.id,
			name: f.Name || f.Application || f.App || "—",
			vendor: f.Vendor || f.Supplier || "—",
			status: f.Status || "unknown",
			createdAt: r.createdTime || f.CreatedAt || ""
		});
	}

	// Sort newest first for a stable UI.
	out.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

	return svc.json({ ok: true, applications: out }, 200, svc.corsHeaders(origin));
}
