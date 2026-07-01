import { PAGE_SIZE, consumePrefetchedRepository, displayTags, option, redirectToRepository, repositoryJson, signInUrl, tagNode, text, titleFromSlug } from './shared.js';

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
let latestReviewRequest = 0;

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

function eventTargetElement(target) {
	return target instanceof Element ? target : target?.parentElement || null;
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
		reviewSummaryRow("Source study", item.sourceStudyId || "Not recorded"),
		reviewSummaryRow("Impact record", item.impactSource?.impactRecordId),
		reviewSummaryRow("Impact context", item.impactSource?.impactSummary),
		reviewSummaryRow("Decision context", item.impactSource?.decisionSummary),
		reviewSummaryRow("Outcome context", item.impactSource?.outcomeSummary)
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
	if (selected && (selected.id !== selectedReviewId() || window.location.pathname !== reviewPathnameForQueue(queueKey))) {
		updateReviewHistory(selected.id, pagination.page, reviewPathnameForQueue(queueKey));
	}
	renderReviewDetail(data?.queue || {}, selected);
}

function bindReviewInteractions(page) {
	const tabs = document.getElementById("repository-review-tabs");
	page.addEventListener("click", (event) => {
		const target = eventTargetElement(event.target);
		const button = target?.closest("[data-review-artefact-id]");
		if (button instanceof HTMLElement) {
			updateReviewHistory(button.dataset.reviewArtefactId || "", selectedReviewPage(), reviewPathnameForQueue(page.dataset.reviewQueue));
			loadReviewState(page, button.dataset.reviewArtefactId || "").catch(() => {});
			return;
		}
		const paginationLink = target?.closest("[data-review-page]");
		if (paginationLink instanceof HTMLAnchorElement) {
			event.preventDefault();
			const targetPage = Number.parseInt(paginationLink.dataset.reviewPage || "1", 10);
			updateReviewHistory("", targetPage, reviewPathnameForQueue(page.dataset.reviewQueue));
			loadReviewState(page, "").catch(() => {});
		}
	});
	if (tabs) {
		tabs.addEventListener("click", (event) => {
			const target = eventTargetElement(event.target);
			const link = target?.closest(".govuk-tabs__tab");
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

export async function initialiseReviewPage() {
	const page = document.querySelector("[data-repository-review-page]");
	if (!page) return;
	page.dataset.reviewQueue = reviewQueueFromPathname(window.location.pathname);
	bindReviewInteractions(page);
	await loadReviewState(page, selectedReviewId());
}
