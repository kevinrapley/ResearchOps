/* eslint-env node */

/**
 * @file scripts/render-reporting-review-site.mjs
 * @summary Render the visual walkthrough report from explicit manifest evidence.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyReportingReviewEvidenceToManifest } from './reporting-review-evidence.mjs';

const DEFAULT_SITE_DIR = 'reports-site';
const PAGES_WRANGLER_CONFIG = `name = "reopsreporting"
pages_build_output_dir = "."
compatibility_date = "2026-05-21"
`;

function escapeHtml(value = '') {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function groupPages(pages = []) {
	const groups = new Map();

	for (const page of pages) {
		const groupName = page.group || 'Application';
		if (!groups.has(groupName)) groups.set(groupName, []);
		groups.get(groupName).push(page);
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

function renderGroupEvidence(page = {}) {
	const evidence = page.reviewEvidence;
	if (!evidence) return '';

	return `
		<section class="review-evidence review-evidence--group" data-review-group-id="${escapeHtml(page.reviewGroupId)}" data-review-evidence-level="group">
			<h4>${escapeHtml(evidence.title)} — group-level review evidence</h4>
			<details>
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

function renderAcceptanceCriteria(state = {}) {
	if (!state.acceptanceCriteria) return '';

	const summary = state.suppressGeneratedStateCriteria === true
		? 'What this state should support'
		: 'What this screen state should support';
	const source = state.acceptanceCriteriaSource || state.criteriaSource?.type || 'generated';

	return `
		<details class="state-acceptance-criteria" data-acceptance-criteria-source="${escapeHtml(source)}">
			<summary>${escapeHtml(summary)}</summary>
			<div class="state-acceptance-criteria__meta">
				${renderCriteriaMaturity(state)}
				<span>Format: Gherkin acceptance criteria</span>
			</div>
			<pre class="gherkin-criteria"><code>${escapeHtml(state.acceptanceCriteria)}</code></pre>
		</details>`;
}

function renderDesignRisk(state = {}) {
	if (!state.designRisk) return '';

	return `
		<section class="design-risk" aria-label="Design-risk notes">
			<h5>Design-risk notes</h5>
			${renderRiskList(state.designRisk)}
		</section>`;
}

function renderEvidenceTypes(state = {}) {
	return `
		<div class="evidence-types" aria-label="Evidence types for this state">
			${(state.evidenceTypes || []).map((type) => `<span>${escapeHtml(type)}</span>`).join('')}
		</div>`;
}

function renderCapture(page = {}, state = {}, capture = {}) {
	const alt = `Screenshot of ${page.title} in the ${state.title} state for ${capture.profileTitle || capture.profile}.`;
	const image = capture.screenshot
		? `<figure class="capture__figure"><a class="capture__lightbox-link" data-lightbox-image href="${escapeHtml(capture.screenshot)}" aria-label="Open full screenshot for ${escapeHtml(page.title)} — ${escapeHtml(state.title)} — ${escapeHtml(capture.profileTitle || capture.profile)}"><img loading="lazy" src="${escapeHtml(capture.screenshot)}" alt="${escapeHtml(alt)}" /></a><figcaption>${escapeHtml(page.title)} — ${escapeHtml(state.title)} — ${escapeHtml(capture.profileTitle || capture.profile)}</figcaption></figure>`
		: '';

	return `
		<section class="capture${capture.status === 'failed' ? ' failed' : ''}" data-profile="${escapeHtml(capture.profile)}">
			<h5>Screenshot evidence</h5>
			<p class="meta">${escapeHtml(capture.profileTitle || capture.profile)} · ${escapeHtml(capture.status)} · ${escapeHtml(capture.url)}</p>
			${capture.error ? `<p>${escapeHtml(capture.error)}</p>` : ''}
			${image}
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
		${renderAcceptanceCriteria(state)}
		${renderDesignRisk(state)}
		<div class="state__captures">
			${(state.captures || []).map((capture) => renderCapture(page, state, capture)).join('')}
		</div>
	</article>`;
}

function isMultiStepPage(page = {}) {
	return (page.states || []).length > 1;
}

function renderPage(page = {}) {
	const pageClass = isMultiStepPage(page) ? 'page-card page-card--multi-step' : 'page-card';

	return `
	<article class="${pageClass}" id="${escapeHtml(page.id)}" data-review-group-id="${escapeHtml(page.reviewGroupId || '')}" data-review-evidence-level="${escapeHtml(page.reviewEvidenceLevel || 'generated')}">
		<div class="page-card__header">
			<h3>${escapeHtml(page.title)}</h3>
			<p class="meta">${escapeHtml(page.path)}</p>
			<p>${escapeHtml(page.description)}</p>
			${renderGroupEvidence(page)}
		</div>
		<div class="states">
			${(page.states || []).map((state) => renderState(page, state)).join('')}
		</div>
	</article>`;
}

function renderPageGrid(pages = []) {
	const blocks = [];
	let singlePages = [];

	function flushSinglePages() {
		if (singlePages.length === 0) return;
		blocks.push(`
			<div class="group__pages">
				${singlePages.map(renderPage).join('')}
			</div>`);
		singlePages = [];
	}

	for (const page of pages) {
		if (isMultiStepPage(page)) {
			flushSinglePages();
			blocks.push(renderPage(page));
		} else {
			singlePages.push(page);
		}
	}

	flushSinglePages();

	return blocks.join('');
}

function renderProfileSwitcher(profiles = []) {
	if (!Array.isArray(profiles) || profiles.length === 0) return '';

	const compareButton = profiles.length > 1
		? `
			<button type="button" class="profile-switcher__button" data-profile-filter="compare" aria-pressed="false">
				Compare
			</button>`
		: '';

	return `
	<nav class="profile-switcher" aria-label="Screenshot profile">
		<p class="profile-switcher__label">View</p>
		<div class="profile-switcher__controls">
			${profiles
				.map(
					(profile, index) => `
			<button type="button" class="profile-switcher__button" data-profile-filter="${escapeHtml(profile.id)}" aria-pressed="${index === 0 ? 'true' : 'false'}">
				${escapeHtml(profile.title || profile.id)}
			</button>`
				)
				.join('')}${compareButton}
		</div>
	</nav>`;
}

function renderLightbox() {
	return `
	<div class="lightbox" role="dialog" aria-modal="true" aria-labelledby="lightbox-title" hidden>
		<div class="lightbox__panel">
			<div class="lightbox__header">
				<h2 id="lightbox-title">Screenshot evidence</h2>
				<button type="button" class="lightbox__close" data-lightbox-close>Close</button>
			</div>
			<div class="lightbox__body">
				<img class="lightbox__image" alt="" />
			</div>
		</div>
	</div>`;
}

function renderProfileSwitcherScript(profiles = []) {
	if (!Array.isArray(profiles) || profiles.length === 0) return '';

	const defaultProfile = profiles[0]?.id || '';

	return `
	<script>
	(function () {
		const defaultProfile = ${JSON.stringify(defaultProfile)};
		const buttons = Array.from(document.querySelectorAll('[data-profile-filter]'));
		const captures = Array.from(document.querySelectorAll('.capture[data-profile]'));

		function applyProfileFilter(profile) {
			const activeProfile = profile || defaultProfile;
			const showAll = activeProfile === 'compare';

			document.documentElement.dataset.profileFilter = activeProfile;

			for (const button of buttons) {
				button.setAttribute('aria-pressed', button.dataset.profileFilter === activeProfile ? 'true' : 'false');
			}

			for (const capture of captures) {
				capture.hidden = !showAll && capture.dataset.profile !== activeProfile;
			}
		}

		for (const button of buttons) {
			button.addEventListener('click', () => applyProfileFilter(button.dataset.profileFilter));
		}

		applyProfileFilter(defaultProfile);
	})();
	</script>`;
}

function renderLightboxScript() {
	return `
	<script>
	(function () {
		const lightbox = document.querySelector('.lightbox');
		if (!lightbox) return;

		const image = lightbox.querySelector('.lightbox__image');
		const closeButton = lightbox.querySelector('[data-lightbox-close]');
		let lastFocusedElement = null;

		function focusableElements() {
			return Array.from(
				lightbox.querySelectorAll(
					'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
				)
			).filter((element) => element.offsetParent !== null);
		}

		function closeLightbox() {
			lightbox.hidden = true;
			document.documentElement.classList.remove('has-lightbox');
			image.removeAttribute('src');
			image.alt = '';
			if (lastFocusedElement) lastFocusedElement.focus();
		}

		function openLightbox(link) {
			const thumbnail = link.querySelector('img');
			lastFocusedElement = document.activeElement;
			image.src = link.href;
			image.alt = thumbnail ? thumbnail.alt : 'Full screenshot evidence';
			lightbox.hidden = false;
			document.documentElement.classList.add('has-lightbox');
			closeButton.focus();
		}

		function trapLightboxFocus(event) {
			if (event.key !== 'Tab' || lightbox.hidden) return;

			const focusable = focusableElements();
			if (focusable.length === 0) return;

			const first = focusable[0];
			const last = focusable[focusable.length - 1];

			if (!lightbox.contains(document.activeElement)) {
				event.preventDefault();
				first.focus();
				return;
			}

			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
				return;
			}

			if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}

		for (const link of document.querySelectorAll('[data-lightbox-image]')) {
			link.addEventListener('click', (event) => {
				event.preventDefault();
				openLightbox(link);
			});
		}

		closeButton.addEventListener('click', closeLightbox);
		lightbox.addEventListener('click', (event) => {
			if (event.target === lightbox) closeLightbox();
		});
		document.addEventListener('keydown', (event) => {
			if (!lightbox.hidden && event.key === 'Escape') closeLightbox();
			trapLightboxFocus(event);
		});
	})();
	</script>`;
}

function renderStyles() {
	return `body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; line-height: 1.45; color: #111; background: #fff; }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; border-bottom: 1px solid #d8d8d8; margin-bottom: 24px; padding-bottom: 16px; }
h1 { margin: 0 0 8px; }
h2 { margin-top: 32px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; }
h3, h4, h5 { margin: 0 0 6px; }
.meta { color: #444; margin: 0; }
.badge { background: #eef; border: 1px solid #99c; border-radius: 6px; display: inline-block; padding: 6px 10px; }
.profile-switcher { align-items: center; display: flex; flex-wrap: wrap; gap: 12px; margin: 0 0 24px; }
.profile-switcher__label { font-weight: 700; margin: 0; }
.profile-switcher__controls { display: flex; flex-wrap: wrap; gap: 8px; }
.profile-switcher__button { background: #f3f2f1; border: 2px solid #0b0c0c; border-radius: 0; cursor: pointer; font: inherit; padding: 8px 12px; }
.profile-switcher__button[aria-pressed="true"] { background: #1d70b8; color: #fff; }
.profile-switcher__button:focus { outline: 3px solid #ffdd00; outline-offset: 2px; }
.group { margin-bottom: 40px; }
.group__pages { display: grid; gap: 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 18px 0; }
.page-card { border: 1px solid #d8d8d8; border-radius: 8px; margin: 0; overflow: hidden; }
.page-card--multi-step { grid-column: 1 / -1; margin: 18px 0; }
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
.review-risk-list { margin: 0; }
.review-risk-list div { display: grid; gap: 4px; grid-template-columns: minmax(120px, 0.35fr) 1fr; margin: 0 0 6px; }
.review-risk-list dt { font-weight: 700; }
.review-risk-list dd { margin: 0; }
.capture { border-top: 1px solid #e5e5e5; padding: 10px 12px; }
.capture__figure { margin: 10px 0 0; }
.capture__lightbox-link { display: block; }
.capture__lightbox-link:focus { outline: 3px solid #ffdd00; outline-offset: 2px; }
.capture__figure img { border: 1px solid #d8d8d8; box-sizing: border-box; display: block; height: 665px; max-width: 100%; object-fit: cover; object-position: top center; width: 100%; }
.has-lightbox { overflow: hidden; }
.lightbox { background: rgba(11, 12, 12, 0.75); bottom: 0; left: 0; padding: 24px; position: fixed; right: 0; top: 0; z-index: 1000; }
.lightbox__panel { background: #fff; display: flex; flex-direction: column; height: 100%; margin: 0 auto; max-width: 1200px; }
.lightbox__header { align-items: center; border-bottom: 1px solid #d8d8d8; display: flex; gap: 16px; justify-content: space-between; padding: 12px 16px; }
.lightbox__header h2 { border-bottom: 0; margin: 0; padding: 0; }
.lightbox__close { background: #f3f2f1; border: 2px solid #0b0c0c; cursor: pointer; font: inherit; padding: 8px 12px; }
.lightbox__close:focus { outline: 3px solid #ffdd00; outline-offset: 2px; }
.lightbox__body { flex: 1; overflow: auto; padding: 16px; }
.lightbox__image { display: block; height: auto; max-width: 100%; }
@media (max-width: 900px) {
	.group__pages { grid-template-columns: 1fr; }
	.lightbox { padding: 12px; }
}`;
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
	${renderProfileSwitcher(reviewedManifest.profiles)}
	<main>
		${groups.map(([group, pages]) => `
		<section class="group" aria-labelledby="group-${escapeHtml(group)}">
			<h2 id="group-${escapeHtml(group)}">${escapeHtml(group)}</h2>
			${renderPageGrid(pages)}
		</section>`).join('')}
	</main>
	${renderLightbox()}
	${renderProfileSwitcherScript(reviewedManifest.profiles)}
	${renderLightboxScript()}
</body>
</html>`;
}

export function renderReportingReviewSite(options = {}) {
	const siteDir = typeof options === 'string' ? options : options.siteDir || DEFAULT_SITE_DIR;
	const manifestPath = path.join(siteDir, 'manifest.json');
	const indexPath = path.join(siteDir, 'index.html');
	const wranglerPath = path.join(siteDir, 'wrangler.toml');
	const manifest = applyReportingReviewEvidenceToManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
	const html = renderReportingReviewHtml(manifest);

	fs.writeFileSync(indexPath, html, 'utf8');
	fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
	fs.writeFileSync(wranglerPath, PAGES_WRANGLER_CONFIG, 'utf8');

	return { indexPath, manifestPath, wranglerPath };
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
	console.log(JSON.stringify(renderReportingReviewSite({ siteDir: process.argv[2] || DEFAULT_SITE_DIR }), null, 2));
}
