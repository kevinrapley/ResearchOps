/**
 * @file src/service/internals/researchops-d1.js
 * @module service/internals/researchops-d1
 * @summary D1 access helpers for the ResearchOps platform (read + write).
 *
 * Design:
 * - D1 is a local replica / cache of Airtable data.
 * - For new writes we always attempt Airtable first, but we *also* write to D1.
 * - When Airtable is unavailable, D1 still supports reads, and can receive writes
 *   in a future enhancement (pending-* IDs).
 */

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
 * @returns {Promise<null | { local_id: string, record_id: string }>}
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
 * List journal entries for a project local_id (UUID used in URLs),
 * most recent first.
 *
 * journal_entries schema:
 *  - record_id        TEXT PRIMARY KEY       // Airtable ID when known
 *  - project          TEXT                   // Airtable project record id (rec...)
 *  - category         TEXT
 *  - content          TEXT
 *  - tags             TEXT                   // JSON string
 *  - createdat        TEXT                   // ISO datetime
 *  - local_project_id TEXT                   // UUID used in URLs
 *
 * @param {any} env
 * @param {string} localProjectId
 * @returns {Promise<Array<{
 *   id: string | null,
 *   project: string | null,
 *   category: string,
 *   content: string,
 *   tags: string[],
 *   createdAt: string | null
 * }>>}
 */
export async function d1ListJournalEntriesByLocalProject(env, localProjectId) {
	if (!localProjectId) return [];
	const rows = await d1All(env, `
		SELECT
			record_id,
			project,
			category,
			content,
			tags,
			createdat
		FROM journal_entries
		WHERE local_project_id = ?
		ORDER BY datetime(createdat) DESC
	`, [String(localProjectId)]);

	return rows.map(row => {
		let tags = [];
		if (typeof row.tags === "string" && row.tags.trim()) {
			try {
				const parsed = JSON.parse(row.tags);
				if (Array.isArray(parsed)) tags = parsed.map(String);
			} catch {
				tags = [];
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

/**
 * Insert a journal entry row into D1.
 *
 * journal_entries schema (from your migration):
 *  - record_id        TEXT PRIMARY KEY       // Airtable ID when known
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
 *   localProjectId?: string | null
 * }} row
 */
export async function d1InsertJournalEntry(env, row) {
	const recordId = row.recordId || null;
	const projectRecordId = row.projectRecordId || null;
	const createdAt = row.createdAt || new Date().toISOString();
	const localProjectId = row.localProjectId || null;

	let tagsJson;
	if (Array.isArray(row.tags)) {
		tagsJson = JSON.stringify(row.tags.map(String));
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
		localProjectId
	]);

	return {
		record_id: recordId,
		project: projectRecordId,
		category: row.category,
		content: row.content,
		tags: tagsJson,
		createdat: createdAt,
		local_project_id: localProjectId
	};
}

/**
 * Update a journal entry row in D1 by record_id (Airtable id).
 *
 * @param {any} env
 * @param {string} recordId
 * @param {{ category?: string, content?: string, tags?: string[] | string }} patch
 */
export async function d1UpdateJournalEntry(env, recordId, patch) {
	if (!recordId) return;

	const sets = [];
	const params = [];

	if (Object.prototype.hasOwnProperty.call(patch, "category")) {
		sets.push("category = ?");
		params.push(patch.category || "");
	}

	if (Object.prototype.hasOwnProperty.call(patch, "content")) {
		sets.push("content = ?");
		params.push(patch.content || "");
	}

	if (Object.prototype.hasOwnProperty.call(patch, "tags")) {
		let tagsText;
		if (Array.isArray(patch.tags)) {
			tagsText = JSON.stringify(patch.tags.map(String));
		} else if (typeof patch.tags === "string") {
			tagsText = patch.tags;
		} else {
			tagsText = "[]";
		}
		sets.push("tags = ?");
		params.push(tagsText);
	}

	if (!sets.length) return;

	params.push(recordId);

	const sql = `
		UPDATE journal_entries
		SET ${sets.join(", ")}
		WHERE record_id = ?
	`;

	await d1Run(env, sql, params);
}

/**
 * Delete a journal entry row in D1 by record_id (Airtable id).
 *
 * @param {any} env
 * @param {string} recordId
 */
export async function d1DeleteJournalEntry(env, recordId) {
	if (!recordId) return;
	await d1Run(env, `
		DELETE FROM journal_entries
		WHERE record_id = ?
	`, [recordId]);
}