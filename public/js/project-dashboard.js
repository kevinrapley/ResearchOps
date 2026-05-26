const API_ORIGIN = resolveApiBase();
const $ = (selector, root = document) => root.querySelector(selector);
let currentProject = null;

{
	const urlId = new URLSearchParams(location.search).get("id") || "";
	const main = document.querySelector("main");
	if (main && urlId) main.setAttribute("data-project-id", urlId);
}

function resolveApiBase() {
	const explicit = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || "";
	return String(explicit || "").trim().replace(/\/+$/, "");
}

function apiUrl(path) {
	const cleanPath = path.startsWith("/") ? path : `/${path}`;
	return `${API_ORIGIN}${cleanPath}`;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 15000) {
	const controller = new AbortController();
	const timer = window.setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} catch (error) {
		if (error?.name === "AbortError") throw new Error(`Request timed out after ${timeoutMs}ms`);
		throw error;
	} finally {
		window.clearTimeout(timer);
	}
}

function escapeHtml(value = "") {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function setText(selector, value, fallback = "—") {
	const element = $(selector);
	if (element) element.textContent = String(value ?? "").trim() || fallback;
}

function setLinkHref(id, href) {
	const element = document.getElementById(id);
	if (element) element.setAttribute("href", href);
}

function setTagText(id, value, fallback) {
	const element = document.getElementById(id);
	if (!element) return;
	element.textContent = String(value ?? "").trim() || fallback;
}

function firstPresent(...values) {
	for (const value of values) if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
	return "";
}

function looksLikeIdentityFragment(value) {
	const text = String(value || "").trim();
	if (!text) return false;
	return /"?email"?\s*:/i.test(text) || /"?role"?\s*:/i.test(text) || /^[}\]]+$/.test(text) || /^[{[]/.test(text);
}

function normaliseLineList(value) {
	if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter((item) => item && !looksLikeIdentityFragment(item));
	return String(value || "").split(/\r?\n|[|]/).map((item) => item.trim()).filter((item) => item && !looksLikeIdentityFragment(item));
}

function normaliseCommaList(value) {
	if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter((item) => item && !looksLikeIdentityFragment(item));
	return String(value || "").split(/\r?\n|[|,]/).map((item) => item.trim()).filter((item) => item && !looksLikeIdentityFragment(item));
}

function normaliseStakeholders(value) {
	if (Array.isArray(value)) {
		return value.map((stakeholder) => ({
			name: String(stakeholder?.name || stakeholder?.Name || "").trim(),
			role: String(stakeholder?.role || stakeholder?.Role || "").trim(),
			email: String(stakeholder?.email || stakeholder?.Email || "").trim(),
		})).filter((stakeholder) => stakeholder.name || stakeholder.role || stakeholder.email);
	}
	try {
		return normaliseStakeholders(JSON.parse(value || "[]"));
	} catch {
		return [];
	}
}

function normaliseProject(project = {}) {
	const publicId = firstPresent(project.id, project.airtableId, project.recordId);
	const teamName = firstPresent(project.teamName, project.team_name, project.team, Array.isArray(project.teamNames) ? project.teamNames[0] : "", project.Org, project.org);
	return {
		id: publicId,
		localId: firstPresent(project.localId, project.LocalId, publicId),
		airtableId: firstPresent(project.airtableId, project.recordId, publicId),
		name: project.name || project.Name || "",
		description: project.description || project.Description || "",
		org: teamName || "Unassigned team",
		phase: firstPresent(project["rops:servicePhase"], project.servicePhase, project["Service stage"], project["Service Stage"], project.ServiceStage, project.Phase, project.phase),
		status: firstPresent(project["rops:projectStatus"], project.projectStatus, project["Project stage"], project["Project Stage"], project.ProjectStage, project.Status, project.status),
		objectives: normaliseLineList(project.objectives ?? project.Objectives),
		user_groups: normaliseCommaList(project.user_groups ?? project.UserGroups),
		stakeholders: normaliseStakeholders(project.stakeholders ?? project.Stakeholders),
		lead_researcher: project.lead_researcher || project["Lead Researcher"] || "",
		lead_researcher_email: project.lead_researcher_email || project["Lead Researcher Email"] || "",
	};
}

async function readJsonResponse(response, label) {
	const contentType = (response.headers.get("content-type") || "").toLowerCase();
	if (!contentType.includes("application/json")) {
		const preview = await response.text().catch(() => "");
		const error = new Error(`${label} non-JSON (${response.status}) ${preview.slice(0, 120)}`);
		error.upstreamStatus = response.status;
		throw error;
	}
	const json = await response.json().catch(() => null);
	if (!response.ok || !json || json.ok === false) {
		const error = new Error(json?.error || json?.detail || `${label} load failed (${response.status})`);
		error.upstreamStatus = response.status;
		error.upstreamBody = json;
		throw error;
	}
	return json;
}

async function loadProject(projectId) {
	const response = await fetchWithTimeout(apiUrl(`/api/projects/${encodeURIComponent(projectId)}?ts=${Date.now()}`), {
		cache: "no-store",
		credentials: "include",
	}, 15000);
	return normaliseProject(await readJsonResponse(response, "Project"));
}

async function loadStudies(projectId) {
	const response = await fetchWithTimeout(apiUrl(`/api/studies?project=${encodeURIComponent(projectId)}&ts=${Date.now()}`), {
		cache: "no-store",
		credentials: "include",
	}, 15000);
	const json = await readJsonResponse(response, "Studies");
	return (json.studies || []).map((study) => ({
		id: study.id || "",
		method: study.method || "",
		status: study.status || "",
		description: study.description || "",
		createdAt: study.createdAt || "",
		title: study.title || study.Title || "",
	}));
}

function computeStudyTitle({ description = "", method = "", createdAt = "" } = {}) {
	if (description.trim()) return description.trim().slice(0, 80);
	const date = createdAt ? new Date(createdAt) : new Date();
	return `${method || "Study"} — ${date.toISOString().slice(0, 10)}`;
}

function projectIdFromUrl(project) {
	return new URLSearchParams(location.search).get("id") || project?.id || project?.localId || "";
}

function renderProject(project) {
	const projectId = projectIdFromUrl(project);
	setText("#eyebrow-org", project.org);
	setText("#project-title", project.name, "Untitled project");
	setText("#project-subtitle", project.description);
	setText("#kv-service-stage", project.phase);
	setText("#kv-project-stage", project.status);
	setText("#kv-client-name", project.org);
	setText("#kv-lead-researcher", project.lead_researcher);
	setText("#kv-lead-email", project.lead_researcher_email);
	setTagText("project-service-stage-tag", project.phase, "Service stage unavailable");
	setTagText("project-stage-tag", project.status, "Project stage unavailable");

	const email = document.getElementById("kv-lead-email");
	if (email) email.setAttribute("href", project.lead_researcher_email ? `mailto:${project.lead_researcher_email}` : "mailto:");

	const main = document.querySelector("main");
	if (main) {
		main.setAttribute("data-project-id", projectId || project.id || "");
		main.dataset.projectName = project.name || "";
		main.dataset.projectAirtableId = project.airtableId || "";
	}

	const metaProject = document.querySelector('meta[name="project:name"]');
	if (metaProject) metaProject.setAttribute("content", project.name || "");

	const breadcrumbProject = document.getElementById("breadcrumb-project");
	if (breadcrumbProject) {
		breadcrumbProject.textContent = project.name || "Project";
		breadcrumbProject.href = `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;
	}

	setLinkHref("journal-link", `/pages/projects/journals/?id=${encodeURIComponent(projectId)}`);
	setLinkHref("journal-button-link", `/pages/projects/journals/?id=${encodeURIComponent(projectId)}`);
	setLinkHref("outcomes-link", `/pages/projects/outcomes/?id=${encodeURIComponent(projectId)}`);
	setLinkHref("outcomes-card-link", `/pages/projects/outcomes/?id=${encodeURIComponent(projectId)}`);
	setLinkHref("add-participant-link", `/pages/project-dashboard/participants/?pid=${encodeURIComponent(projectId)}`);
	setLinkHref("import-participants-link", `/pages/project-dashboard/participants/import/?pid=${encodeURIComponent(projectId)}`);
	setLinkHref("add-study-link", `/pages/study/new/?pid=${encodeURIComponent(projectId)}`);
	setLinkHref("add-insight-link", `/pages/projects/outcomes/?id=${encodeURIComponent(projectId)}#impact-form`);

	renderStakeholders(project.stakeholders || []);
	renderObjectives(project.objectives || []);
	renderUserGroups(project.user_groups || []);
}

function renderStakeholders(stakeholders = []) {
	const list = document.getElementById("stakeholders-list");
	if (!list) return;
	if (!stakeholders.length) {
		list.innerHTML = "<li>No stakeholders yet.</li>";
		return;
	}
	list.innerHTML = stakeholders.map((stakeholder) => {
		const name = escapeHtml(stakeholder.name || "Unnamed stakeholder");
		const role = stakeholder.role ? ` — ${escapeHtml(stakeholder.role)}` : "";
		const email = stakeholder.email ? `<br><a class="govuk-link" href="mailto:${escapeHtml(stakeholder.email)}">${escapeHtml(stakeholder.email)}</a>` : "";
		return `<li><strong>${name}</strong>${role}${email}</li>`;
	}).join("");
}

function renderObjectives(objectives = []) {
	const list = document.getElementById("objectives-list");
	if (!list) return;
	list.innerHTML = objectives.length ? objectives.map((objective) => `<li>${escapeHtml(objective)}</li>`).join("") : "<li>No objectives yet.</li>";
}

function renderUserGroups(userGroups = []) {
	const list = document.getElementById("user-groups-list");
	if (!list) return;
	list.innerHTML = userGroups.length ? userGroups.map((group) => `<li>${escapeHtml(group)}</li>`).join("") : "<li>No user groups yet.</li>";
}

function studyStatusTagClass(status = "") {
	const value = String(status).toLowerCase();
	if (value.includes("complete") || value.includes("done")) return "govuk-tag--green";
	if (value.includes("plan") || value.includes("field") || value.includes("progress")) return "govuk-tag--blue";
	if (value.includes("cancel") || value.includes("risk") || value.includes("blocked")) return "govuk-tag--red";
	return "govuk-tag--grey";
}

function renderStudies(project, studies) {
	const list = document.getElementById("studies-list");
	if (!list) return;
	if (!studies.length) {
		list.innerHTML = "<li>No studies yet.</li>";
		return;
	}
	list.innerHTML = studies.map((study) => {
		const title = study.title?.trim() || study.method?.trim() || computeStudyTitle(study);
		const href = `/pages/study/?id=${encodeURIComponent(study.id)}`;
		const description = study.description && study.description.length > 170 ? `${study.description.slice(0, 170).replace(/\s+\S*$/, "")}…` : study.description;
		const status = String(study.status || "").trim();
		return `
<li class="rops-study-item">
<a class="govuk-link govuk-!-font-weight-bold" href="${href}">${escapeHtml(title)}</a>
${description ? `<p class="govuk-body-s rops-study-description">${escapeHtml(description)}</p>` : ""}
${status ? `<strong class="govuk-tag ${studyStatusTagClass(status)}">${escapeHtml(status)}</strong>` : ""}
</li>`;
	}).join("");
}

function renderStudiesLoadError(error) {
	const list = document.getElementById("studies-list");
	if (!list) return;
	const reason = String(error?.message || error || "Unknown error").trim();
	list.innerHTML = `<li role="alert"><strong>Could not load studies</strong><br><span>Study records could not be loaded for this project.</span><br><span><strong>Technical detail:</strong> <code>${escapeHtml(reason)}</code></span></li>`;
}

function togglePanel(toggle, panel, forceOpen = null) {
	if (!toggle || !panel) return;
	const shouldOpen = forceOpen === null ? panel.hidden : forceOpen;
	panel.hidden = !shouldOpen;
	toggle.setAttribute("aria-expanded", String(shouldOpen));
	if (shouldOpen) panel.querySelector("input, textarea, select, button")?.focus?.();
}

function initPanelToggle(toggleId, panelId) {
	const toggle = document.getElementById(toggleId);
	const panel = document.getElementById(panelId);
	if (toggle && panel) toggle.addEventListener("click", () => togglePanel(toggle, panel));
}

function initPanelClosers() {
	document.querySelectorAll("[data-close-panel]").forEach((button) => {
		button.addEventListener("click", () => {
			const panel = document.getElementById(button.getAttribute("data-close-panel") || "");
			const toggle = document.getElementById(button.getAttribute("data-toggle") || "");
			togglePanel(toggle, panel, false);
		});
	});
}

function setStatus(id, message, isError = false) {
	const status = document.getElementById(id);
	if (!status) return;
	status.classList.toggle("dashboard-action-status--error", isError);
	status.textContent = message || "";
}

async function saveProjectPatch(payload) {
	if (!currentProject?.id) throw new Error("Missing project id");
	const response = await fetchWithTimeout(apiUrl(`/api/projects/${encodeURIComponent(currentProject.id)}`), {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(payload),
	}, 15000);
	const json = await response.json().catch(() => ({}));
	if (!response.ok || json?.ok === false) throw new Error(json?.error || json?.detail || `HTTP ${response.status}`);
	return json.project || null;
}

function initStakeholderForm() {
	const form = document.getElementById("add-stakeholder-form");
	if (!form) return;
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const name = String($("#stakeholder-name")?.value || "").trim();
		const role = String($("#stakeholder-role")?.value || "").trim();
		const email = String($("#stakeholder-email")?.value || "").trim();
		if (!name || !role) {
			setStatus("add-stakeholder-status", "Enter a stakeholder name and role.", true);
			return;
		}
		const nextStakeholders = [...(currentProject.stakeholders || []), { name, role, email }];
		try {
			setStatus("add-stakeholder-status", "Saving stakeholder.");
			await saveProjectPatch({ stakeholders: nextStakeholders });
			currentProject.stakeholders = nextStakeholders;
			renderStakeholders(nextStakeholders);
			form.reset();
			setStatus("add-stakeholder-status", "Stakeholder saved.");
			togglePanel(document.getElementById("add-stakeholder-toggle"), document.getElementById("add-stakeholder-panel"), false);
		} catch (error) {
			setStatus("add-stakeholder-status", `Could not save stakeholder. ${String(error?.message || error)}`, true);
		}
	});
}

function initObjectiveForm() {
	const form = document.getElementById("add-objective-form");
	if (!form) return;
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const objective = String($("#objective-text")?.value || "").trim();
		if (!objective) {
			setStatus("add-objective-status", "Enter at least one research objective.", true);
			return;
		}
		const nextObjectives = [...(currentProject.objectives || []), objective];
		try {
			setStatus("add-objective-status", "Saving objective.");
			await saveProjectPatch({ objectives: nextObjectives });
			currentProject.objectives = nextObjectives;
			renderObjectives(nextObjectives);
			form.reset();
			setStatus("add-objective-status", "Objective saved.");
			togglePanel(document.getElementById("add-objective-toggle"), document.getElementById("add-objective-panel"), false);
		} catch (error) {
			setStatus("add-objective-status", `Could not save objective. ${String(error?.message || error)}`, true);
		}
	});
}

function initUserGroupForm() {
	const form = document.getElementById("add-user-group-form");
	if (!form) return;
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const userGroup = String($("#user-group-name")?.value || "").trim();
		if (!userGroup || looksLikeIdentityFragment(userGroup)) {
			setStatus("add-user-group-status", "Enter a valid user group label.", true);
			return;
		}
		const existing = new Set((currentProject.user_groups || []).map((group) => group.toLowerCase()));
		if (existing.has(userGroup.toLowerCase())) {
			setStatus("add-user-group-status", "This user group is already listed.", true);
			return;
		}
		const nextUserGroups = [...(currentProject.user_groups || []), userGroup];
		try {
			setStatus("add-user-group-status", "Saving user group.");
			await saveProjectPatch({ user_groups: nextUserGroups });
			currentProject.user_groups = nextUserGroups;
			renderUserGroups(nextUserGroups);
			form.reset();
			setStatus("add-user-group-status", "User group saved.");
			togglePanel(document.getElementById("add-user-group-toggle"), document.getElementById("add-user-group-panel"), false);
		} catch (error) {
			setStatus("add-user-group-status", `Could not save user group. ${String(error?.message || error)}`, true);
		}
	});
}

function initProjectActions() {
	initPanelToggle("add-stakeholder-toggle", "add-stakeholder-panel");
	initPanelToggle("add-objective-toggle", "add-objective-panel");
	initPanelToggle("add-user-group-toggle", "add-user-group-panel");
	initPanelClosers();
	initStakeholderForm();
	initObjectiveForm();
	initUserGroupForm();
}

function renderProjectLoadError(error, requestedProjectId) {
	const main = document.querySelector("main");
	if (!main) return;
	const reason = escapeHtml(String(error?.message || error || "Unknown error"));
	const requested = escapeHtml(requestedProjectId || "");
	const container = document.createElement("section");
	container.id = "project-load-error";
	container.className = "dashboard-action-panel";
	container.setAttribute("role", "alert");
	container.innerHTML = `<h2 class="govuk-heading-m">Could not load project</h2><p class="govuk-body">The project record at this URL could not be loaded.</p><p class="govuk-body"><strong>Technical detail:</strong> <code>${reason}</code></p>${requested ? `<p class="govuk-body"><strong>Requested project id:</strong> <code>${requested}</code></p>` : '<p class="govuk-body">No <code>id</code> parameter was present in the URL.</p>'}<p class="govuk-body"><a class="govuk-link" href="/pages/projects/">Back to projects</a></p>`;
	main.querySelector(".govuk-width-container")?.insertBefore(container, main.querySelector(".govuk-breadcrumbs")?.nextSibling || null);
}

(async function bootstrap() {
	const requestedProjectId = new URLSearchParams(location.search).get("id") || "";
	try {
		if (!requestedProjectId) throw new Error("Missing project id param");
		const project = await loadProject(requestedProjectId);
		currentProject = project;
		renderProject(project);
		try {
			const studies = await loadStudies(project.id || requestedProjectId);
			renderStudies(project, studies);
		} catch (studyError) {
			console.error("[project-dashboard] studies load failed", studyError);
			renderStudiesLoadError(studyError);
		}
		initProjectActions();
	} catch (error) {
		console.error("[project-dashboard] load failed", error);
		renderProjectLoadError(error, requestedProjectId);
	}
})();