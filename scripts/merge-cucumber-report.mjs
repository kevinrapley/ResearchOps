/* eslint-env node */

/**
 * @file scripts/merge-cucumber-report.mjs
 * @summary Merge Cucumber evidence into the generated visual walkthrough reporting site.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_SITE_DIR = 'reports-site';
const DEFAULT_CUCUMBER_DIR = '__cuke';
const CUCUMBER_PAGE_FILE = 'cucumber.html';
const RAW_REPORT_DIR = 'cucumber';

function escapeHtml(value = '') {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function slugify(value) {
	return String(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 96);
}

function ensureDir(dir) {
	fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
	if (!fs.existsSync(filePath)) return fallback;
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeFile(filePath, content) {
	ensureDir(path.dirname(filePath));
	fs.writeFileSync(filePath, content);
}

function copyIfPresent(sourcePath, destinationPath) {
	if (!fs.existsSync(sourcePath)) return false;
	ensureDir(path.dirname(destinationPath));
	fs.copyFileSync(sourcePath, destinationPath);
	return true;
}

function normalizeRoute(value) {
	const raw = String(value || '').trim();
	if (!raw) return '';

	let pathname = raw;

	try {
		if (/^https?:\/\//i.test(raw)) pathname = new URL(raw).pathname;
	} catch {
		pathname = raw;
	}

	if (!pathname.startsWith('/')) pathname = `/${pathname}`;
	pathname = pathname.replace(/\/+/g, '/');

	if (pathname === '/index.html') return '/';

	return pathname;
}

function routeAliases(value) {
	const route = normalizeRoute(value);
	const aliases = new Set();

	if (!route) return [];

	aliases.add(route);

	if (route.endsWith('/index.html')) {
		const withoutIndex = route.replace(/\/index\.html$/, '') || '/';
		aliases.add(withoutIndex);
		aliases.add(withoutIndex.endsWith('/') ? withoutIndex : `${withoutIndex}/`);
	}

	if (route.endsWith('/')) {
		aliases.add(`${route}index.html`);
	} else {
		aliases.add(`${route}/`);
	}

	return [...aliases];
}

function extractRoutesFromStep(stepName) {
	const matches = [...String(stepName || '').matchAll(/visit\s+"([^"]+)"/gi)];
	return matches.map((match) => normalizeRoute(match[1])).filter(Boolean);
}

function normaliseStatus(status = 'unknown') {
	return String(status || 'unknown').toLowerCase();
}

function scenarioStatus(steps) {
	const statuses = steps.map((step) => normaliseStatus(step.status));

	if (statuses.some((status) => ['failed', 'ambiguous', 'undefined'].includes(status))) {
		return 'failed';
	}

	if (statuses.some((status) => ['pending', 'skipped'].includes(status))) {
		return 'skipped';
	}

	if (statuses.length > 0 && statuses.every((status) => status === 'passed')) {
		return 'passed';
	}

	return 'unknown';
}

function formatDuration(duration) {
	if (typeof duration !== 'number' || Number.isNaN(duration)) return '';
	return `${(duration / 1_000_000).toFixed(1)}ms`;
}

function buildStep(step = {}) {
	return {
		keyword: step.keyword || '',
		text: step.name || '',
		status: normaliseStatus(step.result?.status),
		duration: formatDuration(step.result?.duration),
		error: step.result?.error_message || '',
		routes: extractRoutesFromStep(step.name),
	};
}

export function buildCucumberEvidence(features = []) {
	const scenarios = [];
	const routes = new Map();

	for (const [featureIndex, feature] of features.entries()) {
		const featureName = feature.name || `Feature ${featureIndex + 1}`;
		const elements = Array.isArray(feature.elements) ? feature.elements : [];

		for (const [scenarioIndex, scenario] of elements.entries()) {
			const steps = (Array.isArray(scenario.steps) ? scenario.steps : []).map(buildStep);
			const scenarioRoutes = new Set(steps.flatMap((step) => step.routes));
			const status = scenarioStatus(steps);
			const id = slugify(`${featureName}-${scenario.name || scenarioIndex + 1}`);
			const item = {
				id,
				feature: featureName,
				name: scenario.name || `Scenario ${scenarioIndex + 1}`,
				keyword: scenario.keyword || 'Scenario',
				uri: feature.uri || '',
				status,
				routes: [...scenarioRoutes],
				steps,
			};

			scenarios.push(item);

			for (const route of scenarioRoutes) {
				for (const alias of routeAliases(route)) {
					if (!routes.has(alias)) routes.set(alias, []);
					routes.get(alias).push(item);
				}
			}
		}
	}

	return {
		features: features.map((feature) => ({
			name: feature.name || 'Untitled feature',
			uri: feature.uri || '',
			scenarioCount: Array.isArray(feature.elements) ? feature.elements.length : 0,
		})),
		scenarios,
		routes,
		passed: scenarios.filter((scenario) => scenario.status === 'passed').length,
		failed: scenarios.filter((scenario) => scenario.status === 'failed').length,
		skipped: scenarios.filter((scenario) => scenario.status === 'skipped').length,
	};
}

function scenariosForPage(page, evidence) {
	const scenarioMap = new Map();

	for (const alias of routeAliases(page.path)) {
		for (const scenario of evidence.routes.get(alias) || []) {
			scenarioMap.set(scenario.id, scenario);
		}
	}

	return [...scenarioMap.values()];
}

function statusTag(status) {
	return `<strong class="cucumber-status cucumber-status--${escapeHtml(status)}">${escapeHtml(status)}</strong>`;
}

function renderScenarioList(scenarios) {
	if (scenarios.length === 0) {
		return '<p class="cucumber-empty">No Cucumber scenarios are mapped to this route.</p>';
	}

	return `<ul class="cucumber-scenario-list">
		${scenarios
			.map(
				(scenario) => `<li>
					${statusTag(scenario.status)}
					<a href="${CUCUMBER_PAGE_FILE}#${escapeHtml(scenario.id)}">${escapeHtml(scenario.name)}</a>
					<span>${escapeHtml(scenario.feature)}</span>
				</li>`
			)
			.join('')}
	</ul>`;
}

function renderRouteDetails(scenarios) {
	const scenarioWord = scenarios.length === 1 ? 'scenario' : 'scenarios';

	return `
			<details class="cucumber-route-evidence" data-cucumber-route-evidence>
				<summary>Cucumber evidence for this route (${scenarios.length} ${scenarioWord})</summary>
				${renderScenarioList(scenarios)}
			</details>`;
}

function injectRouteDetails(indexHtml, manifest, evidence) {
	let html = indexHtml;

	for (const page of manifest.pages || []) {
		const scenarios = scenariosForPage(page, evidence);
		if (scenarios.length === 0) continue;

		const articleStart = html.indexOf(`<article class="page-card" id="${page.id}">`);
		if (articleStart === -1) continue;

		const statesMarker = '\n\t\t\t<div class="states">';
		const insertAt = html.indexOf(statesMarker, articleStart);
		if (insertAt === -1) continue;

		html = `${html.slice(0, insertAt)}${renderRouteDetails(scenarios)}${html.slice(insertAt)}`;
	}

	return html;
}

function injectCucumberNavigation(indexHtml) {
	if (indexHtml.includes('class="cucumber-site-nav"')) return indexHtml;

	const nav = `
	<nav class="cucumber-site-nav" aria-label="Cucumber report navigation">
		<a href="${CUCUMBER_PAGE_FILE}">Open Cucumber report summary</a>
		<a href="${RAW_REPORT_DIR}/cucumber-report.html">Open raw Cucumber HTML</a>
	</nav>`;

	return indexHtml.replace('</header>', `</header>${nav}`);
}

function injectCucumberStyles(indexHtml) {
	if (indexHtml.includes('.cucumber-site-nav')) return indexHtml;

	const styles = `
		.cucumber-site-nav { border-bottom: 1px solid #b1b4b6; display: flex; flex-wrap: wrap; gap: 16px; margin: -8px 0 24px; padding: 0 0 16px; }
		.cucumber-site-nav a { color: #1d70b8; font-weight: 700; }
		.cucumber-route-evidence { border-top: 1px solid #d8d8d8; padding: 12px 16px; }
		.cucumber-route-evidence summary { color: #1d70b8; cursor: pointer; font-weight: 700; }
		.cucumber-route-evidence summary:focus { outline: 3px solid #ffdd00; outline-offset: 2px; }
		.cucumber-scenario-list { margin: 12px 0 0; padding-left: 20px; }
		.cucumber-scenario-list li { margin: 8px 0; }
		.cucumber-scenario-list span { color: #505a5f; display: block; }
		.cucumber-status { display: inline-block; margin-right: 8px; text-transform: capitalize; }
		.cucumber-status--passed { color: #00703c; }
		.cucumber-status--failed { color: #d4351c; }
		.cucumber-status--skipped, .cucumber-status--unknown { color: #505a5f; }`;

	return indexHtml.replace('\n\t</style>', `${styles}\n\t</style>`);
}

function renderCucumberPage(evidence, options = {}) {
	const rawHtmlPresent = Boolean(options.rawHtmlPresent);
	const rawJsonPresent = Boolean(options.rawJsonPresent);

	return `<!doctype html>
<html lang="en-GB">
<head>
	<meta charset="utf-8" />
	<title>Cucumber reports</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<style>
		body { background: #fff; color: #0b0c0c; font-family: Arial, sans-serif; line-height: 1.5; margin: 32px; }
		a { color: #1d70b8; }
		header { border-bottom: 1px solid #b1b4b6; margin-bottom: 24px; padding-bottom: 16px; }
		h1 { margin: 0 0 8px; }
		h2 { border-bottom: 1px solid #b1b4b6; margin-top: 32px; padding-bottom: 8px; }
		.summary { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }
		.badge { border: 2px solid #0b0c0c; display: inline-block; font-weight: 700; padding: 8px 12px; }
		.badge--passed { border-color: #00703c; color: #00703c; }
		.badge--failed { border-color: #d4351c; color: #d4351c; }
		.badge--skipped { border-color: #505a5f; color: #505a5f; }
		.report-links { display: flex; flex-wrap: wrap; gap: 16px; }
		.scenario { border: 1px solid #b1b4b6; margin: 16px 0; padding: 16px; }
		.scenario h3 { margin-top: 0; }
		.meta { color: #505a5f; margin: 4px 0; }
		.steps { margin: 12px 0 0; padding-left: 24px; }
		.steps li { margin: 8px 0; }
		.error { background: #fff4f2; border-left: 5px solid #d4351c; padding: 8px 12px; white-space: pre-wrap; }
		.status { font-weight: 700; text-transform: capitalize; }
		.status--passed { color: #00703c; }
		.status--failed { color: #d4351c; }
		.status--skipped, .status--unknown { color: #505a5f; }
	</style>
</head>
<body>
	<header>
		<p><a href="index.html">Back to visual walkthrough</a></p>
		<h1>Cucumber reports</h1>
		<p class="meta">Behaviour-driven development evidence for the same application build as the visual walkthrough.</p>
		<div class="summary">
			<span class="badge">${evidence.scenarios.length} scenarios</span>
			<span class="badge badge--passed">${evidence.passed} passed</span>
			<span class="badge badge--failed">${evidence.failed} failed</span>
			<span class="badge badge--skipped">${evidence.skipped} skipped</span>
		</div>
		<div class="report-links">
			${rawHtmlPresent ? `<a href="${RAW_REPORT_DIR}/cucumber-report.html">Open raw Cucumber HTML report</a>` : ''}
			${rawJsonPresent ? `<a href="${RAW_REPORT_DIR}/cucumber-report.json">Open raw Cucumber JSON report</a>` : ''}
		</div>
	</header>
	<section>
		<h2>Scenario evidence</h2>
		${
			evidence.scenarios.length === 0
				? '<p>No Cucumber scenarios were found in the downloaded report artifact.</p>'
				: evidence.scenarios
						.map(
							(scenario) => `
		<article class="scenario" id="${escapeHtml(scenario.id)}">
			<h3>${escapeHtml(scenario.name)}</h3>
			<p class="meta">${escapeHtml(scenario.feature)} · ${scenario.keyword} · <span class="status status--${escapeHtml(scenario.status)}">${escapeHtml(scenario.status)}</span></p>
			<p class="meta">Routes: ${scenario.routes.length > 0 ? scenario.routes.map(escapeHtml).join(', ') : 'No route mapped'}</p>
			<ol class="steps">
				${scenario.steps
					.map(
						(step) => `<li>
						<span class="status status--${escapeHtml(step.status)}">${escapeHtml(step.status)}</span>
						${escapeHtml(`${step.keyword}${step.text}`)}
						${step.duration ? `<span class="meta">${escapeHtml(step.duration)}</span>` : ''}
						${step.error ? `<pre class="error">${escapeHtml(step.error)}</pre>` : ''}
					</li>`
					)
					.join('')}
			</ol>
		</article>`
						)
						.join('')
		}
	</section>
</body>
</html>`;
}

export function mergeCucumberReport(options = {}) {
	const siteDir = options.siteDir || process.env.REPORTS_SITE_DIR || DEFAULT_SITE_DIR;
	const cucumberDir = options.cucumberDir || process.env.CUCUMBER_REPORT_DIR || DEFAULT_CUCUMBER_DIR;
	const manifestPath = path.join(siteDir, 'manifest.json');
	const indexPath = path.join(siteDir, 'index.html');
	const sourceHtmlPath = path.join(cucumberDir, 'cucumber-report.html');
	const sourceJsonPath = path.join(cucumberDir, 'cucumber-report.json');
	const rawReportDir = path.join(siteDir, RAW_REPORT_DIR);

	ensureDir(siteDir);
	ensureDir(rawReportDir);

	const rawHtmlPresent = copyIfPresent(sourceHtmlPath, path.join(rawReportDir, 'cucumber-report.html'));
	const rawJsonPresent = copyIfPresent(sourceJsonPath, path.join(rawReportDir, 'cucumber-report.json'));

	copyIfPresent(sourceHtmlPath, path.join(siteDir, 'cucumber-report.html'));
	copyIfPresent(sourceJsonPath, path.join(siteDir, 'cucumber-report.json'));

	const features = readJson(sourceJsonPath, []);
	const evidence = buildCucumberEvidence(Array.isArray(features) ? features : []);
	const cucumberPage = renderCucumberPage(evidence, { rawHtmlPresent, rawJsonPresent });

	writeFile(path.join(siteDir, CUCUMBER_PAGE_FILE), cucumberPage);

	if (fs.existsSync(indexPath) && fs.existsSync(manifestPath)) {
		const manifest = readJson(manifestPath, {});
		let indexHtml = fs.readFileSync(indexPath, 'utf8');
		indexHtml = injectCucumberStyles(indexHtml);
		indexHtml = injectCucumberNavigation(indexHtml);
		indexHtml = injectRouteDetails(indexHtml, manifest, evidence);
		fs.writeFileSync(indexPath, indexHtml);
	}

	console.log(
		`[cucumber-report] merged ${evidence.scenarios.length} scenario(s) into ${path.join(
			siteDir,
			CUCUMBER_PAGE_FILE
		)}`
	);

	return evidence;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	mergeCucumberReport();
}
