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

function resolvedProjectId() {
	return currentProjectId() || document.querySelector("main")?.dataset?.projectId || "";
}

function syncProjectContext() {
	const projectId = resolvedProjectId();
	if (!projectId) return;

	const main = document.querySelector("main");
	if (main) {
		main.dataset.projectId = projectId;
		main.dataset.projectAirtableId = projectId;
	}

	for (const [id, path, queryKey, hash] of PROJECT_SCOPED_LINKS) {
		const link = document.getElementById(id);
		if (!link) continue;

		const href = projectScopedHref(path, queryKey, projectId, hash);
		if (link.getAttribute("href") !== href) {
			link.setAttribute("href", href);
		}
	}
}

function initProjectDashboardContext() {
	syncProjectContext();

	let attempts = 0;
	const timer = window.setInterval(() => {
		syncProjectContext();
		attempts += 1;
		if (attempts >= 50) window.clearInterval(timer);
	}, 100);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initProjectDashboardContext, { once: true });
} else {
	initProjectDashboardContext();
}
