/**
 * @file public/js/projects-page.js
 * @module ProjectsPage
 * @summary Projects list UI with team-scoped API data.
 */

function resolveApiBase() {
	const explicit = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || "";
	return String(explicit || "").trim().replace(/\/+$/, "");
}

function apiUrl(path) {
	const cleanPath = path.startsWith("/") ? path : `/${path}`;
	return `${CONFIG.API_BASE}${cleanPath}`;
}

const CONFIG = Object.freeze({
	API_BASE: resolveApiBase(),
	FETCH_TIMEOUT_MS: 12000,
	CACHE: "no-store",
	SHOW_SOURCE_NOTE: false,
});

const container = document.getElementById("list");
const startProjectAction = document.querySelector(".projects-page-actions");

const VALID_PROJECT_PHASES = new Set(["pre-discovery", "discovery", "alpha", "beta", "live"]);
const REDIRECTING_TO_SIGN_IN_ERROR = "redirecting_to_sign_in";
const TEMPLATE_IDS = Object.freeze({
	PROJECT_CARD: "project-summary-card-template",
	EMPTY_STATE: "projects-empty-state-template",
	ERROR_STATE: "projects-error-state-template",
	MALFORMED_STATE: "projects-malformed-state-template",
});

function signInUrl() {
	const returnTo = `${window.location.pathname}${window.location.search || ""}`;
	return `/pages/account/sign-in/?returnTo=${encodeURIComponent(returnTo)}`;
}

function redirectToSignIn() {
	window.location.assign(signInUrl());
}

function setListBusy(isBusy) {
	if (!container) return;
	container.setAttribute("aria-busy", isBusy ? "true" : "false");
}

function setStartProjectVisible(isVisible) {
	if (!startProjectAction) return;
	startProjectAction.hidden = !isVisible;
}

function toMs(value) {
	const n = Date.parse(value);
	return Number.isFinite(n) ? n : 0;
}

function safeJsonArray(value) {
	try {
		const parsed = JSON.parse(String(value));
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function isAirtableRecordId(value) {
	return /^rec[a-zA-Z0-9]{14,}$/.test(String(value || "").trim());
}

function looksLikeIdentityFragment(value) {
	const text = String(value || "").trim();
	if (!text) return false;
	return (
		/"?EMAIL"?\s*:/i.test(text) ||
		/"?email"?\s*:/i.test(text) ||
		/"?role"?\s*:/i.test(text) ||
		/^[}\]]+$/.test(text) ||
		/^[{[]/.test(text) ||
		(/^[^,\s]+@[^,\s]+\.[^,\s]+$/i.test(text) && !/\s/.test(text))
	);
}

function looksLikeUuid(value) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
		String(value || "").trim(),
	);
}

function normaliseList(value, splitPattern = /[\n|,]/) {
	if (Array.isArray(value)) {
		return value
			.map((item) => String(item || "").trim())
			.filter((item) => item && !looksLikeIdentityFragment(item));
	}

	return String(value || "")
		.split(splitPattern)
		.map((item) => item.trim())
		.filter((item) => item && !looksLikeIdentityFragment(item));
}

function firstPresent(...values) {
	for (const value of values) {
		if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
	}
	return "";
}

function normaliseTeamName(value) {
	return String(value || "").trim();
}

function hasValidProjectPhase(project) {
	const phase = String(project?.["rops:servicePhase"] || "").trim().toLowerCase();
	return VALID_PROJECT_PHASES.has(phase);
}

function isRenderableProject(project) {
	if (!isAirtableRecordId(project?.id)) return false;
	if (!String(project?.name || "").trim()) return false;
	if (looksLikeIdentityFragment(project.name)) return false;
	if (!hasValidProjectPhase(project)) return false;
	if (looksLikeIdentityFragment(project["rops:projectStatus"]) || looksLikeUuid(project["rops:projectStatus"])) return false;
	return true;
}

async function fetchWithTimeout(url) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort("timeout"), CONFIG.FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			credentials: "include",
			cache: CONFIG.CACHE,
		});
		const text = await response.text();
		let data;
		try {
			data = JSON.parse(text);
		} catch {
			data = { ok: false, parseError: true, raw: text };
		}
		return { ok: response.ok, status: response.status, data, text };
	} finally {
		clearTimeout(timer);
	}
}

function normaliseProject(p) {
	const stakeholders = Array.isArray(p.Stakeholders)
		? p.Stakeholders
		: Array.isArray(p.stakeholders)
			? p.stakeholders
			: p.Stakeholders
				? safeJsonArray(p.Stakeholders)
				: p.stakeholders
					? safeJsonArray(p.stakeholders)
					: [];

	const objectivesRaw = p.Objectives ?? p.objectives ?? "";
	const groupsRaw = p.UserGroups ?? p.user_groups ?? "";
	const teamName = normaliseTeamName(
		firstPresent(p.teamName, p.team_name, p.team, Array.isArray(p.teamNames) ? p.teamNames[0] : "", p.Org, p.org),
	);

	return {
		id: firstPresent(p.id, p.airtableId, p.recordId),
		airtableId: firstPresent(p.airtableId, p.id, p.recordId),
		recordId: firstPresent(p.recordId, p.id, p.airtableId),
		name: p.Name ?? p.name ?? "",
		description: p.Description ?? p.description ?? "",
		stakeholders,
		objectives: normaliseList(objectivesRaw, /\r?\n|[|]/),
		user_groups: normaliseList(groupsRaw, /\r?\n|[|,]/),
		createdAt: p.CreatedAt ?? p.createdAt ?? p.createdTime ?? "",
		"rops:servicePhase": p.Phase ?? p["rops:servicePhase"] ?? "",
		"rops:projectStatus": p.Status ?? p["rops:projectStatus"] ?? "",
		teamName,
		team_name: teamName,
		team: teamName,
		org: teamName || p.Org || p.org || "",
	};
}

async function listProjects() {
	const { ok, status, data } = await fetchWithTimeout(apiUrl("/api/projects"));
	if (status === 401) {
		redirectToSignIn();
		throw new Error(REDIRECTING_TO_SIGN_IN_ERROR);
	}
	if (!ok || !data?.ok) throw new Error(`Project list failed (${status})`);

	const rawProjects = Array.isArray(data.projects) ? data.projects : [];
	const projects = rawProjects.map(normaliseProject);

	const malformed = [];
	projects.forEach((project, index) => {
		if (!isRenderableProject(project)) {
			malformed.push({
				index,
				rawKeys: Object.keys(rawProjects[index] || {}),
				rawIdLikeValues: {
					id: rawProjects[index]?.id,
					airtableId: rawProjects[index]?.airtableId,
					recordId: rawProjects[index]?.recordId,
					Id: rawProjects[index]?.Id,
					ID: rawProjects[index]?.ID,
					localId: rawProjects[index]?.localId,
					LocalId: rawProjects[index]?.LocalId,
					pid: rawProjects[index]?.pid,
					PID: rawProjects[index]?.PID,
					"Record ID": rawProjects[index]?.["Record ID"],
				},
				name: project.name,
				phase: project["rops:servicePhase"],
				status: project["rops:projectStatus"],
			});
		}
	});

	if (malformed.length) {
		console.error("[projects-page] /api/projects returned project records that cannot be rendered safely", {
			malformed,
			sampleRawProject: rawProjects[malformed[0].index],
		});
	}

	return {
		source: "api",
		projects: projects.filter(isRenderableProject),
		canStartProject: Boolean(data.canStartProject),
		malformed,
	};
}

function projectDashboardHref(projectId) {
	return `/pages/project-dashboard/?id=${encodeURIComponent(projectId || "")}`;
}

function projectDashboardLabel(project) {
	return `View dashboard for ${project.name || "this project"}`;
}

function projectTeamLabel(project) {
	return project.teamName || project.team_name || project.team || project.org || "Unassigned team";
}

function templateContent(id) {
	const template = document.getElementById(id);
	if (!(template instanceof HTMLTemplateElement)) throw new Error(`Missing template: ${id}`);
	return template.content.firstElementChild.cloneNode(true);
}

function field(root, name) {
	return root.querySelector(`[data-project-field="${name}"]`);
}

function list(root, name) {
	return root.querySelector(`[data-project-list="${name}"]`);
}

function setText(root, name, value, fallback = "Not recorded") {
	const target = field(root, name);
	if (!target) return;
	const text = String(value || "").trim();
	target.textContent = text || fallback;
	if (!text) target.classList.add("govuk-hint");
}

function appendTextList(listElement, values, fallbackText) {
	if (!listElement) return;
	listElement.replaceChildren();
	const items = Array.isArray(values) ? values.filter(Boolean) : [];
	if (!items.length) {
		const item = document.createElement("li");
		item.textContent = fallbackText;
		item.className = "govuk-hint";
		listElement.append(item);
		return;
	}
	items.forEach((value) => {
		const item = document.createElement("li");
		item.textContent = String(value);
		listElement.append(item);
	});
}

function appendStakeholderList(listElement, stakeholders) {
	if (!listElement) return;
	listElement.replaceChildren();
	if (!stakeholders?.length) {
		const item = document.createElement("li");
		item.className = "govuk-hint";
		item.textContent = "No stakeholders recorded";
		listElement.append(item);
		return;
	}
	stakeholders.forEach((stakeholder) => {
		const item = document.createElement("li");
		const name = stakeholder.name || "Unnamed stakeholder";
		const role = stakeholder.role ? ` — ${stakeholder.role}` : "";
		item.append(document.createTextNode(`${name}${role}`));
		if (stakeholder.email) {
			item.append(document.createTextNode(" "));
			const email = document.createElement("a");
			email.className = "govuk-link";
			email.href = `mailto:${encodeURIComponent(stakeholder.email)}`;
			email.textContent = stakeholder.email;
			item.append(email);
		}
		listElement.append(item);
	});
}

function populateProjectCard(card, project) {
	const projectId = encodeURIComponent(project.id);
	card.setAttribute("aria-labelledby", `project-title-${projectId}`);
	const title = field(card, "name");
	if (title) {
		title.id = `project-title-${projectId}`;
		title.textContent = project.name;
	}

	const dashboardLink = card.querySelector('[data-project-link="dashboard"]');
	if (dashboardLink) {
		dashboardLink.href = projectDashboardHref(project.id);
		dashboardLink.setAttribute("aria-label", projectDashboardLabel(project));
	}

	setText(card, "team", projectTeamLabel(project));
	setText(card, "phase", project["rops:servicePhase"]);
	setText(card, "status", project["rops:projectStatus"]);
	setText(card, "description", project.description, "No description recorded");
	appendTextList(list(card, "user-groups"), project.user_groups, "No user groups recorded");
	appendStakeholderList(list(card, "stakeholders"), project.stakeholders);
	appendTextList(list(card, "objectives"), project.objectives, "No objectives recorded");
}

function createProjectCard(project) {
	const card = templateContent(TEMPLATE_IDS.PROJECT_CARD);
	populateProjectCard(card, project);
	return card;
}

function renderEmptyState(canStartProject = false) {
	const emptyState = templateContent(TEMPLATE_IDS.EMPTY_STATE);
	const startAction = emptyState.querySelector('[data-project-action="start"]');
	if (startAction) startAction.hidden = !canStartProject;
	container.replaceChildren(emptyState);
}

function renderErrorState(error) {
	const errorState = templateContent(TEMPLATE_IDS.ERROR_STATE);
	setText(errorState, "technical-detail", error?.message || error, "Unknown error");
	container.replaceChildren(errorState);
}

function malformedBanner(malformed) {
	if (!malformed?.length) return null;
	const banner = templateContent(TEMPLATE_IDS.MALFORMED_STATE);
	const count = malformed.length;
	const noun = count === 1 ? "project record" : "project records";
	setText(banner, "count", count);
	setText(
		banner,
		"message",
		`${noun} could not be linked because the API response did not match the project-card contract. ${
			count === 1 ? "It has" : "They have"
		} been hidden from this list. See the browser console for technical detail.`,
	);
	return banner;
}

function render(projects, source, canStartProject = false, malformed = []) {
	setStartProjectVisible(canStartProject);
	projects.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

	const nodes = [];
	const warning = malformedBanner(malformed);
	if (warning) nodes.push(warning);

	if (!projects.length) {
		const emptyState = templateContent(TEMPLATE_IDS.EMPTY_STATE);
		const startAction = emptyState.querySelector('[data-project-action="start"]');
		if (startAction) startAction.hidden = !canStartProject;
		nodes.push(emptyState);
		container.replaceChildren(...nodes);
		return;
	}

	nodes.push(...projects.map(createProjectCard));
	container.replaceChildren(...nodes);

	if (CONFIG.SHOW_SOURCE_NOTE) {
		const sourceNote = document.createElement("p");
		sourceNote.className = "govuk-body-s";
		sourceNote.textContent = `Source: ${source}`;
		container.prepend(sourceNote);
	}
}

(async () => {
	if (!container) return;
	setStartProjectVisible(false);
	setListBusy(true);
	try {
		const { source, projects, canStartProject, malformed } = await listProjects();
		render(projects, source, canStartProject, malformed);
	} catch (error) {
		if (error?.message === REDIRECTING_TO_SIGN_IN_ERROR) return;
		setStartProjectVisible(false);
		renderErrorState(error);
	} finally {
		setListBusy(false);
	}
})();

window.__rops = Object.freeze({
	CONFIG,
	toMs,
});
