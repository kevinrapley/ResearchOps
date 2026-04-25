/**
 * @file public/js/study-page.js
 * @module study-page
 * @summary Loads a study page and renders a readiness-led control page.
 */

const API_ORIGIN = window.RESEARCHOPS_API_ORIGIN || "https://rops-api.kevinrapley.workers.dev";

const $ = (selector, root = document) => root.querySelector(selector);

function apiUrl(path) {
	return new URL(path, API_ORIGIN).toString();
}

function route(path, params) {
	const url = new URL(path, window.location.origin);
	for (const [key, value] of Object.entries(params)) {
		if (value) url.searchParams.set(key, value);
	}
	return `${url.pathname}${url.search}`;
}

function setText(selector, value) {
	const el = $(selector);
	if (el) el.textContent = value || "—";
}

function fallbackTitle(study = {}) {
	const method = (study.method || "Study").trim();
	const d = study.createdAt ? new Date(study.createdAt) : new Date();
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(d.getUTCDate()).padStart(2, "0");
	return `${method} — ${yyyy}-${mm}-${dd}`;
}

function studyTitle(study = {}) {
	return (study.title || study.Title || "").trim() || fallbackTitle(study);
}

function showError(message) {
	const summary = $("#study-error");
	const messageEl = $("#study-error-message");
	if (!summary || !messageEl) return;
	summary.hidden = false;
	summary.removeAttribute("aria-hidden");
	messageEl.textContent = message;
	summary.focus();
}

function hideError() {
	const summary = $("#study-error");
	if (!summary) return;
	summary.hidden = true;
	summary.setAttribute("aria-hidden", "true");
}

async function jsonFetch(url) {
	const response = await fetch(url, { cache: "no-store" });
	const body = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(body?.error || `Request failed (${response.status})`);
	}
	return body;
}

async function loadProject(projectId) {
	const body = await jsonFetch(apiUrl("/api/projects"));
	const projects = Array.isArray(body?.projects) ? body.projects : [];
	return projects.find(project => project.id === projectId) || null;
}

async function loadStudies(projectId) {
	const url = new URL(apiUrl("/api/studies"));
	url.searchParams.set("project", projectId);
	const body = await jsonFetch(url);
	if (body?.ok !== true || !Array.isArray(body.studies)) {
		throw new Error(body?.error || "Could not load studies");
	}
	return body.studies;
}

function enableLink(selector, href) {
	const el = $(selector);
	if (!el) return;
	el.href = href;
	el.classList.remove("link--disabled");
	el.removeAttribute("aria-disabled");
	el.removeAttribute("tabindex");
}

function disableLink(selector, reason) {
	const el = $(selector);
	if (!el) return;
	el.href = "#";
	el.classList.add("link--disabled");
	el.setAttribute("aria-disabled", "true");
	el.setAttribute("tabindex", "-1");
	const reasonEl = el.querySelector(".study-action__reason");
	if (reasonEl) reasonEl.textContent = reason;
}

function setReadinessItem(key, state, text) {
	const item = document.querySelector(`[data-readiness-item="${key}"]`);
	if (!item) return;
	const status = item.querySelector(".readiness-item__status");
	const body = item.querySelector(".readiness-item__body");
	if (status) status.textContent = state;
	if (body) body.textContent = text;
}

function renderReadiness(study) {
	const hasDescription = !!String(study.description || "").trim();
	const status = String(study.status || "").trim() || "Planned";

	setReadinessItem("description", hasDescription ? "Ready" : "Needs attention", hasDescription ? "The study has a description." : "Add a short description before running sessions.");
	setReadinessItem("status", status ? "Set" : "Needs attention", `Study status is ${status}.`);
	setReadinessItem("participants", "Action needed", "Schedule participants or confirm existing participant arrangements.");
	setReadinessItem("guide", "Action needed", "Create or review the discussion guide before running a session.");
	setReadinessItem("consent", "Action needed", "Consent materials and participant consent need to be confirmed.");
	setReadinessItem("session", "Available", "Open the session workspace when the study setup is ready.");
}

function renderRoutes(projectId, studyId) {
	const params = { pid: projectId, sid: studyId };
	enableLink("#back-to-project", route("/pages/project-dashboard/", { id: projectId }));
	enableLink("#breadcrumb-project", route("/pages/project-dashboard/", { id: projectId }));
	enableLink("#link-guides", route("/pages/study/guides/", params));
	enableLink("#link-participants", route("/pages/study/participants/", params));
	enableLink("#link-session", route("/pages/study/session/", params));

	disableLink("#link-consent-forms", "Consent form generation has not been connected yet.");
	disableLink("#link-consent-manage", "Participant consent management has not been connected yet.");
	disableLink("#link-observers", "Observer and note taker setup has not been connected yet.");

	const editStudy = $("#edit-study");
	if (editStudy) editStudy.href = `${route("/pages/study/", params)}#edit`;
}

function renderStudy(project, study, projectId, studyId) {
	const projectName = project?.name || "Project";
	document.body.setAttribute("data-study-id", studyId);
	document.body.setAttribute("data-project-id", projectId);

	setText("#breadcrumb-project", projectName);
	setText("#study-title", studyTitle(study));
	setText("#description", String(study.description || "").trim() || "No study description has been added yet.");
	setText("#kv-method", study.method || "—");
	setText("#kv-status", study.status || "—");
	setText("#kv-studyid", String(study.studyId || "—").toUpperCase());

	renderRoutes(projectId, studyId);
	renderReadiness(study);
}

async function init() {
	hideError();
	const params = new URLSearchParams(window.location.search);
	const projectId = params.get("pid") || "";
	const studyId = params.get("sid") || "";

	if (!projectId || !studyId) {
		showError("The study page needs a project ID and study ID in the URL.");
		return;
	}

	try {
		const [project, studies] = await Promise.all([
			loadProject(projectId),
			loadStudies(projectId)
		]);
		const study = studies.find(item => item.id === studyId);
		if (!study) {
			showError("The requested study could not be found for this project.");
			return;
		}
		renderStudy(project, study, projectId, studyId);
	} catch (error) {
		console.error("[study-page] init failed", error);
		showError("Could not load the study. Check the project and study links, then try again.");
	}
}

document.addEventListener("study:desc:save", async event => {
	const studyId = document.body.getAttribute("data-study-id") || "";
	if (!studyId) return;
	try {
		await fetch(apiUrl(`/api/studies/${encodeURIComponent(studyId)}`), {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ description: event.detail?.markdown || "" })
		});
	} catch (error) {
		console.error("[study-page] description save failed", error);
	}
});

init();
