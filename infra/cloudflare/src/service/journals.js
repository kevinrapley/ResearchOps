/**
 * @file src/service/journals.js
 * @module service/journals
 * @summary Reflexive journal handling for qualitative research.
 *
 * Behaviour (v2 – D1-aware):
 * - Reads:
 *   - If D1 is present, treats ?project= as a *local project id* (UUID).
 *   - Tries Airtable first (mapping local → Airtable via D1), but falls back to D1
 *     when Airtable is unavailable (e.g. 429 billing limit).
 * - Writes:
 *   - Airtable remains primary when available.
 *   - Always attempts to insert into D1 as a replica.
 *   - If Airtable is rate-limited (429 / PUBLIC_API_BILLING_LIMIT_EXCEEDED),
 *     the entry is still created in D1 and a 201 is returned.
 */

import { safeText, mdToAirtableRich } from "../core/utils.js";
import { listAll, getRecord, createRecords, patchRecords, deleteRecord } from "./internals/airtable.js";
import { d1All, d1GetProjectByLocalId, d1InsertJournalEntry } from "./internals/researchops-d1.js";

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

/* ───────────────────────────── D1 helpers ───────────────────────────── */

/**
 * List journal entries from D1 for a local project id.
 * Mirrors the payload shape used by the Airtable path.
 *
 * @param {any} env
 * @param {string} localProjectId
 * @returns {Promise<Array<{
 *   id: string|null,
 *   project: string|null,
 *   category: string,
 *   content: string,
 *   tags: string[],
 *   createdAt: string|null
 * }>>}
 */
async function d1ListEntriesForProject(env, localProjectId) {
	if (!localProjectId) return [];
	const rows = await d1All(env, `
		SELECT record_id,
		       project,
		       category,
		       content,
		       tags,
		       createdat
		  FROM journal_entries
		 WHERE local_project_id = ?1
		 ORDER BY datetime(createdat) DESC;
	`, [localProjectId]);

	return rows.map(row => {
		let tags = [];
		if (typeof row.tags === "string" && row.tags.trim()) {
			try {
				const parsed = JSON.parse(row.tags);
				if (Array.isArray(parsed)) {
					tags = parsed.map(String);
				}
			} catch {
				// fall back to comma-split if JSON parse fails
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
}

/* ───────────────────────────────────── routes ─────────────────────────────────── */

/**
 * List journal entries for a project.
 * - With D1: treats ?project= as local project id; tries Airtable (via map) then
 *   falls back to D1.
 * - Without D1: behaves as before (treats ?project= as Airtable record id).
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
	const useAirtable = hasAirtable(env);

	// Interpret the query param
	const localProjectId = useD1 ? projectParam : ""; // only meaningful when D1 exists
	let airtableProjectId = projectParam; // legacy fallback

	if (useD1) {
		try {
			const projRow = await d1GetProjectByLocalId(env, projectParam);
			if (projRow?.record_id) {
				airtableProjectId = projRow.record_id;
			}
		} catch (e) {
			svc?.log?.warn?.("journal.list.d1.project_lookup_fail", {
				localProjectId: projectParam,
				err: safeText(e?.message || e)
			});
		}
	}

	// If we *only* have D1 (no Airtable creds) just read from D1.
	if (!useAirtable && useD1) {
		try {
			const entries = await d1ListEntriesForProject(env, localProjectId || projectParam);
			return svc.json({ ok: true, entries }, 200, svc.corsHeaders(origin));
		} catch (e) {
			const msg = safeText(e?.message || e);
			svc?.log?.error?.("journals.list.d1.fail", { err: msg });
			return svc.json({ ok: false, error: "Failed to load journal entries", detail: msg },
				500,
				svc.corsHeaders(origin)
			);
		}
	}

	// If neither Airtable nor D1 is configured, keep a soft-empty response
	if (!useAirtable && !useD1) {
		return svc.json({ ok: true, entries: [] }, 200, svc.corsHeaders(origin));
	}

	// Airtable path (primary when available)
	const tableRef = resolveJournalTable(env);

	try {
		if (!airtableProjectId) {
			// We know we can't sensibly query Airtable, so skip straight to D1 fallback.
			throw new Error("no_airtable_project_id");
		}

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
				tags: Array.isArray(f.Tags) ?
					f.Tags : String(f.Tags || "").split(",").map(s => s.trim()).filter(Boolean),
				createdAt: r.createdTime || f.Created || ""
			});
		}

		// If Airtable returns nothing but D1 exists, we can still fall back to D1
		if (!entries.length && useD1) {
			const d1Entries = await d1ListEntriesForProject(env, localProjectId || projectParam);
			return svc.json({ ok: true, entries: d1Entries }, 200, svc.corsHeaders(origin));
		}

		return svc.json({ ok: true, entries }, 200, svc.corsHeaders(origin));
	} catch (e) {
		const msg = safeText(e?.message || e || "");
		svc?.log?.error?.("journals.list.fail", { err: msg });

		// Airtable fell over: try D1 fallback if we have it.
		if (useD1) {
			try {
				const entries = await d1ListEntriesForProject(env, localProjectId || projectParam);
				return svc.json({ ok: true, entries, source: "d1-fallback", airtableError: msg },
					200,
					svc.corsHeaders(origin)
				);
			} catch (d1Err) {
				const d1Msg = safeText(d1Err?.message || d1Err);
				svc?.log?.error?.("journals.list.d1_fallback_fail", { err: d1Msg, airtableError: msg });
				return svc.json({ ok: false, error: "Failed to load journal entries", detail: msg, d1Error: d1Msg },
					500,
					svc.corsHeaders(origin)
				);
			}
		}

		// No D1 or D1 also failed
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
 * (Currently Airtable-only; D1-only entries created during Airtable outages
 * will not yet be visible via this endpoint.)
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
 *
 * With D1:
 *  - Interprets `project` as local project id (UUID used in URLs).
 *  - Uses D1 to resolve Airtable project id when available.
 *  - Attempts Airtable create first; always writes to D1.
 *  - On Airtable 429 / PUBLIC_API_BILLING_LIMIT_EXCEEDED, still creates in D1
 *    and returns 201 with source="d1-only".
 *
 * Without D1:
 *  - Behaviour is mostly unchanged and treats `project` as Airtable record id.
 *
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function createJournalEntry(svc, request, origin) {
	try {
		const env = svc.env;
		const useD1 = hasD1(env);
		const useAirtable = hasAirtable(env);

		// Size guard
		const buf = await request.arrayBuffer();
		if (svc?.cfg?.MAX_BODY_BYTES && buf.byteLength > svc.cfg.MAX_BODY_BYTES) {
			svc?.log?.warn?.("request.too_large", { size: buf.byteLength });
			return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
		}

		// Parse JSON
		/** @type {{project?:string, project_airtable_id?:string, project_local_id?:string, category?:string, content?:string, tags?:string[]|string, author?:string, initial_memo?:string}} */
		let p;
		try {
			p = JSON.parse(new TextDecoder().decode(buf));
		} catch {
			return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
		}

		// Interpret project id(s)
		let localProjectId = "";
		let airtableProjectId = "";

		if (useD1) {
			localProjectId = (p.project_local_id || p.project || "").trim();
			// Best-effort Airtable id via D1
			if (localProjectId) {
				try {
					const projRow = await d1GetProjectByLocalId(env, localProjectId);
					if (projRow?.record_id) airtableProjectId = projRow.record_id;
				} catch (e) {
					svc?.log?.warn?.("journal.create.d1.project_lookup_fail", {
						localProjectId,
						err: safeText(e?.message || e)
					});
				}
			}
		} else {
			// Legacy behaviour: treat project as Airtable id
			airtableProjectId = (p.project_airtable_id || p.project || "").trim();
		}

		const category = (p.category || "").trim();
		const content = (p.content || "").trim();

		if (!category || !content || (!localProjectId && !airtableProjectId)) {
			return svc.json({
				error: "Missing required fields",
				detail: "project / project_local_id, category, content"
			}, 400, svc.corsHeaders(origin));
		}

		if (!VALID_CATEGORIES.includes(category)) {
			return svc.json({
				error: "Invalid category",
				detail: `Must be one of: ${VALID_CATEGORIES.join(", ")}`
			}, 400, svc.corsHeaders(origin));
		}

		const tableRef = resolveJournalTable(env);

		// Normalise tags (store as comma-delimited text in Airtable, JSON in D1)
		const tagsArr = normTagsArray(p.tags);
		const tagsStr = tagsArr.join(", ");

		const LINK_FIELDS = ["Project", "Projects"];
		const CONTENT_FIELDS = ["Content", "Body", "Notes"];

		let airtableCreated = null;
		let airtableRateLimited = false;

		// ───── Airtable path (primary when configured & we know an Airtable project id) ─────
		if (useAirtable && airtableProjectId) {
			outer: for (const linkName of LINK_FIELDS) {
				for (const contentField of CONTENT_FIELDS) {
					const fields = {
						[linkName]: [airtableProjectId],
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
						const result = await createRecords(env, tableRef, [{ fields }], svc?.cfg?.TIMEOUT_MS);
						const entryId = result?.records?.[0]?.id;
						if (!entryId) {
							return svc.json({ error: "Airtable response missing id" }, 502, svc.corsHeaders(origin));
						}

						const createdAt = result?.records?.[0]?.createdTime || new Date().toISOString();

						if (env.AUDIT === "true") {
							svc?.log?.info?.("journal.entry.created", { entryId, linkName, contentField, tableRef });
						}

						airtableCreated = { id: entryId, createdAt };
						break outer;
					} catch (airErr) {
						const msg = safeText(airErr?.message || airErr);

						// If Airtable says "unknown field", try next candidate
						if (/422/.test(msg) && /UNKNOWN_FIELD_NAME/i.test(msg)) {
							continue;
						}

						// Rate limit / billing limit → mark as such and fall back to D1
						if (/429/.test(msg) || /PUBLIC_API_BILLING_LIMIT_EXCEEDED/i.test(msg)) {
							airtableRateLimited = true;
							svc?.log?.warn?.("airtable.journal.create.rate_limited", {
								err: msg,
								tableRef,
								linkName,
								contentField
							});
							break outer;
						}

						// Other Airtable errors: surface as failure *unless* D1 is available and you
						// decide to still create locally. For now, we keep them as hard failures.
						svc?.log?.error?.("airtable.journal.create.fail", { err: msg, linkName, contentField, tableRef });
						return svc.json({ error: "Failed to create journal entry", detail: msg },
							500,
							svc.corsHeaders(origin)
						);
					}
				}
			}
		}

		// ───── D1 path (replica / fallback) ─────
		let d1Row = null;
		if (useD1) {
			try {
				d1Row = await d1InsertJournalEntry(env, {
					recordId: airtableCreated?.id || null,
					projectRecordId: airtableProjectId || null,
					category,
					content,
					tags: tagsArr,
					createdAt: airtableCreated?.createdAt || null,
					localProjectId: localProjectId || (useD1 ? p.project : "") || null
				});
			} catch (d1Err) {
				const msg = safeText(d1Err?.message || d1Err);
				svc?.log?.error?.("journal.d1.insert.fail", { err: msg, localProjectId, airtableProjectId });

				// If Airtable ALSO failed or was unavailable, there's nowhere else to write.
				if (!airtableCreated) {
					return svc.json({ error: "Failed to create journal entry", detail: msg },
						500,
						svc.corsHeaders(origin)
					);
				}
			}
		}

		// ───── Response ─────
		// Priority for "id" is Airtable record id; otherwise D1's record_id (pending-...).
		const id = airtableCreated?.id || d1Row?.record_id || null;
		const source =
			airtableCreated && d1Row ? "airtable+d1" :
			airtableCreated ? "airtable-only" :
			d1Row ? "d1-only" :
			"unknown";

		// Optional initial memo (best-effort, only when we have a definitive entry id)
		if (p.initial_memo && id) {
			try {
				const { createMemo } = await import("./reflection/memos.js");
				const memoReq = new Request("https://local/inline", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						project_id: airtableProjectId || localProjectId || id,
						memo_type: "analytical",
						content: p.initial_memo,
						linked_entries: [id],
						author: p.author
					})
				});
				await createMemo(svc, memoReq, origin);
			} catch (memoErr) {
				svc?.log?.warn?.("journal.entry.memo.create_fail", { err: safeText(memoErr) });
			}
		}

		// If Airtable was rate-limited but we successfully wrote to D1, signal that
		// to the caller but still treat as success.
		if (!id) {
			// Extremely unlikely: both Airtable and D1 gave us nothing but we didn't
			// throw above.
			return svc.json({ error: "Failed to create journal entry", detail: "No identifier returned from Airtable or D1" },
				500,
				svc.corsHeaders(origin)
			);
		}

		const body = { ok: true, id, source };
		if (airtableRateLimited && !airtableCreated && d1Row) {
			body.note = "Airtable rate-limited; entry stored in D1 only.";
		}

		return svc.json(body, 201, svc.corsHeaders(origin));

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
 * (Still Airtable-only for now.)
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

	if (typeof p.category === "string") {
		if (!VALID_CATEGORIES.includes(p.category)) {
			return svc.json({
				error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`
			}, 400, svc.corsHeaders(origin));
		}
		fields.Category = p.category;
	}

	if (typeof p.content === "string") {
		// Keep parity with create: Content is plain text there; however updating
		// with rich text is a safe enhancement if your field is rich text.
		fields.Content = mdToAirtableRich(p.content);
	}

	if (p.tags !== undefined) {
		const tagsStr = Array.isArray(p.tags) ? p.tags.map(String).join(", ") : String(p.tags || "");
		fields.Tags = tagsStr.trim();
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
 * (Currently only deletes from Airtable; D1 clean-up can be added later.)
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

		return svc.json({ ok: true }, 200, svc.corsHeaders(origin));

	} catch (err) {
		svc?.log?.error?.("journal.delete.error", { err: String(err?.message || err), entryId });
		return svc.json({
			error: "Failed to delete journal entry",
			detail: safeText(String(err?.message || err))
		}, 500, svc.corsHeaders(origin));
	}
}
