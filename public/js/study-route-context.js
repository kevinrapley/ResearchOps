/**
 * @file public/js/study-route-context.js
 * @module study-route-context
 * @summary Shared resolver for Study pages that use a canonical Study record ID URL.
 */

function resolveApiBase() {
	const explicit =
		document.documentElement?.dataset?.apiOrigin ||
		window.API_ORIGIN ||
		window.RESEARCHOPS_API_ORIGIN ||
		"";
	return String(explicit || "").trim().replace(/\/+$/, "");
}

export const API_ORIGIN = resolveApiBase();

export function apiUrl(path) {
	const p = String(path || "");
	return `${API_ORIGIN}${p.startsWith("/") ? p : "/" + p}`;
}

export function route(path, params = {}) {
	const url = new URL(path, window.location.origin);
	for (const [key, value] of Object.entries(params)) {
		if (value) url.searchParams.set(key, value);
	}
	return `${url.pathname}${url.search}`;
}

export async function jsonFetch(url, options = {}) {
	const response = await fetch(url, {
		cache: "no-store",
		credentials: "include",
		...options,
		headers: {
			Accept: "application/json",
			...(options.headers || {})
		}
	});
	const contentType = (response.headers.get("content-type") || "").toLowerCase();
	if (!contentType.includes("application/json")) {
		const preview = await response.text().catch(() => "");
		throw new Error(`Request returned non-JSON (${response.status}) ${preview.slice(0, 120)}`);
	}
	const text = await response.text();
	const body = text ? JSON.parse(text) : {};
	if (!response.ok || body?.ok === false) {
		throw new Error(body?.error || body?.detail || `Request failed (${response.status})`);
	}
	return body;
}

export function fallbackStudyTitle(study = {}) {
	const method = (study.method || "Study").trim();
	const date = study.createdAt ? new Date(study.createdAt) : new Date();
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${method} — ${year}-${month}-${day}`;
}

export function studyTitle(study = {}) {
	return (study.title || study.Title || "").trim() || fallbackStudyTitle(study);
}

export function linkedProjectIdForStudy(study = {}) {
	return (
		study.projectId ||
		study.project_id ||
		study.projectRecordId ||
		study.project_record_id ||
		(Array.isArray(study.projectIds) ? study.projectIds[0] : "") ||
		(Array.isArray(study.project_ids) ? study.project_ids[0] : "") ||
		""
	);
}

export async function loadStudyById(studyId) {
	const url = new URL(apiUrl("/api/studies"), window.location.origin);
	url.searchParams.set("id", studyId);
	const body = await jsonFetch(url.toString());
	const studies = Array.isArray(body?.studies) ? body.studies : [];
	const study = body?.study || studies.find(item => item?.id === studyId || item?.recordId === studyId || item?.airtableId === studyId) || null;
	if (!study?.id) throw new Error("Could not load the Study record.");
	return study;
}

export async function loadProjectById(projectId) {
	if (!projectId) return null;
	try {
		const body = await jsonFetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}`));
		return body?.project || body || null;
	} catch (error) {
		console.warn("[study-route-context] project lookup failed", error);
		return null;
	}
}

export async function resolveStudyContextFromUrl(params = new URLSearchParams(window.location.search)) {
	const canonicalStudyId = params.get("id") || "";
	const legacyProjectId = params.get("pid") || "";
	const legacyStudyId = params.get("sid") || "";

	if (canonicalStudyId) {
		const study = await loadStudyById(canonicalStudyId);
		const projectId = linkedProjectIdForStudy(study);
		if (!projectId) throw new Error("The Study record does not include a linked Project record.");
		const project = await loadProjectById(projectId);
		return { projectId, studyId: study.id || canonicalStudyId, project, study, routeMode: "canonical" };
	}

	if (legacyProjectId && legacyStudyId) {
		const study = await loadStudyById(legacyStudyId);
		const projectId = linkedProjectIdForStudy(study);
		if (projectId && projectId !== legacyProjectId) {
			throw new Error("The legacy project and study URL does not match the linked records.");
		}
		const resolvedProjectId = projectId || legacyProjectId;
		const project = await loadProjectById(resolvedProjectId);
		return { projectId: resolvedProjectId, studyId: study.id || legacyStudyId, project, study, routeMode: "legacy-resolved" };
	}

	throw new Error("The page needs a Study record ID in the URL.");
}

export function canonicalStudyRouteParams(studyId) {
	return { id: studyId };
}
