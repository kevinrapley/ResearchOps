// /components/guides/context.js
/**
 * @typedef {{
 *   project?: any,
 *   study?: { title?: string, Title?: string, description?: string, method?: string, createdAt?: string } | any,
 *   session?: any,
 *   participant?: any,
 *   meta?: Record<string, any>
 * }} CtxIn
 */

/** Compute Airtable-like fallback title. */
function computeStudyTitle({ description = '', method = '', createdAt = '' } = {}) {
	if (description && String(description).trim()) return String(description).trim().slice(0, 80);
	const d = createdAt ? new Date(createdAt) : new Date();
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(d.getUTCDate()).padStart(2, '0');
	return `${method || 'Study'} — ${yyyy}-${mm}-${dd}`;
}

/**
 * @param {CtxIn} param0
 * @returns {{ project:any, study:any, session:any, participant:any, meta:Record<string,any> }}
 */
export function buildContext({ project = {}, study = {}, session = {}, participant = {}, meta = {} } = {}) {
	const safeStudy = { ...study, title: study.title || study.Title || computeStudyTitle(study) };
	return { project, study: safeStudy, session, participant, meta };
}
