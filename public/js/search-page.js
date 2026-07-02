/**
 * @file public/js/search-page.js
 * @module SearchPage
 * @summary Local ResearchOps entity search for legacy SDK records.
 */

const queryInput = document.getElementById("q");
const typeSelect = document.getElementById("type");
const searchButton = document.getElementById("go");
const resultsSection = document.getElementById("search-results-section");
const resultsContainer = document.getElementById("results");

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function readStoredEntities() {
	const entities = [];

	for (let index = 0; index < localStorage.length; index += 1) {
		const key = localStorage.key(index);
		if (!key) continue;

		try {
			const value = JSON.parse(localStorage.getItem(key) || "null");
			if (value && typeof value === "object" && value.entityType) {
				entities.push(value);
			}
		} catch {
			// Ignore non-JSON localStorage entries.
		}
	}

	return entities;
}

function searchEntities({ query = "", type = "" } = {}) {
	const needle = query.trim().toLowerCase();
	const entities = readStoredEntities();
	const typed = type ? entities.filter(entity => entity.entityType === type) : entities;

	if (!needle) return typed;

	return typed.filter(entity => JSON.stringify(entity).toLowerCase().includes(needle));
}

function renderItem(entity) {
	const raw = escapeHtml(JSON.stringify(entity, null, 2));
	const title = entity.name || entity.description || entity.hasBody || entity.id || "Untitled result";

	return `<div class="govuk-summary-card researchops-utility-card">
	<div class="govuk-summary-card__title-wrapper">
		<h3 class="govuk-summary-card__title">${escapeHtml(title)}</h3>
		<ul class="govuk-summary-card__actions">
			<li class="govuk-summary-card__action">
				<strong class="govuk-tag govuk-tag--blue">${escapeHtml(entity.entityType)}</strong>
			</li>
		</ul>
	</div>
	<div class="govuk-summary-card__content">
		<details class="govuk-details" data-module="govuk-details">
			<summary class="govuk-details__summary">
				<span class="govuk-details__summary-text">Raw record</span>
			</summary>
			<div class="govuk-details__text"><pre class="researchops-utility-page__raw">${raw}</pre></div>
		</details>
	</div>
</div>`;
}

function renderResults(results) {
	if (!resultsContainer) return;

	if (resultsSection) resultsSection.hidden = false;
	resultsContainer.innerHTML = results.map(renderItem).join("") || '<div class="govuk-hint">No results.</div>';
}

function runSearch() {
	const query = queryInput?.value || "";
	const type = typeSelect?.value || "";
	const results = searchEntities({ query, type });
	renderResults(results);
}

searchButton?.addEventListener("click", runSearch);
queryInput?.addEventListener("keydown", event => {
	if (event.key === "Enter") runSearch();
});

window.__ropsSearch = Object.freeze({
	searchEntities,
	readStoredEntities
});
