/**
 * @file src/service/reflection/code-applications.js
 * @module service/reflection/code-applications
 * @summary List Code Applications linked to a Project (CAQDAS support).
 *
 * Route: GET /api/code-applications?project=<AirtableProjectId>
 *
 * Success (200): { ok:true, applications:[{ id, name, vendor, status, createdAt }] }
 * Failure (4xx/5xx): { ok:false, error:"..." }
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

	// 400 — client error (missing param)
	if (!projectId) {
		return svc.json({ ok: false, error: "Missing ?project" }, 400, svc.corsHeaders(origin));
	}

	// 200 — dev-friendly empty payload if Airtable bindings aren’t present
	if (!svc?.env?.AIRTABLE_API_KEY || !svc?.env?.AIRTABLE_BASE_ID) {
		return svc.json({ ok: true, applications: [] }, 200, svc.corsHeaders(origin));
	}

	const tableName =
		svc.env.AIRTABLE_TABLE_CODE_APPLICATIONS ||
		svc.env.AIRTABLE_TABLE_CODE_APPS ||
		"Code Applications";

	try {
		// Pull all rows; filter client-side to tolerate linked-record field variants.
		const { records } = await listAll(
			svc.env,
			tableName, { pageSize: 100 }, // no extraParams; some bases use views that hide links
			svc.cfg.TIMEOUT_MS
		);

		const LINK_FIELDS = ["Project", "Projects"]; // single or multi link
		const out = [];

		for (const r of records) {
			const f = r?.fields || {};
			// detect a link match across tolerated field names
			const linked = LINK_FIELDS.some((lf) => Array.isArray(f[lf]) && f[lf].includes(projectId));
			if (!linked) continue;

			out.push({
				id: r.id,
				name: f.Name || f.Application || f.App || "—",
				vendor: f.Vendor || f.Supplier || "—",
				status: f.Status || "unknown",
				createdAt: r.createdTime || f.CreatedAt || ""
			});
		}

		// newest first
		out.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

		return svc.json({ ok: true, applications: out }, 200, svc.corsHeaders(origin));
	} catch (err) {
		// 502/500 — upstream or unexpected
		const status = /Airtable\s+(\d{3})/.test(String(err)) ? 502 : 500;
		svc.log?.error?.("codeApplications.error", { err: String(err) });
		return svc.json({ ok: false, error: String(err) }, status, svc.corsHeaders(origin));
	}
}