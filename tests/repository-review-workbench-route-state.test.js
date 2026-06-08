import assert from "node:assert/strict";
import fs from "node:fs";

const files = {
	pageData: fs.readFileSync("src/govuk/data/repository-page.mjs", "utf8"),
	template: fs.readFileSync("src/govuk/templates/pages/repository-static.njk", "utf8"),
	script: fs.readFileSync("public/js/repository-static-page.js", "utf8"),
	service: fs.readFileSync("infra/cloudflare/src/service/repository.js", "utf8"),
	worker: fs.readFileSync("infra/cloudflare/src/worker.js", "utf8"),
	indexService: fs.readFileSync("infra/cloudflare/src/service/index.js", "utf8"),
};

function has(source, text, label) {
	assert.equal(source.includes(text), true, `${label} should include ${text}`);
}

function lacks(source, text, label) {
	assert.equal(source.includes(text), false, `${label} should not include ${text}`);
}

has(files.pageData, "reviewRoute: true", "repository review page data");
has(files.pageData, "reviewQueue: 'candidates'", "repository review page data");
has(files.pageData, "reviewQueue: 'stale'", "repository review page data");
has(files.pageData, "reviewQueue: 'withdrawn'", "repository review page data");
lacks(files.pageData, "heading: 'Review checks'", "repository review page data");
lacks(files.pageData, "heading: 'Review outcomes'", "repository review page data");
lacks(files.pageData, "heading: 'Withdrawal reasons'", "repository review page data");

has(files.template, "prefetchRepositoryReview", "repository static template");
has(files.template, "data-repository-review-page", "repository static template");
has(files.template, "data-review-queue=\"{{ reviewQueue }}\"", "repository static template");
has(files.template, 'import govukTabs', "repository static template");
has(files.template, 'import govukPagination', "repository static template");
has(files.template, 'id: "repository-review-tabs"', "repository static template");
has(files.template, 'id="repository-review-list"', "repository static template");
has(files.template, 'id="repository-review-detail"', "repository static template");
has(files.template, 'id: "repository-review-pagination"', "repository static template");

has(files.script, "let latestReviewRequest = 0", "repository static page script");
has(files.script, "function renderReviewTabs", "repository static page script");
has(files.script, "function renderReviewPagination", "repository static page script");
has(files.script, "function reviewPanelElements(queueKey)", "repository static page script");
has(files.script, "page.dataset.reviewQueue = reviewQueueFromPathname(window.location.pathname);", "repository static page script");
has(files.script, "async function loadReviewState(page, preferredId = selectedReviewId())", "repository static page script");
has(files.script, "data-review-action-form", "repository static page script");
has(files.script, 'repositoryJson(`/api/repository/review/${encodeURIComponent(artefactId)}/actions`', "repository static page script");
has(files.script, "initialiseReviewPage().catch(() => {});", "repository static page script");

has(files.service, "const REVIEW_QUEUE_DEFINITIONS = Object.freeze({", "repository service");
has(files.service, "const REVIEW_QUEUE_PAGE_SIZE = 10", "repository service");
has(files.service, "export async function listRepositoryReviewQueue", "repository service");
has(files.service, "export async function applyRepositoryReviewAction", "repository service");
has(files.service, "function reviewPagination(url, total)", "repository service");
has(files.service, "repository.review.${outcome}", "repository service");
has(files.service, "repository_curator_required", "repository service");

has(files.indexService, "listRepositoryReviewQueue = (origin, queueKey, url, authContext)", "repository index service");
has(files.indexService, "applyRepositoryReviewAction = (req, origin, artefactId, authContext)", "repository index service");

has(files.worker, '"/api/repository/review/candidates"', "repository worker routes");
has(files.worker, '"/api/repository/review/stale"', "repository worker routes");
has(files.worker, '"/api/repository/review/withdrawn"', "repository worker routes");
has(files.worker, '"/api/repository/review/:id/actions"', "repository worker routes");
has(files.worker, "service.listRepositoryReviewQueue(origin, reviewMatch[1], url, authContext)", "repository worker routes");
has(files.worker, "service.applyRepositoryReviewAction(request, origin, decodeURIComponent(reviewActionMatch[1]), authContext)", "repository worker routes");
