/**
 * @file /js/project-context.js
 * @summary Hydrates project route breadcrumbs, parent links and page feedback placement from the ?id= project context.
 */

const API_ORIGIN = resolveApiBase();

function resolveApiBase() {
	const explicit = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || "";
	return String(explicit || "").trim().replace(/\/+$/, "");
}

function projectApiUrl(path) {
	const value = String(path || "");
	return `${API_ORIGIN}${value.startsWith("/") ? value : "/" + value}`;
}

function firstPresent(...values) {
	for (const value of values) {
		if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
	}
	return "";
}

function projectPayloadFrom(data = {}) {
	return data?.project || data?.record || data;
}

function normaliseProject(project = {}) {
	const source = projectPayloadFrom(project);
	const publicId = firstPresent(source.id, source.airtableId, source.recordId, source.LocalId, source.localId);
	return {
		id: publicId,
		localId: firstPresent(source.localId, source.LocalId, publicId),
		airtableId: firstPresent(source.airtableId, source.recordId, publicId),
		name: firstPresent(source.name, source.Name, source.title, source.Title)
	};
}

async function readJsonResponse(response, label) {
	const data = await response.json().catch(() => null);
	if (!response.ok || data?.ok === false) {
		throw new Error(data?.error || data?.detail || `${label} load failed (${response.status})`);
	}
	return data;
}

async function loadProjectFromRecord(projectId) {
	const response = await fetch(projectApiUrl(`/api/projects/${encodeURIComponent(projectId)}?ts=${Date.now()}`), {
		cache: "no-store",
		credentials: "include"
	});
	return normaliseProject(await readJsonResponse(response, "Project"));
}

async function loadProjects() {
	const response = await fetch(projectApiUrl(`/api/projects?limit=200&ts=${Date.now()}`), {
		cache: "no-store",
		credentials: "include"
	});
	const data = await readJsonResponse(response, "Projects list");
	const list = Array.isArray(data) ? data : Array.isArray(data?.projects) ? data.projects : [];
	return list.map(normaliseProject);
}

function findProject(projects, projectId) {
	const requested = String(projectId || "").trim();
	return projects.find((project) => [project.id, project.localId, project.airtableId].includes(requested)) || null;
}

async function loadProject(projectId) {
	try {
		return await loadProjectFromRecord(projectId);
	} catch (recordError) {
		console.warn("[project-context] Project record load failed; falling back to project list", recordError);
		return findProject(await loadProjects(), projectId);
	}
}

function dashboardHref(projectId) {
	return `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;
}

function setProjectAnchor(anchor, project) {
	if (!anchor || !project) return;
	const projectId = project.id || project.localId || project.airtableId;

	anchor.textContent = project.name || "Project Dashboard";
	anchor.href = dashboardHref(projectId);
}

function findProjectBreadcrumb() {
	return (
		document.getElementById("breadcrumb-project") ||
		document.querySelector('.govuk-breadcrumbs__link[href="/pages/project-dashboard/"]') ||
		document.querySelector('.govuk-breadcrumbs__link[href^="/pages/project-dashboard/?id="]')
	);
}

function ensureProjectActionBar(anchor) {
	if (!anchor) return;

	anchor.classList.remove("govuk-back-link");
	anchor.classList.add("govuk-button", "govuk-button--secondary");

	if (anchor.parentElement?.classList.contains("actions-bar")) return;

	const actionsBar = document.createElement("div");
	actionsBar.className = "actions-bar";
	anchor.parentNode.insertBefore(actionsBar, anchor);
	actionsBar.appendChild(anchor);
}

function setProjectRouteFallback(projectId) {
	const href = dashboardHref(projectId);
	const breadcrumb = findProjectBreadcrumb();
	if (breadcrumb) breadcrumb.href = href;

	const legacyProjectLink = document.getElementById("project-link");
	if (legacyProjectLink) legacyProjectLink.href = href;

	const parentLink = document.getElementById("back-to-project");
	if (parentLink) parentLink.href = href;
}

function setProjectParentLink(anchor, project) {
	if (!anchor || !project) return;
	const projectId = project.id || project.localId || project.airtableId;

	anchor.textContent = "Back to Project";
	anchor.href = dashboardHref(projectId);
	ensureProjectActionBar(anchor);
}

function findFeedbackAnchor() {
	return document.querySelector(".journal-header") || document.querySelector("#main-content .govuk-width-container");
}

function normaliseFlashElement(flash) {
	if (!flash) return;
	flash.classList.add("govuk-notification-banner", "govuk-!-margin-bottom-6");
	flash.removeAttribute("style");
	flash.setAttribute("role", flash.getAttribute("role") || "status");
	flash.setAttribute("aria-live", flash.getAttribute("aria-live") || "polite");
}

function placeFlashElement(flash) {
	if (!flash) return;
	const anchor = findFeedbackAnchor();
	if (!anchor || anchor.nextElementSibling === flash) return;
	normaliseFlashElement(flash);
	anchor.insertAdjacentElement("afterend", flash);
}

function observeJournalFeedbackPlacement() {
	placeFlashElement(document.getElementById("flash"));

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node instanceof HTMLElement && node.id === "flash") placeFlashElement(node);
			}
		}
	});
	observer.observe(document.body, { childList: true, subtree: true });
}

async function hydrateProjectRouteContext() {
	const parentLink = document.getElementById("back-to-project");
	ensureProjectActionBar(parentLink);

	const params = new URLSearchParams(window.location.search);
	const projectId = params.get("id");
	if (!projectId) return;
	setProjectRouteFallback(projectId);

	const project = await loadProject(projectId);
	if (!project) return;

	setProjectAnchor(findProjectBreadcrumb(), project);
	setProjectAnchor(document.getElementById("project-link"), project);
	setProjectParentLink(parentLink, project);

	const main = document.querySelector("main");
	if (main) {
		main.dataset.projectId = project.id || projectId;
		main.dataset.projectName = project.name || "";
	}
}

document.addEventListener("DOMContentLoaded", observeJournalFeedbackPlacement);

hydrateProjectRouteContext().catch((error) => {
	console.warn("[project-context] Could not hydrate project route context", error);
});
