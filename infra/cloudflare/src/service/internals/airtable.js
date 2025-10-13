/**
 * @file internals/airtable.js
 * @module service/internals/airtable
 * @summary Thin Airtable helper layer used by feature modules.
 *
 * Centralises URL building, headers, pagination, and resilient writes so that
 * feature modules (studies, guides, participants, sessions, etc.) can stay
 * small and focused on business logic.
 */

import { fetchWithTimeout, safeText, airtableTryWrite } from "../../core/utils.js";
import { DEFAULTS } from "../../core/constants.js";

/**
 * Build the base Airtable REST URL for a given table.
 *
 * @param {import("../index.js").Env} env
 * @param {string} tableName
 * @returns {string}
 */
export function makeTableUrl(env, tableName) {
	const base = env.AIRTABLE_BASE_ID;
	const t = encodeURIComponent(tableName);
	return `https://api.airtable.com/v0/${base}/${t}`;
}

/**
 * Build the Authorization + common headers for Airtable calls.
 *
 * @param {import("../index.js").Env} env
 * @returns {Record<string,string>}
 */
export function authHeaders(env) {
	return {
		"Authorization": `Bearer ${env.AIRTABLE_API_KEY}`,
		"Content-Type": "application/json",
		"Accept": "application/json"
	};
}

/**
 * List *all* records from a table, automatically paging via `offset`.
 * Does not restrict fields; caller can filter after fetching.
 *
 * @async
 * @param {import("../index.js").Env} env
 * @param {string} tableName
 * @param {{pageSize?:number, extraParams?:Record<string,string>}} [opts]
 * @param {number} [timeoutMs=DEFAULTS.TIMEOUT_MS]
 * @returns {Promise<{records:Array<any>, pages:number}>}
 * @throws {Error} on HTTP failure
 */
export async function listAll(env, tableName, opts = {}, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const pageSize = Math.min(Math.max(parseInt(String(opts.pageSize ?? 100), 10), 1), 100);
	const base = makeTableUrl(env, tableName);
	const headers = authHeaders(env);

	const all = [];
	let offset;
	let pages = 0;

	do {
		const params = new URLSearchParams({ pageSize: String(pageSize) });
		if (offset) params.set("offset", offset);
		if (opts.extraParams) {
			for (const [k, v] of Object.entries(opts.extraParams)) {
				if (v != null) params.set(k, String(v));
			}
		}

		const url = `${base}?${params.toString()}`;
		const resp = await fetchWithTimeout(url, { headers }, timeoutMs);
		const txt = await resp.text();

		if (!resp.ok) {
			throw new Error(`Airtable ${resp.status}: ${safeText(txt)}`);
		}

		/** @type {{records?:Array<any>, offset?:string}} */
		let js;
		try { js = JSON.parse(txt); } catch { js = { records: [] }; }
		all.push(...(js.records || []));
		offset = js.offset;
		pages += 1;
	} while (offset);

	return { records: all, pages };
}

/**
 * Read a single record by ID.
 * If Airtable returns 404 (NOT_FOUND), fall back to a filtered list using
 * filterByFormula: RECORD_ID() = 'id' (some integrations/views can cause
 * the record endpoint to 404 even when the record is visible in list queries).
 *
 * @async
 * @param {import("../index.js").Env} env
 * @param {string} tableName
 * @param {string} id
 * @param {number} [timeoutMs=DEFAULTS.TIMEOUT_MS]
 * @returns {Promise<any>} Airtable single-record JSON (shape: { id, fields, createdTime })
 * @throws {Error} on HTTP failure (non-404) or if not found in fallback
 */
export async function getRecord(env, tableName, id, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const url = `${makeTableUrl(env, tableName)}/${encodeURIComponent(id)}`;
	const headers = authHeaders(env);

	// Primary: record endpoint
	{
		const res = await fetchWithTimeout(url, { headers }, timeoutMs);
		const txt = await res.text();
		if (res.ok) {
			try { return JSON.parse(txt); } catch { return {}; }
		}
		// If NOT_FOUND, we’ll try a query-based fallback next
		if (res.status !== 404) {
			throw new Error(`Airtable ${res.status}: ${safeText(txt)}`);
		}
	}

	// Fallback: list with filterByFormula on RECORD_ID()
	{
		const base = makeTableUrl(env, tableName);
		const params = new URLSearchParams({
			pageSize: "1",
			filterByFormula: `RECORD_ID()='${id}'`
		});
		const listUrl = `${base}?${params.toString()}`;
		const res2 = await fetchWithTimeout(listUrl, { headers }, timeoutMs);
		const txt2 = await res2.text();

		if (!res2.ok) {
			throw new Error(`Airtable ${res2.status}: ${safeText(txt2)}`);
		}

		/** @type {{records?: Array<any>}} */
		let js2;
		try { js2 = JSON.parse(txt2); } catch { js2 = { records: [] }; }
		const rec = (js2.records || [])[0];
		if (!rec) {
			// Still not found → surface a clear NOT_FOUND error
			throw new Error(`Airtable 404: NOT_FOUND (record ${id} in table "${tableName}")`);
		}
		return rec;
	}
}

/**
 * Create records (bulk POST).
 *
 * @async
 * @param {import("../index.js").Env} env
 * @param {string} tableName
 * @param {Array<{fields:Record<string,any>}>} records
 * @param {number} [timeoutMs=DEFAULTS.TIMEOUT_MS]
 * @returns {Promise<any>}
 * @throws {Error} on HTTP failure
 */
export async function createRecords(env, tableName, records, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const url = makeTableUrl(env, tableName);
	const res = await fetchWithTimeout(url, {
		method: "POST",
		headers: authHeaders(env),
		body: JSON.stringify({ records })
	}, timeoutMs);

	const txt = await res.text();
	if (!res.ok) throw new Error(`Airtable ${res.status}: ${safeText(txt)}`);
	try { return JSON.parse(txt); } catch { return { records: [] }; }
}

/**
 * Patch records (bulk PATCH).
 *
 * @async
 * @param {import("../index.js").Env} env
 * @param {string} tableName
 * @param {Array<{id:string, fields:Record<string,any>}>} records
 * @param {number} [timeoutMs=DEFAULTS.TIMEOUT_MS]
 * @returns {Promise<any>}
 * @throws {Error} on HTTP failure
 */
export async function patchRecords(env, tableName, records, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const url = makeTableUrl(env, tableName);
	const res = await fetchWithTimeout(url, {
		method: "PATCH",
		headers: authHeaders(env),
		body: JSON.stringify({ records })
	}, timeoutMs);

	const txt = await res.text();
	if (!res.ok) throw new Error(`Airtable ${res.status}: ${safeText(txt)}`);
	try { return JSON.parse(txt); } catch { return { records: [] }; }
}

/**
 * Delete a single record by ID.
 *
 * @async
 * @param {import("../index.js").Env} env
 * @param {string} tableName
 * @param {string} id
 * @param {number} [timeoutMs=DEFAULTS.TIMEOUT_MS]
 * @returns {Promise<any>}
 * @throws {Error} on HTTP failure
 */
export async function deleteRecord(env, tableName, id, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const url = `${makeTableUrl(env, tableName)}/${encodeURIComponent(id)}`;
	const res = await fetchWithTimeout(url, {
		method: "DELETE",
		headers: { "Authorization": `Bearer ${env.AIRTABLE_API_KEY}` }
	}, timeoutMs);

	const txt = await res.text();
	if (!res.ok) throw new Error(`Airtable ${res.status}: ${safeText(txt)}`);
	try { return JSON.parse(txt); } catch { return {}; }
}

/**
 * Resilient create/update helper that returns retry hints on common 422s
 * (e.g., UNKNOWN_FIELD_NAME). Thin wrapper around the shared util.
 *
 * @async
 * @param {import("../index.js").Env} env
 * @param {string} tableName
 * @param {"POST"|"PATCH"} method
 * @param {Record<string,any>} fields
 * @param {number} [timeoutMs=DEFAULTS.TIMEOUT_MS]
 * @returns {Promise<{ok:true,json:any} | {ok:false,retry:boolean,detail?:string,status?:number}>}
 */
export async function tryWrite(env, tableName, method, fields, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const url = makeTableUrl(env, tableName);
	return airtableTryWrite(url, env.AIRTABLE_API_KEY, method, fields, timeoutMs);
}
