/**
 * @file src/service/reflection/code-applications.js
 * @module service/code-applications
 * @summary List Code Applications for a given Project.
 *
 * Route: GET /api/code-applications?project=<AirtableProjectId>
 *
 * Output (200):
 * [
 *   { id, name, vendor, status, createdAt }
 * ]
 */

import { json } from "../internals/responders.js";
import { listRecords } from "../internals/airtable.js";

/**
 * Handler: GET /api/code-applications
 * @param {import('../index.js').ResearchOpsService} svc
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function listCodeApplications(svc, origin, url) {
	const projectId =
		url.searchParams.get("project") ||
		url.searchParams.get("pid") ||
		"";

	if (!projectId) {
		return json({ error: "Missing ?project" }, 400);
	}

	// Dev-friendly behaviour when Airtable isn’t configured.
	if (!svc?.env?.AIRTABLE_API_KEY || !svc?.env?.AIRTABLE_BASE_ID) {
		return json([], 200, {
			"cache-control": "no-store",
			"x-dev-note": "Airtable not configured; returning []"
		});
	}

	// ── Airtable config
	const table = "Code Applications";
	const view = "Grid view";

	// If {Project} is a linked-record field, FIND against ARRAYJOIN is robust.
	const filterByFormula = `FIND('${projectId}', ARRAYJOIN({Project}))`;

	const { ok, records, status, error } = await listRecords(svc.env, {
		table,
		view,
		filterByFormula
	});

	if (!ok) {
		return json({ error: error || "Upstream Airtable error" }, status || 502);
	}

	const out = records.map(r => ({
		id: r.id,
		name: r.fields?.Name ?? r.fields?.name ?? "—",
		vendor: r.fields?.Vendor ?? r.fields?.vendor ?? "—",
		status: r.fields?.Status ?? r.fields?.status ?? "unknown",
		createdAt: r.createdTime
	}));

	return json(out, 200, { "cache-control": "no-store" });
}
