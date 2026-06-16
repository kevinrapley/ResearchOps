const DAAS_KEY = "daas";

function resolveApiBase() {
	const explicit =
		document.documentElement?.dataset?.apiOrigin ||
		window.API_ORIGIN ||
		window.RESEARCHOPS_API_ORIGIN ||
		"";
	return String(explicit || "").trim().replace(/\/+$/, "");
}

function apiUrl(path) {
	const cleanPath = String(path || "").startsWith("/") ? path : `/${path}`;
	return `${resolveApiBase()}${cleanPath}`;
}

function firstPresent(...values) {
	for (const value of values) {
		if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
	}
	return "";
}

function normaliseBrandKey(value = "") {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");
}

function normaliseBrandValues(value) {
	if (Array.isArray(value)) return value;
	return String(value || "")
		.split(/\r?\n|[|,]/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function projectPayloadFrom(payload = {}) {
	return payload?.project || payload?.record || payload;
}

function projectBrandValues(project = {}) {
	const source = projectPayloadFrom(project);
	return [
		source.org,
		source.Org,
		source.teamName,
		source.team_name,
		source.team,
		source.Team,
		source["Team"],
		source["Project team"],
		source["Project Team"],
		source.clientName,
		source.client_name,
		source["Client name"],
		source["Client Name"],
		source.teamNames,
		source.team_names,
		source["Team Names"],
		source.teams,
		source.Teams,
	].flatMap(normaliseBrandValues);
}

export function isDaaSProject(project = {}) {
	return projectBrandValues(project).map(normaliseBrandKey).includes(DAAS_KEY);
}

export function renderDaaSBrandPanel(project = {}) {
	const panel = document.getElementById("daas-brand-panel");
	if (!panel) return false;
	const showPanel = isDaaSProject(project);
	panel.hidden = !showPanel;
	panel.classList.toggle("rops-daas-brand-panel--visible", showPanel);
	return showPanel;
}

async function readJsonResponse(response) {
	const contentType = (response.headers.get("content-type") || "").toLowerCase();
	if (!contentType.includes("application/json")) throw new Error(`Project lookup returned non-JSON (${response.status})`);
	const body = await response.json().catch(() => null);
	if (!response.ok || !body || body.ok === false) throw new Error(body?.error || body?.detail || `Project lookup failed (${response.status})`);
	return body;
}

export async function loadProjectBrandById(projectId) {
	const id = String(projectId || "").trim();
	if (!id) return null;
	const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(id)}`), {
		cache: "no-store",
		credentials: "include",
		headers: { Accept: "application/json" },
	});
	return projectPayloadFrom(await readJsonResponse(response));
}

function projectIdFromParams(params = new URLSearchParams(window.location.search)) {
	return firstPresent(params.get("project"), params.get("projectId"), params.get("pid"), params.get("id"));
}

function isNewStudyRoute(pathname = window.location.pathname) {
	return /^\/pages\/study\/new\/?$/i.test(pathname);
}

async function projectFromStudyRoute(params = new URLSearchParams(window.location.search)) {
	if (isNewStudyRoute()) return loadProjectBrandById(projectIdFromParams(params));
	const { resolveStudyContextFromUrl } = await import("/js/study-route-context.js");
	const context = await resolveStudyContextFromUrl(params);
	return context?.project || null;
}

async function projectForCurrentRoute() {
	const params = new URLSearchParams(window.location.search);
	const pathname = window.location.pathname;
	if (/^\/pages\/study\//i.test(pathname)) return projectFromStudyRoute(params);
	return loadProjectBrandById(projectIdFromParams(params));
}

async function initDaaSBrandPanel() {
	if (!document.getElementById("daas-brand-panel")) return;
	try {
		const project = await projectForCurrentRoute();
		renderDaaSBrandPanel(project || {});
	} catch (error) {
		console.warn("[daas-brand-panel] project brand lookup failed", error);
		renderDaaSBrandPanel({});
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initDaaSBrandPanel, { once: true });
} else {
	initDaaSBrandPanel();
}
