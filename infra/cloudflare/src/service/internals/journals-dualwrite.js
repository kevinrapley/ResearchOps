/**
 * @file service/internals/journals-dualwrite.js
 * @module service/internals/journals-dualwrite
 * @summary Dual-write logic for journal entries (Airtable primary, D1 replica + offline buffer).
 *
 * Behaviour:
 * - Resolve project local_id → Airtable record_id using D1.
 * - Attempt to create the journal entry in Airtable (source of truth).
 * - Always insert a corresponding row into D1.
 * - If Airtable is unavailable, D1 still stores the entry with a placeholder ID.
 */

/** @typedef {import("../index.js").ResearchOpsService} ResearchOpsService */

import {
	d1GetProjectByLocalId,
	d1InsertJournalEntry
} from "./researchops-d1.js";

import {
	createJournalEntry as atCreateJournalEntry
} from "./airtable.js";

/* ────────────────────── helpers ────────────────────── */

/**
 * Normalise tags to an array of strings.
 * @param {any} value
 * @returns {string[]}
 */
function _normTags(value) {
	if (Array.isArray(value)) {
		return value
			.map(String)
			.map(s => s.trim())
			.filter(Boolean);
	}
	if (!value) return [];
	return String(value)
		.split(",")
		.map(s => s.trim())
		.filter(Boolean);
}

/* ────────────────────── dual-write API ────────────────────── */

/**
 * Dual-write journal entry:
 * 1) Resolve project by local_id using D1.
 * 2) Attempt to create in Airtable (source-of-truth).
 * 3) Insert into D1 regardless of Airtable result.
 *
 * If Airtable fails:
 *  - D1 row is created with a local placeholder record_id (pending-...).
 *  - A later seeding job can:
 *      * find pending rows,
 *      * create them in Airtable,
 *      * overwrite record_id with the real recXXXX ID.
 *
 * @param {ResearchOpsService} root
 * @param {{
 *   projectLocalId: string,
 *   category: string,
 *   content: string,
 *   tags?: string[] | string
 * }} payload
 * @returns {Promise<{
 *   ok: boolean,
 *   source: "airtable+d1" | "d1-only",
 *   projectLocalId: string,
 *   projectRecordId: string | null,
 *   d1: any,
 *   airtableId: string | null,
 *   airtableError: string | null
 * }>}
 */
export async function createJournalEntryDualWrite(root, payload) {
	const env = root.env;
	const log = root.log || console;

	const projectLocalId = String(payload.projectLocalId || "").trim();
	const category = String(payload.category || "").trim();
	const content = String(payload.content || "").trim();
	const tags = _normTags(payload.tags);

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

	// 1) Resolve project local_id → (local_id, Airtable record_id) via D1
	let projectRow;
	try {
		projectRow = await d1GetProjectByLocalId(env, projectLocalId);
	} catch (err) {
		log.warn?.("[journal.dualwrite] D1 lookup for project failed", {
			projectLocalId,
			message: String(err?.message || err)
		});
		throw err;
	}

	if (!projectRow) {
		const err = new Error("project_not_found_in_d1");
		// @ts-ignore
		err.status = 404;
		throw err;
	}

	const projectRecordId = projectRow.record_id || null;

	let airtableEntry = null;
	let airtableError = null;

	// 2) Attempt Airtable write (if we know the Airtable project id)
	if (projectRecordId) {
		try {
			const created = await atCreateJournalEntry(
				env, {
					projectId: projectRecordId,
					category,
					content,
					tags
				},
				root
			);

			// Normalise Airtable response shape
			const id =
				created.id ||
				created.recordId ||
				created.record_id ||
				null;

			const fields = created.fields || created || {};
			const createdAt =
				fields.CreatedAt ||
				fields.createdAt ||
				fields.created_at ||
				created.createdTime ||
				new Date().toISOString();

			airtableEntry = {
				id,
				createdAt
			};
		} catch (err) {
			airtableError = err;
			log.warn?.("[journal.dualwrite] Airtable create failed, falling back to D1-only", {
				projectLocalId,
				projectRecordId,
				message: String(err?.message || err),
				name: err?.name
			});
		}
	} else {
		log.warn?.("[journal.dualwrite] No Airtable project record_id for local project id", {
			projectLocalId
		});
	}

	// 3) Insert into D1 *regardless* of Airtable result
	let d1Row;
	try {
		d1Row = await d1InsertJournalEntry(env, {
			recordId: airtableEntry?.id || null,
			projectRecordId,
			category,
			content,
			tags,
			createdAt: airtableEntry?.createdAt || null,
			localProjectId: projectLocalId
		});
	} catch (err) {
		log.error?.("[journal.dualwrite] D1 insert failed", {
			projectLocalId,
			projectRecordId,
			message: String(err?.message || err)
		});
		// If Airtable succeeded but D1 fails, we still return success but flag it
		if (airtableEntry) {
			return {
				ok: true,
				source: "airtable+d1",
				projectLocalId,
				projectRecordId,
				d1: null,
				airtableId: airtableEntry.id || null,
				airtableError: airtableError ? String(airtableError?.message || airtableError) : null
			};
		}
		// If both fail, bubble the error up
		throw err;
	}

	const ok = true;
	const source = airtableEntry ? "airtable+d1" : "d1-only";

	return {
		ok,
		source,
		projectLocalId,
		projectRecordId,
		d1: d1Row,
		airtableId: airtableEntry?.id || null,
		airtableError: airtableError ? String(airtableError?.message || airtableError) : null
	};
}