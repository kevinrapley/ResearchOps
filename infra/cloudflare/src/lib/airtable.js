// /infra/cloudflare/src/lib/airtable.js
const API = "https://api.airtable.com/v0";

export function airtable(env) {
	const base = `${API}/${env.AIRTABLE_BASE_ID}`;
	const headers = {
		"authorization": `Bearer ${env.AIRTABLE_API_KEY}`,
		"content-type": "application/json"
	};
        return {
                async list(table, { maxRecords = 100, filterByFormula = "" } = {}) {
                        const url = new URL(`${base}/${encodeURIComponent(table)}`);
                        url.searchParams.set("maxRecords", String(maxRecords));
                        if (filterByFormula) url.searchParams.set("filterByFormula", filterByFormula);
                        const res = await fetch(url.toString(), { headers });
                        if (!res.ok) throw new Error(`Airtable list failed: ${res.status}`);
                        return res.json();
                },
                async create(table, fields) {
                        const encoded = encodeLinkedRecordFields(fields);
                        const res = await fetch(`${base}/${encodeURIComponent(table)}`, { method: "POST", headers, body: JSON.stringify({ fields: encoded }) });
                        if (!res.ok) throw new Error(`Airtable create failed: ${res.status}`);
                        return res.json();
                },
                async update(table, recordId, fields) {
                        const encoded = encodeLinkedRecordFields(fields);
                        const res = await fetch(`${base}/${encodeURIComponent(table)}/${recordId}`, { method: "PATCH", headers, body: JSON.stringify({ fields: encoded }) });
                        if (!res.ok) throw new Error(`Airtable update failed: ${res.status}`);
                        return res.json();
                }
        };
}

/**
 * Ensure linked-record fields conform to Airtable's array-of-strings contract.
 * Airtable expects `fields.MyLink` to be an array of record IDs (strings), even
 * when linking a single record. This helper leaves other field types untouched
 * while coercing lone record IDs into arrays.
 * @param {Record<string, unknown>} fields
 * @returns {Record<string, unknown>}
 */
function encodeLinkedRecordFields(fields = {}) {
        const out = {};
        for (const [key, value] of Object.entries(fields || {})) {
                if (typeof value === "string" && isAirtableRecordId(value)) {
                        out[key] = [value];
                } else {
                        out[key] = value;
                }
        }
        return out;
}

/**
 * Airtable record IDs begin with "rec" followed by 14 base-62 characters.
 * @param {unknown} value
 */
function isAirtableRecordId(value) {
        return typeof value === "string" && /^rec[a-zA-Z0-9]{14}$/.test(value);
}
