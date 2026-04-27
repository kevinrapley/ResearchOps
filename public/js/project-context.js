/**
 * @file /js/project-context.js
 * @summary Hydrates project route breadcrumbs and parent links from the ?id= project context.
 */

const API_ORIGIN =
	document.documentElement?.dataset?.apiOrigin ||
	window.API_ORIGIN ||
	(location.hostname.endsWith("pages.dev") ?
		"https://rops-api.digikev-kevin-rapley.workers.dev" :
		location.origin);

function projectApiUrl(path) {
	const value = String(path || "");
	return `${API_ORIGIN}${value.startsWith("/") ? value : "/" + value}`;
}

function normaliseProject(project = {}) {
	return {
		id: project.id || project.LocalId || project.localId || "",
		localId: project.LocalId || project.localId || "",
		name: project.name || project.Name || ""
	};
}

async function loadProjects() {
	const response = await fetch(projectApiUrl(`/api/projects?ts=${Date.now()}`), { cache: "no-store" });
	const data = await response.json().catch(() => null);

	if (!response.ok) {
		throw new Error(`Could not load projects: HTTP ${response.status}`);
	}

	const list = Array.isArray(data) ? data : Array.isArray(data?.projects) ? data.projects : [];
	return list.map(normaliseProject);
}

function findProject(projects, projectId) {
	return projects.find((project) => project.id === projectId || project.localId === projectId) || null;
}

function dashboardHref(projectId) {
	return `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;
}

function setProjectAnchor(anchor, project) {
	if (!anchor || !project) return;

	anchor.textContent = project.name || "Project";
	anchor.href = dashboardHref(project.id || project.localId);
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

function setProjectParentLink(anchor, project) {
	if (!anchor || !project) return;

	anchor.textContent = "Back to Project";
	anchor.href = dashboardHref(project.id || project.localId);
	ensureProjectActionBar(anchor);
}

async function hydrateProjectRouteContext() {
	const parentLink = document.getElementById("back-to-project");
	ensureProjectActionBar(parentLink);

	const params = new URLSearchParams(window.location.search);
	const projectId = params.get("id");
	if (!projectId) return;

	const projects = await loadProjects();
	const project = findProject(projects, projectId);
	if (!project) return;

	setProjectAnchor(document.getElementById("breadcrumb-project"), project);
	setProjectAnchor(document.getElementById("project-link"), project);
	setProjectParentLink(parentLink, project);

	const main = document.querySelector("main");
	if (main) {
		main.dataset.projectId = project.id || projectId;
		main.dataset.projectName = project.name || "";
	}
}

hydrateProjectRouteContext().catch((error) => {
	console.warn("[project-context] Could not hydrate project route context", error);
});
