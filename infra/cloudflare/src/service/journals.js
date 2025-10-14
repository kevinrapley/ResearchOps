/**
 * @file src/service/journals.js
 * @module service/journals
 * @summary Reflexive journal handling for qualitative research.
 */

import { fetchWithTimeout, safeText, toMs, mdToAirtableRich } from "../core/utils.js";
import { listAll, getRecord, createRecords, patchRecords, deleteRecord } from "./internals/airtable.js";

/**
 * List journal entries for a project.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function listJournalEntries(svc, origin, url) {
	const projectId = url.searchParams.get("project");
	if (!projectId) {
		return svc.json({ ok: false, error: "Missing project query" }, 400, svc.corsHeaders(origin));
	}

	try {
		const tableName = svc.env.AIRTABLE_TABLE_JOURNAL || "Journal Entries";
		const { records } = await listAll(svc.env, tableName, { pageSize: 100 }, svc.cfg.TIMEOUT_MS);

		// Filter to this project (handle "Project" or "Projects" field name)
		const LINK_FIELDS = ["Project", "Projects"];
		const entries = [];

		for (const r of records) {
			const f = r.fields || {};
			const linkKey = LINK_FIELDS.find(k => Array.isArray(f[k]));
			const linkArr = linkKey ? f[linkKey] : undefined;

			if (Array.isArray(linkArr) && linkArr.includes(projectId)) {
				// Parse tags (could be comma-separated string or array)
				let tags = [];
				if (Array.isArray(f.Tags)) {
					tags = f.Tags;
				} else if (typeof f.Tags === 'string') {
					tags = f.Tags.split(',').map(t => t.trim()).filter(Boolean);
				}

				entries.push({
					id: r.id,
					category: f.Category || "procedures",
					content: f.Content || "",
					tags: tags,
					author: f.Author || "",
					createdAt: r.createdTime || ""
				});
			}
		}

		// Sort newest first
		entries.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
		return svc.json({ ok: true, entries }, 200, svc.corsHeaders(origin));

	} catch (err) {
		svc.log.error("journal.list.error", { err: String(err?.message || err) });
		return svc.json({
			ok: false,
			error: "Failed to list journal entries",
			detail: String(err?.message || err)
		}, 500, svc.corsHeaders(origin));
	}
}

/**
 * Get a single journal entry by ID.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {string} entryId
 * @returns {Promise<Response>}
 */
export async function getJournalEntry(svc, origin, entryId) {
	if (!entryId) {
		return svc.json({ error: "Missing entry id" }, 400, svc.corsHeaders(origin));
	}

	try {
		const tableName = svc.env.AIRTABLE_TABLE_JOURNAL || "Journal Entries";
		const rec = await getRecord(svc.env, tableName, entryId, svc.cfg.TIMEOUT_MS);

		if (!rec) {
			return svc.json({
				error: "Entry not found",
				detail: `No record found with id: ${entryId}`
			}, 404, svc.corsHeaders(origin));
		}

		const f = rec.fields || {};

		// Parse tags
		let tags = [];
		if (Array.isArray(f.Tags)) {
			tags = f.Tags;
		} else if (typeof f.Tags === 'string') {
			tags = f.Tags.split(',').map(t => t.trim()).filter(Boolean);
		}

		const entry = {
			id: rec.id,
			category: f.Category || "procedures",
			content: f.Content || "",
			tags: tags,
			author: f.Author || "",
			createdAt: rec.createdTime || ""
		};

		return svc.json({ ok: true, entry }, 200, svc.corsHeaders(origin));

	} catch (err) {
		svc.log.error("journal.get.error", { err: String(err?.message || err), entryId });

		const msg = String(err?.message || "");
		const isNotFound = /404|NOT_FOUND/i.test(msg);

		return svc.json({ error: isNotFound ? "Entry not found" : "Internal server error", detail: msg },
			isNotFound ? 404 : 500,
			svc.corsHeaders(origin)
		);
	}
}

/**
 * Create a journal entry.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function createJournalEntry(svc, request, origin) {
	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) {
		svc.log.warn("request.too_large", { size: body.byteLength });
		return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
	}

	let p;
	try {
		p = JSON.parse(new TextDecoder().decode(body));
	} catch {
		return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
	}

	if (!p.project_airtable_id || !p.category || !p.content) {
		return svc.json({
			error: "Missing required fields: project_airtable_id, category, content"
		}, 400, svc.corsHeaders(origin));
	}

	// Validate category
	const validCategories = ["perceptions", "procedures", "decisions", "introspections"];
	if (!validCategories.includes(p.category)) {
		return svc.json({
			error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
		}, 400, svc.corsHeaders(origin));
	}

	// Try multiple link field name candidates
	const LINK_FIELDS = ["Project", "Projects"];
	const tableName = svc.env.AIRTABLE_TABLE_JOURNAL || "Journal Entries";

	for (const linkName of LINK_FIELDS) {
		// Format tags for Airtable (comma-separated string)
		const tagsStr = Array.isArray(p.tags) ? p.tags.join(', ') : String(p.tags || '');

		const fields = {
			[linkName]: [p.project_airtable_id],
			Category: p.category,
			Content: mdToAirtableRich(p.content),
			Tags: tagsStr,
			Author: p.author || ""
		};

		// Remove empty fields
		for (const k of Object.keys(fields)) {
			const v = fields[k];
			if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
				delete fields[k];
			}
		}

		try {
			const result = await createRecords(svc.env, tableName, [{ fields }], svc.cfg.TIMEOUT_MS);
			const id = result.records?.[0]?.id;

			if (!id) {
				return svc.json({ error: "Airtable response missing id" }, 502, svc.corsHeaders(origin));
			}

			if (svc.env.AUDIT === "true") {
				svc.log.info("journal.entry.created", { id, category: p.category, linkName });
			}

			return svc.json({ ok: true, id }, 200, svc.corsHeaders(origin));

		} catch (err) {
			const msg = String(err?.message || "");

			// If UNKNOWN_FIELD_NAME, try next candidate
			if (msg.includes("422") && /UNKNOWN_FIELD_NAME/i.test(msg)) {
				continue;
			}

			// Other error - bail out
			svc.log.error("airtable.journal.create.fail", { err: msg });
			return svc.json({
				error: "Failed to create journal entry",
				detail: safeText(msg)
			}, 500, svc.corsHeaders(origin));
		}
	}

	// No link field matched
	svc.log.error("airtable.journal.create.linkfield.none_matched");
	return svc.json({
		error: "Field configuration error",
		detail: `No matching link field name found. Add a link-to-record field in Journal Entries table that links to Projects. Try: ${LINK_FIELDS.join(", ")}`
	}, 422, svc.corsHeaders(origin));
}

/**
 * Update a journal entry (partial).
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @param {string} entryId
 * @returns {Promise<Response>}
 */
export async function updateJournalEntry(svc, request, origin, entryId) {
	if (!entryId) {
		return svc.json({ error: "Missing entry id" }, 400, svc.corsHeaders(origin));
	}

	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) {
		svc.log.warn("request.too_large", { size: body.byteLength });
		return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
	}

	let p;
	try {
		p = JSON.parse(new TextDecoder().decode(body));
	} catch {
		return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
	}

	const fields = {};

	if (typeof p.category === "string") {
		const validCategories = ["perceptions", "procedures", "decisions", "introspections"];
		if (!validCategories.includes(p.category)) {
			return svc.json({
				error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
			}, 400, svc.corsHeaders(origin));
		}
		fields.Category = p.category;
	}

	if (typeof p.content === "string") {
		fields.Content = mdToAirtableRich(p.content);
	}

	if (p.tags !== undefined) {
		const tagsStr = Array.isArray(p.tags) ? p.tags.join(', ') : String(p.tags || '');
		fields.Tags = tagsStr;
	}

	if (Object.keys(fields).length === 0) {
		return svc.json({ error: "No updatable fields provided" }, 400, svc.corsHeaders(origin));
	}

	try {
		const tableName = svc.env.AIRTABLE_TABLE_JOURNAL || "Journal Entries";
		await patchRecords(svc.env, tableName, [{ id: entryId, fields }], svc.cfg.TIMEOUT_MS);

		if (svc.env.AUDIT === "true") {
			svc.log.info("journal.entry.updated", { entryId, fields });
		}

		return svc.json({ ok: true }, 200, svc.corsHeaders(origin));

	} catch (err) {
		svc.log.error("journal.update.error", { err: String(err?.message || err), entryId });
		return svc.json({
			error: "Failed to update journal entry",
			detail: safeText(String(err?.message || err))
		}, 500, svc.corsHeaders(origin));
	}
}

/**
 * Delete a journal entry.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {string} entryId
 * @returns {Promise<Response>}
 */
export async function deleteJournalEntry(svc, origin, entryId) {
	if (!entryId) {
		return svc.json({ error: "Missing entry id" }, 400, svc.corsHeaders(origin));
	}

	try {
		const tableName = svc.env.AIRTABLE_TABLE_JOURNAL || "Journal Entries";
		await deleteRecord(svc.env, tableName, entryId, svc.cfg.TIMEOUT_MS);

		if (svc.env.AUDIT === "true") {
			svc.log.info("journal.entry.deleted", { entryId });
		}

		return svc.json({ ok: true }, 200, svc.corsHeaders(origin));

	} catch (err) {
		svc.log.error("journal.delete.error", { err: String(err?.message || err), entryId });
		return svc.json({
			error: "Failed to delete journal entry",
			detail: safeText(String(err?.message || err))
		}, 500, svc.corsHeaders(origin));
	}
}
