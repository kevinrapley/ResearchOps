/**
 * @file src/service/internals/journals-dualwrite.js
 * @module service/internals/journals-dualwrite
 * @summary Dual-write logic for journal entries (Airtable primary when healthy, D1 replica + offline buffer).
 */

import { createRecords } from "./airtable.js";
import {
	d1GetProjectByLocalId,
	d1InsertJournalEntry
} from "./researchops-d1.js";
import { safeText } from "../../core/utils.js";

/** @typedef {import("../index.js").ResearchOpsService} ResearchOpsService */

const VALID_CATEGORIES = ["perceptions", "procedures", "decisions", "introspections"];

function hasAirtable(env) {
	return !!(env?.AIRTABLE_BASE_ID && (env?.AIRTABLE_API_KEY || env?.AIRTABLE_ACCESS_TOKEN));
}

function resolveJournalTable(env) {
	return env.AIRTABLE_TABLE_JOURNAL || "Journals";
}

/**
 * Normalise tags to an array of strings.
 * @param {any} value
 * @returns {string[]}
 */
function normTags(value) {
	if (Array.isArray(value)) {
		return value.map(String).map(s => s.trim()).filter(Boolean);
	}
	if (!value) return [];
	return String(value)
		.split(",")
		.map(s => s.trim())
		.filter(Boolean);
}

/**
 * Dual-write journal entry:
 * 1) Resolve project by local_id using D1.
 * 2) Attempt to create in Airtable (source-of-truth) when configured.
 * 3) Insert into D1 regardless of Airtable result.
 *
 * If Airtable fails with 429/payment or 5xx:
 *  - D1 row is still created with a local placeholder record_id.
 *  - Caller still gets a 201 + D1 id so the UI doesn’t break.
 *
 * @param {ResearchOpsService} svc
 * @param {{
 *   projectLocalId: string,
 *   category: string,
 *   content: string,
 *   tags?: string[] | string
 * }} payload
 */
export async function createJournalEntryDualWrite(svc, payload) {
	const env = svc.env;
	const log = svc.log || console;

	const projectLocalId = String(payload.projectLocalId || "").trim();
	const category = String(payload.category || "").trim();
	const content = String(payload.content || "").trim();
	const tagsArr = normTags(payload.tags);

	if (!projectLocalId) {
		const err = new Error("project_local_id_required");
		// @ts-ignore
		err.status = 400;
		throw err;
	}
	if (!category || !content) {
		const err = new Error("category_and_content_required");
		// @ts-ignore
		err.status = 400;
		throw err;
	}
	if (!VALID_CATEGORIES.includes(category)) {
		const err = new Error("invalid_category");
		// @ts-ignore
		err.status = 400;
		err.detail = `Must be one of: ${VALID_CATEGORIES.join(", ")}`;
		throw err;
	}

	// 1) Resolve project local_id → (local_id, Airtable record_id) via D1
	const projectRow = await d1GetProjectByLocalId(env, projectLocalId);
	if (!projectRow) {
		const err = new Error("project_not_found_in_d1");
		// @ts-ignore
		err.status = 404;
		throw err;
	}

	const projectRecordId = projectRow.record_id || null;
	const useAirtable = hasAirtable(env) && !!projectRecordId;

	let airtableEntry = null;
	let airtableError = null;

	// 2) Attempt Airtable write (if we know the Airtable project id and Airtable is configured)
	if (useAirtable) {
		const tableRef = resolveJournalTable(env);
		const LINK_FIELDS = ["Project", "Projects"];
		const CONTENT_FIELDS = ["Content", "Body", "Notes"];

		outer:
			for (const linkName of LINK_FIELDS) {
				for (const contentField of CONTENT_FIELDS) {
					const fields = {
						[linkName]: [projectRecordId],
						Category: category,
						[contentField]: content,
						Tags: tagsArr.join(", "),
						Author: ""
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
						const result = await createRecords(
							env,
							tableRef,
							[{ fields }],
							svc?.cfg?.TIMEOUT_MS
						);

						const rec = result?.records?.[0];
						if (rec && rec.id) {
							const f = rec.fields || {};
							const createdAt =
								f.CreatedAt ||
								f.createdAt ||
								f.created_at ||
								rec.createdTime ||
								new Date().toISOString();

							airtableEntry = {
								id: rec.id,
								createdAt
							};

							if (env.AUDIT === "true") {
								log.info?.("journal.entry.created.airtable", {
									entryId: rec.id,
									projectRecordId,
									tableRef,
									linkName,
									contentField
								});
							}

							break outer;
						}
					} catch (err) {
						const msg = safeText(err?.message || err);
						// If Airtable says "unknown field", try next schema variant.
						if (/422/.test(msg) && /UNKNOWN_FIELD_NAME/i.test(msg)) {
							continue;
						}

						// If we hit billing/429 or server-ish errors, fall back to D1-only but do NOT crash.
						if (/429/.test(msg) || /PUBLIC_API_BILLING_LIMIT_EXCEEDED/i.test(msg) || /5\d\d/.test(msg)) {
							airtableError = err;
							log.warn?.("[journal.dualwrite] Airtable create failed, falling back to D1-only", {
								message: msg
							});
							break outer;
						}

						// For other errors (auth, config etc.) surface them
						throw err;
					}
				}
			}
	}

	// 3) Insert into D1 *regardless* of Airtable result
	const d1Row = await d1InsertJournalEntry(env, {
		recordId: airtableEntry?.id || null,
		projectRecordId,
		category,
		content,
		tags: tagsArr,
		createdAt: airtableEntry?.createdAt || null,
		localProjectId: projectLocalId
	});

	const ok = true;
	const source = airtableEntry ? "airtable+d1" : "d1-only";

	return {
		ok,
		source,
		projectLocalId,
		projectRecordId,
		d1: d1Row,
		airtableId: airtableEntry?.id || null,
		airtableError: airtableError ? safeText(airtableError?.message || airtableError) : null
	};
}