/**
 * @file project-dashboard.js
 * @module ProjectDashboard
 */

/* ───────── Set data-project-id from URL ASAP (read by integrations) ───────── */
{
	const urlId = new URLSearchParams(location.search).get("id") || "";
	const m = document.querySelector("main");
	if (m && urlId) m.setAttribute("data-project-id", urlId);
}

/* ───────── Config: single source of truth for API origin ───────── */
const API_ORIGIN =
	document.documentElement?.dataset?.apiOrigin ||
	window.API_ORIGIN ||
	(location.hostname.endsWith("pages.dev") ?
		"https://rops-api.digikev-kevin-rapley.workers.dev" :
		location.origin);

/**
 * @typedef {Object} UIProject
 * @property {string} id
 * @property {string} localId
 * @property {string} name
 * @property {string} description
 * @property {string} org
 * @property {string} phase
 * @property {string} status
 * @property {string[]} objectives
 * @property {string[]} user_groups
 * @property {{name?:string, role?:string, email?:string}[]} stakeholders
 * @property {string} createdAt
 * @property {string} lead_researcher
 * @property {string} lead_researcher_email
 */

/**
 * @typedef {Object} UIStudy
 * @property {string} id
 * @property {string} studyId
 * @property {string} method
 * @property {string} status
 * @property {string} description
 * @property {string} createdAt
 * @property {string} [title]
 */

const $ = (s, r = document) => r.querySelector(s);
const setText = (sel, val, fallback = "—") => {
	const el = $(sel);
	if (el) el.textContent = (val ?? "").toString().trim() || fallback;
};
const toMs = (d) => {
	const n = Date.parse(d);
	return Number.isFinite(n) ? n : 0;
};

let currentProject = null;

function escapeHtml(value = "") {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function looksLikeIdentityFragment(value) {
	const text = String(value || "").trim();
	if (!text) return false;
	return /"?EMAIL"?\s*:/i.test(text) ||
		/"?email"?\s*:/i.test(text) ||
		/^[}\]]+$/.test(text) ||
		/^[{[]/.test(text) ||
		(/^[^,\s]+@[^,\s]+\.[^,\s]+$/i.test(text) && !/\s/.test(text));
}

function normaliseLineList(value) {
	if (Array.isArray(value)) {
		return value.map((item) => String(item || "").trim()).filter(Boolean);
	}
	return String(value || "")
		.split(/\r?\n|[|]/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function normaliseCommaList(value) {
	if (Array.isArray(value)) {
		return value
			.map((item) => String(item || "").trim())
			.filter((item) => item && !looksLikeIdentityFragment(item));
	}
	return String(value || "")
		.split(/\r?\n|[|,]/)
		.map((item) => item.trim())
		.filter((item) => item && !looksLikeIdentityFragment(item));
}

function firstPresent(...values) {
	for (const value of values) {
		if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
	}
	return "";
}

function normaliseStakeholders(value) {
	if (Array.isArray(value)) {
		return value
			.map((stakeholder) => ({
				name: String(stakeholder?.name || stakeholder?.Name || "").trim(),
				role: String(stakeholder?.role || stakeholder?.Role || "").trim(),
				email: String(stakeholder?.email || stakeholder?.Email || "").trim(),
			}))
			.filter((stakeholder) => stakeholder.name || stakeholder.role || stakeholder.email);
	}

	try {
		return normaliseStakeholders(JSON.parse(value || "[]"));
	} catch {
		return [];
	}
}

function normaliseProject(p = {}) {
	const teamName = firstPresent(
		p.teamName,
		p.team_name,
		p.team,
		Array.isArray(p.teamNames) ? p.teamNames[0] : "",
		p.Org,
		p.org
	);

	return {
		id: p.id || p.LocalId || p.localId || "",
		localId: p.LocalId || p.localId || "",
		name: p.name || p.Name || "",
		description: p.description || p.Description || "",
		org: teamName || "Unassigned team",
		phase: p["rops:servicePhase"] || p.Phase || "",
		status: p["rops:projectStatus"] || p.Status || "",
		objectives: normaliseLineList(p.objectives ?? p.Objectives),
		user_groups: normaliseCommaList(p.user_groups ?? p.UserGroups),
		stakeholders: normaliseStakeholders(p.stakeholders ?? p.Stakeholders),
		createdAt: p.createdAt || p.CreatedAt || p.createdTime || "",
		lead_researcher: p.lead_researcher || p["Lead Researcher"] || "",
		lead_researcher_email: p.lead_researcher_email || p["Lead Researcher Email"] || "",
	};
}

async function loadProject(projectId) {
	const url = `${API_ORIGIN}/api/projects/${encodeURIComponent(projectId)}?ts=${Date.now()}`;
	const res = await fetch(url, {
		cache: "no-store",
		credentials: "include",
	});
	const ctype = (res.headers.get("content-type") || "").toLowerCase();
	if (!ctype.includes("application/json")) {
		const preview = await res.text().catch(() => "");
		throw new Error(`Project non-JSON (${res.status}) ${preview.slice(0, 120)}`);
	}

	let data;
	try {
		data = await res.json();
	} catch {
		throw new Error(`Project JSON parse failed (${res.status})`);
	}

	if (!res.ok || data?.ok === false) {
		throw new Error(data?.error || data?.detail || `Project load failed (${res.status})`);
	}

	return normaliseProject(data);
}

async function loadStudies(projectId) {
	const url = `${API_ORIGIN}/api/studies?project=${encodeURIComponent(projectId)}&ts=${Date.now()}`;
	const res = await fetch(url, {
		cache: "no-store",
		credentials: "include",
	});
	const js = await res.json().catch(() => ({}));
	if (!res.ok || !js?.ok) return [];
	return (js.studies || []).map((r) => ({
		id: r.id || "",
		studyId: r.studyId || "",
		method: r.method || "",
		status: r.status || "",
		description: r.description || "",
		createdAt: r.createdAt || "",
		title: r.title || r.Title || "",
	}));
}

function computeStudyTitle({ description = "", method = "", createdAt = "" } = {}) {
	if (description && description.trim()) return description.trim().slice(0, 80);
	const d = createdAt ? new Date(createdAt) : new Date();
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(d.getUTCDate()).padStart(2, "0");
	return `${method || "Study"} — ${yyyy}-${mm}-${dd}`;
}

function projectIdFromUrl(project) {
	return new URLSearchParams(location.search).get("id") || project?.id || "";
}

function setLinkHref(id, href) {
	const el = document.getElementById(id);
	if (el) el.setAttribute("href", href);
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

	const email = document.getElementById("kv-lead-email");
	if (email) email.setAttribute("href", project.lead_researcher_email ? `mailto:${project.lead_researcher_email}` : "mailto:");

	const main = document.querySelector("main");
	if (main) {
		if (!main.getAttribute("data-project-id")) {
			main.setAttribute("data-project-id", project.id || "");
		}
		main.dataset.projectName = project.name || "";
		main.dataset.projectAirtableId = project.id || "";
	}

	const metaProject = document.querySelector('meta[name="project:name"]');
	if (metaProject) metaProject.setAttribute("content", project.name || "");

	const bcProject = document.getElementById("breadcrumb-project");
	if (bcProject) {
		bcProject.textContent = project.name || "Project";
		bcProject.href = `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;
	}

	setLinkHref("journal-link", `/pages/projects/journals/?id=${encodeURIComponent(projectId)}`);
	setLinkHref("outcomes-link", `/pages/projects/outcomes/?id=${encodeURIComponent(projectId)}`);
	setLinkHref("add-participant-link", `/pages/project-dashboard/participants/?id=${encodeURIComponent(projectId)}`);
	setLinkHref("import-participants-link", `/pages/project-dashboard/participants/import/?id=${encodeURIComponent(projectId)}`);
	setLinkHref("add-study-link", `/pages/study/new/?pid=${encodeURIComponent(projectId)}`);
	setLinkHref("add-insight-link", `/pages/projects/outcomes/?id=${encodeURIComponent(projectId)}#impact-form`);

	renderProjectLists(project);
}

function renderProjectLists(project) {
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

	list.innerHTML = stakeholders
		.map((stakeholder) => {
			const name = escapeHtml(stakeholder.name || "Unnamed stakeholder");
			const role = stakeholder.role ? ` — ${escapeHtml(stakeholder.role)}` : "";
			const email = stakeholder.email ? `<br><a class="govuk-link" href="mailto:${escapeHtml(stakeholder.email)}">${escapeHtml(stakeholder.email)}</a>` : "";
			return `<li><strong>${name}</strong>${role}${email}</li>`;
		})
		.join("");
}

function renderObjectives(objectives = []) {
	const list = document.getElementById("objectives-list");
	if (!list) return;

	if (!objectives.length) {
		list.innerHTML = "<li>No objectives yet.</li>";
		return;
	}

	list.innerHTML = objectives.map((objective) => `<li>${escapeHtml(objective)}</li>`).join("");
}

function renderUserGroups(userGroups = []) {
	const list = document.getElementById("user-groups-list");
	if (!list) return;

	if (!userGroups.length) {
		list.innerHTML = "<li>No user groups yet.</li>";
		return;
	}

	list.innerHTML = userGroups.map((group) => `<li>${escapeHtml(group)}</li>`).join("");
}

function renderStudies(project, studies) {
	const list = document.getElementById("studies-list");
	if (!list) return;

	if (!studies.length) {
		list.innerHTML = '<li class="lede">No studies yet.</li>';
		return;
	}

	const truncateToWords = (text, maxLength = 170) => {
		if (!text) return "";
		if (text.length <= maxLength) return text;
		return text.slice(0, maxLength).replace(/\s+\S*$/, "");
	};

	list.innerHTML = studies
		.map((s) => {
			const title = s.title?.trim() || s.Title?.trim() || s.method?.trim() || computeStudyTitle(s);
			const href = `/pages/study/?pid=${encodeURIComponent(project.id)}&sid=${encodeURIComponent(s.id)}`;
			const status = (s.status || "").trim();
			const meta = status ? ` — <em>${escapeHtml(status)}</em>` : "";

			const full = s.description || "";
			const isTruncated = full.length > 170;
			const truncated = truncateToWords(full, 170);

			let descHtml = "";
			if (truncated) {
				if (isTruncated && truncated.length > 10) {
					const head = escapeHtml(truncated.slice(0, -10));
					const tail = escapeHtml(truncated.slice(-10));
					descHtml = `${head}<span class="fade-tail">${tail}</span>&hellip;`;
				} else {
					descHtml = escapeHtml(truncated);
				}
			}

			return `
<li class="item">
<div>
<a class="govuk-link" href="${href}">${escapeHtml(title)}</a>${meta}
</div>
${descHtml ? `<div class="lede" style="margin-top:4px;">${descHtml}</div>` : ""}
</li>`;
		})
		.join("");
}

function togglePanel(toggle, panel, forceOpen = null) {
	if (!toggle || !panel) return;
	const shouldOpen = forceOpen === null ? panel.hidden : forceOpen;
	panel.hidden = !shouldOpen;
	toggle.setAttribute("aria-expanded", String(shouldOpen));
	if (shouldOpen) {
		const firstField = panel.querySelector("input, textarea, select, button");
		if (firstField && typeof firstField.focus === "function") firstField.focus();
	}
}

function initPanelToggle(toggleId, panelId) {
	const toggle = document.getElementById(toggleId);
	const panel = document.getElementById(panelId);
	if (!toggle || !panel) return;
	toggle.addEventListener("click", () => togglePanel(toggle, panel));
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

	const res = await fetch(`${API_ORIGIN}/api/projects/${encodeURIComponent(currentProject.id)}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(payload),
	});

	const json = await res.json().catch(() => ({}));
	if (!res.ok || json?.ok === false) {
		throw new Error(json?.error || json?.detail || `HTTP ${res.status}`);
	}

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
		setStatus("add-stakeholder-status", "Saving stakeholder.");

		try {
			await saveProjectPatch({ stakeholders: nextStakeholders });
			currentProject.stakeholders = nextStakeholders;
			renderStakeholders(nextStakeholders);
			form.reset();
			setStatus("add-stakeholder-status", "Stakeholder saved.");
			togglePanel(document.getElementById("add-stakeholder-toggle"), document.getElementById("add-stakeholder-panel"), false);
		} catch (err) {
			setStatus("add-stakeholder-status", `Could not save stakeholder. ${String(err?.message || err)}`, true);
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
		setStatus("add-objective-status", "Saving objective.");

		try {
			await saveProjectPatch({ objectives: nextObjectives });
			currentProject.objectives = nextObjectives;
			renderObjectives(nextObjectives);
			form.reset();
			setStatus("add-objective-status", "Objective saved.");
			togglePanel(document.getElementById("add-objective-toggle"), document.getElementById("add-objective-panel"), false);
		} catch (err) {
			setStatus("add-objective-status", `Could not save objective. ${String(err?.message || err)}`, true);
		}
	});
}

function initUserGroupForm() {
	const form = document.getElementById("add-user-group-form");
	if (!form) return;

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const userGroup = String($("#user-group-name")?.value || "").trim();

		if (!userGroup) {
			setStatus("add-user-group-status", "Enter a user group.", true);
			return;
		}

		if (looksLikeIdentityFragment(userGroup)) {
			setStatus("add-user-group-status", "Enter a valid user group label.", true);
			return;
		}

		const existing = new Set((currentProject.user_groups || []).map((group) => group.toLowerCase()));
		if (existing.has(userGroup.toLowerCase())) {
			setStatus("add-user-group-status", "This user group is already listed.", true);
			return;
		}

		const nextUserGroups = [...(currentProject.user_groups || []), userGroup];
		setStatus("add-user-group-status", "Saving user group.");

		try {
			await saveProjectPatch({ user_groups: nextUserGroups });
			currentProject.user_groups = nextUserGroups;
			renderUserGroups(nextUserGroups);
			form.reset();
			setStatus("add-user-group-status", "User group saved.");
			togglePanel(document.getElementById("add-user-group-toggle"), document.getElementById("add-user-group-panel"), false);
		} catch (err) {
			setStatus("add-user-group-status", `Could not save user group. ${String(err?.message || err)}`, true);
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

(async function bootstrap() {
	try {
		const requestedProjectId = new URLSearchParams(location.search).get("id") || "";
		if (!requestedProjectId) throw new Error("Missing project id param");

		const project = await loadProject(requestedProjectId);
		currentProject = project;
		renderProject(project);

		const studies = await loadStudies(project.id || requestedProjectId);
		renderStudies(project, studies);

		initProjectActions();
	} catch (err) {
		console.error(err);
		alert("Could not load project.");
	}
})();
