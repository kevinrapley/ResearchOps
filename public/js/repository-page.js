function resolveApiBase() {
	const explicit = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || "";
	return String(explicit || "").trim().replace(/\/+$/, "");
}

const CONFIG = Object.freeze({
	API_BASE: resolveApiBase(),
	FETCH_TIMEOUT_MS: 12000,
	CACHE: "no-store",
});

function apiUrl(path) {
	const cleanPath = path.startsWith("/") ? path : `/${path}`;
	return `${CONFIG.API_BASE}${cleanPath}`;
}

function signInUrl() {
	const returnTo = `${window.location.pathname}${window.location.search || ""}`;
	return `/pages/account/sign-in/?returnTo=${encodeURIComponent(returnTo)}`;
}

function redirectToSignIn() {
	window.location.assign(signInUrl());
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
		return { ok: response.ok, status: response.status, data };
	} finally {
		clearTimeout(timer);
	}
}

function text(value) {
	return String(value || "");
}

function clear(element) {
	if (!element) return;
	element.replaceChildren();
}

function templateContent(id) {
	const template = document.getElementById(id);
	if (!(template instanceof HTMLTemplateElement)) throw new Error(`Missing template: ${id}`);
	return template.content.firstElementChild.cloneNode(true);
}

function setBusy(element, busy) {
	if (!element) return;
	element.setAttribute("aria-busy", busy ? "true" : "false");
}

function renderError(detail) {
	const target = document.getElementById("repository-results");
	if (!target) return;
	const node = templateContent("repository-error-template");
	const detailNode = node.querySelector("[data-repository-error='detail']");
	if (detailNode) detailNode.textContent = text(detail || "repository_api_error");
	clear(target);
	target.appendChild(node);
	setBusy(target, false);
}

function renderMetrics(metrics = []) {
	const target = document.getElementById("repository-metrics");
	if (!target) return;
	clear(target);
	if (!metrics.length) {
		target.appendChild(document.createTextNode("Repository summary is not available."));
		setBusy(target, false);
		return;
	}
	for (const metric of metrics) {
		const node = templateContent("repository-metric-template");
		const value = node.querySelector("[data-repository-metric='value']");
		const label = node.querySelector("[data-repository-metric='label']");
		if (value) value.textContent = text(metric.value);
		if (label) label.textContent = text(metric.label);
		target.appendChild(node);
	}
	setBusy(target, false);
}

function tagFor(tag) {
	const strong = document.createElement("strong");
	strong.className = `govuk-tag ${tag.classes || "govuk-tag--grey"}`;
	strong.textContent = text(tag.text);
	return strong;
}

function renderArtefacts(artefacts = []) {
	const target = document.getElementById("repository-results");
	const count = document.getElementById("repository-result-count");
	if (!target) return;
	clear(target);
	if (count) count.textContent = `${artefacts.length} published artefact${artefacts.length === 1 ? "" : "s"}`;
	if (!artefacts.length) {
		target.appendChild(templateContent("repository-empty-template"));
		setBusy(target, false);
		return;
	}
	const list = document.createElement("div");
	list.className = "repository-artefact-list";
	for (const artefact of artefacts) {
		const node = templateContent("repository-artefact-template");
		const link = node.querySelector("[data-repository-artefact='title']");
		const summary = node.querySelector("[data-repository-artefact='summary']");
		const tags = node.querySelector("[data-repository-artefact='tags']");
		if (link) {
			link.textContent = text(artefact.title);
			link.setAttribute("href", text(artefact.href || `/pages/repository/artefacts/${encodeURIComponent(artefact.id || "")}/`));
		}
		if (summary) summary.textContent = text(artefact.summary);
		if (tags) {
			for (const tag of artefact.tags || []) tags.appendChild(tagFor(tag));
		}
		list.appendChild(node);
	}
	target.appendChild(list);
	setBusy(target, false);
}

function renderFilters(filters = []) {
	const target = document.getElementById("repository-filters");
	if (!target) return;
	clear(target);
	if (!filters.length) {
		target.innerHTML = '<p class="govuk-body-s">No filters are available yet.</p>';
		setBusy(target, false);
		return;
	}
	const form = document.createElement("form");
	form.method = "get";
	form.action = "/pages/repository/";
	for (const filter of filters) {
		const group = document.createElement("div");
		group.className = "govuk-form-group";
		const fieldset = document.createElement("fieldset");
		fieldset.className = "govuk-fieldset";
		const legend = document.createElement("legend");
		legend.className = "govuk-fieldset__legend govuk-fieldset__legend--s";
		legend.textContent = text(filter.label);
		fieldset.appendChild(legend);
		const checkboxes = document.createElement("div");
		checkboxes.className = "govuk-checkboxes govuk-checkboxes--small";
		for (const item of filter.items || []) {
			const id = `repository-filter-${filter.name}-${item.value}`.replace(/[^a-z0-9_-]+/gi, "-");
			const wrapper = document.createElement("div");
			wrapper.className = "govuk-checkboxes__item";
			const input = document.createElement("input");
			input.className = "govuk-checkboxes__input";
			input.id = id;
			input.name = filter.name;
			input.type = "checkbox";
			input.value = text(item.value);
			const label = document.createElement("label");
			label.className = "govuk-label govuk-checkboxes__label";
			label.setAttribute("for", id);
			label.textContent = `${item.label} (${item.count})`;
			wrapper.append(input, label);
			checkboxes.appendChild(wrapper);
		}
		fieldset.appendChild(checkboxes);
		group.appendChild(fieldset);
		form.appendChild(group);
	}
	const button = document.createElement("button");
	button.type = "submit";
	button.className = "govuk-button govuk-button--secondary";
	button.setAttribute("data-module", "govuk-button");
	button.textContent = "Apply filters";
	form.appendChild(button);
	target.appendChild(form);
	setBusy(target, false);
}

function renderQueues(queues = [], canCurate = false) {
	const target = document.getElementById("repository-queues");
	if (!target) return;
	clear(target);
	if (!canCurate) {
		target.innerHTML = '<p class="govuk-body">Curator queues are shown to users with repository curation permission.</p>';
		setBusy(target, false);
		return;
	}
	const table = document.createElement("table");
	table.className = "govuk-table repository-queue-table";
	table.innerHTML = '<caption class="govuk-table__caption">Repository queue</caption><thead><tr><th class="govuk-table__header" scope="col">Queue</th><th class="govuk-table__header" scope="col">Items</th><th class="govuk-table__header" scope="col">Action</th></tr></thead><tbody></tbody>';
	const body = table.querySelector("tbody");
	for (const row of queues) {
		const tr = document.createElement("tr");
		tr.className = "govuk-table__row";
		tr.innerHTML = `<td class="govuk-table__cell"></td><td class="govuk-table__cell"></td><td class="govuk-table__cell"><a class="govuk-link"></a></td>`;
		tr.children[0].textContent = text(row.queue);
		tr.children[1].textContent = text(row.count);
		const link = tr.querySelector("a");
		link.textContent = text(row.action);
		link.href = text(row.href);
		body.appendChild(tr);
	}
	target.appendChild(table);
	setBusy(target, false);
}

async function initialiseRepositoryPage() {
	const { ok, status, data } = await fetchWithTimeout(apiUrl(`/api/repository${window.location.search || ""}`));
	if (status === 401) {
		redirectToSignIn();
		return;
	}
	if (!ok || data?.ok !== true) {
		renderError(data?.message || data?.error || `repository_http_${status}`);
		return;
	}
	renderMetrics(data.metrics || []);
	renderArtefacts(data.artefacts || []);
	renderFilters(data.filters || []);
	renderQueues(data.queues || [], Boolean(data.canCurate));
}

initialiseRepositoryPage().catch((error) => renderError(error?.message || error));
