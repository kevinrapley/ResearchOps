/**
 * @file src/service/internals/responders.js
 * @summary Small helpers for shaping HTTP responses.
 */

/**
 * JSON response helper (used by the composed service).
 * @param {unknown} body
 * @param {number} [status=200]
 * @param {HeadersInit} [headers]
 * @returns {Response}
 */
export function json(body, status = 200, headers = {}) {
	const hdrs = Object.assign({ "Content-Type": "application/json" }, headers || {});
	return new Response(JSON.stringify(body), { status, headers: hdrs });
}