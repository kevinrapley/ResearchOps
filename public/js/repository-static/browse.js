import { PAGE_SIZE, consumePrefetchedRepository, displayTags, repositoryJson, signInUrl, slug, tagNode, text, titleFromSlug } from './shared.js';

let latestBrowseRequest = 0;

function selectedValueFor(type) {
	return slug(new URLSearchParams(window.location.search).get(type));
}

function selectedPage() {
	const page = Number.parseInt(new URLSearchParams(window.location.search).get("page") || "1", 10);
	return Number.isFinite(page) && page > 0 ? page : 1;
}

function selectedSort() {
	const sort = new URLSearchParams(window.location.search).get("sort") || "reviewed_desc";
	return ["reviewed_desc", "confidence_desc", "relevance"].includes(sort) ? sort : "reviewed_desc";
}

function definitionItem(term, value) {
	const wrapper = document.createElement("div");
	wrapper.className = "repository-result-meta__row";
	const dt = document.createElement("dt");
	dt.className = "repository-result-meta__key";
	dt.textContent = term;
	const dd = document.createElement("dd");
	dd.className = "repository-result-meta__value";
	dd.textContent = text(value) || "Not recorded";
	wrapper.append(dt, dd);
	return wrapper;
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
	const meta = document.createElement("dl");
	meta.className = "repository-result-meta govuk-body-s";
	meta.append(
		definitionItem("Confidence", titleFromSlug(artefact.confidence)),
		definitionItem("Evidence maturity", titleFromSlug(artefact.evidenceMaturity)),
		definitionItem("Method", titleFromSlug(artefact.method || artefact.provenance?.method)),
		definitionItem("Source context", text(artefact.provenance?.sample || artefact.serviceArea || "Not recorded")),
		definitionItem("Review state", artefact.reviewDueAt ? `Review due ${artefact.reviewDueAt}` : "No review date recorded")
	);
	const tagContainer = document.createElement("div");
	tagContainer.className = "repository-artefact-list__meta";
	tagContainer.setAttribute("aria-label", "Artefact metadata");
	for (const tag of displayTags(artefact)) tagContainer.appendChild(tagNode(tag));
	article.append(heading, summary, meta);
	if (tagContainer.children.length) article.appendChild(tagContainer);
	return article;
}

function renderSelectedState(selected) {
	const container = document.getElementById("repository-selected-state");
	const summary = document.getElementById("repository-selected-summary");
	if (!container || !summary) return;
	if (!selected?.value) {
		container.hidden = true;
		return;
	}
	summary.textContent = `Showing artefacts tagged to: ${selected.label || titleFromSlug(selected.value)}.`;
	container.hidden = false;
}

function renderResultCount(pagination = {}, selectedLabel = "") {
	const count = document.getElementById("repository-browse-result-count");
	if (!count) return;
	const total = Number(pagination.total || 0);
	if (!total) {
		count.textContent = selectedLabel ? `0 published artefacts for ${selectedLabel}.` : "0 published artefacts.";
		return;
	}
	const page = Number(pagination.page || 1);
	const limit = Number(pagination.limit || PAGE_SIZE);
	const start = (page - 1) * limit + 1;
	const end = Math.min(start + limit - 1, total);
	count.textContent = `Showing ${start} to ${end} of ${total} published artefacts${selectedLabel ? ` for ${selectedLabel}` : ""}.`;
}

function renderPagination(type, value, pagination = {}, sort = "reviewed_desc") {
	const nav = document.getElementById("repository-pagination");
	if (!nav) return;
	nav.replaceChildren();
	const total = Number(pagination.total || 0);
	const limit = Number(pagination.limit || PAGE_SIZE);
	const currentPage = Number(pagination.page || 1);
	const totalPages = Math.ceil(total / limit);
	if (!value || totalPages <= 1) {
		nav.hidden = true;
		return;
	}
	const list = document.createElement("ul");
	list.className = "govuk-pagination__list";
	for (let page = 1; page <= totalPages; page += 1) {
		const item = document.createElement("li");
		item.className = `govuk-pagination__item${page === currentPage ? " govuk-pagination__item--current" : ""}`;
		const link = document.createElement("a");
		link.className = "govuk-link govuk-pagination__link";
		link.href = `${window.location.pathname}?${new URLSearchParams({ [type]: value, page: String(page), limit: String(limit), sort })}`;
		link.textContent = String(page);
		link.setAttribute("aria-label", `Page ${page}`);
		if (page === currentPage) link.setAttribute("aria-current", "page");
		item.appendChild(link);
		list.appendChild(item);
	}
	nav.appendChild(list);
	nav.hidden = false;
}

export function renderBrowseResults(artefacts = [], selected = {}, pagination = {}) {
	const target = document.getElementById("repository-browse-results");
	if (!target) return;
	target.replaceChildren();
	const selectedLabel = selected?.label || titleFromSlug(selected?.value || "");
	renderSelectedState(selected);
	renderResultCount(pagination, selectedLabel);
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

function browseUrl(type, value, page = 1, sort = selectedSort()) {
	return `${window.location.pathname}?${new URLSearchParams({ [type]: value, page: String(page), limit: String(PAGE_SIZE), sort })}`;
}

function updateBrowseHistory(type, value, page = 1, sort = selectedSort()) {
	window.history.pushState({}, "", browseUrl(type, value, page, sort));
}

function renderBrowseOptions(page, filters = []) {
	const target = document.getElementById("repository-browse-options");
	if (!target) return;
	const type = page.dataset.browseType;
	const selected = selectedValueFor(type);
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
		const itemValue = slug(item.value);
		const itemLabel = titleFromSlug(item.label || item.value);
		const li = document.createElement("li");
		const link = document.createElement("a");
		link.className = `govuk-link repository-browse-list__button${itemValue === selected ? " repository-browse-list__button--selected" : ""}`;
		link.href = browseUrl(type, item.value, 1, selectedSort());
		link.textContent = `${itemLabel}, ${item.count} published artefact${Number(item.count) === 1 ? "" : "s"}`;
		if (itemValue === selected) link.setAttribute("aria-current", "true");
		li.appendChild(link);
		list.appendChild(li);
	}
	target.appendChild(list);
	target.setAttribute("aria-busy", "false");
}

function initialiseSortForm(type, value) {
	const form = document.getElementById("repository-sort-form");
	const select = document.getElementById("repository-sort");
	if (!form || !select) return;
	select.value = selectedSort();
	form.hidden = !value;
}

function browseRequestPath(page) {
	const type = page.dataset.browseType;
	const value = selectedValueFor(type);
	if (!value) {
		return "/api/repository";
	}
	const params = new URLSearchParams(window.location.search);
	params.set(type, value);
	params.set("page", String(selectedPage()));
	params.set("limit", String(PAGE_SIZE));
	params.set("sort", selectedSort());
	return `/api/repository?${params.toString()}`;
}

async function loadBrowseState(page) {
	const requestId = ++latestBrowseRequest;
	const type = page.dataset.browseType;
	const value = selectedValueFor(type);
	const sort = selectedSort();
	initialiseSortForm(type, value);
	document.getElementById("repository-browse-options")?.setAttribute("aria-busy", "true");
	document.getElementById("repository-browse-results")?.setAttribute("aria-busy", "true");
	const requestPath = browseRequestPath(page);
	const prefetched = await consumePrefetchedRepository(requestPath);
	const { response, data } = prefetched || await repositoryJson(requestPath);
	if (requestId !== latestBrowseRequest) return;
	if (response.status === 401) {
		window.location.assign(signInUrl());
		return;
	}
	const filters = data?.filters || [];
	renderBrowseOptions(page, filters);
	if (!value || !data?.selected?.value) {
		renderBrowseResults([], {}, { page: 1, limit: PAGE_SIZE, total: 0 });
		renderPagination(type, "", {}, sort);
		document.getElementById("repository-browse-results")?.setAttribute("aria-busy", "false");
		return;
	}
	renderBrowseResults(data.artefacts || [], data.selected, data.pagination || {});
	renderPagination(type, value, data.pagination || {}, sort);
	document.getElementById("repository-browse-results")?.setAttribute("aria-busy", "false");
}

function bindBrowseInteractions(page) {
	const type = page.dataset.browseType;
	const options = document.getElementById("repository-browse-options");
	const pagination = document.getElementById("repository-pagination");
	const form = document.getElementById("repository-sort-form");
	const select = document.getElementById("repository-sort");
	if (options) {
		options.addEventListener("click", (event) => {
			const link = event.target.closest("a");
			if (!(link instanceof HTMLAnchorElement)) return;
			event.preventDefault();
			const value = new URL(link.href, window.location.origin).searchParams.get(type);
			if (!value) return;
			updateBrowseHistory(type, value, 1, selectedSort());
			loadBrowseState(page).catch(() => renderBrowseResults([], {}, { page: 1, limit: PAGE_SIZE, total: 0 }));
		});
	}
	if (pagination) {
		pagination.addEventListener("click", (event) => {
			const link = event.target.closest("a");
			if (!(link instanceof HTMLAnchorElement)) return;
			event.preventDefault();
			const params = new URL(link.href, window.location.origin).searchParams;
			const value = params.get(type);
			const targetPage = Number.parseInt(params.get("page") || "1", 10);
			if (!value) return;
			updateBrowseHistory(type, value, targetPage, params.get("sort") || selectedSort());
			loadBrowseState(page).catch(() => renderBrowseResults([], {}, { page: 1, limit: PAGE_SIZE, total: 0 }));
		});
	}
	if (!form || !select) return;
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		const currentValue = selectedValueFor(type);
		if (!currentValue) return;
		updateBrowseHistory(type, currentValue, 1, select.value);
		loadBrowseState(page).catch(() => renderBrowseResults([], {}, { page: 1, limit: PAGE_SIZE, total: 0 }));
	});
}

export async function initialiseBrowsePage() {
	const page = document.querySelector("[data-repository-browse-page]");
	if (!page) return;
	bindBrowseInteractions(page);
	await loadBrowseState(page);
	window.addEventListener("popstate", () => {
		loadBrowseState(page).catch(() => renderBrowseResults([], {}, { page: 1, limit: PAGE_SIZE, total: 0 }));
	});
}
