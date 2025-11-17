/**
 * @file src/service/journals.js
 * @module service/journals
 * @summary Reflexive journal handling for qualitative research.
 */

import { fetchWithTimeout, safeText, toMs, mdToAirtableRich } from "../core/utils.js";
import { listAll, getRecord, createRecords, patchRecords, deleteRecord } from "./internals/airtable.js";
import {
	d1ListJournalEntriesByLocalProject,
	d1InsertJournalEntry,
	d1UpdateJournalEntry,
	d1DeleteJournalEntry
} from "./internals/researchops-d1.js";

/* ───────────────────────────── helpers / constants ───────────────────────────── */

const VALID_CATEGORIES = ["perceptions", "procedures", "decisions", "introspections"];

/** Resolve the Airtable table name consistently across all ops */
function resolveJournalTable(env) {
	// Single source of truth. Your base uses "Journals"; keep that as primary.
	return env.AIRTABLE_TABLE_JOURNAL || "Journals";
}

function hasAirtable(env) {
	return !!(env?.AIRTABLE_BASE_ID && (env?.AIRTABLE_API_KEY || env?.AIRTABLE_ACCESS_TOKEN));
}

function hasD1(env) {
	return !!env?.RESEARCHOPS_D1;
}

/**
 * Normalise `tags` to an array of trimmed strings.
 * @param {string[] | string | undefined | null} value
 * @returns {string[]}
 */
function normaliseTagsArray(value) {
	if (Array.isArray(value)) {
		return value.map(String).map(s => s.trim()).filter(Boolean);
	}
	if (!value) return [];
	return String(value)
		.split(",")
		.map(s => s.trim())
		.filter(Boolean);
}

/* ───────────────────────────────────── routes ─────────────────────────────────── */

/**
 * List journal entries for a project.
 * Preferred query param is the local project id (UUID) used in the UI:
 *   /api/journal-entries?project={localProjectId}
 *
 * Behaviour:
 *  - Airtable present and OK → read from Airtable.
 *  - Airtable missing or errors → fallback to D1 using local_project_id.
 *
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function listJournalEntries(svc, origin, url) {
	const projectId = url.searchParams.get("project") || "";
	if (!projectId) {
		return svc.json({ ok: true, entries: [] }, 200, svc.corsHeaders(origin));
	}

	const tableRef = resolveJournalTable(svc.env);
	const useAirtable = hasAirtable(svc.env);
	const useD1 = hasD1(svc.env);

	// If no Airtable credentials but D1 exists, serve from D1 only
	if (!useAirtable && useD1) {
		try {
			const entries = await d1ListJournalEntriesByLocalProject(svc.env, projectId);
			return svc.json({ ok: true, source: "d1-only", entries }, 200, svc.corsHeaders(origin));
		} catch (e) {
			const msg = String(e?.message || e || "");
			svc?.log?.error?.("journals.list.d1.fail", { err: msg, projectId });
			return svc.json({ ok: false, error: "Failed to load journal entries", detail: msg },
				500,
				svc.corsHeaders(origin)
			);
		}
	}

	try {
		if (!useAirtable) {
			// No Airtable and no D1 -> empty, but don’t crash the UI
			return svc.json({ ok: true, entries: [] }, 200, svc.corsHeaders(origin));
		}

		// Airtable path
		const res = await listAll(svc.env, tableRef, { pageSize: 100 }, svc?.cfg?.TIMEOUT_MS);

		// Tolerate helper returning either {records} or an array
		const records = Array.isArray(res?.records) ? res.records :
			Array.isArray(res) ? res : [];

		const entries = [];
		for (const r of records) {
			const f = r?.fields || {};
			const projects = Array.isArray(f.Project) ? f.Project :
				Array.isArray(f.Projects) ? f.Projects : [];
			if (!projects.includes(projectId)) continue;

			const tags = Array.isArray(f.Tags) ?
				f.Tags :
				String(f.Tags || "").split(",").map(s => s.trim()).filter(Boolean);

			entries.push({
				id: r.id,
				category: f.Category || "—",
				content: f.Content || f.Body || f.Notes || "",
				tags,
				createdAt: r.createdTime || f.Created || ""
			});
		}

		return svc.json({ ok: true, source: "airtable", entries }, 200, svc.corsHeaders(origin));
	} catch (e) {
		const msg = String(e?.message || e || "");
		svc?.log?.error?.("journals.list.fail", { err: msg, projectId, tableRef });

		// Airtable failed; try D1 fallback if available
		if (useD1) {
			try {
				const entries = await d1ListJournalEntriesByLocalProject(svc.env, projectId);
				return svc.json({
					ok: true,
					source: "d1-fallback",
					entries,
					warning: "Airtable read failed; served from D1 cache"
				}, 200, svc.corsHeaders(origin));
			} catch (d1Err) {
				const d1Msg = String(d1Err?.message || d1Err || "");
				svc?.log?.error?.("journals.list.d1.fallback_fail", { err: d1Msg, projectId });
				const status = /Airtable\s+40[13]/i.test(msg) ? 502 : 500;
				return svc.json({
					ok: false,
					error: "Failed to load journal entries",
					detail: msg,
					d1_detail: d1Msg
				}, status, svc.corsHeaders(origin));
			}
		}

		const status = /Airtable\s+40[13]/i.test(msg) ? 502 : 500;
		return svc.json({ ok: false, error: "Failed to load journal entries", detail: msg },
			status,
			svc.corsHeaders(origin)
		);
	}
}

/**
 * Get memos linked to a specific journal entry
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {string} entryId - Journal entry ID
 * @returns {Promise<Response>} Response with memos JSON
 */
export async function getRelatedMemos(svc, origin, entryId) {
	const { listMemos } = await import("./reflection/memos.js");
	// Build a local URL for listMemos; rely on service to read search params
	const url = new URL("/api/memos", "https://local/");
	url.searchParams.set("entry", entryId);
	return listMemos(svc, origin, url);
}

/**
 * Create a memo linked to this journal entry
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @param {string} entryId
 */
export async function createLinkedMemo(svc, request, origin, entryId) {
	const { createMemo } = await import("./reflection/memos.js");

	// Parse the incoming memo data
	const body = await request.json();

	// Ensure the memo is linked to this entry
	const memoPayload = {
		...body,
		linked_entries: [entryId, ...(body.linked_entries || [])]
	};

	// Create new request with modified payload
	const memoRequest = new Request(request.url, {
		method: "POST",
		headers: request.headers,
		body: JSON.stringify(memoPayload)
	});

	return createMemo(svc, memoRequest, origin);
}

/**
 * Get a single journal entry by ID.
 * (Still Airtable-only for now; D1 could be added as a future fallback.)
 *
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
		const tableRef = resolveJournalTable(svc.env);
		const rec = await getRecord(svc.env, tableRef, entryId, svc?.cfg?.TIMEOUT_MS);

		if (!rec) {
			return svc.json({
				error: "Entry not found",
				detail: `No record found with id: ${entryId}`
			}, 404, svc.corsHeaders(origin));
		}

		const f = rec.fields || {};
		let tags = [];
		if (Array.isArray(f.Tags)) {
			tags = f.Tags;
		} else if (typeof f.Tags === "string") {
			tags = f.Tags.split(",").map(t => t.trim()).filter(Boolean);
		}

		const entry = {
			id: rec.id,
			category: f.Category || "procedures",
			content: f.Content || f.Body || f.Notes || "",
			tags,
			author: f.Author || "",
			createdAt: rec.createdTime || ""
		};

		return svc.json({ ok: true, entry }, 200, svc.corsHeaders(origin));

	} catch (err) {
		svc?.log?.error?.("journal.get.error", { err: String(err?.message || err), entryId });
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
 * - Accepts `project` or `project_airtable_id` for Airtable link.
 * - Optionally accepts `project_local_id` (UUID) to help D1 mirror writes.
 * - Validates category.
 * - Tries common link/content field names to match your base.
 * - Uses existing Airtable internals: createRecords().
 * - On success, mirrors into D1 (if RESEARCHOPS_D1 is bound).
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
		/** @type {{
			project?:string,
			project_airtable_id?:string,
			project_local_id?:string,
			category?:string,
			content?:string,
			tags?:string[]|string,
			author?:string,
			initial_memo?:string
		}} */
		let p;
		try {
			p = JSON.parse(new TextDecoder().decode(buf));
		} catch {
			return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
		}

		// Inputs
		const projectInput = (p.project || p.project_airtable_id || "").trim();
		const projectLocalId = (p.project_local_id || (!projectInput.startsWith("rec") ? projectInput : "") || "").trim();
		const projectId = projectInput; // used for Airtable link
		const category = (p.category || "").trim();
		const content = (p.content || "").trim();

		if (!projectId || !category || !content) {
			return svc.json({
				error: "Missing required fields",
				detail: "project (or project_airtable_id), category, content"
			}, 400, svc.corsHeaders(origin));
		}

		if (!VALID_CATEGORIES.includes(category)) {
			return svc.json({
				error: "Invalid category",
				detail: `Must be one of: ${VALID_CATEGORIES.join(", ")}`
			}, 400, svc.corsHeaders(origin));
		}

		const tableRef = resolveJournalTable(svc.env);

		// Normalise tags
		const tagsArr = normaliseTagsArray(p.tags);
		const tagsStr = tagsArr.join(", ");

		// Try common schema variants
		const LINK_FIELDS = ["Project", "Projects"];
		const CONTENT_FIELDS = ["Content", "Body", "Notes"];

		for (const linkName of LINK_FIELDS) {
			for (const contentField of CONTENT_FIELDS) {
				const fields = {
					[linkName]: [projectId], // Airtable link-to-record (recXXXX… in Projects table)
					Category: category,
					[contentField]: content,
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

					// ── NEW: Dual-write into D1 when available ──
					if (hasD1(svc.env)) {
						try {
							await d1InsertJournalEntry(svc.env, {
								recordId: entryId,
								projectRecordId: projectId,
								category,
								content,
								tags: tagsArr,
								// Use explicit project_local_id if present; otherwise best-effort: if the caller
								// is still sending the UUID as `project`, we capture it.
								localProjectId: projectLocalId || null
							});
						} catch (d1Err) {
							svc?.log?.warn?.("journal.d1.insert.fail", {
								err: safeText(d1Err),
								entryId,
								projectId,
								projectLocalId
							});
						}
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
		const msg = (() => { try { return String(fatal?.message || fatal || ""); } catch { return ""; } })();
		svc?.log?.error?.("journal.create.fatal", { err: msg });
		return svc.json({ error: "Internal error", detail: msg }, 500, svc.corsHeaders(origin));
	}
}

export async function diagAirtableCreate(svc, request, origin) {
	try {
		const tableRef = resolveJournalTable(svc.env);
		const res = await createRecords(svc.env, tableRef, [{
			fields: {
				Category: "perceptions",
				Content: "diag ping",
				Tags: "diag",
				Author: "diag"
			}
		}], svc?.cfg?.TIMEOUT_MS);
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
 * Mirrors updates into D1 when RESEARCHOPS_D1 is bound.
 *
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
	if (svc?.cfg?.MAX_BODY_BYTES && body.byteLength > svc.cfg.MAX_BODY_BYTES) {
		svc?.log?.warn?.("request.too_large", { size: body.byteLength });
		return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
	}

	let p;
	try {
		p = JSON.parse(new TextDecoder().decode(body));
	} catch {
		return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
	}

	const fields = {};
	const d1Patch = {};

	if (typeof p.category === "string") {
		if (!VALID_CATEGORIES.includes(p.category)) {
			return svc.json({
				error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`
			}, 400, svc.corsHeaders(origin));
		}
		fields.Category = p.category;
		d1Patch.category = p.category;
	}

	if (typeof p.content === "string") {
		// Keep parity with create: Content is plain text there; however updating
		// with rich text is a safe enhancement if your field is rich text.
		fields.Content = mdToAirtableRich(p.content);
		d1Patch.content = p.content;
	}

	if (p.tags !== undefined) {
		const tagsArr = normaliseTagsArray(p.tags);
		const tagsStr = tagsArr.join(", ");
		fields.Tags = tagsStr.trim();
		d1Patch.tags = tagsArr;
	}

	if (Object.keys(fields).length === 0) {
		return svc.json({ error: "No updatable fields provided" }, 400, svc.corsHeaders(origin));
	}

	try {
		const tableRef = resolveJournalTable(svc.env);
		await patchRecords(svc.env, tableRef, [{ id: entryId, fields }], svc?.cfg?.TIMEOUT_MS);

		if (svc.env.AUDIT === "true") {
			svc?.log?.info?.("journal.entry.updated", { entryId, fields });
		}

		// Mirror into D1
		if (hasD1(svc.env) && Object.keys(d1Patch).length) {
			try {
				await d1UpdateJournalEntry(svc.env, entryId, d1Patch);
			} catch (d1Err) {
				svc?.log?.warn?.("journal.d1.update.fail", {
					err: safeText(d1Err),
					entryId
				});
			}
		}

		return svc.json({ ok: true }, 200, svc.corsHeaders(origin));

	} catch (err) {
		svc?.log?.error?.("journal.update.error", { err: String(err?.message || err), entryId });
		return svc.json({
			error: "Failed to update journal entry",
			detail: safeText(String(err?.message || err))
		}, 500, svc.corsHeaders(origin));
	}
}

/**
 * Delete a journal entry.
 * Mirrors delete into D1 when RESEARCHOPS_D1 is bound.
 *
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
		const tableRef = resolveJournalTable(svc.env);
		await deleteRecord(svc.env, tableRef, entryId, svc?.cfg?.TIMEOUT_MS);

		if (svc.env.AUDIT === "true") {
			svc?.log?.info?.("journal.entry.deleted", { entryId });
		}

		// Mirror delete into D1
		if (hasD1(svc.env)) {
			try {
				await d1DeleteJournalEntry(svc.env, entryId);
			} catch (d1Err) {
				svc?.log?.warn?.("journal.d1.delete.fail", {
					err: safeText(d1Err),
					entryId
				});
			}
		}

		return svc.json({ ok: true }, 200, svc.corsHeaders(origin));

	} catch (err) {
		svc?.log?.error?.("journal.delete.error", { err: String(err?.message || err), entryId });
		return svc.json({
			error: "Failed to delete journal entry",
			detail: safeText(String(err?.message || err))
		}, 500, svc.corsHeaders(origin));
	}
}