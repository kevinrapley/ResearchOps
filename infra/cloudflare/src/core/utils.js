/**
 * @file core/utils.js
 * @module core/utils
 * @summary Shared utility functions for the ResearchOps Worker.
 */

import { DEFAULTS } from "./constants.js";

/**
 * Fetch with a hard timeout.
 * @async
 * @param {RequestInfo | URL} resource
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs=DEFAULTS.TIMEOUT_MS]
 * @returns {Promise<Response>}
 * @throws {Error} If aborted due to timeout.
 */
export async function fetchWithTimeout(resource, init, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort("timeout"), timeoutMs);
	try {
		const initSafe = Object.assign({}, init || {});
		initSafe.signal = controller.signal;
		return await fetch(resource, initSafe);
	} finally {
		clearTimeout(id);
	}
}

/**
 * CSV-escape a single value.
 * @param {unknown} val
 * @returns {string}
 */
export function csvEscape(val) {
	if (val == null) return "";
	let s = String(val);
	if (/^[=+\-@]/.test(s)) s = "'" + s; // neutralize formula
	const needsQuotes = /[",\r\n]/.test(s);
	const esc = s.replace(/"/g, '""');
	return needsQuotes ? `"${esc}"` : esc;
}

/**
 * Convert an array to a CSV line.
 * @param {Array<unknown>} arr
 * @returns {string}
 */
export function toCsvLine(arr) {
	return arr.map(csvEscape).join(",") + "\n";
}

/**
 * Base64 encode (UTF-8 safe).
 * @param {string} s
 * @returns {string}
 */
export function b64Encode(s) {
	const bytes = new TextEncoder().encode(s);
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin);
}

/**
 * Base64 decode (UTF-8 safe).
 * @param {string} b64
 * @returns {string}
 */
export function b64Decode(b64) {
	const bin = atob(String(b64 || "").replace(/\s+/g, ""));
	const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

/**
 * Truncate long text for logs.
 * @param {string} t
 * @returns {string}
 */
export function safeText(t) {
	return t && t.length > 2048 ? t.slice(0, 2048) + "…" : t;
}

/**
 * Parse date string to epoch ms; invalid → 0.
 * @param {string} d
 * @returns {number}
 */
export function toMs(d) {
	const n = Date.parse(d);
	return Number.isFinite(n) ? n : 0;
}

/**
 * Normalise Markdown for Airtable Rich Text fields (server-side).
 * - Normalises line endings to "\n"
 * - Trims outer whitespace
 * - Collapses >2 blank lines to 2
 * - Converts tabs to N spaces (default 2)
 * - Trims trailing spaces at line ends
 * @param {string} markdown
 * @param {{collapseBlank?:boolean, tabSize?:number}} [opts]
 * @returns {string}
 */
export function mdToAirtableRich(markdown, opts = {}) {
	const tabSize = Math.max(1, opts.tabSize ?? 2);
	const collapseBlank = opts.collapseBlank ?? true;

	let md = String(markdown ?? "");
	md = md.replace(/\r\n?/g, "\n"); // normalise line endings
	md = md.replace(/\t/g, " ".repeat(tabSize)); // tabs → spaces
	md = md.split("\n").map(l => l.replace(/[ \t]+$/g, "")).join("\n"); // strip trailing ws per line
	if (collapseBlank) md = md.replace(/\n{3,}/g, "\n\n"); // collapse 3+ blank lines
	return md.trim();
}

/**
 * Pick the first present key from `obj` that matches any of the candidates.
 * @param {Record<string, any>} obj
 * @param {string[]} candidates
 * @returns {string|null}
 */
export function pickFirstField(obj, candidates) {
	if (!obj || typeof obj !== "object") return null;
	for (const k of candidates)
		if (Object.prototype.hasOwnProperty.call(obj, k)) return k;
	return null;
}

/**
 * Attempt an Airtable write with a field name; on 422 UNKNOWN_FIELD_NAME, tell caller to try next.
 * Returns {ok:true, json} OR {ok:false, retry:true, detail} for UNKNOWN_FIELD_NAME; OR {ok:false, retry:false, detail}
 * @param {string} url
 * @param {string} token
 * @param {"POST"|"PATCH"} method
 * @param {Record<string, any>} fields
 * @param {number} timeoutMs
 * @returns {Promise<{ok:true,json:any}|{ok:false,retry:boolean,detail?:string,status?:number}>}
 */
export async function airtableTryWrite(url, token, method, fields, timeoutMs) {
	const res = await fetchWithTimeout(url, {
		method,
		headers: {
			"Authorization": `Bearer ${token}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({ records: [{ fields }] })
	}, timeoutMs);

	const text = await res.text();
	if (res.ok) {
		try { return { ok: true, json: JSON.parse(text) }; } catch { return { ok: true, json: { records: [] } }; }
	}

	// Detect UNKNOWN_FIELD_NAME to allow retry with another candidate
	let retry = false;
	try {
		const js = JSON.parse(text);
		retry = js?.error?.type === "UNKNOWN_FIELD_NAME";
	} catch {}
	return { ok: false, retry, detail: safeText(text), status: res.status };
}