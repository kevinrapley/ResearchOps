/**
 * @file variable-utils.js
 * @summary Lightweight utilities for Discussion Guides variable handling (JSON-only).
 * @description
 * - No coupling to editor or persistence.
 * - No duplication of helpers that live inside guides-page.js.
 */

/**
 * Deep clone a plain object.
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function clonePlainObject(obj) {
	return JSON.parse(JSON.stringify(obj ?? {}));
}

/**
 * Deterministic JSON stringify (stable key order).
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
 * Parse a text input into a useful JS type.
 * @param {string} input
 * @returns {any}
 */
export function smartParse(input) {
	const s = (input ?? "").trim();
	if (s === "") return "";
	try {
		return JSON.parse(s);
	} catch {
		if (/^(true|false)$/i.test(s)) return /^true$/i.test(s);
		if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
		return s;
	}
}

/**
 * Convert a JS value into a string for display.
 * @param {any} value
 * @returns {string}
 */
export function toDisplayString(value) {
	if (value == null) return "";
	if (typeof value === "string") return value;
	try {
		const json = JSON.stringify(value);
		return json.length > 80 ? JSON.stringify(value, null, 2) : json;
	} catch {
		return String(value);
	}
}

/**
 * Simple equality via stable JSON.
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
export function shallowEqualByJSON(a, b) {
	return stableStringify(a) === stableStringify(b);
}

/* ------------------------------------------------------------------
   The following four functions are required by guide-editor-enhanced.js
   ------------------------------------------------------------------ */

/**
 * Basic template validation: unclosed braces + unused vars.
 * @param {string} template
 * @param {Record<string, any>} vars
 * @returns {{ valid:boolean, errors:string[] }}
 */
export function validateTemplate(template, vars = {}) {
	const errors = [];
	if ((template.match(/{{[^}]*$/g) || []).length)
		errors.push("Unclosed Mustache tag.");
	const unused = Object.keys(vars).filter(k => !template.includes(`{{${k}`));
	if (unused.length)
		errors.push(`Unused variables: ${unused.join(", ")}`);
	return { valid: errors.length === 0, errors };
}

/**
 * Format a validation result into GOV.UK-friendly HTML.
 * @param {{valid:boolean, errors:string[]}} result
 * @returns {string}
 */
export function formatValidationReport(result) {
	if (result.valid)
		return '<p class="muted">✔ Template valid</p>';
	return `<ul class="govuk-error-summary__list">${result.errors
		.map(e => `<li>${e}</li>`)
		.join("")}</ul>`;
}

/**
 * Suggest missing variables found in template.
 * @param {string} template
 * @param {Record<string, any>} vars
 * @returns {Record<string, string>}
 */
export function suggestVariables(template, vars = {}) {
	const re = /{{\s*([a-zA-Z0-9_.]+)\s*}}/g;
	const suggestions = {};
	let m;
	while ((m = re.exec(template)) !== null) {
		const key = m[1];
		if (!(key in vars)) suggestions[key] = "";
	}
	return suggestions;
}

/**
 * Count each variable’s usage frequency in the template.
 * @param {string} template
 * @returns {Record<string, number>}
 */
export function countVariableUsage(template) {
	const re = /{{\s*([a-zA-Z0-9_.]+)\s*}}/g;
	const usage = {};
	let m;
	while ((m = re.exec(template)) !== null) {
		const key = m[1];
		usage[key] = (usage[key] || 0) + 1;
	}
	return usage;
}