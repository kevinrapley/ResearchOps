/**
 * @file /components/guides/context.js
 * @module GuidesContext
 * @summary Normalises project/study shape and builds the render context for Mustache.
 *
 * @description
 * Ensures `study.title` is always present and NEVER falls back to `description`.
 * Title precedence:
 *   1) study.title (string, trimmed)
 *   2) study.Title (Airtable capitalised field)
 *   3) Fallback: `${method} — YYYY-MM-DD`
 *
 * Other notes:
 * - Leaves `study.description` as-is (not used as title).
 * - Keeps raw `study.method`, `study.createdAt`, `study.status`, etc.
 */

/**
 * Compute a safe fallback title like: "User Interview — 2025-10-05".
 * @param {{ method?: string, createdAt?: string }} s
 * @returns {string}
 */
export function fallbackStudyTitle(s = {}) {
	const method = (s.method || "Study").trim();
	const d = s.createdAt ? new Date(s.createdAt) : new Date();
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(d.getUTCDate()).padStart(2, "0");
	return `${method} — ${yyyy}-${mm}-${dd}`;
}

/**
 * Ensure the study has a correct `title` property populated.
 * @param {any} s
 * @returns {any} a shallow clone with a guaranteed `title`
 */
export function normaliseStudy(s = {}) {
	const explicit = (s.title || s.Title || "").toString().trim();
	const safeTitle = explicit || fallbackStudyTitle(s);
	// NEVER derive title from description
	return { ...s, title: safeTitle };
}

/**
 * Build the Mustache rendering context.
 * @param {{
 *   project?: any,
 *   study?: any,
 *   session?: any,
 *   participant?: any,
 *   meta?: Record<string, any>
 * }} inCtx
 * @returns {{
 *   project: any,
 *   study: any,
 *   session: any,
 *   participant: any,
 *   meta: Record<string, any>
 * }}
 */
export function buildContext(inCtx = {}) {
	const project = inCtx.project || {};
	const study = normaliseStudy(inCtx.study || {});
	const session = inCtx.session || {};
	const participant = inCtx.participant || {};
	const meta = { ...(inCtx.meta || {}) };

	return { project, study, session, participant, meta };
}
