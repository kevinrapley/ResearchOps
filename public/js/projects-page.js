/**
 * @file public/js/projects-page.js
 * @module ProjectsPage
 * @summary Projects list UI with Airtable-first read and CSV fallback.
 */

const CONFIG = Object.freeze({
	API_BASE: document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || (location.hostname.endsWith("pages.dev") ? "https://rops-api.digikev-kevin-rapley.workers.dev" : location.origin),
	FETCH_TIMEOUT_MS: 12000,
	CACHE: "no-store",
	SHOW_SOURCE_NOTE: false
});

const container = document.getElementById("list");

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
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

function parseCSV(text) {
	const rows = [];
	let row = [];
	let field = "";
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		const n = text[i + 1];
		if (inQuotes) {
			if (c === '"' && n === '"') {
				field += '"';
				i++;
			} else if (c === '"') {
				inQuotes = false;
			} else {
				field += c;
			}
		} else if (c === '"') {
			inQuotes = true;
		} else if (c === ',') {
			row.push(field);
			field = "";
		} else if (c === "\r") {
			continue;
		} else if (c === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += c;
		}
	}

	if (field.length || row.length) {
		row.push(field);
		rows.push(row);
	}

	return rows;
}

function mapProjectRow(header, row) {
	const idx = name => header.indexOf(name);
	const get = name => {
		const i = idx(name);
		return i >= 0 ? (row[i] ?? "") : "";
	};

	let stakeholders = [];
	try {
		stakeholders = JSON.parse(get("Stakeholders") || "[]");
	} catch {
		stakeholders = [];
	}

	return {
		id: get("LocalId") || undefined,
		name: get("Name"),
		description: get("Description"),
		stakeholders,
		objectives: (get("Objectives") || "").split("|").map(s => s.trim()).filter(Boolean),
		user_groups: (get("UserGroups") || "").split("|").map(s => s.trim()).filter(Boolean),
		createdAt: get("CreatedAt") || "",
		"rops:servicePhase": get("Phase") || "Discovery",
		"rops:projectStatus": get("Status") || "Planning research"
	};
}

async function fetchWithTimeout(url) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort("timeout"), CONFIG.FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			credentials: "omit",
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

	return {
		id: p.LocalId || p.id,
		name: p.Name ?? p.name ?? "",
		description: p.Description ?? p.description ?? "",
		stakeholders,
		objectives: Array.isArray(objectivesRaw) ? objectivesRaw : String(objectivesRaw).split("\n").map(s => s.trim()).filter(Boolean),
		user_groups: Array.isArray(groupsRaw) ? groupsRaw : String(groupsRaw).split(",").map(s => s.trim()).filter(Boolean),
		createdAt: p.CreatedAt ?? p.createdAt ?? p.createdTime ?? "",
		"rops:servicePhase": p.Phase ?? p["rops:servicePhase"] ?? "",
		"rops:projectStatus": p.Status ?? p["rops:projectStatus"] ?? ""
	};
}

async function listFromAirtable() {
	const { ok, status, data } = await fetchWithTimeout(`${CONFIG.API_BASE}/api/projects`);
	if (!ok || !data?.ok) throw new Error(`Airtable list failed (${status})`);
	return (data.projects || []).map(normaliseProject);
}

async function listFromCsv() {
	const response = await fetch(`${CONFIG.API_BASE}/api/projects.csv`, { cache: CONFIG.CACHE });
	if (!response.ok) throw new Error(`CSV fetch failed (${response.status})`);
	const rows = parseCSV(await response.text());
	if (!rows.length) return [];
	const [headerRow, ...dataRows] = rows;
	const header = headerRow.map(h => (h || "").trim());
	return dataRows
		.filter(r => r && r.some(cell => (cell || "").trim().length))
		.map(r => mapProjectRow(header, r));
}

async function listProjects() {
	try {
		return { source: "airtable", projects: await listFromAirtable() };
	} catch (error) {
		console.warn("[ProjectsPage] Falling back to CSV", error);
		return { source: "csv", projects: await listFromCsv() };
	}
}

function projectDashboardHref(projectId) {
	return `/pages/project-dashboard/?id=${encodeURIComponent(projectId || "")}`;
}

function projectDashboardLabel(project) {
	return `View dashboard for ${project.name || "this project"}`;
}

function projectCard(project) {
	const projectId = encodeURIComponent(project.id || "");
	const dashboardHref = projectDashboardHref(project.id || "");
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
	<p class="project-org">${escapeHtml(project.org || project.Org || "Home Office Biometrics")}</p>
	<h2 id="project-title-${projectId}" class="project-title govuk-heading-m">
		<a class="govuk-link" href="${dashboardHref}" rel="bookmark">${escapeHtml(project.name)}</a>
	</h2>
	<p class="project-meta"><strong>Phase:</strong> ${escapeHtml(project["rops:servicePhase"] || "")} · <strong>Status:</strong> ${escapeHtml(project["rops:projectStatus"] || "")}</p>
	${project.description ? `<section class="project-summary"><p>${escapeHtml(project.description)}</p></section>` : ""}
	<p class="project-actions">
		<a class="govuk-button govuk-button--secondary project-dashboard-action" href="${dashboardHref}" aria-label="${dashboardLabel}">View dashboard</a>
	</p>
	${project.user_groups?.length ? `<section class="user-groups" aria-labelledby="user-groups-${projectId}"><h3 id="user-groups-${projectId}" class="project-groups-title">User Groups</h3><ul class="tags" role="list">${groups}</ul></section>` : ""}
	<section class="project-extra">
		<details class="project-details">
			<summary class="govuk-link">Stakeholders &amp; Objectives</summary>
			<div class="details-columns">
				<div><h4 class="govuk-heading-s">Stakeholders</h4><ul role="list">${stakeholders || "<li class='lede'>None</li>"}</ul></div>
				<div><h4 class="govuk-heading-s">Objectives</h4><ul role="list">${objectives || "<li class='lede'>None</li>"}</ul></div>
			</div>
		</details>
	</section>
</article>`;
}

function render(projects, source) {
	projects.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
	if (!projects.length) {
		container.innerHTML = '<p class="lede">No projects yet. <a class="govuk-link" href="./pages/start/">Create one</a>.</p>';
		return;
	}
	container.innerHTML = projects.map(projectCard).join("");
	if (CONFIG.SHOW_SOURCE_NOTE) {
		const sourceNote = document.createElement("p");
		sourceNote.className = "lede";
		sourceNote.textContent = `Source: ${source}`;
		container.prepend(sourceNote);
	}
}

(async () => {
	if (!container) return;
	try {
		const { source, projects } = await listProjects();
		render(projects, source);
	} catch (error) {
		container.innerHTML = `<p class="lede">Could not load projects (${escapeHtml(error?.message || error)}).</p>`;
	}
})();

window.__rops = Object.freeze({
	CONFIG,
	parseCSV,
	toMs
});
