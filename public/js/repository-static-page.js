const PAGE_SIZE = 10;
const repositoryLabelOverrides = new Map([
	["frontline-staff", "Frontline staff"],
	["assisted-digital-users", "Assisted digital users"],
	["public-users", "Public users"],
	["researchers", "Researchers"],
	["research-operations-team", "Research operations staff"],
	["research-operations-staff", "Research operations staff"],
]);
const REVIEW_QUEUE_PAGE_CONTEXT = Object.freeze({
	candidates: {
		title: "Candidate artefacts",
		lead: "Review candidate artefacts before they are published to the repository.",
		body: "Assess candidate artefacts, record a review outcome and keep a clear audit trail before anything is published.",
	},
	stale: {
		title: "Due review",
		lead: "Check published artefacts that are due for scheduled review.",
		body: "Run a scheduled review, confirm whether the evidence still stands and capture the decision for audit.",
	},
	withdrawn: {
		title: "Withdrawn artefacts",
		lead: "Inspect artefacts that have been withdrawn from repository search.",
		body: "Inspect governed withdrawn records, understand why they were removed from reuse, and reinstate them when that decision changes.",
	},
});
let latestBrowseRequest = 0;
let latestReviewRequest = 0;

function text(value) {
	return String(value || "");
}

function slug(value) {
	return text(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function apiUrl(path) {
	const explicit = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || "";
	const base = String(explicit || "").trim().replace(/\/+$/, "");
	return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function consumePrefetchedRepository(requestPath) {
	const prefetch = window.__repositoryPrefetch;
	if (!prefetch?.promise || prefetch.requestPath !== requestPath) return null;
	delete window.__repositoryPrefetch;
	return prefetch.promise;
}

function titleFromSlug(value) {
	const raw = text(value).trim();
	const key = slug(raw);
	if (repositoryLabelOverrides.has(key)) return repositoryLabelOverrides.get(key);
	const words = raw.includes("-") ? raw.replace(/-/g, " ") : raw;
	return words ? `${words.slice(0, 1).toUpperCase()}${words.slice(1).toLowerCase()}` : "";
}

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

async function repositoryJson(path, options = {}) {
	const response = await fetch(apiUrl(path), {
		credentials: "include",
		cache: "no-store",
		...options,
		headers: { Accept: "application/json", ...(options.headers || {}) },
	});
	const data = await response.json().catch(() => ({ ok: false }));
	return { response, data };
}

function signInUrl() {
	const returnTo = `${window.location.pathname}${window.location.search || ""}`;
	return `/pages/account/sign-in/?returnTo=${encodeURIComponent(returnTo)}`;
}

function redirectToRepository() {
	window.location.assign("/pages/repository/");
}

function option(value, label = value) {
	const node = document.createElement("option");
	node.value = value;
	node.textContent = label || titleFromSlug(value);
	return node;
}

function tagNode(tag) {
	const strong = document.createElement("strong");
	strong.className = `govuk-tag ${tag.classes || "govuk-tag--grey"}`;
	strong.textContent = text(tag.text);
	return strong;
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

function displayTags(artefact) {
	return (artefact.tags || []).filter((tag) => !/seeded/i.test(text(tag.text))).slice(0, 6);
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

function renderBrowseResults(artefacts = [], selected = {}, pagination = {}) {
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

async function initialiseBrowsePage() {
	const page = document.querySelector("[data-repository-browse-page]");
	if (!page) return;
	bindBrowseInteractions(page);
	await loadBrowseState(page);
	window.addEventListener("popstate", () => {
		loadBrowseState(page).catch(() => renderBrowseResults([], {}, { page: 1, limit: PAGE_SIZE, total: 0 }));
	});
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
		const id = text(project.id || project.airtableId || project.recordId || project.localId || project.LocalId);
		const name = text(project.name || project.Name || project.title || project.Title);
		const team = text(project.teamName || project.team_name || project.team || project.org || project.Org);
		const label = team ? `${name} - ${team}` : name;
		if (id && label) select.appendChild(option(id, label));
	}
}

async function initialiseCandidatePage() {
	const form = document.getElementById("repository-candidate-form");
	if (!form) return;
	const status = document.getElementById("repository-candidate-status");
	const [{ data }] = await Promise.all([repositoryJson("/api/repository?limit=1"), populateProjectSelect()]);
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
			body: JSON.stringify(payload),
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

function selectedReviewId() {
	return text(new URLSearchParams(window.location.search).get("id")).trim();
}

function selectedReviewPage() {
	const page = Number.parseInt(new URLSearchParams(window.location.search).get("page") || "1", 10);
	return Number.isFinite(page) && page > 0 ? page : 1;
}

function reviewQueueFromPathname(pathname = window.location.pathname) {
	if (pathname.includes("/review/withdrawn/")) return "withdrawn";
	if (pathname.includes("/review/stale/")) return "stale";
	return "candidates";
}

function reviewPathnameForQueue(queueKey) {
	if (queueKey === "withdrawn") return "/pages/repository/review/withdrawn/";
	if (queueKey === "stale") return "/pages/repository/review/stale/";
	return "/pages/repository/review/candidates/";
}

function reviewQueryParams(artefactId = "", page = selectedReviewPage(), pathname = window.location.pathname) {
	const params = new URLSearchParams();
	if (page > 1) params.set("page", String(page));
	if (artefactId) params.set("id", artefactId);
	return `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
}

function updateReviewHistory(artefactId = "", page = selectedReviewPage(), pathname = window.location.pathname) {
	window.history.pushState({}, "", reviewQueryParams(artefactId, page, pathname));
}

function reviewApiPath(queueKey) {
	const params = new URLSearchParams();
	const page = selectedReviewPage();
	if (page > 1) params.set("page", String(page));
	return `/api/repository/review/${queueKey}${params.toString() ? `?${params.toString()}` : ""}`;
}

function reviewCountText(queue, pagination = {}) {
	const total = Number(pagination.total || 0);
	if (!total) return queue.emptyMessage;
	const page = Number(pagination.page || 1);
	const limit = Number(pagination.limit || PAGE_SIZE);
	const start = (page - 1) * limit + 1;
	const end = Math.min(start + limit - 1, total);
	return `Showing ${start} to ${end} of ${total} queue items.`;
}

function reviewTabId(queueKey) {
	return `review-${queueKey}`;
}

function reviewPageContext(queueKey) {
	return REVIEW_QUEUE_PAGE_CONTEXT[queueKey] || REVIEW_QUEUE_PAGE_CONTEXT.candidates;
}

function setReviewPageContext(queueKey) {
	const context = reviewPageContext(queueKey);
	const title = document.querySelector("[data-repository-page-title]");
	const lead = document.querySelector("[data-repository-page-lead]");
	const body = document.querySelector("[data-repository-page-body]");
	const breadcrumb = document.querySelector("#repository-breadcrumbs .govuk-breadcrumbs__list-item:last-child");
	if (title) title.textContent = context.title;
	if (lead) lead.textContent = context.lead;
	if (body) body.textContent = context.body;
	if (breadcrumb) breadcrumb.textContent = context.title;
	document.title = `${context.title} - ResearchOps Demo Suite`;
}

function reviewQueueFromTabId(tabId = "") {
	if (tabId === "review-withdrawn") return "withdrawn";
	if (tabId === "review-stale") return "stale";
	return "candidates";
}

function reviewPanelElements(queueKey) {
	const workbench = document.querySelector(`[data-review-workbench="${queueKey}"]`);
	return {
		count: workbench?.querySelector("[data-review-count]"),
		list: workbench?.querySelector("[data-review-list]"),
		detail: workbench?.querySelector("[data-review-detail]"),
		pagination: workbench?.querySelector("[data-review-pagination]"),
	};
}

function setActiveReviewTab(queueKey) {
	const tabs = document.getElementById("repository-review-tabs");
	if (!tabs) return;
	setReviewPageContext(queueKey);
	for (const item of tabs.querySelectorAll(".govuk-tabs__list-item")) {
		const link = item.querySelector(".govuk-tabs__tab");
		const panelId = link?.getAttribute("href")?.replace(/^#/, "") || "";
		const current = panelId === reviewTabId(queueKey);
		item.classList.toggle("govuk-tabs__list-item--selected", current);
		if (link) {
			if (current) link.setAttribute("aria-current", "page");
			else link.removeAttribute("aria-current");
		}
	}
	for (const panel of tabs.querySelectorAll(".govuk-tabs__panel")) {
		const current = panel.id === reviewTabId(queueKey);
		panel.classList.toggle("govuk-tabs__panel--hidden", !current);
	}
}

function renderReviewTabs(navigation = [], currentQueue) {
	const tabs = document.getElementById("repository-review-tabs");
	if (!tabs) return;
	for (const entry of navigation) {
		const link = tabs.querySelector(`.govuk-tabs__tab[href="#${reviewTabId(entry.key)}"]`);
		if (!link) continue;
		link.textContent = `${entry.label} (${entry.count})`;
		link.dataset.reviewHref = `${entry.href}${entry.current ? `${selectedReviewPage() > 1 ? `?page=${selectedReviewPage()}` : ""}` : ""}`;
		link.dataset.reviewQueue = entry.key;
	}
	setActiveReviewTab(currentQueue);
}

function reviewListButton(item, selectedId) {
	const button = document.createElement("button");
	button.type = "button";
	button.className = `repository-review-list__button${item.id === selectedId ? " repository-review-list__button--selected" : ""}`;
	button.dataset.reviewArtefactId = item.id;
	const title = document.createElement("span");
	title.className = "repository-review-list__title";
	title.textContent = text(item.title);
	const meta = document.createElement("span");
	meta.className = "repository-review-list__meta";
	meta.textContent = item.withdrawalReason || item.queueReason || item.reviewDueAt || item.updatedAt || "No review note recorded";
	button.append(title, meta);
	return button;
}

function renderReviewList(queue, items = [], pagination = {}) {
	const queueKey = queue?.key || reviewQueueFromPathname();
	const { list: target, count } = reviewPanelElements(queueKey);
	if (count) count.textContent = reviewCountText(queue, pagination);
	if (!target) return;
	target.replaceChildren();
	if (!items.length) {
		const inset = document.createElement("div");
		inset.className = "govuk-inset-text";
		inset.textContent = queue.emptyMessage;
		target.appendChild(inset);
		target.setAttribute("aria-busy", "false");
		return;
	}
	const list = document.createElement("div");
	list.className = "repository-review-list__items";
	const selectedId = selectedReviewId() || items[0].id;
	for (const item of items) list.appendChild(reviewListButton(item, selectedId));
	target.appendChild(list);
	target.setAttribute("aria-busy", "false");
}

function renderReviewPagination(queueKey, pagination = {}) {
	const { pagination: nav } = reviewPanelElements(queueKey);
	if (!nav) return;
	nav.replaceChildren();
	const total = Number(pagination.total || 0);
	const limit = Number(pagination.limit || PAGE_SIZE);
	const currentPage = Number(pagination.page || 1);
	const totalPages = Math.ceil(total / limit);
	if (totalPages <= 1) {
		nav.hidden = true;
		return;
	}
	const paramsForPage = (page) => reviewQueryParams("", page, reviewPathnameForQueue(queueKey)).replace(reviewPathnameForQueue(queueKey), "");
	const appendLink = (parent, page, textLabel, ariaLabel, extraClass = "") => {
		const item = document.createElement(extraClass ? "div" : "li");
		item.className = extraClass || "govuk-pagination__item";
		const link = document.createElement("a");
		link.className = extraClass ? "govuk-link govuk-pagination__link" : "govuk-link govuk-pagination__link";
		link.href = `${reviewPathnameForQueue(queueKey)}${paramsForPage(page)}`;
		link.textContent = textLabel;
		link.setAttribute("aria-label", ariaLabel);
		link.dataset.reviewPage = String(page);
		if (!extraClass && page === currentPage) link.setAttribute("aria-current", "page");
		item.appendChild(link);
		parent.appendChild(item);
	};
	if (currentPage > 1) {
		appendLink(nav, currentPage - 1, "Previous", `Go to page ${currentPage - 1}`, "govuk-pagination__prev");
	}
	const list = document.createElement("ul");
	list.className = "govuk-pagination__list";
	for (let page = 1; page <= totalPages; page += 1) {
		const item = document.createElement("li");
		item.className = `govuk-pagination__item${page === currentPage ? " govuk-pagination__item--current" : ""}`;
		const link = document.createElement("a");
		link.className = "govuk-link govuk-pagination__link";
		link.href = `${reviewPathnameForQueue(queueKey)}${paramsForPage(page)}`;
		link.textContent = String(page);
		link.setAttribute("aria-label", `Go to page ${page}`);
		link.dataset.reviewPage = String(page);
		if (page === currentPage) link.setAttribute("aria-current", "page");
		item.appendChild(link);
		list.appendChild(item);
	}
	nav.appendChild(list);
	if (currentPage < totalPages) {
		appendLink(nav, currentPage + 1, "Next", `Go to page ${currentPage + 1}`, "govuk-pagination__next");
	}
	nav.hidden = false;
}

function reviewSummaryRow(term, value) {
	const row = document.createElement("div");
	row.className = "govuk-summary-list__row";
	const dt = document.createElement("dt");
	dt.className = "govuk-summary-list__key";
	dt.textContent = term;
	const dd = document.createElement("dd");
	dd.className = "govuk-summary-list__value";
	dd.textContent = text(value) || "Not recorded";
	row.append(dt, dd);
	return row;
}

function reviewHistoryNode(entry) {
	const item = document.createElement("li");
	item.className = "repository-review-history__item";
	const heading = document.createElement("p");
	heading.className = "govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-1";
	heading.textContent = `${text(entry.outcome || entry.action)} by ${text(entry.actor || "Curator")}`;
	const meta = document.createElement("p");
	meta.className = "govuk-body-s govuk-!-margin-bottom-1";
	meta.textContent = text(entry.createdAt);
	const notes = document.createElement("p");
	notes.className = "govuk-body-s govuk-!-margin-bottom-0";
	notes.textContent = text(entry.notes || entry.withdrawalReason || "No notes recorded.");
	item.append(heading, meta, notes);
	return item;
}

function renderReviewDetail(queue, item) {
	const queueKey = queue?.key || reviewQueueFromPathname();
	const { detail: target } = reviewPanelElements(queueKey);
	if (!target) return;
	target.replaceChildren();
	if (!item) {
		const inset = document.createElement("div");
		inset.className = "govuk-inset-text";
		inset.textContent = queue.emptyMessage;
		target.appendChild(inset);
		target.setAttribute("aria-busy", "false");
		return;
	}

	const heading = document.createElement("h4");
	heading.className = "govuk-heading-m";
	heading.textContent = text(item.title);

	const summary = document.createElement("p");
	summary.className = "govuk-body";
	summary.textContent = text(item.summary);

	const tags = document.createElement("div");
	tags.className = "repository-artefact-list__meta govuk-!-margin-bottom-4";
	for (const tag of displayTags(item)) tags.appendChild(tagNode(tag));

	const details = document.createElement("dl");
	details.className = "govuk-summary-list repository-review-summary";
	details.append(
		reviewSummaryRow("Status", titleFromSlug(item.status)),
		reviewSummaryRow("Review due", item.reviewDueAt || "No date recorded"),
		reviewSummaryRow("Service area", titleFromSlug(item.serviceArea)),
		reviewSummaryRow("User group", titleFromSlug(item.userGroup)),
		reviewSummaryRow("Method", titleFromSlug(item.method || item.sourceMethod)),
		reviewSummaryRow("Source project", item.sourceProjectId || "Not recorded"),
		reviewSummaryRow("Source study", item.sourceStudyId || "Not recorded")
	);

	if (item.queueReason || item.withdrawalReason) {
		const inset = document.createElement("div");
		inset.className = "govuk-inset-text";
		inset.textContent = item.withdrawalReason || item.queueReason;
		target.append(heading, summary, tags, details, inset);
	} else {
		target.append(heading, summary, tags, details);
	}

	const form = document.createElement("form");
	form.className = "repository-review-form";
	form.dataset.reviewActionForm = item.id;
	const fieldId = (name) => `repository-review-${name}-${queueKey}`;

	const formHeading = document.createElement("h5");
	formHeading.className = "govuk-heading-s";
	formHeading.textContent = queue.actionLabel;
	form.appendChild(formHeading);

	const outcomeGroup = document.createElement("div");
	outcomeGroup.className = "govuk-form-group";
	const outcomeLabel = document.createElement("label");
	outcomeLabel.className = "govuk-label govuk-label--s";
	outcomeLabel.setAttribute("for", fieldId("outcome"));
	outcomeLabel.textContent = "Outcome";
	const outcomeSelect = document.createElement("select");
	outcomeSelect.className = "govuk-select";
	outcomeSelect.id = fieldId("outcome");
	outcomeSelect.name = "outcome";
	for (const optionItem of queue.outcomes || []) outcomeSelect.appendChild(option(optionItem.value, optionItem.label));
	outcomeGroup.append(outcomeLabel, outcomeSelect);
	form.appendChild(outcomeGroup);

	const dueGroup = document.createElement("div");
	dueGroup.className = "govuk-form-group";
	const dueLabel = document.createElement("label");
	dueLabel.className = "govuk-label govuk-label--s";
	dueLabel.setAttribute("for", fieldId("due-at"));
	dueLabel.textContent = "Next review date";
	const dueInput = document.createElement("input");
	dueInput.className = "govuk-input govuk-input--width-20";
	dueInput.id = fieldId("due-at");
	dueInput.name = "reviewDueAt";
	dueInput.type = "date";
	dueInput.value = text(item.reviewDueAt).slice(0, 10);
	dueGroup.append(dueLabel, dueInput);
	form.appendChild(dueGroup);

	const reasonGroup = document.createElement("div");
	reasonGroup.className = "govuk-form-group";
	const reasonLabel = document.createElement("label");
	reasonLabel.className = "govuk-label govuk-label--s";
	reasonLabel.setAttribute("for", fieldId("withdrawal-reason"));
	reasonLabel.textContent = "Withdrawal or reinstatement reason";
	const reasonInput = document.createElement("textarea");
	reasonInput.className = "govuk-textarea";
	reasonInput.id = fieldId("withdrawal-reason");
	reasonInput.name = "withdrawalReason";
	reasonInput.rows = 3;
	reasonInput.value = text(item.withdrawalReason);
	reasonGroup.append(reasonLabel, reasonInput);
	form.appendChild(reasonGroup);

	for (const field of [
		["limitations", "Limitations", item.limitations],
		["reuseGuidance", "Reuse guidance", item.reuseGuidance],
		["doNotUseFor", "Do not use for", item.doNotUseFor]
	]) {
		const group = document.createElement("div");
		group.className = "govuk-form-group";
		const label = document.createElement("label");
		label.className = "govuk-label govuk-label--s";
		label.setAttribute("for", fieldId(field[0]));
		label.textContent = field[1];
		const input = document.createElement("textarea");
		input.className = "govuk-textarea";
		input.id = fieldId(field[0]);
		input.name = field[0];
		input.rows = 3;
		input.value = text(field[2]);
		group.append(label, input);
		form.appendChild(group);
	}

	const notesGroup = document.createElement("div");
	notesGroup.className = "govuk-form-group";
	const notesLabel = document.createElement("label");
	notesLabel.className = "govuk-label govuk-label--s";
	notesLabel.setAttribute("for", fieldId("notes"));
	notesLabel.textContent = "Audit notes";
	const notesInput = document.createElement("textarea");
	notesInput.className = "govuk-textarea";
	notesInput.id = fieldId("notes");
	notesInput.name = "notes";
	notesInput.rows = 5;
	notesInput.required = true;
	notesGroup.append(notesLabel, notesInput);
	form.appendChild(notesGroup);

	const submit = document.createElement("button");
	submit.className = "govuk-button";
	submit.type = "submit";
	submit.textContent = "Record review outcome";
	form.appendChild(submit);

	const status = document.createElement("div");
	status.id = `repository-review-action-status-${queueKey}`;
	status.setAttribute("aria-live", "polite");
	form.appendChild(status);
	target.appendChild(form);

	const historyHeading = document.createElement("h5");
	historyHeading.className = "govuk-heading-s";
	historyHeading.textContent = "Audit history";
	target.appendChild(historyHeading);
	if (item.history?.length) {
		const history = document.createElement("ul");
		history.className = "govuk-list repository-review-history";
		for (const entry of item.history) history.appendChild(reviewHistoryNode(entry));
		target.appendChild(history);
	} else {
		const emptyHistory = document.createElement("p");
		emptyHistory.className = "govuk-body-s";
		emptyHistory.textContent = "No review history recorded yet.";
		target.appendChild(emptyHistory);
	}
	target.setAttribute("aria-busy", "false");
}

async function loadReviewState(page, preferredId = selectedReviewId()) {
	const requestId = ++latestReviewRequest;
	const queueKey = page.dataset.reviewQueue;
	setActiveReviewTab(queueKey);
	const { list, detail } = reviewPanelElements(queueKey);
	list?.setAttribute("aria-busy", "true");
	detail?.setAttribute("aria-busy", "true");
	const requestPath = reviewApiPath(queueKey);
	const prefetched = await consumePrefetchedRepository(requestPath);
	const { response, data } = prefetched || await repositoryJson(requestPath);
	if (requestId !== latestReviewRequest) return;
	if (response.status === 401) {
		window.location.assign(signInUrl());
		return;
	}
	if (response.status === 403) {
		redirectToRepository();
		return;
	}
	renderReviewTabs(data?.navigation || [], queueKey);
	const items = Array.isArray(data?.items) ? data.items : [];
	const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: items.length };
	renderReviewList(data?.queue || {}, items, pagination);
	renderReviewPagination(queueKey, pagination);
	const selected = items.find((item) => item.id === preferredId) || items[0] || null;
	if (selected && selected.id !== selectedReviewId()) updateReviewHistory(selected.id, pagination.page);
	renderReviewDetail(data?.queue || {}, selected);
}

function bindReviewInteractions(page) {
	const tabs = document.getElementById("repository-review-tabs");
	page.addEventListener("click", (event) => {
		const button = event.target.closest("[data-review-artefact-id]");
		if (button instanceof HTMLElement) {
			updateReviewHistory(button.dataset.reviewArtefactId || "", selectedReviewPage(), reviewPathnameForQueue(page.dataset.reviewQueue));
			loadReviewState(page, button.dataset.reviewArtefactId || "").catch(() => {});
			return;
		}
		const paginationLink = event.target.closest("[data-review-page]");
		if (paginationLink instanceof HTMLAnchorElement) {
			event.preventDefault();
			const targetPage = Number.parseInt(paginationLink.dataset.reviewPage || "1", 10);
			updateReviewHistory("", targetPage, reviewPathnameForQueue(page.dataset.reviewQueue));
			loadReviewState(page, "").catch(() => {});
		}
	});
	if (tabs) {
		tabs.addEventListener("click", (event) => {
			const link = event.target.closest(".govuk-tabs__tab");
			if (!(link instanceof HTMLAnchorElement)) return;
			const tabId = link.getAttribute("href")?.replace(/^#/, "") || "";
			const reviewQueue = link.dataset.reviewQueue || reviewQueueFromTabId(tabId);
			const reviewHref = link.dataset.reviewHref || reviewPathnameForQueue(reviewQueue);
			event.preventDefault();
			if (reviewQueue === page.dataset.reviewQueue) {
				setActiveReviewTab(reviewQueue);
				return;
			}
			page.dataset.reviewQueue = reviewQueue;
			updateReviewHistory("", 1, new URL(reviewHref, window.location.origin).pathname);
			loadReviewState(page, "").catch(() => {});
		});
	}
	page.addEventListener("submit", async (event) => {
			const form = event.target.closest("[data-review-action-form]");
			if (!(form instanceof HTMLFormElement)) return;
			event.preventDefault();
			const artefactId = form.dataset.reviewActionForm || "";
			if (!artefactId) return;
			const payload = Object.fromEntries(new FormData(form).entries());
			const { response, data } = await repositoryJson(`/api/repository/review/${encodeURIComponent(artefactId)}/actions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload)
			});
			if (response.status === 401) {
				window.location.assign(signInUrl());
				return;
			}
			if (response.status === 403) {
				redirectToRepository();
				return;
			}
			const status = document.getElementById(`repository-review-action-status-${page.dataset.reviewQueue}`);
			if (status) {
				status.className = response.ok && data?.ok ? "govuk-inset-text" : "govuk-error-message";
				status.textContent = response.ok && data?.ok ?
					"Review outcome recorded." :
					"Review outcome could not be recorded. Check the outcome and notes, then try again.";
			}
			if (response.ok && data?.ok) {
				await loadReviewState(page, artefactId);
			}
	});
	window.addEventListener("popstate", () => {
		page.dataset.reviewQueue = reviewQueueFromPathname(window.location.pathname);
		loadReviewState(page, selectedReviewId()).catch(() => {});
	});
}

async function initialiseReviewPage() {
	const page = document.querySelector("[data-repository-review-page]");
	if (!page) return;
	page.dataset.reviewQueue = reviewQueueFromPathname(window.location.pathname);
	bindReviewInteractions(page);
	await loadReviewState(page, selectedReviewId());
}

initialiseBrowsePage().catch(() => renderBrowseResults([], {}, { page: 1, limit: PAGE_SIZE, total: 0 }));
initialiseCandidatePage().catch(() => {});
initialiseReviewPage().catch(() => {});
