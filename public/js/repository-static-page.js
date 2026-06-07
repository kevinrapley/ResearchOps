function apiUrl(path) {
	const explicit = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || "";
	const base = String(explicit || "").trim().replace(/\/+$/, "");
	const cleanPath = path.startsWith("/") ? path : `/${path}`;
	return `${base}${cleanPath}`;
}

function text(value) {
	return String(value || "");
}

const repositoryLabelOverrides = new Map([
	["frontline-staff", "Frontline staff"],
	["assisted-digital-users", "Assisted digital users"],
	["public-users", "Public users"],
	["researchers", "Researchers"],
	["research-operations-team", "Research operations staff"],
	["research-operations-staff", "Research operations staff"],
]);

function titleFromSlug(value) {
	const raw = text(value).trim();
	const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
	if (repositoryLabelOverrides.has(key)) return repositoryLabelOverrides.get(key);
	const words = raw.includes("-") ? raw.replace(/-/g, " ") : raw;
	return words ? `${words.slice(0, 1).toUpperCase()}${words.slice(1).toLowerCase()}` : "";
}

async function repositoryJson(path, options = {}) {
	const response = await fetch(apiUrl(path), {
		credentials: "include",
		cache: "no-store",
		...options,
		headers: {
			Accept: "application/json",
			...(options.headers || {})
		}
	});
	const data = await response.json().catch(() => ({ ok: false }));
	return { response, data };
}

function signInUrl() {
	const returnTo = `${window.location.pathname}${window.location.search || ""}`;
	return `/pages/account/sign-in/?returnTo=${encodeURIComponent(returnTo)}`;
}

function option(value, label = value) {
	const node = document.createElement("option");
	node.value = value;
	node.textContent = label || titleFromSlug(value);
	return node;
}

function projectId(project = {}) {
	return text(project.id || project.airtableId || project.recordId || project.localId || project.LocalId);
}

function projectLabel(project = {}) {
	const name = text(project.name || project.Name || project.title || project.Title);
	const team = text(project.teamName || project.team_name || project.team || project.org || project.Org);
	return team ? `${name} - ${team}` : name;
}

function tagNode(tag) {
	const strong = document.createElement("strong");
	strong.className = `govuk-tag ${tag.classes || "govuk-tag--grey"}`;
	strong.textContent = text(tag.text);
	return strong;
}

function artefactNode(artefact) {
	const article = document.createElement("article");
	article.className = "repository-artefact-list__item";
	const heading = document.createElement("h3");
	heading.className = "govuk-heading-m";
	const link = document.createElement("a");
	link.className = "govuk-link govuk-link--no-visited-state";
	link.href = text(artefact.href || `/pages/repository/artefacts/?id=${encodeURIComponent(artefact.id || "")}`);
	link.textContent = text(artefact.title);
	heading.appendChild(link);
	const summary = document.createElement("p");
	summary.className = "govuk-body";
	summary.textContent = text(artefact.summary);
	const meta = document.createElement("div");
	meta.className = "repository-artefact-list__meta";
	meta.setAttribute("aria-label", "Artefact metadata");
	for (const tag of artefact.tags || []) meta.appendChild(tagNode(tag));
	article.append(heading, summary, meta);
	return article;
}

function renderBrowseResults(artefacts = [], selectedLabel = "") {
	const target = document.getElementById("repository-browse-results");
	const count = document.getElementById("repository-browse-result-count");
	if (!target) return;
	target.replaceChildren();
	if (count) count.textContent = `${artefacts.length} published artefact${artefacts.length === 1 ? "" : "s"}${selectedLabel ? ` for ${selectedLabel}` : ""}`;
	if (!artefacts.length) {
		const inset = document.createElement("div");
		inset.className = "govuk-inset-text";
		inset.textContent = selectedLabel ? "No published artefacts match this selection." : "Choose an option to filter the repository.";
		target.appendChild(inset);
		return;
	}
	const list = document.createElement("div");
	list.className = "repository-artefact-list";
	for (const artefact of artefacts) list.appendChild(artefactNode(artefact));
	target.appendChild(list);
}

async function loadBrowseResults(type, value, label) {
	const query = new URLSearchParams({ [type]: value, limit: "50" });
	const { response, data } = await repositoryJson(`/api/repository?${query.toString()}`);
	if (response.status === 401) {
		window.location.assign(signInUrl());
		return;
	}
	renderBrowseResults(data?.ok ? data.artefacts || [] : [], label);
}

function renderBrowseOptions(page, filters = []) {
	const target = document.getElementById("repository-browse-options");
	if (!target) return;
	const type = page.dataset.browseType;
	const filter = filters.find((entry) => entry.name === type);
	target.replaceChildren();
	if (!filter?.items?.length) {
		const inset = document.createElement("div");
		inset.className = "govuk-inset-text";
		inset.textContent = "No filter options are available for this route yet.";
		target.appendChild(inset);
		target.setAttribute("aria-busy", "false");
		return;
	}
	const list = document.createElement("ul");
	list.className = "govuk-list repository-browse-list";
	for (const item of filter.items) {
		const li = document.createElement("li");
		const button = document.createElement("button");
		button.type = "button";
		button.className = "govuk-link repository-browse-list__button";
		button.textContent = `${titleFromSlug(item.label || item.value)} (${item.count})`;
		button.addEventListener("click", () => loadBrowseResults(type, item.value, titleFromSlug(item.label || item.value)));
		li.appendChild(button);
		list.appendChild(li);
	}
	target.appendChild(list);
	target.setAttribute("aria-busy", "false");
}

async function initialiseBrowsePage() {
	const page = document.querySelector("[data-repository-browse-page]");
	if (!page) return;
	const { response, data } = await repositoryJson("/api/repository?limit=1");
	if (response.status === 401) {
		window.location.assign(signInUrl());
		return;
	}
	renderBrowseOptions(page, data?.filters || []);
}

function populateSelect(select, filters, filterName) {
	if (!select) return;
	select.replaceChildren(option("", "Select one"));
	const filter = filters.find((entry) => entry.name === filterName);
	for (const item of filter?.items || []) select.appendChild(option(item.value, titleFromSlug(item.label || item.value)));
}

async function populateProjectSelect() {
	const select = document.getElementById("candidate-source-project-id");
	if (!select) return;
	const { response, data } = await repositoryJson(`/api/projects?limit=200&ts=${Date.now()}`);
	if (response.status === 401) {
		window.location.assign(signInUrl());
		return;
	}
	const projects = Array.isArray(data?.projects) ? data.projects : [];
	select.replaceChildren(option("", projects.length ? "Select source project" : "No accessible projects found"));
	for (const project of projects) {
		const id = projectId(project);
		const label = projectLabel(project);
		if (id && label) select.appendChild(option(id, label));
	}
}

async function initialiseCandidatePage() {
	const form = document.getElementById("repository-candidate-form");
	if (!form) return;
	const status = document.getElementById("repository-candidate-status");
	const [{ data }] = await Promise.all([
		repositoryJson("/api/repository?limit=1"),
		populateProjectSelect()
	]);
	const filters = data?.filters || [];
	populateSelect(document.getElementById("candidate-service-area"), filters, "service_area");
	populateSelect(document.getElementById("candidate-user-group"), filters, "user_group");
	populateSelect(document.getElementById("candidate-method"), filters, "method");
	populateSelect(document.getElementById("candidate-risk-area"), filters, "risk_area");

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const payload = Object.fromEntries(new FormData(form).entries());
		const { response, data: created } = await repositoryJson("/api/repository/artefacts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload)
		});
		if (response.status === 401) {
			window.location.assign(signInUrl());
			return;
		}
		if (status) {
			status.className = response.ok && created?.ok ? "govuk-inset-text" : "govuk-error-message";
			status.textContent = response.ok && created?.ok
				? `Candidate artefact ${created.id} has been submitted for repository review.`
				: "Candidate artefact could not be submitted. Check the required fields and try again.";
		}
		if (response.ok && created?.ok) form.reset();
	});
}

initialiseBrowsePage().catch(() => renderBrowseResults([], ""));
initialiseCandidatePage().catch(() => {});
