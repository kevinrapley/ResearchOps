/**
 * @file infra/seed-d1-worker.js
 * @summary One-off seeding Worker: create tables in D1 and import CSV data.
 *
 * Tables covered (from /data/*.csv):
 * - projects.csv
 * - project-details.csv
 * - discussion-guides.csv
 * - codes.csv
 * - memos.csv
 * - journal-entries.csv
 * - journal-excerpts.csv
 * - communications-log.csv
 * - session-notes.csv
 * - partials.csv
 *
 * Binding required in wrangler.toml:
 * [[d1_databases]]
 * binding = "DB"
 * database_name = "researchops-d1"
 * database_id = "..."
 */

const DATA_BASE_URL = 'https://researchops.pages.dev/data/';

// Map CSV files → D1 table names.
const TABLE_SOURCES = [
	{ table: 'projects',            csv: 'projects.csv' },
	{ table: 'project_details',     csv: 'project-details.csv' },
	{ table: 'discussion_guides',   csv: 'discussion-guides.csv' },
	{ table: 'codes',               csv: 'codes.csv' },
	{ table: 'memos',               csv: 'memos.csv' },
	{ table: 'journal_entries',     csv: 'journal-entries.csv' },
	{ table: 'journal_excerpts',    csv: 'journal-excerpts.csv' },
	{ table: 'communications_log',  csv: 'communications-log.csv' },
	{ table: 'session_notes',       csv: 'session-notes.csv' },
	{ table: 'partials',            csv: 'partials.csv' }
];

/**
 * Normalise a CSV header into a safe SQLite column name.
 * Examples:
 *   "Record ID" → "record_id"
 *   "% of something" → "pct_of_something"
 */
function normaliseColumnName(raw) {
	const bomStripped = raw.replace(/\uFEFF/g, '');
	let s = bomStripped.trim();
	s = s.replace(/%/g, 'pct');
	s = s.replace(/[^0-9a-zA-Z]+/g, '_');
	s = s.replace(/_+/g, '_');
	s = s.replace(/^_+|_+$/g, '');
	if (!s) s = 'col';
	if (/^[0-9]/.test(s)) s = 'c_' + s;
	return s.toLowerCase();
}

/**
 * Very small CSV parser that handles:
 * - commas
 * - quoted fields
 * - escaped quotes ("")
 * - newlines inside quoted fields
 */
function parseCsv(text) {
	const rows = [];
	let curRow = [];
	let curField = '';
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const c = text[i];

		if (inQuotes) {
			if (c === '"') {
				const next = text[i + 1];
				if (next === '"') {
					// Escaped quote
					curField += '"';
					i++;
				} else {
					// End quote
					inQuotes = false;
				}
			} else {
				curField += c;
			}
		} else {
			if (c === '"') {
				inQuotes = true;
			} else if (c === ',') {
				curRow.push(curField);
				curField = '';
			} else if (c === '\r' || c === '\n') {
				// End of record
				// Handle CRLF
				if (c === '\r' && text[i + 1] === '\n') i++;
				curRow.push(curField);
				curField = '';

				// Skip completely empty trailing lines
				if (curRow.some(v => v !== '')) {
					rows.push(curRow);
				}
				curRow = [];
			} else {
				curField += c;
			}
		}
	}

	// Final field / row
	if (inQuotes || curField !== '' || curRow.length) {
		curRow.push(curField);
		if (curRow.some(v => v !== '')) {
			rows.push(curRow);
		}
	}

	return rows;
}

function sqlQuote(value) {
	if (value == null) return 'NULL';
	const v = String(value).replace(/'/g, "''");
	return `'${v}'`;
}

/**
 * Decide a primary key column:
 * - If "id" exists, use that.
 * - Else if "record_id" exists, use that.
 * - Otherwise, no explicit primary key.
 */
function choosePrimaryKey(columns) {
	if (columns.includes('id')) return 'id';
	if (columns.includes('record_id')) return 'record_id';
	return null;
}

/**
 * Build CREATE TABLE and INSERT statements from a CSV payload.
 */
function buildSqlFromCsv(tableName, csvText) {
	const rows = parseCsv(csvText);
	if (!rows.length) {
		return { create: null, inserts: [], columns: [] };
	}

	const headerRaw = rows[0];
	const dataRows = rows.slice(1).filter(r => r.some(v => String(v).trim() !== ''));

	const columns = headerRaw.map(normaliseColumnName);
	const pk = choosePrimaryKey(columns);

	const colDefs = columns.map(col => {
		if (col === pk) return `"${col}" TEXT PRIMARY KEY`;
		return `"${col}" TEXT`;
	});

	const createSql =
		`CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ` +
		colDefs.join(',\n  ') +
		`\n);`;

	const inserts = dataRows.map(row => {
		const cells = columns.map((col, idx) => {
			const v = row[idx] != null ? row[idx] : '';
			return sqlQuote(v);
		});
		return `INSERT INTO "${tableName}" (` +
			columns.map(c => `"${c}"`).join(', ') +
			`) VALUES (` +
			cells.join(', ') +
			`);`;
	});

	return { create: createSql, inserts, columns };
}

async function seedTable(env, tableName, csvFile) {
	const url = DATA_BASE_URL + csvFile;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch CSV for ${tableName} from ${url} (${res.status})`);
	}

	const text = await res.text();
	const { create, inserts, columns } = buildSqlFromCsv(tableName, text);

	if (!create) {
		return { table: tableName, created: false, inserted: 0, columns: [] };
	}

	// Create table and insert all rows in one exec per table.
	const allSql = [create, ...inserts].join('\n');
	await env.DB.exec(allSql);

	return {
		table: tableName,
		created: true,
		inserted: inserts.length,
		columns
	};
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		// Simple guard so it can’t be run accidentally from the public UI.
		if (url.pathname !== '/seed') {
			return new Response('Not found', { status: 404 });
		}

		// Optional very-light auth: require a secret token.
		const token = url.searchParams.get('token');
		const expected = env.SEED_SECRET || null;
		if (expected && token !== expected) {
			return new Response('Forbidden', { status: 403 });
		}

		const results = [];
		for (const { table, csv } of TABLE_SOURCES) {
			try {
				const r = await seedTable(env, table, csv);
				results.push({ ok: true, ...r });
			} catch (err) {
				results.push({
					ok: false,
					table,
					error: String(err && err.message || err)
				});
			}
		}

		return new Response(JSON.stringify({ ok: true, results }, null, 2), {
			status: 200,
			headers: { 'content-type': 'application/json; charset=utf-8' }
		});
	}
};
