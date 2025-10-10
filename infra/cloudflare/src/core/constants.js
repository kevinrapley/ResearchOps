/**
 * @file core/constants.js
 * @module core/constants
 * @summary Global constants and immutable defaults for the ResearchOps Worker.
 */

/**
 * @typedef {Object} Defaults
 * @property {number} TIMEOUT_MS Fetch timeout (ms)
 * @property {string} CSV_CACHE_CONTROL Cache-Control header for streamed CSV
 * @property {string} GH_API_VERSION GitHub API version header value
 * @property {number} LOG_BATCH_SIZE Max number of logs to buffer before flush
 * @property {number} MAX_BODY_BYTES Maximum accepted request body size
 */

/**
 * Immutable configuration defaults.
 * @constant
 * @type {Readonly<Defaults>}
 */
export const DEFAULTS = Object.freeze({
	TIMEOUT_MS: 10_000,
	CSV_CACHE_CONTROL: "no-store",
	GH_API_VERSION: "2022-11-28",
	LOG_BATCH_SIZE: 20,
	MAX_BODY_BYTES: 512 * 1024 // 512KB
});