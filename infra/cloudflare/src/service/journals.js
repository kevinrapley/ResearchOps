/**
 * @file src/service/journals.js
 * @module service/journals
 * @summary Reflexive journal handling for qualitative research.
 */

import { fetchWithTimeout, safeText, toMs, mdToAirtableRich } from "../core/utils.js";
import { airtableCreate, isTableId, listAll, getRecord, createRecords, patchRecords, deleteRecord } from "./internals/airtable.js";

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
 * Get memos linked to a specific journal entry
 * @param {string} entryId - Journal entry ID
 * @returns {Promise<Array>} Related memos
 */
export async function getRelatedMemos(svc, origin, entryId) {
	// Import listMemos from memos module
	const { listMemos } = await import('./reflection/memos.js');

	// Create URL with entry filter
	const url = new URL(`${svc.env.API_BASE}/api/memos`);
	url.searchParams.set('project', svc.env.CURRENT_PROJECT_ID);
	url.searchParams.set('entry', entryId);

	return listMemos(svc, origin, url);
}

/**
 * Create a memo linked to this journal entry
 * @param {Object} journalEntry - The journal entry to link
 * @param {Object} memoData - Memo content and type
 */
export async function createLinkedMemo(svc, request, origin, entryId) {
	const { createMemo } = await import('./reflection/memos.js');

	// Parse the incoming memo data
	const body = await request.json();

	// Ensure the memo is linked to this entry
	const memoPayload = {
		...body,
		linked_entries: [entryId, ...(body.linked_entries || [])]
	};

	// Create new request with modified payload
	const memoRequest = new Request(request.url, {
		method: 'POST',
		headers: request.headers,
		body: JSON.stringify(memoPayload)
	});

	return createMemo(svc, memoRequest, origin);
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

	const entry = {
		id: rec.id,
		category: f.Category || "procedures",
		content: f.Content || "",
		tags: tags,
		author: f.Author || "",
		createdAt: rec.createdTime || ""
	};

	// Optionally include related memos
	if (url.searchParams.get('include_memos') === 'true') {
		const memosResponse = await getRelatedMemos(svc, origin, entryId);
		const memosData = await memosResponse.json();
		entry.relatedMemos = memosData.memos || [];
	}

	return svc.json({ ok: true, entry }, 200, svc.corsHeaders(origin));
}

/**
 * Create a journal entry.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function createJournalEntry(svc, request, origin) {
	// Size guard
	const bodyBuf = await request.arrayBuffer();
	if (svc?.cfg?.MAX_BODY_BYTES && bodyBuf.byteLength > svc.cfg.MAX_BODY_BYTES) {
		svc?.log?.warn?.("request.too_large", { size: bodyBuf.byteLength });
		return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
	}

	// Parse JSON
	/** @type {{project?:string, project_airtable_id?:string, category?:string, content?:string, tags?:string[]|string, author?:string, initial_memo?:string}} */
	let p;
	try {
		p = JSON.parse(new TextDecoder().decode(bodyBuf));
	} catch {
		return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
	}

	// Accept both keys for compatibility
	const projectId = (p.project || p.project_airtable_id || "").trim();
	const category = (p.category || "").trim();
	const content = (p.content || "").trim();

	if (!projectId || !category || !content) {
		return svc.json({
			error: "Missing required fields",
			detail: "project (or project_airtable_id), category, content"
		}, 400, svc.corsHeaders(origin));
	}

	// Validate category
	const VALID = ["perceptions", "procedures", "decisions", "introspections"];
	if (!VALID.includes(category)) {
		return svc.json({
			error: "Invalid category",
			detail: `Must be one of: ${VALID.join(", ")}`
		}, 400, svc.corsHeaders(origin));
	}

	// Table resolution (prefer ID over name)
	const tableRef =
		(svc.env.AIRTABLE_TABLE_JOURNALS_ID && /^tbl\w+/i.test(svc.env.AIRTABLE_TABLE_JOURNALS_ID)) ?
		svc.env.AIRTABLE_TABLE_JOURNALS_ID :
		(svc.env.AIRTABLE_TABLE_JOURNALS || "Journal Entries");

	// Optional helpers
	let toRich;
	try {
		const { mdToAirtableRich } = await import("./internals/richtext.js");
		toRich = mdToAirtableRich;
	} catch {
		toRich = (s) => s; // plain text fallback
	}

	// Import Airtable client
	const { createRecords } = await import("./internals/airtable.js");
	const { safeText } = await import("./internals/util.js").catch(() => ({ safeText: (x) => String(x || "") }));

	// Tags: accept array or comma-delimited string; use comma-delimited text by default
	const tagsArray = Array.isArray(p.tags) ?
		p.tags.map(String).map(s => s.trim()).filter(Boolean) :
		String(p.tags || "").split(",").map(s => s.trim()).filter(Boolean);
	const tagsText = tagsArray.join(", ");

	// We will try combinations of link-field and content-field names to match your base
	const LINK_FIELDS = ["Project", "Projects"];
	const CONTENT_FIELDS = ["Content", "Body", "Notes"];

	for (const linkName of LINK_FIELDS) {
		for (const contentField of CONTENT_FIELDS) {
			/** @type {Record<string, any>} */
			const fields = {
				[linkName]: [projectId], // link to Projects table record (recXXXX)
				Category: category,
				[contentField]: toRich(content),
				Tags: tagsText,
				Author: p.author || ""
			};

			// Drop empty values so we don't upset Airtable
			for (const k of Object.keys(fields)) {
				const v = fields[k];
				if (
					v === undefined ||
					v === null ||
					(typeof v === "string" && v.trim() === "") ||
					(Array.isArray(v) && v.length === 0)
				) {
					delete fields[k];
				}
			}

			try {
				const result = await createRecords(svc.env, tableRef, [{ fields }], svc?.cfg?.TIMEOUT_MS);
				const id = result?.records?.[0]?.id;
				if (!id) {
					return svc.json({ error: "Airtable response missing id" }, 502, svc.corsHeaders(origin));
				}

				if (svc.env.AUDIT === "true") {
					svc?.log?.info?.("journal.entry.created", { id, category, linkName, contentField, tableRef });
				}

				// Optional follow-on memo (kept synchronous here; ignore failures)
				if (p.initial_memo) {
					try {
						const { createMemo } = await import("./reflection/memos.js");
						const memoReq = new Request("https://internal.local/inline", {
							method: "POST",
							headers: { "content-type": "application/json" },
							body: JSON.stringify({
								project_id: projectId,
								memo_type: "analytical",
								content: p.initial_memo,
								linked_entries: [id],
								author: p.author
							})
						});
						await createMemo(svc, memoReq, origin);
					} catch (memoErr) {
						svc?.log?.warn?.("journal.entry.memo.create_fail", { err: String(memoErr || "") });
					}
				}

				return svc.json({ ok: true, id }, 201, svc.corsHeaders(origin));
			} catch (err) {
				const msg = String(err?.message || err || "");
				// If the failure is clearly about an unknown field, try the next candidate
				if (/422/.test(msg) && /UNKNOWN_FIELD_NAME/i.test(msg)) {
					continue;
				}
				// Otherwise, surface the upstream error text for fast diagnosis
				svc?.log?.error?.("airtable.journal.create.fail", { err: msg, linkName, contentField, tableRef });
				return svc.json({
					error: "Failed to create journal entry",
					detail: safeText ? safeText(msg) : msg
				}, 500, svc.corsHeaders(origin));
			}
		}
	}

	// If we got here, neither Project/Projects nor Content/Body/Notes matched your base
	svc?.log?.error?.("airtable.journal.create.link_or_content_field.none_matched", { tableRef });
	return svc.json({
		error: "Field configuration error",
		detail: `No matching link/content field names found. Add a link-to-record field in "${tableRef}" that links to Projects (try: ${LINK_FIELDS.join(", ")}), and ensure one of ${CONTENT_FIELDS.join(", ")} exists.`
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

const ENTRY_TYPES = {
	JOURNAL: ['perceptions', 'procedures', 'decisions', 'introspections'],
	MEMO: ['analytical', 'methodological', 'theoretical', 'reflexive']
};

// Allow memos to link to specific codes or journal entries
export async function createMemo(svc, request, origin) {
	const body = await request.json();

	const fields = {
		Project: [body.project_id],
		Type: 'memo',
		MemoType: body.memo_type,
		Content: mdToAirtableRich(body.content),
		LinkedEntries: body.linked_entries || [],
		LinkedCodes: body.linked_codes || [],
		Author: body.author
	};

	// Rest of creation logic...
}
