/**
 * @file src/service/internals/researchops-d1.js
 * @module service/internals/researchops-d1
 * @summary D1 access helpers for the ResearchOps platform (read + write).
 *
 * Design:
 * - D1 is a replica / cache of Airtable data.
 * - For new writes we always attempt Airtable first (when configured),
 *   but we *always* write to D1 when the binding exists.
 * - When Airtable is unavailable or rate-limited, D1 still accepts new rows
 *   using local placeholder IDs. Airtable can be backfilled later.
 */

/** @typedef {import("../index.js").ResearchOpsService} ResearchOpsService */

/* ─────────────────────── low-level helpers ─────────────────────── */

function _getDb(env) {
	const db = env?.RESEARCHOPS_D1;
	if (!db) throw new Error("D1 binding RESEARCHOPS_D1 is not configured on this environment");
	return db;
}

/**
 * Run a SQL statement (INSERT/UPDATE/DELETE).
 * @param {any} env
 * @param {string} sql
 * @param {any[]} [params]
 */
export async function d1Run(env, sql, params = []) {
	const db = _getDb(env);
	let stmt = db.prepare(sql);
	if (params && params.length) stmt = stmt.bind(...params);
	return stmt.run();
}

/**
 * Fetch a single row.
 * @param {any} env
 * @param {string} sql
 * @param {any[]} [params]
 */
export async function d1Get(env, sql, params = []) {
	const db = _getDb(env);
	let stmt = db.prepare(sql);
	if (params && params.length) stmt = stmt.bind(...params);
	return stmt.first();
}

/**
 * Fetch multiple rows.
 * @param {any} env
 * @param {string} sql
 * @param {any[]} [params]
 */
export async function d1All(env, sql, params = []) {
	const db = _getDb(env);
	let stmt = db.prepare(sql);
	if (params && params.length) stmt = stmt.bind(...params);
	const { results } = await stmt.all();
	return results || [];
}

/* ─────────────────────── projects helpers ─────────────────────── */

/**
 * Resolve a project row from D1 by local_id (the UUID used in URLs).
 *
 * Table: projects
 *  - local_id   TEXT PRIMARY KEY (your UUID, e.g. d04ab32e-...)
 *  - record_id  TEXT (Airtable ID, e.g. rec010B6...)
 *
 * @param {any} env
 * @param {string} localId
 * @returns {Promise<null | {
 *   local_id: string,
 *   record_id: string,
 *   name?: string,
 *   org?: string,
 *   phase?: string,
 *   status?: string,
 *   description?: string
 * }>}
 */
export async function d1GetProjectByLocalId(env, localId) {
	if (!localId) return null;
	return d1Get(env, `
		SELECT
			local_id,
			record_id,
			name,
			org,
			phase,
			status,
			description
		FROM projects
		WHERE local_id = ?
		LIMIT 1
	`, [String(localId)]);
}

/* ─────────────────────── journal entries helpers ─────────────────────── */

/**
 * Generate a placeholder ID for journal_entries.record_id when Airtable
 * could not create a record yet. This keeps the PRIMARY KEY non-null.
 */
function _pendingId() {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return "pending-" + crypto.randomUUID();
	}
	// Fallback: timestamp + random
	return "pending-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

/**
 * Insert a journal entry row into D1.
 *
 * journal_entries schema (from your migration):
 *  - record_id        TEXT PRIMARY KEY       // Airtable ID when known, otherwise pending-...
 *  - project          TEXT                   // Airtable project record id (rec...)
 *  - category         TEXT
 *  - content          TEXT
 *  - tags             TEXT                   // JSON string
 *  - createdat        TEXT                   // ISO datetime
 *  - local_project_id TEXT                   // UUID used in URLs
 *
 * @param {any} env
 * @param {{
 *   recordId?: string | null,
 *   projectRecordId?: string | null,
 *   category: string,
 *   content: string,
 *   tags?: string[] | string | null,
 *   createdAt?: string | null,
 *   localProjectId: string
 * }} row
 */
export async function d1InsertJournalEntry(env, row) {
	const recordId = row.recordId || _pendingId();
	const projectRecordId = row.projectRecordId || null;
	const createdAt = row.createdAt || new Date().toISOString();

	let tagsJson;
	if (Array.isArray(row.tags)) {
		tagsJson = JSON.stringify(row.tags);
	} else if (typeof row.tags === "string") {
		tagsJson = row.tags;
	} else {
		tagsJson = "[]";
	}

	await d1Run(env, `
		INSERT INTO journal_entries (
			record_id,
			project,
			category,
			content,
			tags,
			createdat,
			local_project_id
		) VALUES (?, ?, ?, ?, ?, ?, ?)
	`, [
		recordId,
		projectRecordId,
		row.category,
		row.content,
		tagsJson,
		createdAt,
		row.localProjectId
	]);

	return {
		record_id: recordId,
		project: projectRecordId,
		category: row.category,
		content: row.content,
		tags: tagsJson,
		createdat: createdAt,
		local_project_id: row.localProjectId
	};
}

/**
 * List journal entries by local_project_id, newest first.
 * @param {any} env
 * @param {string} localProjectId
 */
export async function d1ListJournalEntriesByLocalProject(env, localProjectId) {
	if (!localProjectId) return [];
	return d1All(env, `
		SELECT record_id,
		       project,
		       category,
		       content,
		       tags,
		       createdat,
		       local_project_id
		  FROM journal_entries
		 WHERE local_project_id = ?1
		 ORDER BY datetime(createdat) DESC;
	`, [localProjectId]);
}

/**
 * Get a journal entry by its record_id (primary key).
 * @param {any} env
 * @param {string} recordId
 */
export async function d1GetJournalEntryById(env, recordId) {
	if (!recordId) return null;
	return d1Get(env, `
		SELECT record_id,
		       project,
		       category,
		       content,
		       tags,
		       createdat,
		       local_project_id
		  FROM journal_entries
		 WHERE record_id = ?1
		 LIMIT 1;
	`, [recordId]);
}

/**
 * Update a journal entry in D1.
 * Supports patching category, content, tags, createdat.
 * @param {any} env
 * @param {string} recordId
 * @param {{ category?: string, content?: string, tags?: string[] | string, createdAt?: string }} patch
 */
export async function d1UpdateJournalEntry(env, recordId, patch) {
	if (!recordId) return;

	const sets = [];
	const params = [];

	if (patch.category !== undefined) {
		sets.push("category = ?");
		params.push(patch.category);
	}
	if (patch.content !== undefined) {
		sets.push("content = ?");
		params.push(patch.content);
	}
	if (patch.tags !== undefined) {
		const tagsText = Array.isArray(patch.tags) ?
			JSON.stringify(patch.tags) :
			(typeof patch.tags === "string" ? patch.tags : "[]");
		sets.push("tags = ?");
		params.push(tagsText);
	}
	if (patch.createdAt !== undefined) {
		sets.push("createdat = ?");
		params.push(patch.createdAt);
	}

	if (!sets.length) return;

	params.push(recordId);

	await d1Run(env, `
		UPDATE journal_entries
		   SET ${sets.join(", ")}
		 WHERE record_id = ?;
	`, params);
}

/**
 * Delete a journal entry from D1.
 * @param {any} env
 * @param {string} recordId
 */
export async function d1DeleteJournalEntry(env, recordId) {
	if (!recordId) return;
	await d1Run(env, `
		DELETE FROM journal_entries
		 WHERE record_id = ?1;
	`, [recordId]);
}