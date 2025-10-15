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
	try {
		const projectId = url.searchParams.get("project") || "";
		if (!projectId) {
			return svc.json({ ok: true, entries: [] }, 200, svc.corsHeaders(origin));
		}

		// If Airtable creds absent, just return empty (keeps UI alive)
		if (!svc?.env?.AIRTABLE_BASE_ID || !(svc?.env?.AIRTABLE_API_KEY || svc?.env?.AIRTABLE_ACCESS_TOKEN)) {
			return svc.json({ ok: true, entries: [] }, 200, svc.corsHeaders(origin));
		}

		const tableRef = svc.env.AIRTABLE_TABLE_JOURNAL || "Journals";
		const { listAll } = await import("./internals/airtable.js");

		// Filter by either link field name without downloading whole table
		const esc = projectId.replace(/"/g, '\\"');
		const filterByFormula = `OR(FIND("${esc}", ARRAYJOIN(Project)), FIND("${esc}", ARRAYJOIN(Projects)))`;

		const { records } = await listAll(
			svc.env,
			tableRef, { pageSize: 100, filterByFormula },
			svc?.cfg?.TIMEOUT_MS
		);

		const entries = (records || []).map((r) => {
			const f = r.fields || {};
			return {
				id: r.id,
				category: f.Category || "—",
				content: f.Content || f.Body || f.Notes || "",
				tags: Array.isArray(f.Tags) ? f.Tags : String(f.Tags || "")
					.split(",").map(s => s.trim()).filter(Boolean),
				createdAt: r.createdTime || f.Created || ""
			};
		});

		// sort newest first on the client if you prefer; here we keep created order
		return svc.json({ ok: true, entries }, 200, svc.corsHeaders(origin));
	} catch (e) {
		const msg = String(e?.message || e || "");
		svc?.log?.error?.("journals.list.fail", { err: msg });
		const status = /Airtable\s+40[13]/i.test(msg) ? 502 : 500;
		return svc.json({ ok: false, error: "Failed to load journal entries", detail: msg }, status, svc.corsHeaders(origin));
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
 * - Accepts `project` or `project_airtable_id`
 * - Validates category
 * - Tries common link/content field names to match your base
 * - Uses existing Airtable internals: createRecords()
 *
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function createJournalEntry(svc, request, origin) {
	try {
		// Size guard
		const buf = await request.arrayBuffer();
		if (svc?.cfg?.MAX_BODY_BYTES && buf.byteLength > svc.cfg.MAX_BODY_BYTES) {
			svc?.log?.warn?.("request.too_large", { size: buf.byteLength });
			return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
		}

		// Parse JSON
		/** @type {{project?:string, project_airtable_id?:string, category?:string, content?:string, tags?:string[]|string, author?:string, initial_memo?:string}} */
		let p;
		try {
			p = JSON.parse(new TextDecoder().decode(buf));
		} catch {
			return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
		}

		// Inputs
		const projectId = (p.project || p.project_airtable_id || "").trim();
		const category = (p.category || "").trim();
		const content = (p.content || "").trim();

		if (!projectId || !category || !content) {
			return svc.json({
				error: "Missing required fields",
				detail: "project (or project_airtable_id), category, content"
			}, 400, svc.corsHeaders(origin));
		}

		const VALID = ["perceptions", "procedures", "decisions", "introspections"];
		if (!VALID.includes(category)) {
			return svc.json({
				error: "Invalid category",
				detail: `Must be one of: ${VALID.join(", ")}`
			}, 400, svc.corsHeaders(origin));
		}

		// Resolve table strictly per your rule
		const tableRef = svc.env.AIRTABLE_TABLE_JOURNAL || "Journals";

		// Imports present in your repo
		const { createRecords } = await import("./internals/airtable.js");
		const safeText = (x) => {
			try { return String(x ?? ""); } catch { return ""; }
		};

		// Normalise tags (store as comma-delimited text)
		const tagsArr = Array.isArray(p.tags) ?
			p.tags.map(String).map(s => s.trim()).filter(Boolean) :
			String(p.tags || "").split(",").map(s => s.trim()).filter(Boolean);
		const tagsStr = tagsArr.join(", ");

		// Try common schema variants
		const LINK_FIELDS = ["Project", "Projects"];
		const CONTENT_FIELDS = ["Content", "Body", "Notes"];

		for (const linkName of LINK_FIELDS) {
			for (const contentField of CONTENT_FIELDS) {
				const fields = {
					[linkName]: [projectId], // link-to-record (recXXXX… in Projects table)
					Category: category,
					[contentField]: content, // plain text
					Tags: tagsStr,
					Author: p.author || ""
				};

				// Drop empties
				for (const k of Object.keys(fields)) {
					const v = fields[k];
					if (v === undefined || v === null ||
						(typeof v === "string" && v.trim() === "") ||
						(Array.isArray(v) && v.length === 0)) {
						delete fields[k];
					}
				}

				try {
					const result = await createRecords(svc.env, tableRef, [{ fields }], svc?.cfg?.TIMEOUT_MS);
					const entryId = result?.records?.[0]?.id;
					if (!entryId) {
						return svc.json({ error: "Airtable response missing id" }, 502, svc.corsHeaders(origin));
					}

					if (svc.env.AUDIT === "true") {
						svc?.log?.info?.("journal.entry.created", { entryId, linkName, contentField, tableRef });
					}

					// Optional initial memo (best-effort)
					if (p.initial_memo) {
						try {
							const { createMemo } = await import("./reflection/memos.js");
							const memoReq = new Request("https://local/inline", {
								method: "POST",
								headers: { "content-type": "application/json" },
								body: JSON.stringify({
									project_id: projectId,
									memo_type: "analytical",
									content: p.initial_memo,
									linked_entries: [entryId],
									author: p.author
								})
							});
							await createMemo(svc, memoReq, origin);
						} catch (memoErr) {
							svc?.log?.warn?.("journal.entry.memo.create_fail", { err: safeText(memoErr) });
						}
					}

					return svc.json({ ok: true, id: entryId }, 201, svc.corsHeaders(origin));
				} catch (airErr) {
					const msg = safeText(airErr?.message || airErr);

					// If Airtable says "unknown field", try next candidate
					if (/422/.test(msg) && /UNKNOWN_FIELD_NAME/i.test(msg)) {
						continue;
					}

					// Surface the upstream message so client shows more than "Internal error"
					svc?.log?.error?.("airtable.journal.create.fail", { err: msg, linkName, contentField, tableRef });
					return svc.json({ error: "Failed to create journal entry", detail: msg }, 500, svc.corsHeaders(origin));
				}
			}
		}

		// No schema matched
		svc?.log?.error?.("airtable.journal.create.schema_mismatch", { tableRef });
		return svc.json({
			error: "Field configuration error",
			detail: `Ensure "${tableRef}" has a link-to-record to Projects (Project/Projects) and one of: Content/Body/Notes.`
		}, 422, svc.corsHeaders(origin));

	} catch (fatal) {
		// Catch *anything* outside inner try/catches: missing imports, ref errors, etc.
		const msg = (() => { try { return String(fatal?.message || fatal || ""); } catch { return ""; } })();
		svc?.log?.error?.("journal.create.fatal", { err: msg });
		return svc.json({ error: "Internal error", detail: msg }, 500, svc.corsHeaders(origin));
	}
}

export async function diagAirtableCreate(svc, request, origin) {
	try {
		const tableRef = svc.env.AIRTABLE_TABLE_JOURNAL || "Journals";
		const { createRecords } = await import("./internals/airtable.js");

		// Try a minimal create with harmless content, then delete it immediately
		const fields = { Category: "perceptions", Content: "diag ping", Tags: "diag", Author: "diag" };
		const res = await createRecords(svc.env, tableRef, [{ fields }], svc?.cfg?.TIMEOUT_MS);
		const id = res?.records?.[0]?.id || null;

		return svc.json({ ok: true, tableRef, createdId: id }, 200, svc.corsHeaders(origin));
	} catch (e) {
		const msg = String(e?.message || e || "");
		svc?.log?.error?.("diag.airtable.create.fail", { err: msg });
		return svc.json({ ok: false, error: msg }, 500, svc.corsHeaders(origin));
	}
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
