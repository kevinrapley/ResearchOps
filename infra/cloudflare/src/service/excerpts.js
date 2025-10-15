/**
 * @file service/excerpts.js
 * @summary Service layer for the "Excerpts" Airtable table.
 *
 * Airtable Table: Excerpts
 * Fields:
 *  - Excerpt (Formula primary)
 *  - Entry ID           (Link → Journal Entries)
 *  - Start              (Number)
 *  - End                (Number)
 *  - Text               (Long text)
 *  - Created At         (Created time or ISO string)
 *  - Author             (Single line text)
 *  - Codes              (Link → Codes)
 *  - Memos              (Link → Memos)
 *  - Mural Widget ID    (Text)
 *  - Synced At          (Date)
 */

import { getRecord } from "./internals/airtable.js";
import { json as jsonHelper } from "./internals/responders.js";

/* ──────────────── CREATE ──────────────── */
/**
 * POST /api/excerpts
 * Body: { entryId, start, end, text, createdAt?, author?, codes?, memos?, muralWidgetId?, syncedAt? }
 */
export async function createExcerpt(request, origin) {
	let body;
	try {
		body = await request.json();
	} catch {
		return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
	}

	if (!body.entryId || typeof body.text !== "string") {
		return jsonResponse({ ok: false, error: "Missing required fields" }, 400);
	}

	const fields = {
		"Entry ID": Array.isArray(body.entryId) ? body.entryId : [body.entryId],
		"Start": Number(body.start) || 0,
		"End": Number(body.end) || 0,
		"Text": body.text,
		"Created At": body.createdAt || new Date().toISOString(),
		"Author": body.author || "Unknown",
		"Codes": body.codes || [],
		"Memos": body.memos || [],
		"Mural Widget ID": body.muralWidgetId || "",
		"Synced At": body.syncedAt || null
	};

	const record = await airtable.create("Excerpts", fields);
	return jsonResponse({ ok: true, record }, 201);
}

/* ──────────────── LIST ──────────────── */
/**
 * GET /api/excerpts?entry=<entryId>
 */
export async function listExcerpts(origin, url) {
	const entryId = url.searchParams.get("entry");
	if (!entryId) {
		return jsonResponse({ ok: false, error: "Missing ?entry parameter" }, 400);
	}

	const filterByFormula = `{Entry ID} = '${entryId}'`;
	const records = await airtable.list("Excerpts", {
		maxRecords: 1000,
		filterByFormula
	});

	return jsonResponse({ ok: true, records });
}

/* ──────────────── UPDATE ──────────────── */
/**
 * PATCH /api/excerpts/:id
 */
export async function updateExcerpt(request, origin, excerptId) {
	let body;
	try {
		body = await request.json();
	} catch {
		return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
	}

	const fields = {};

	if ("start" in body) fields["Start"] = Number(body.start);
	if ("end" in body) fields["End"] = Number(body.end);
	if ("text" in body) fields["Text"] = body.text;
	if ("author" in body) fields["Author"] = body.author;
	if ("codes" in body) fields["Codes"] = body.codes || [];
	if ("memos" in body) fields["Memos"] = body.memos || [];
	if ("muralWidgetId" in body) fields["Mural Widget ID"] = body.muralWidgetId || "";
	if ("syncedAt" in body) fields["Synced At"] = body.syncedAt || new Date().toISOString();

	const record = await airtable.update("Excerpts", excerptId, fields);
	return jsonResponse({ ok: true, record });
}
