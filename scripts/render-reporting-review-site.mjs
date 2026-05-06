/* eslint-env node */

/**
 * @file scripts/render-reporting-review-site.mjs
 * @summary Render the visual walkthrough report from manifest evidence without runtime DOM patching.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyReportingReviewEvidenceToManifest } from './reporting-review-evidence.mjs';

const DEFAULT_SITE_DIR = 'reports-site';

function escapeHtml(value = '') {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function groupPages(pages = []) {
	const groups = new Map();

	for (const page of pages) {
		const group = page.group || 'Application';
		if (!groups.has(group)) groups.set(group, []);
		groups.get(group).push(page);
	}

	return [...groups.entries()];
}

function renderStatus(status = 'needs-review') {
	return `<strong class="review-status review-status--${escapeHtml(status)}">${escapeHtml(status.replaceAll('-', ' '))}</strong>`;
}

function renderRiskList(designRisk = {}) {
	return `
			<dl class="review-risk-list">
				<div><dt>Design risk</dt><dd>${escapeHtml(designRisk.risk)}</dd></div>
				<div><dt>Impact</dt><dd>${escapeHtml(designRisk.impact)}</dd></div>
				<div><dt>Recommended change</dt><dd>${escapeHtml(designRisk.recommendedChange)}</dd></div>
				<div><dt>Owner</dt><dd>${escapeHtml(designRisk.owner)}</dd></div>
				<div><dt>Status</dt><dd>${escapeHtml(designRisk.status)}</dd></div>
			</dl>`;
}

function renderGroupReviewEvidence(page = {}) {
	const evidence = page.reviewEvidence;
	if (!evidence) return '';

	return `
			<section class="review-evidence review-evidence--group" data-review-group-id="${escapeHtml(page.reviewGroupId)}" data-review-evidence-level="group">
				<h4>${escapeHtml(evidence.title)} — group-level review evidence</h4>
				<details open>
					<summary>What this grouping should support</summary>
					<p>Applies once to the full grouping. State cards below contain only scenario-specific review evidence.</p>
					<h5>Gherkin acceptance criteria ${renderStatus(evidence.acceptanceStatus)}</h5>
					<pre class="gherkin-criteria"><code>${escapeHtml(evidence.gherkin)}</code></pre>
					<h5>Design-risk notes ${renderStatus(evidence.designRiskStatus)}</h5>
					${renderRiskList(evidence.designRisk)}
				</details>
			</section>`;
}

function renderCriteriaMaturity(state = {}) {
	const maturity = state.criteriaMaturity || { label: 'Needs review', slug: 'needs-review' };
	return `<strong class="criteria-tag criteria-tag--${escapeHtml(maturity.slug)}">${escapeHtml(maturity.label)}</strong>`;
}

function renderStateAcceptanceCriteria(state = {}) {
	if (!state.acceptanceCriteria || state.suppressGeneratedStateCriteria !== true) return '';

	return `
					<details class="state-acceptance-criteria" data-acceptance-criteria-source="${escapeHtml(state.acceptanceCriteriaSource || 'generated')}">
						<summary>What this state should support</summary>
						<div class="state-acceptance-criteria__meta">
							${renderCriteriaMaturity(state)}
							<span>Format: Gherkin acceptance criteria</span>
						</div>
						<pre class="gherkin-criteria"><code>${escapeHtml(state.acceptanceCriteria)}</code></pre>
					</details>`;
}

function renderDesignRisk(state = {}) {
	if (!state.designRisk || state.suppressGeneratedStateCriteria !== true) return '';

	return `
					<section class="design-risk" aria-label="Design-risk notes">
						<h5>Design-risk notes</h5>
						${renderRiskList(state.designRisk)}
					</section>`;
}

function renderEvidenceTypes(state = {}) {
	const types = state.evidenceTypes || [];
	if (types.length === 0) return '';

	return `
					<div class="evidence-types" aria-label="Evidence types for this state">
						${types.map((type) => `<span>${escapeHtml(type)}</span>`).join('')}
					</div>`;
}

function renderCapture(page = {}, state = {}, capture = {}) {
	const failedClass = capture.status === 'failed' ? ' failed' : '';
	const alt = `Screenshot of ${page.title} in the ${state.title} state for ${capture.profileTitle || capture.profile}.`;

	return `
					<section class="capture${failedClass}" data-profile="${escapeHtml(capture.profile)}">
						<div class="capture__header">
							<h5>Screenshot evidence</h5>
							<p class="meta">${escapeHtml(capture.profileTitle || capture.profile)} · ${escapeHtml(capture.status)} · ${escapeHtml(capture.url)}</p>
							${capture.error ? `<p>${escapeHtml(capture.error)}</p>` : ''}
						</div>
						${capture.screenshot ? `<figure class="capture__figure"><a href="${escapeHtml(capture.screenshot)}"><img loading="lazy" src="${escapeHtml(capture.screenshot)}" alt="${escapeHtml(alt)}" /></a><figcaption>${escapeHtml(page.title)} — ${escapeHtml(state.title)} — ${escapeHtml(capture.profileTitle || capture.profile)}</figcaption></figure>` : ''}
					</section>`;
}

function renderState(page = {}, state = {}) {
	return `
				<article class="state" id="${escapeHtml(page.id)}-${escapeHtml(state.id)}" data-review-group-id="${escapeHtml(state.reviewGroupId || '')}" data-review-evidence-level="${escapeHtml(state.reviewEvidenceLevel || 'generated')}" data-suppress-generated-state-criteria="${state.suppressGeneratedStateCriteria === true ? 'true' : 'false'}">
					<div class="state__header">
						<h4>${escapeHtml(state.title)}</h4>
						<p class="meta">${escapeHtml(state.status)} · ${escapeHtml(state.url)}</p>
						${state.description ? `<p>${escapeHtml(state.description)}</p>` : ''}
						${renderEvidenceTypes(state)}
					</div>
					${renderStateAcceptanceCriteria(state)}
					${renderDesignRisk(state)}
					<div class="state__captures">
						${(state.captures || []).map((capture) => renderCapture(page, state, capture)).join('')}
					</div>
				</article>`;
}

function renderPage(page = {}) {
	return `
			<article class="page-card" id="${escapeHtml(page.id)}" data-review-group-id="${escapeHtml(page.reviewGroupId || '')}" data-review-evidence-level="${escapeHtml(page.reviewEvidenceLevel || 'generated')}">
				<div class="page-card__header">
					<h3>${escapeHtml(page.title)}</h3>
					<p class="meta">${escapeHtml(page.path)}</p>
					<p>${escapeHtml(page.description)}</p>
					${renderGroupReviewEvidence(page)}
				</div>
				<div class="states">
					${(page.states || []).map((state) => renderState(page, state)).join('')}
				</div>
			</article>`;
}

function renderJourneyNavigation(manifest = {}) {
	const pagesById = new Map((manifest.pages || []).map((page) => [page.id, page]));
	const journeys = manifest.journeys || [];
	if (journeys.length === 0) return '';

	return `
	<section class="journey-nav" aria-labelledby="journey-nav-title">
		<h2 id="journey-nav-title">ResearchOps journeys</h2>
		<p class="meta">Review the visual evidence by workflow, not only by page.</p>
		<div class="journey-nav__grid">
			${journeys.map((journey) => `
			<article class="journey-card" id="journey-${escapeHtml(journey.id)}">
				<h3>${escapeHtml(journey.title)}</h3>
				<p>${escapeHtml(journey.description)}</p>
				<ul>${(journey.pageIds || []).map((pageId) => pagesById.get(pageId)).filter(Boolean).map((page) => `<li><a href="#${escapeHtml(page.id)}">${escapeHtml(page.title)}</a></li>`).join('')}</ul>
			</article>`).join('')}
		</div>
	</section>`;
}

function renderStyles() {
	return `body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; line-height: 1.45; color: #111; background: #fff; }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; border-bottom: 1px solid #d8d8d8; margin-bottom: 24px; padding-bottom: 16px; }
h1 { margin: 0 0 8px; }
h2 { margin-top: 32px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; }
h3, h4, h5 { margin: 0 0 6px; }
.badge { background: #eef; border: 1px solid #99c; border-radius: 6px; display: inline-block; padding: 6px 10px; }
.meta { color: #444; margin: 0; }
.group { margin-bottom: 40px; }
.journey-nav { border-bottom: 1px solid #d8d8d8; margin: 0 0 24px; padding: 0 0 24px; }
.journey-nav__grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin-top: 16px; }
.journey-card { border-left: 5px solid #1d70b8; background: #f3f2f1; padding: 12px 16px; }
.page-card { border: 1px solid #d8d8d8; border-radius: 8px; margin: 18px 0; overflow: hidden; }
.page-card__header { background: #f7f7f7; border-bottom: 1px solid #d8d8d8; padding: 14px 16px; }
.states { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); padding: 16px; }
.state { border: 1px solid #e5e5e5; border-radius: 6px; overflow: hidden; background: #fff; }
.state__header { padding: 10px 12px; border-bottom: 1px solid #e5e5e5; }
.evidence-types { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; }
.evidence-types span { background: #f3f2f1; border: 1px solid #b1b4b6; display: inline-block; font-size: 0.875rem; padding: 3px 6px; }
.review-evidence { border: 2px solid #1d70b8; margin: 16px 0 0; padding: 16px; background: #fff; }
.review-evidence--group { background: #f3f2f1; }
.review-status { background: #f47738; display: inline-block; font-size: 0.875rem; padding: 4px 8px; text-transform: uppercase; }
.criteria-tag { border: 2px solid #0b0c0c; display: inline-block; font-size: 0.875rem; line-height: 1; padding: 4px 6px; }
.criteria-tag--curated { border-color: #00703c; color: #00703c; }
.state-acceptance-criteria, .design-risk { border-top: 1px solid #e5e5e5; padding: 10px 12px; }
.gherkin-criteria { background: #f3f2f1; border: 1px solid #b1b4b6; overflow-x: auto; padding: 12px; white-space: pre-wrap; }
.review-risk-list, .design-risk .review-risk-list { margin: 0; }
.review-risk-list div { display: grid; gap: 4px; grid-template-columns: minmax(120px, 0.35fr) 1fr; margin: 0 0 6px; }
.review-risk-list dt { font-weight: 700; }
.review-risk-list dd { margin: 0; }
.capture { border-top: 1px solid #e5e5e5; padding: 10px 12px; }
.capture__figure { margin: 10px 0 0; }
.capture__figure img { border: 1px solid #d8d8d8; height: auto; max-width: 100%; }`;
}

export function renderReportingReviewHtml(manifest = {}) {
	const reviewedManifest = applyReportingReviewEvidenceToManifest(manifest);
	const groups = groupPages(reviewedManifest.pages);

	return `<!doctype html>
<html lang="en-GB">
<head>
	<meta charset="utf-8" />
	<title>${escapeHtml(reviewedManifest.title)}</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<style>${renderStyles()}</style>
</head>
<body>
	<header>
		<div>
			<h1>${escapeHtml(reviewedManifest.title)}</h1>
			<p>${escapeHtml(reviewedManifest.description)}</p>
			<p class="meta">Run started: ${escapeHtml(reviewedManifest.startedAt)} · Base URL: ${escapeHtml(reviewedManifest.baseURL)}</p>
		</div>
		<p class="badge">${escapeHtml(reviewedManifest.failureCount)} failures</p>
	</header>
	<main>
		${renderJourneyNavigation(reviewedManifest)}
		${groups.map(([group, pages]) => `
		<section class="group" aria-labelledby="group-${escapeHtml(group)}">
			<h2 id="group-${escapeHtml(group)}">${escapeHtml(group)}</h2>
			${pages.map(renderPage).join('')}
		</section>`).join('')}
	</main>
</body>
</html>`;
}

export function renderReportingReviewSite(options = {}) {
	const siteDir = typeof options === 'string' ? options : options.siteDir || DEFAULT_SITE_DIR;
	const manifestPath = path.join(siteDir, 'manifest.json');
	const indexPath = path.join(siteDir, 'index.html');
	const manifest = applyReportingReviewEvidenceToManifest(readJson(manifestPath));
	const html = renderReportingReviewHtml(manifest);

	writeJson(manifestPath, manifest);
	fs.writeFileSync(indexPath, html, 'utf8');

	return { indexPath, manifestPath };
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
	const result = renderReportingReviewSite({ siteDir: process.argv[2] || DEFAULT_SITE_DIR });
	console.log(JSON.stringify(result, null, 2));
}
