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
			const res = await fetch(`${base}/${encodeURIComponent(table)}`, { method: "POST", headers, body: JSON.stringify({ fields }) });
			if (!res.ok) throw new Error(`Airtable create failed: ${res.status}`);
			return res.json();
		},
		async update(table, recordId, fields) {
			const res = await fetch(`${base}/${encodeURIComponent(table)}/${recordId}`, { method: "PATCH", headers, body: JSON.stringify({ fields }) });
			if (!res.ok) throw new Error(`Airtable update failed: ${res.status}`);
			return res.json();
		}
	};
}
