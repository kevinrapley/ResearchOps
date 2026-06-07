function resolveApiBase() {
	const explicit = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || "";
	return String(explicit || "").trim().replace(/\/+$/, "");
}

const PAGE_SIZE = 20;

const CONFIG = Object.freeze({
	API_BASE: resolveApiBase(),
	FETCH_TIMEOUT_MS: 12000,
	CACHE: "no-store",
});

let latestRepositoryRequest = 0;

function apiUrl(path) {
	const cleanPath = path.startsWith("/") ? path : `/${path}`;
	return `${CONFIG.API_BASE}${cleanPath}`;
}

async function consumePrefetchedRepository(requestPath) {
	const prefetch = window.__repositoryPrefetch;
	if (!prefetch?.promise || prefetch.requestPath !== requestPath) return null;
	delete window.__repositoryPrefetch;
	return prefetch.promise;
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
		const responseText = await response.text();
		let data;
		try {
			data = JSON.parse(responseText);
		} catch {
			data = { ok: false, parseError: true, raw: responseText };
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

function paragraph(message, classes = "govuk-body") {
	const p = document.createElement("p");
	p.className = classes;
	p.textContent = message;
	return p;
}

function renderUnavailable(id, message, classes = "govuk-body") {
	const target = document.getElementById(id);
	if (!target) return;
	clear(target);
	target.appendChild(paragraph(message, classes));
	setBusy(target, false);
}

function renderError() {
	const target = document.getElementById("repository-results");
	if (target) {
		const node = templateContent("repository-error-template");
		clear(target);
		target.appendChild(node);
		setBusy(target, false);
	}
	renderUnavailable("repository-metrics", "Repository summary is not available right now.");
	setBusy(document.getElementById("repository-filter-form"), false);
	setQueueCounts([], false);
}

function normaliseKey(value) {
	return text(value).trim().toLowerCase();
}

function renderMetrics(metrics = []) {
	const target = document.getElementById("repository-metrics");
	if (!target) return;
	const byLabel = new Map(metrics.map((metric) => [normaliseKey(metric.label), metric]));
	target.querySelectorAll("[data-repository-metric]").forEach((node) => {
		const metric = byLabel.get(normaliseKey(node.getAttribute("data-repository-metric")));
		node.textContent = metric ? text(metric.value) : "0";
	});
	setBusy(target, false);
}

function displayTags(artefact) {
	return (artefact.tags || []).filter((tag) => !/seeded/i.test(text(tag.text)));
}

function tagFor(tag) {
	const strong = document.createElement("strong");
	strong.className = `govuk-tag ${tag.classes || "govuk-tag--grey"}`;
	strong.textContent = text(tag.text);
	return strong;
}

function renderArtefacts(artefacts = [], pagination = {}) {
	const target = document.getElementById("repository-results");
	const count = document.getElementById("repository-result-count");
	if (!target) return;
	clear(target);
	if (count) {
		const total = Number(pagination.total || artefacts.length || 0);
		const page = Number(pagination.page || 1);
		const limit = Number(pagination.limit || PAGE_SIZE);
		const start = total ? (page - 1) * limit + 1 : 0;
		const end = total ? Math.min(start + artefacts.length - 1, total) : 0;
		count.textContent = total > artefacts.length ?
			`Showing ${start} to ${end} of ${total} published artefacts` :
			`${total} published artefact${total === 1 ? "" : "s"}`;
	}
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
			link.setAttribute("href", text(artefact.href || `/pages/repository/artefacts/?id=${encodeURIComponent(artefact.id || "")}`));
		}
		if (summary) summary.textContent = text(artefact.summary);
		if (tags) {
			for (const tag of displayTags(artefact)) tags.appendChild(tagFor(tag));
		}
		list.appendChild(node);
	}
	target.appendChild(list);
	setBusy(target, false);
}

function filterCountMap(filters = []) {
	const counts = new Map();
	for (const filter of filters) {
		for (const item of filter.items || []) {
			counts.set(`${filter.name}:${item.value}`, item.count);
		}
	}
	return counts;
}

function updateFilterCounts(filters = []) {
	const form = document.getElementById("repository-filter-form");
	if (!form) return;
	const counts = filterCountMap(filters);
	form.querySelectorAll(".repository-filter-count").forEach((node) => node.remove());
	form.querySelectorAll("input[type='checkbox']").forEach((input) => {
		const count = counts.get(`${input.name}:${input.value}`);
		const label = form.querySelector(`label[for="${input.id}"]`);
		if (!label) return;
		const countNode = document.createElement("span");
		countNode.className = "repository-filter-count";
		countNode.textContent = ` (${Number.isFinite(Number(count)) ? count : 0})`;
		label.appendChild(countNode);
	});
	setBusy(form, false);
}

function setQueueCounts(queues = [], canCurate = false) {
	const table = document.getElementById("repository-queues");
	if (!table) return;
	const counts = new Map(queues.map((row) => [normaliseKey(row.queue), row.count]));
	table.querySelectorAll("[data-repository-queue-count]").forEach((cell) => {
		if (!canCurate) {
			cell.textContent = "Restricted";
			return;
		}
		const count = counts.get(normaliseKey(cell.getAttribute("data-repository-queue-count")));
		cell.textContent = count === undefined ? "0" : text(count);
	});
	setBusy(table, false);
}

function syncSearchAndFiltersFromUrl() {
	const params = new URLSearchParams(window.location.search);
	const search = document.getElementById("repository-search-query");
	if (search) search.value = text(params.get("q"));
	const form = document.getElementById("repository-filter-form");
	if (!form) return;
	form.querySelectorAll("input[type='checkbox']").forEach((input) => {
		input.checked = params.getAll(input.name).includes(input.value);
	});
}

function repositoryQueryFromForms() {
	const params = new URLSearchParams();
	const search = document.getElementById("repository-search-query");
	const query = text(search?.value).trim();
	if (query) params.set("q", query);
	const form = document.getElementById("repository-filter-form");
	if (form) {
		form.querySelectorAll("input[type='checkbox']:checked").forEach((input) => {
			params.append(input.name, input.value);
		});
	}
	return params;
}

function repositoryRequestUrl(params = new URLSearchParams(window.location.search)) {
	const query = params.toString();
	return apiUrl(`/api/repository${query ? `?${query}` : ""}`);
}

function repositoryRequestPath(params = new URLSearchParams(window.location.search)) {
	const query = params.toString();
	return `/api/repository${query ? `?${query}` : ""}`;
}

function updateRepositoryHistory(params) {
	const query = params.toString();
	window.history.pushState({}, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
}

async function loadRepositoryState(params = new URLSearchParams(window.location.search)) {
	const requestId = ++latestRepositoryRequest;
	syncSearchAndFiltersFromUrl();
	setBusy(document.getElementById("repository-results"), true);
	setBusy(document.getElementById("repository-filter-form"), true);
	const requestPath = repositoryRequestPath(params);
	const prefetched = await consumePrefetchedRepository(requestPath);
	const { ok, status, data } = prefetched || await fetchWithTimeout(repositoryRequestUrl(params));
	if (requestId !== latestRepositoryRequest) return;
	if (status === 401) {
		redirectToSignIn();
		return;
	}
	if (!ok || data?.ok !== true) {
		renderError();
		return;
	}
	renderMetrics(data.metrics || []);
	updateFilterCounts(data.filters || []);
	setQueueCounts(data.queues || [], Boolean(data.canCurate));
	renderArtefacts(data.artefacts || [], data.pagination || {});
}

function bindRepositoryInteractions() {
	const searchForm = document.getElementById("repository-search");
	const filterForm = document.getElementById("repository-filter-form");
	const apply = async (event) => {
		event.preventDefault();
		const params = repositoryQueryFromForms();
		updateRepositoryHistory(params);
		await loadRepositoryState(params);
	};
	searchForm?.addEventListener("submit", apply);
	filterForm?.addEventListener("submit", apply);
	window.addEventListener("popstate", () => {
		loadRepositoryState(new URLSearchParams(window.location.search)).catch(() => renderError());
	});
}

async function initialiseRepositoryPage() {
	bindRepositoryInteractions();
	await loadRepositoryState(new URLSearchParams(window.location.search));
}

initialiseRepositoryPage().catch(() => renderError());
