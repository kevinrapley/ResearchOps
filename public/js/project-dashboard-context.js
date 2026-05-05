const PROJECT_ID_PARAMS = ["id", "pid"];
const PROJECT_SCOPED_LINKS = Object.freeze([
	["journal-link", "/pages/projects/journals/", "id"],
	["outcomes-link", "/pages/projects/outcomes/", "id"],
	["add-participant-link", "/pages/project-dashboard/participants/", "pid"],
	["import-participants-link", "/pages/project-dashboard/participants/import/", "pid"],
	["add-study-link", "/pages/study/new/", "pid"],
	["add-insight-link", "/pages/projects/outcomes/", "id", "impact-form"]
]);

function currentProjectId() {
	const params = new URLSearchParams(location.search);
	for (const key of PROJECT_ID_PARAMS) {
		const value = params.get(key);
		if (value) return value;
	}
	return "";
}

function projectScopedHref(path, queryKey, projectId, hash = "") {
	const query = `${queryKey}=${encodeURIComponent(projectId || "")}`;
	return `${path}?${query}${hash ? `#${hash}` : ""}`;
}

function setProjectContext() {
	const projectId = currentProjectId();
	const main = document.querySelector("main");
	if (main && projectId) {
		main.dataset.projectId = projectId;
		main.dataset.projectAirtableId = projectId;
	}
	return projectId;
}

function syncProjectScopedLinks() {
	const projectId = currentProjectId() || document.querySelector("main")?.dataset?.projectId || "";
	if (!projectId) return;

	for (const [id, path, queryKey, hash] of PROJECT_SCOPED_LINKS) {
		const link = document.getElementById(id);
		if (!link) continue;
		link.setAttribute("href", projectScopedHref(path, queryKey, projectId, hash));
	}
}

function initProjectDashboardContext() {
	setProjectContext();
	syncProjectScopedLinks();

	const observer = new MutationObserver(() => syncProjectScopedLinks());
	for (const [id] of PROJECT_SCOPED_LINKS) {
		const link = document.getElementById(id);
		if (link) observer.observe(link, { attributes: true, attributeFilter: ["href"] });
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initProjectDashboardContext, { once: true });
} else {
	initProjectDashboardContext();
}
