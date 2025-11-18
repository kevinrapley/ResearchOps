/**
 * @file src/service/internals/researchops-d1.js
 * @module service/internals/researchops-d1
 * @summary D1 access helpers for the ResearchOps platform (read + write).
 *
 * Design:
 * - D1 is a local replica / cache of Airtable data.
 * - For new writes we always attempt Airtable first, but we *always* write to D1.
 * - When Airtable is unavailable, D1 still accepts new rows using local placeholder IDs.
 */

/* ─────────────────────── low-level helpers ─────────────────────── */

/**
 * @param {any} env
 */
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
 * @returns {Promise<any[]>}
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
 * Generate a placeholder ID for journal_entries.record_id when Airtable
 * could not create a record yet. This keeps the PRIMARY KEY non-null.
 */
function _pendingId() {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return "pending-" + crypto.randomUUID();
	}
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
 * List journal entries for a project local_id, most recent first.
 * This is used when Airtable is unavailable and we serve from D1 only.
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
export async function d1ListJournalEntriesByLocalProject(env, localProjectId) {
	if (!localProjectId) return [];
	const rows = await d1All(env, `
		SELECT record_id,
		       project,
		       category,
		       content,
		       tags,
		       createdat
		  FROM journal_entries
		 WHERE local_project_id = ?
		 ORDER BY datetime(createdat) DESC;
	`, [localProjectId]);

	return rows.map(row => {
		let tags = [];
		if (typeof row.tags === "string" && row.tags.trim()) {
			try {
				const parsed = JSON.parse(row.tags);
				tags = Array.isArray(parsed) ? parsed : [];
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

/* ─────────────────────── mural boards helpers ─────────────────────── */

/**
 * Resolve a Mural board for a project from D1.
 *
 * Table: mural_boards  (from your CSV import)
 *  - mural_id     TEXT PRIMARY KEY
 *  - project      TEXT       // usually Airtable project id (rec...), but may hold local UUID
 *  - purpose      TEXT       // e.g. "reflexive_journal"
 *  - board_url    TEXT
 *  - workspace_id TEXT
 *
 * We accept both:
 *  - projectRecordId  (Airtable Projects record id, recXXXX…)
 *  - localProjectId   (UUID used in URLs, d04ab3…)
 *
 * and match if mural_boards.project equals either.
 *
 * @param {any} env
 * @param {{ projectRecordId?: string|null, localProjectId?: string|null, purpose?: string }} opts
 * @returns {Promise<null | {
 *   mural_id: string,
 *   board_url: string|null,
 *   workspace_id: string|null,
 *   project: string|null,
 *   purpose: string|null
 * }>}
 */
export async function d1GetMuralBoardForProject(env, opts = {}) {
	const projectRecordId = String(opts.projectRecordId || "").trim();
	const localProjectId = String(opts.localProjectId || "").trim();
	const wantPurpose = String(opts.purpose || "").toLowerCase();

	if (!projectRecordId && !localProjectId) return null;

	// Small table, so a full scan + JS filter is acceptable and more tolerant
	// of how the CSV was imported.
	const rows = await d1All(env, `
		SELECT
			mural_id,
			project,
			purpose,
			board_url,
			workspace_id
		FROM mural_boards;
	`);

	const candidates = rows.filter(row => {
		const projVal = String(row.project || "").trim();
		if (!projVal) return false;

		// Match either Airtable project id or local UUID
		const projectMatch =
			(projectRecordId && projVal === projectRecordId) ||
			(localProjectId && projVal === localProjectId);

		if (!projectMatch) return false;

		if (!wantPurpose) return true;
		const rowPurpose = String(row.purpose || "").toLowerCase();
		return rowPurpose === wantPurpose;
	});

	if (!candidates.length) return null;

	// First match is fine – if you later add updated_at we can order by it.
	const row = candidates[0];

	return {
		mural_id: row.mural_id,
		board_url: row.board_url || null,
		workspace_id: row.workspace_id || null,
		project: row.project || null,
		purpose: row.purpose || null
	};
}
