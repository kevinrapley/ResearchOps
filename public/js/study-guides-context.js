/**
 * @file public/js/study-guides-context.js
 * @module StudyGuidesContext
 * @summary Loads project and study context for the Discussion Guides page.
 */

import {
	apiUrl,
	resolveStudyContextFromUrl,
	route,
	studyTitle
} from './study-route-context.js';

const $ = (selector, root = document) => root.querySelector(selector);

function fallbackTitle(study = {}) {
	const method = (study.method || "Study").trim();
	const date = study.createdAt ? new Date(study.createdAt) : new Date();
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${method} — ${year}-${month}-${day}`;
}

function pickTitle(study = {}) {
	return studyTitle(study) || fallbackTitle(study);
}

async function loadStudies(projectId) {
	const url = new URL(apiUrl("/api/studies"));
	url.searchParams.set("project", projectId);
	const response = await fetch(url.toString(), { cache: "no-store", credentials: "include" });
	const data = await response.json().catch(() => ({}));

	if (!response.ok || data?.ok !== true || !Array.isArray(data.studies)) {
		throw new Error(data?.error || `Studies fetch failed (${response.status})`);
	}

	return data.studies;
}

async function loadProject(projectId) {
	const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}`), {
		cache: "no-store",
		credentials: "include"
	});

	if (!response.ok) return {};
	const body = await response.json().catch(() => ({}));
	return body?.project || body || {};
}

function bindContext({ projectId, studyId, project, study }) {
	const projectBreadcrumb = $("#breadcrumb-project");
	const studyBreadcrumb = $("#breadcrumb-study");
	const studyTitleEl = $("#study-title");
	const backToStudy = $("#back-to-study");
	const canonicalStudyHref = route("/pages/study/", { id: studyId });

	if (projectBreadcrumb) {
		projectBreadcrumb.href = route("/pages/project-dashboard/", { id: projectId });
		projectBreadcrumb.textContent = project?.name || "Project";
	}

	if (studyBreadcrumb) {
		studyBreadcrumb.href = canonicalStudyHref;
		studyBreadcrumb.textContent = pickTitle(study);
	}

	if (studyTitleEl) studyTitleEl.textContent = pickTitle(study);
	if (backToStudy) backToStudy.href = canonicalStudyHref;

	window.__guideCtx = { projectId, studyId, project, study };
}

async function init() {
	try {
		const context = window.__studyRouteContext || await resolveStudyContextFromUrl(new URLSearchParams(location.search));
		const projectId = context.projectId || "";
		const studyId = context.studyId || "";

		if (!projectId || !studyId) throw new Error("Missing Study record ID in URL");

		const project = context.project || await loadProject(projectId);
		let study = context.study || null;
		if (!study?.id) {
			const studies = await loadStudies(projectId);
			study = studies.find((candidate) => candidate.id === studyId) || {};
		}

		bindContext({ projectId, studyId, project, study });
	} catch (error) {
		console.error("[guides] init error:", error);
		window.__guideCtx = { error };
		const studyTitleEl = $("#study-title");
		if (studyTitleEl) studyTitleEl.textContent = "Study context could not be loaded";
	}
}

init();

export { fallbackTitle, pickTitle };
