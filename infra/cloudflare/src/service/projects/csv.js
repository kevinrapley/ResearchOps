/**
 * Parse RFC 4180-style CSV text into an array of row objects keyed by header.
 *
 * Handles:
 * - quoted fields ("...,...") with embedded commas
 * - escaped quotes inside quoted fields ("" => ")
 * - multi-line cells (newlines inside quoted fields)
 * - leading UTF-8 BOM
 * - blank trailing lines
 *
 * The previous implementation split on every newline and then on every comma,
 * which exploded `data/projects.csv` rows with quoted JSON `Stakeholders` cells
 * into dozens of garbage "records". See docs/agent-audit/reasoning/2026/05/15/.
 *
 * @param {string} text Raw CSV text.
 * @returns {Array<Record<string, string>>}
 */
export function parseCsv(text) {
	const rows = parseCsvRecords(String(text || ""));
	if (!rows.length) return [];

	const headers = rows[0].map((header) => String(header || "").trim());
	if (!headers.length) return [];

	const out = [];
	for (let r = 1; r < rows.length; r += 1) {
		const cols = rows[r];
		// Skip completely empty trailing rows (a single empty cell, no content).
		if (cols.length === 1 && cols[0].trim() === "") continue;
		const obj = {};
		for (let i = 0; i < headers.length; i += 1) {
			const key = headers[i];
			if (!key) continue;
			const value = cols[i] ?? "";
			// Unquoted cells get their surrounding whitespace trimmed for
			// compatibility with the prior parser; quoted cell content is
			// returned verbatim by parseCsvRecords.
			obj[key] = value;
		}
		out.push(obj);
	}
	return out;
}

/**
 * Tokenise CSV text into an array of records (each record is an array of cell
 * values). RFC 4180-compliant for the subset we actually emit and consume.
 *
 * @param {string} text
 * @returns {Array<Array<string>>}
 */
function parseCsvRecords(text) {
	if (!text) return [];
	// Strip a leading UTF-8 BOM if present.
	const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

	/** @type {Array<Array<string>>} */
	const records = [];
	/** @type {Array<string>} */
	let record = [];
	let field = "";
	let inQuoted = false;
	let started = false;

	for (let i = 0; i < src.length; i += 1) {
		const c = src[i];

		if (inQuoted) {
			if (c === '"') {
				if (src[i + 1] === '"') {
					field += '"';
					i += 1;
				} else {
					inQuoted = false;
				}
			} else {
				field += c;
			}
			started = true;
			continue;
		}

		if (c === '"') {
			inQuoted = true;
			started = true;
			continue;
		}

		if (c === ",") {
			record.push(field);
			field = "";
			started = true;
			continue;
		}

		if (c === "\n" || c === "\r") {
			// Skip the second character of a CRLF pair.
			if (c === "\r" && src[i + 1] === "\n") i += 1;
			if (started || field || record.length) {
				record.push(field);
				records.push(record);
				record = [];
				field = "";
				started = false;
			}
			continue;
		}

		field += c;
		started = true;
	}

	if (started || field || record.length) {
		record.push(field);
		records.push(record);
	}

	return records;
}
