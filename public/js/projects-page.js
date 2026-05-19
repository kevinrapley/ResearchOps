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
	SHOW_SOURCE_NOTE: false
});

const container = document.getElementById("list");
const startProjectAction = document.querySelector(".projects-page-actions");

const VALID_PROJECT_PHASES = new Set(["pre-discovery", "discovery", "alpha", "beta", "live"]);

function setListBusy(isBusy) {
	if (!container) return;
	container.setAttribute("aria-busy", isBusy ? "true" : "false");
}

function setStartProjectVisible(isVisible) {
	if (!startProjectAction) return;
	startProjectAction.hidden = !isVisible;
}

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&#39;");
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
	return /"?EMAIL"?\s*:/i.test(text) ||
		/"?email"?\s*:/i.test(text) ||
		/"?role"?\s*:/i.test(text) ||
		/^[}\]]+$/.test(text) ||
		/^[{[]/.test(text) ||
		(/^[^,\s]+@[^,\s]+\.[^,\s]+$/i.test(text) && !/\s/.test(text));
}

function looksLikeUuid(value) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || "").trim());
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
			cache: CONFIG.CACHE
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
	const stakeholders = Array.isArray(p.Stakeholders) ? p.Stakeholders :
		Array.isArray(p.stakeholders) ? p.stakeholders :
		p.Stakeholders ? safeJsonArray(p.Stakeholders) :
		p.stakeholders ? safeJsonArray(p.stakeholders) : [];

	const objectivesRaw = p.Objectives ?? p.objectives ?? "";
	const groupsRaw = p.UserGroups ?? p.user_groups ?? "";
	const teamName = normaliseTeamName(firstPresent(
		p.teamName,
		p.team_name,
		p.team,
		Array.isArray(p.teamNames) ? p.teamNames[0] : "",
		p.Org,
		p.org
	));

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
		org: teamName || p.Org || p.org || ""
	};
}

async function listProjects() {
	const { ok, status, data } = await fetchWithTimeout(apiUrl("/api/projects"));
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

function projectCard(project) {
	const projectId = encodeURIComponent(project.id);
	const dashboardHref = projectDashboardHref(project.id);
	const dashboardLabel = escapeHtml(projectDashboardLabel(project));
	const groups = (project.user_groups || [])
		.map(group => `<li><span class="tag">${escapeHtml(group)}</span></li>`)
		.join("");
	const stakeholders = (project.stakeholders || [])
		.map(stakeholder => {
			const name = escapeHtml(stakeholder.name || "");
			const role = stakeholder.role ? ` — ${escapeHtml(stakeholder.role)}` : "";
			const email = stakeholder.email ? ` <a href="mailto:${escapeHtml(stakeholder.email)}" class="govuk-link">${escapeHtml(stakeholder.email)}</a>` : "";
			return `<li>${name}${role}${email}</li>`;
		})
		.join("");
	const objectives = (project.objectives || []).map(objective => `<li>${escapeHtml(objective)}</li>`).join("");

	return `
<article class="card" aria-labelledby="project-title-${projectId}">
	<p class="project-org"><span class="govuk-visually-hidden">Team: </span>${escapeHtml(projectTeamLabel(project))}</p>
	<h3 id="project-title-${projectId}" class="project-title govuk-heading-m">
		<a class="govuk-link" href="${dashboardHref}" rel="bookmark">${escapeHtml(project.name)}</a>
	</h3>
	<p class="project-meta"><strong>Phase:</strong> ${escapeHtml(project["rops:servicePhase"] || "")} · <strong>Status:</strong> ${escapeHtml(project["rops:projectStatus"] || "")}</p>
	${project.description ? `<section class="project-summary"><p>${escapeHtml(project.description)}</p></section>` : ""}
	<p class="project-actions">
		<a class="govuk-button govuk-button--secondary project-dashboard-action" href="${dashboardHref}" aria-label="${dashboardLabel}">View dashboard</a>
	</p>
	${project.user_groups?.length ? `<section class="user-groups" aria-labelledby="user-groups-${projectId}"><h4 id="user-groups-${projectId}" class="project-groups-title">User groups</h4><ul class="tags" role="list">${groups}</ul></section>` : ""}
	<section class="project-extra">
		<details class="project-details">
			<summary class="govuk-link">Stakeholders and objectives</summary>
			<div class="details-columns">
				<div><h4 class="govuk-heading-s">Stakeholders</h4><ul role="list">${stakeholders || "<li class='lede'>None</li>"}</ul></div>
				<div><h4 class="govuk-heading-s">Objectives</h4><ul role="list">${objectives || "<li class='lede'>None</li>"}</ul></div>
			</div>
		</details>
	</section>
</article>`;
}

function renderEmptyState(canStartProject = false) {
	container.innerHTML = `
<div class="projects-empty-state" role="status">
	<h3 class="govuk-heading-m">No projects yet</h3>
	<p class="govuk-body">Create a research project to hold studies, participants, sessions, notes, evidence, insights and recommendations.</p>
	${canStartProject ? '<p><a class="govuk-link" href="/pages/start/overview/">Start a research project</a></p>' : ""}
</div>`;
}

function renderErrorState(error) {
	container.innerHTML = `
<div class="projects-error-state" role="alert">
	<h3 class="govuk-heading-m">Could not load projects</h3>
	<p class="govuk-body">Project records could not be loaded. Try again later.</p>
	<p class="govuk-body">Technical detail: ${escapeHtml(error?.message || error)}</p>
</div>`;
}

function malformedBanner(malformed) {
	if (!malformed?.length) return "";
	const count = malformed.length;
	const noun = count === 1 ? "project record" : "project records";
	return `
<div class="projects-malformed-banner" role="status" aria-live="polite">
	<p class="govuk-body"><strong>${count}</strong> ${noun} could not be linked because the API response did not match the project-card contract. ${count === 1 ? "It has" : "They have"} been hidden from this list. See the browser console for technical detail.</p>
</div>`;
}

function render(projects, source, canStartProject = false, malformed = []) {
	setStartProjectVisible(canStartProject);
	projects.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
	if (!projects.length) {
		renderEmptyState(canStartProject);
		if (malformed?.length) container.innerHTML = malformedBanner(malformed) + container.innerHTML;
		return;
	}
	container.innerHTML = malformedBanner(malformed) + projects.map(projectCard).join("");
	if (CONFIG.SHOW_SOURCE_NOTE) {
		const sourceNote = document.createElement("p");
		sourceNote.className = "lede";
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
		setStartProjectVisible(false);
		renderErrorState(error);
	} finally {
		setListBusy(false);
	}
})();

window.__rops = Object.freeze({
	CONFIG,
	toMs
});
