/**
 * @file src/service/journals.js
 * @module service/journals
 * @summary Reflexive journal handling for qualitative research.
 */

import { safeText, mdToAirtableRich } from "../core/utils.js";
import { listAll, getRecord, createRecords, patchRecords, deleteRecord } from "./internals/airtable.js";
import {
	d1ListJournalEntriesByLocalProject,
	d1GetJournalEntryById,
	d1UpdateJournalEntry,
	d1DeleteJournalEntry
} from "./internals/researchops-d1.js";
import { createJournalEntryDualWrite } from "./internals/journals-dualwrite.js";

/* ───────────────────────────── helpers / constants ───────────────────────────── */

const VALID_CATEGORIES = ["perceptions", "procedures", "decisions", "introspections"];

function resolveJournalTable(env) {
	return env.AIRTABLE_TABLE_JOURNAL || "Journals";
}

function hasAirtable(env) {
	return !!(env?.AIRTABLE_BASE_ID && (env?.AIRTABLE_API_KEY || env?.AIRTABLE_ACCESS_TOKEN));
}

function hasD1(env) {
	return !!env?.RESEARCHOPS_D1;
}

/**
 * Normalise tags to an array of strings.
 * @param {any} value
 * @returns {string[]}
 */
function normTagsArray(value) {
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
 *
 * Behaviour:
 * - If D1 is bound:
 *   - Treats ?project= as local_project_id and reads from D1 (primary).
 * - If D1 is NOT bound:
 *   - Falls back to Airtable behaviour:
 *     treats ?project= as Airtable project record id and filters via link field.
 *
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function listJournalEntries(svc, origin, url) {
	const projectParam = url.searchParams.get("project") || "";
	if (!projectParam) {
		return svc.json({ ok: true, entries: [] }, 200, svc.corsHeaders(origin));
	}

	const env = svc.env;
	const useD1 = hasD1(env);
	const useAirtable = !useD1 && hasAirtable(env);

	// ───── D1-primary path ─────
	if (useD1) {
		try {
			const rows = await d1ListJournalEntriesByLocalProject(env, projectParam);
			const entries = rows.map(row => {
				let tags = [];
				if (typeof row.tags === "string" && row.tags.trim()) {
					try {
						const parsed = JSON.parse(row.tags);
						if (Array.isArray(parsed)) {
							tags = parsed.map(String);
						} else {
							tags = row.tags.split(",").map(s => s.trim()).filter(Boolean);
						}
					} catch {
						tags = row.tags.split(",").map(s => s.trim()).filter(Boolean);
					}
				}

				return {
					id: row.record_id || null,
					project: row.project || null,
					category: row.category || "",
					content: row.content || "",
					tags,
					createdAt: row.createdat || null
				};
			});

			return svc.json({ ok: true, source: "d1", entries }, 200, svc.corsHeaders(origin));
		} catch (e) {
			const msg = safeText(e?.message || e);
			svc?.log?.error?.("journals.list.d1.fail", { err: msg });
			return svc.json(
				{ ok: false, error: "Failed to load journal entries", detail: msg },
				500,
				svc.corsHeaders(origin)
			);
		}
	}

	// ───── Airtable fallback path (no D1) ─────
	if (!useAirtable) {
		// Neither Airtable nor D1 configured: soft-empty rather than crash
		return svc.json({ ok: true, entries: [] }, 200, svc.corsHeaders(origin));
	}

	try {
		const airtableProjectId = projectParam;
		const tableRef = resolveJournalTable(env);
		const res = await listAll(env, tableRef, { pageSize: 100 }, svc?.cfg?.TIMEOUT_MS);

		const records = Array.isArray(res?.records) ? res.records :
			Array.isArray(res) ? res : [];

		const entries = [];
		for (const r of records) {
			const f = r?.fields || {};
			const projects = Array.isArray(f.Project) ? f.Project :
				Array.isArray(f.Projects) ? f.Projects : [];
			if (!projects.includes(airtableProjectId)) continue;

			entries.push({
				id: r.id,
				category: f.Category || "—",
				content: f.Content || f.Body || f.Notes || "",
				tags: Array.isArray(f.Tags)
					? f.Tags
					: String(f.Tags || "").split(",").map(s => s.trim()).filter(Boolean),
				createdAt: r.createdTime || f.Created || ""
			});
		}

		return svc.json({ ok: true, source: "airtable", entries }, 200, svc.corsHeaders(origin));
	} catch (e) {
		const msg = safeText(e?.message || e || "");
		svc?.log?.error?.("journals.list.fail", { err: msg });
		const status = /Airtable\s+40[13]/i.test(msg) ? 502 : 500;
		return svc.json(
			{ ok: false, error: "Failed to load journal entries", detail: msg },
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
	const body = await request.json();
	const memoPayload = {
		...body,
		linked_entries: [entryId, ...(body.linked_entries || [])]
	};
	const memoRequest = new Request(request.url, {
		method: "POST",
		headers: request.headers,
		body: JSON.stringify(memoPayload)
	});
	return createMemo(svc, memoRequest, origin);
}

/**
 * Get a single journal entry by ID.
 *
 * Behaviour:
 * - If D1 is bound:
 *   - First try D1 by record_id.
 *   - If not found, and id looks like an Airtable recXXX and Airtable is configured, try Airtable.
 * - If D1 is NOT bound:
 *   - Airtable-only behaviour (as before).
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

	const env = svc.env;
	const useD1 = hasD1(env);
	const useAirtable = hasAirtable(env);

	// ───── D1 first ─────
	if (useD1) {
		try {
			const row = await d1GetJournalEntryById(env, entryId);
			if (row) {
				let tags = [];
				if (typeof row.tags === "string" && row.tags.trim()) {
					try {
						const parsed = JSON.parse(row.tags);
						if (Array.isArray(parsed)) {
							tags = parsed.map(String);
						} else {
							tags = row.tags.split(",").map(s => s.trim()).filter(Boolean);
						}
					} catch {
						tags = row.tags.split(",").map(s => s.trim()).filter(Boolean);
					}
				}

				const entry = {
					id: row.record_id || entryId,
					category: row.category || "procedures",
					content: row.content || "",
					tags,
					author: "",
					createdAt: row.createdat || null,
					source: "d1"
				};

				return svc.json({ ok: true, entry }, 200, svc.corsHeaders(origin));
			}
		} catch (err) {
			const msg = safeText(err?.message || err);
			svc?.log?.warn?.("journal.get.d1.error", { err: msg, entryId });
			// fall through to Airtable if possible
		}
	}

	// ───── Airtable fallback ─────
	if (!useAirtable) {
		return svc.json(
			{ error: "Entry not found", detail: "No D1 row and Airtable not configured" },
			404,
			svc.corsHeaders(origin)
		);
	}

	try {
		const tableRef = resolveJournalTable(env);
		const rec = await getRecord(env, tableRef, entryId, svc?.cfg?.TIMEOUT_MS);

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
			createdAt: rec.createdTime || "",
			source: "airtable"
		};

		return svc.json({ ok: true, entry }, 200, svc.corsHeaders(origin));

	} catch (err) {
		const msg = safeText(err?.message || err);
		svc?.log?.error?.("journal.get.error", { err: msg, entryId });
		const isNotFound = /404|NOT_FOUND/i.test(msg);
		return svc.json(
			{ error: isNotFound ? "Entry not found" : "Internal server error", detail: msg },
			isNotFound ? 404 : 500,
			svc.corsHeaders(origin)
		);
	}
}

/**
 * Create a journal entry.
 *
 * Behaviour:
 * - If D1 is bound:
 *   - Treats incoming `project`/`project_local_id` as the local project id (d04ab3…).
 *   - Resolves Airtable project id via D1.
 *   - Dual-writes:
 *     - Airtable first (best-effort).
 *     - Always writes to D1, even if Airtable is 429/payment-limited.
 *   - Returns 201 using Airtable id if available, otherwise D1 record_id.
 *
 * - If D1 is NOT bound:
 *   - Falls back to the original Airtable-only behaviour
 *     (treats `project`/`project_airtable_id` as Airtable project record id).
 *
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function createJournalEntry(svc, request, origin) {
	const env = svc.env;
	const useD1 = hasD1(env);
	const useAirtable = hasAirtable(env);

	try {
		const buf = await request.arrayBuffer();
		if (svc?.cfg?.MAX_BODY_BYTES && buf.byteLength > svc.cfg.MAX_BODY_BYTES) {
			svc?.log?.warn?.("request.too_large", { size: buf.byteLength });
			return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
		}

		/** @type {{
		 *  project?:string,
		 *  project_airtable_id?:string,
		 *  project_local_id?:string,
		 *  category?:string,
		 *  content?:string,
		 *  tags?:string[]|string,
		 *  author?:string,
		 *  initial_memo?:string
		 * }} */
		let p;
		try {
			p = JSON.parse(new TextDecoder().decode(buf));
		} catch {
			return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
		}

		// ───── D1 + dual-write path ─────
		if (useD1) {
			const projectLocalId =
				(p.project_local_id || p.project)?.trim() || "";
			const category = (p.category || "").trim();
			const content = (p.content || "").trim();
			const tags = normTagsArray(p.tags);

			if (!projectLocalId || !category || !content) {
				return svc.json({
					error: "Missing required fields",
					detail: "project (or project_local_id), category, content"
				}, 400, svc.corsHeaders(origin));
			}

			try {
				const result = await createJournalEntryDualWrite(svc, {
					projectLocalId,
					category,
					content,
					tags
				});

				const entryId = result.airtableId || result.d1?.record_id || null;
				if (!entryId) {
					return svc.json({
						error: "Failed to create journal entry",
						detail: "No identifier returned from Airtable or D1"
					}, 500, svc.corsHeaders(origin));
				}

				// Optional initial memo (best-effort)
				if (p.initial_memo) {
					try {
						const { createMemo } = await import("./reflection/memos.js");
						const memoReq = new Request("https://local/inline", {
							method: "POST",
							headers: { "content-type": "application/json" },
							body: JSON.stringify({
								project_id: projectLocalId,
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

				return svc.json(
					{
						ok: true,
						id: entryId,
						source: result.source,
						airtableId: result.airtableId,
						airtableError: result.airtableError
					},
					201,
					svc.corsHeaders(origin)
				);
			} catch (err) {
				const msg = safeText(err?.message || err);
				const status = err?.status || 500;
				const detail = err?.detail || msg;
				svc?.log?.error?.("journal.create.dualwrite.error", { err: msg });
				return svc.json(
					{ error: "Failed to create journal entry", detail },
					status,
					svc.corsHeaders(origin)
				);
			}
		}

		// ───── Airtable-only fallback (no D1) ─────
		if (!useAirtable) {
			return svc.json(
				{ error: "No storage configured for journal entries" },
				500,
				svc.corsHeaders(origin)
			);
		}

		const projectId = (p.project || p.project_airtable_id || "").trim();
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

		const tableRef = resolveJournalTable(env);

		const tagsArr = normTagsArray(p.tags);
		const tagsStr = tagsArr.join(", ");

		const LINK_FIELDS = ["Project", "Projects"];
		const CONTENT_FIELDS = ["Content", "Body", "Notes"];

		for (const linkName of LINK_FIELDS) {
			for (const contentField of CONTENT_FIELDS) {
				const fields = {
					[linkName]: [projectId],
					Category: category,
					[contentField]: content,
					Tags: tagsStr,
					Author: p.author || ""
				};

				for (const k of Object.keys(fields)) {
					const v = fields[k];
					if (v === undefined || v === null ||
						(typeof v === "string" && v.trim() === "") ||
						(Array.isArray(v) && v.length === 0)) {
						delete fields[k];
					}
				}

				try {
					const result = await createRecords(env, tableRef, [{ fields }], svc?.cfg?.TIMEOUT_MS);
					const entryId = result?.records?.[0]?.id;
					if (!entryId) {
						return svc.json({ error: "Airtable response missing id" }, 502, svc.corsHeaders(origin));
					}

					if (env.AUDIT === "true") {
						svc?.log?.info?.("journal.entry.created", { entryId, linkName, contentField, tableRef });
					}

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

					if (/422/.test(msg) && /UNKNOWN_FIELD_NAME/i.test(msg)) {
						continue;
					}

					svc?.log?.error?.("airtable.journal.create.fail", { err: msg, linkName, contentField, tableRef });
					return svc.json(
						{ error: "Failed to create journal entry", detail: msg },
						500,
						svc.corsHeaders(origin)
					);
				}
			}
		}

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

/**
 * Update a journal entry (partial).
 * Dual behaviour:
 * - If D1 bound:
 *   - Updates D1 row.
 *   - Best-effort updates Airtable if id looks like recXXXX… and Airtable configured.
 * - If no D1:
 *   - Airtable-only (as before).
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

	const env = svc.env;
	const useD1 = hasD1(env);
	const useAirtable = hasAirtable(env);

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

	const patchFields = {};
	const d1Patch = {};

	if (typeof p.category === "string") {
		if (!VALID_CATEGORIES.includes(p.category)) {
			return svc.json({
				error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`
			}, 400, svc.corsHeaders(origin));
		}
		patchFields.Category = p.category;
		d1Patch.category = p.category;
	}

	if (typeof p.content === "string") {
		patchFields.Content = mdToAirtableRich(p.content);
		d1Patch.content = p.content;
	}

	if (p.tags !== undefined) {
		const tagsArr = normTagsArray(p.tags);
		const tagsStr = tagsArr.join(", ");
		patchFields.Tags = tagsStr;
		d1Patch.tags = tagsArr;
	}

	if (Object.keys(patchFields).length === 0 && Object.keys(d1Patch).length === 0) {
		return svc.json({ error: "No updatable fields provided" }, 400, svc.corsHeaders(origin));
	}

	// D1 update first (if available)
	if (useD1) {
		try {
			await d1UpdateJournalEntry(env, entryId, d1Patch);
		} catch (err) {
			const msg = safeText(err?.message || err);
			svc?.log?.warn?.("journal.update.d1.error", { err: msg, entryId });
			// don’t fail the request solely on D1 error; try Airtable too
		}
	}

	// Airtable update (best-effort)
	if (useAirtable && /^rec[A-Za-z0-9]+/.test(entryId) && Object.keys(patchFields).length) {
		try {
			const tableRef = resolveJournalTable(env);
			await patchRecords(env, tableRef, [{ id: entryId, fields: patchFields }], svc?.cfg?.TIMEOUT_MS);

			if (env.AUDIT === "true") {
				svc?.log?.info?.("journal.entry.updated", { entryId, fields: patchFields });
			}
		} catch (err) {
			const msg = safeText(err?.message || err);
			svc?.log?.warn?.("journal.update.airtable.error", { err: msg, entryId });
			// Don’t hard-fail if D1 already updated – treat Airtable error as soft
		}
	}

	return svc.json({ ok: true }, 200, svc.corsHeaders(origin));
}

/**
 * Delete a journal entry.
 *
 * Behaviour:
 * - If D1 bound:
 *   - Deletes from D1.
 *   - Best-effort deletes from Airtable if id looks like recXXXX…
 * - If D1 not bound:
 *   - Airtable-only (as before).
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

	const env = svc.env;
	const useD1 = hasD1(env);
	const useAirtable = hasAirtable(env);

	// D1 delete
	if (useD1) {
		try {
			await d1DeleteJournalEntry(env, entryId);
		} catch (err) {
			const msg = safeText(err?.message || err);
			svc?.log?.warn?.("journal.delete.d1.error", { err: msg, entryId });
			// keep going and try Airtable
		}
	}

	// Airtable delete
	if (useAirtable && /^rec[A-Za-z0-9]+/.test(entryId)) {
		try {
			const tableRef = resolveJournalTable(env);
			await deleteRecord(env, tableRef, entryId, svc?.cfg?.TIMEOUT_MS);

			if (env.AUDIT === "true") {
				svc?.log?.info?.("journal.entry.deleted", { entryId });
			}
		} catch (err) {
			const msg = safeText(err?.message || err);
			svc?.log?.warn?.("journal.delete.airtable.error", { err: msg, entryId });
			// In a dual-store world, D1 delete is enough for UI consistency
		}
	}

	return svc.json({ ok: true }, 200, svc.corsHeaders(origin));
}

/**
 * Diag helper: Airtable-only ping (unchanged).
 */
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
		const msg = safeText(e?.message || e || "");
		svc?.log?.error?.("diag.airtable.create.fail", { err: msg });
		return svc.json({ ok: false, error: msg }, 500, svc.corsHeaders(origin));
	}
}
