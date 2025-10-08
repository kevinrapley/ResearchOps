/**
 * @file variable-utils.js
 * @summary Lightweight utilities for Discussion Guides variable handling (JSON-only).
 * @description
 * - No coupling to editor or persistence.
 * - No duplication of helpers that live inside guides-page.js.
 */

/**
 * Deep clone a plain object safely.
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function clonePlainObject(obj) {
	return JSON.parse(JSON.stringify(obj ?? {}));
}

/**
 * Deterministic JSON stringify (stable key order).
 * Useful for tests, diffs, and predictable payload logs.
 * @param {any} obj
 * @param {number} [space=2]
 * @returns {string}
 */
export function stableStringify(obj, space = 2) {
	const keys = new Set();
	JSON.stringify(obj, (k, v) => (keys.add(k), v));
	return JSON.stringify(obj, Array.from(keys).sort(), space);
}

/**
 * Parse a free-text value into the most sensible JSON type.
 * - Tries JSON.parse for objects/arrays/numbers/booleans/null.
 * - Falls back to trimmed string.
 * @param {string} input
 * @returns {any}
 */
export function smartParse(input) {
	const s = (input ?? "").trim();
	if (s === "") return "";
	try {
		// Fast path for primitives/structures
		return JSON.parse(s);
	} catch {
		// Heuristics for bare booleans/numbers without quotes
		if (/^(true|false)$/i.test(s)) return /^true$/i.test(s);
		if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
		return s;
	}
}

/**
 * Convert any value into a compact, user-friendly string for editing.
 * - Strings return as-is.
 * - Objects/arrays return JSON (single line when short, pretty when long).
 * @param {any} value
 * @returns {string}
 */
export function toDisplayString(value) {
	if (value == null) return "";
	if (typeof value === "string") return value;
	try {
		const json = JSON.stringify(value);
		// Pretty print only if long/complex
		return json.length > 80 ? JSON.stringify(value, null, 2) : json;
	} catch {
		return String(value);
	}
}

/**
 * Shallow equality by stable JSON (adequate for variable form fields).
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
export function shallowEqualByJSON(a, b) {
	return stableStringify(a) === stableStringify(b);
}