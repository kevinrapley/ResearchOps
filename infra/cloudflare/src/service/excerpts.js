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

import { listAll, createRecords, patchRecords } from "./internals/airtable.js";
import { json as jsonHelper } from "./internals/responders.js";

const TABLE = "Excerpts";

/* ──────────────── CREATE ──────────────── */
/**
 * POST /api/excerpts
 * Body: { entryId, start, end, text, createdAt?, author?, codes?, memos?, muralWidgetId?, syncedAt? }
 */
export async function createExcerpt(service, request, origin) {
	try {
		const body = await request.json().catch(() => ({}));
		const { entryId, start, end, text } = body || {};
		if (!entryId || typeof text !== "string" || !text.trim()) {
			return service.json({ ok: false, error: "entryId and text are required" }, 400, service.corsHeaders(origin));
		}
		if (!Number.isFinite(Number(start)) || !Number.isFinite(Number(end)) || Number(end) <= Number(start)) {
			return service.json({ ok: false, error: "start/end must be integers with end > start" }, 400, service.corsHeaders(origin));
		}

		const fields = {
			"Entry ID": Array.isArray(entryId) ? entryId : [entryId],
			"Start": Number(start),
			"End": Number(end),
			"Text": text,
			"Created At": body.createdAt ?? new Date().toISOString(),
			"Author": body.author ?? null,
			"Codes": body.codes ?? [],
			"Memos": body.memos ?? [],
			"Mural Widget ID": body.muralWidgetId ?? "",
			"Synced At": body.syncedAt ?? null
		};

		const resp = await createRecords(service.env, TABLE, [{ fields }]);
		const record = (resp.records || [])[0] || null;
		return service.json({ ok: true, record }, 201, service.corsHeaders(origin));
	} catch (err) {
		service.log.error("excerpts.create", { err: String(err) });
		return service.json({ ok: false, error: "Internal error" }, 500, service.corsHeaders(origin));
	}
}

/* ──────────────── LIST ──────────────── */
/**
 * GET /api/excerpts?entry=<entryId>
 */
export async function listExcerpts(service, origin, url) {
	try {
		const entryId = url.searchParams.get("entry");
		if (!entryId) {
			return service.json({ ok: false, error: "Missing ?entry" }, 400, service.corsHeaders(origin));
		}

		// Robust filter for a linked-record field
		const extraParams = { filterByFormula: `FIND('${entryId}', ARRAYJOIN({Entry ID}))` };
		const { records } = await listAll(service.env, TABLE, { extraParams });

		return service.json({ ok: true, records }, 200, service.corsHeaders(origin));
	} catch (err) {
		service.log.error("excerpts.list", { err: String(err) });
		return service.json({ ok: false, error: "Internal error" }, 500, service.corsHeaders(origin));
	}
}

/* ──────────────── UPDATE ──────────────── */
/**
 * PATCH /api/excerpts/:id
 */
export async function updateExcerpt(service, request, origin, excerptId) {
	try {
		const body = await request.json().catch(() => ({}));
		if ("start" in body && "end" in body && Number(body.end) <= Number(body.start)) {
			return service.json({ ok: false, error: "end must be greater than start" }, 400, service.corsHeaders(origin));
		}

		const fields = {};
		if ("start" in body) fields["Start"] = Number(body.start);
		if ("end" in body) fields["End"] = Number(body.end);
		if ("text" in body) fields["Text"] = body.text;
		if ("author" in body) fields["Author"] = body.author ?? null;
		if ("codes" in body) fields["Codes"] = body.codes ?? [];
		if ("memos" in body) fields["Memos"] = body.memos ?? [];
		if ("muralWidgetId" in body) fields["Mural Widget ID"] = body.muralWidgetId ?? "";
		if ("syncedAt" in body) fields["Synced At"] = body.syncedAt ?? new Date().toISOString();

		const resp = await patchRecords(service.env, TABLE, [{ id: excerptId, fields }]);
		const record = (resp.records || [])[0] || null;

		return service.json({ ok: true, record }, 200, service.corsHeaders(origin));
	} catch (err) {
		service.log.error("excerpts.update", { err: String(err) });
		return service.json({ ok: false, error: "Internal error" }, 500, service.corsHeaders(origin));
	}
}
