/**
 * @file service/dev/diag.js
 * @summary Diagnostic endpoints for Airtable connectivity and filters.
 *
 * SECURITY: This endpoint is read-only and returns limited metadata and error text.
 *           Keep under a non-guessable path or remove after debugging.
 */

import { makeTableUrl, authHeaders } from "../internals/airtable.js";
import { fetchWithTimeout, safeText } from "../../core/utils.js";

/**
 * GET /api/_diag/airtable?table=<TableName>&project=<recId>&field=Project&nofilter=0
 * - Reads pageSize=3 from the table.
 * - If project+field provided, applies filterByFormula: FIND('<project>', ARRAYJOIN({<field>})).
 * - Always returns diagnostics: url, status, errorText (if any), formula used, and sample field names.
 */
export async function airtableProbe(service, origin, url) {
	const cors = service.corsHeaders(origin);
	const env = service.env;

	const tableParam = url.searchParams.get("table") || env.AIRTABLE_TABLE_CODES || "Codes";
	const project = url.searchParams.get("project") || "";
	const field = url.searchParams.get("field") || "Project";
	const nofilter = url.searchParams.get("nofilter") === "1";
	const timeoutMs = Number(env.TIMEOUT_MS || 15000);

	const baseUrl = makeTableUrl(env, tableParam);
	const params = new URLSearchParams({ pageSize: "3" });

	let formula = "";
	if (project && !nofilter) {
		formula = `FIND('${project}', ARRAYJOIN({${field}}))`;
		params.set("filterByFormula", formula);
	}

	const reqUrl = `${baseUrl}?${params.toString()}`;

	try {
		const res = await fetchWithTimeout(reqUrl, { headers: authHeaders(env) }, timeoutMs);
		const text = await res.text();
		let json;
		try { json = JSON.parse(text); } catch { json = null; }

		// Extract sample field names if records exist
		const sample = Array.isArray(json?.records) && json.records[0]?.fields ?
			Object.keys(json.records[0].fields) :
			[];

		return service.json({
			ok: res.ok,
			status: res.status,
			table: tableParam,
			formula,
			requestUrl: reqUrl,
			sampleFieldNames: sample,
			recordCount: Array.isArray(json?.records) ? json.records.length : 0,
			body: json ?? safeText(text)
		}, res.ok ? 200 : 502, cors);
	} catch (err) {
		// Network/timeouts or thrown by fetchWithTimeout
		return service.json({
			ok: false,
			status: 0,
			table: tableParam,
			formula,
			requestUrl: reqUrl,
			diag: String(err)
		}, 502, cors);
	}
}
