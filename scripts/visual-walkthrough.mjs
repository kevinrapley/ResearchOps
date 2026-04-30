/* eslint-env node */

/**
 * @file scripts/visual-walkthrough.mjs
 * @summary Generate the application visual walkthrough report from a registered page/state catalogue.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { visualWalkthroughConfig } from '../visual-walkthrough.config.mjs';

const OUTPUT_DIR = 'reports-site';
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');
const MANIFEST_FILE = path.join(OUTPUT_DIR, 'manifest.json');
const INDEX_FILE = path.join(OUTPUT_DIR, 'index.html');
const DEFAULT_BASE_URL = 'https://researchops.pages.dev/';

const startedAt = new Date().toISOString();
const baseURL = normalizeBaseURL(
	process.env.BASE_URL || process.env.PAGES_URL || process.env.PREVIEW_URL || DEFAULT_BASE_URL
);

/** Normalize a URL and ensure a trailing slash. */
function normalizeBaseURL(value) {
	const url = String(value || '').trim();

	if (!url) return DEFAULT_BASE_URL;

	return url.endsWith('/') ? url : `${url}/`;
}

/** Escape unsafe characters for HTML text output. */
function escapeHtml(value = '') {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/** Convert a string to a stable filename slug. */
function slugify(value) {
	return String(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 96);
}

/** Ensure a directory exists. */
function ensureDir(dir) {
	fs.mkdirSync(dir, { recursive: true });
}

/** Convert a public file path to the URL route it represents. */
function routeFromPublicFile(filePath) {
	const relativePath = path.relative(visualWalkthroughConfig.publicRoot, filePath).replaceAll(path.sep, '/');

	if (relativePath === 'index.html') return '/';

	return `/${relativePath}`;
}

/** Recursively list HTML files under a directory. */
function listHtmlFiles(dir) {
	if (!fs.existsSync(dir)) return [];

	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			files.push(...listHtmlFiles(entryPath));
			continue;
		}

		if (entry.isFile() && entry.name.endsWith('.html')) {
			files.push(entryPath);
		}
	}

	return files.sort();
}

/** Get all application routes that should have visual walkthrough coverage. */
function getDiscoveredApplicationRoutes() {
	const excluded = new Set(visualWalkthroughConfig.excludedRoutes || []);

	return listHtmlFiles(visualWalkthroughConfig.publicRoot)
		.map(routeFromPublicFile)
		.filter((route) => !excluded.has(route));
}

/** Validate that the registry covers every discovered public HTML page. */
function validateRegistry() {
	const registeredRoutes = new Set(visualWalkthroughConfig.pages.map((page) => page.path));
	const registeredIds = new Set();
	const failures = [];

	for (const page of visualWalkthroughConfig.pages) {
		if (registeredIds.has(page.id)) {
			failures.push(`Duplicate page id: ${page.id}`);
		}

		registeredIds.add(page.id);

		if (!page.path.startsWith('/')) {
			failures.push(`Page path must start with /: ${page.id}`);
		}
	}

	for (const route of getDiscoveredApplicationRoutes()) {
		if (!registeredRoutes.has(route)) {
			failures.push(`Missing visual walkthrough registry entry for route: ${route}`);
		}
	}

	if (failures.length > 0) {
		throw new Error(`Visual walkthrough registry is incomplete:\n- ${failures.join('\n- ')}`);
	}
}

/** Wait until the page is stable enough for evidence capture. */
async function settlePage(page) {
	await page.waitForLoadState('domcontentloaded');

	try {
		await page.waitForLoadState('networkidle', { timeout: 3000 });
	} catch {
		// Some pages keep network connections open. Visual evidence capture should continue.
	}

	await page.locator('body').waitFor({ state: 'visible', timeout: 5000 });

	await page.evaluate(async () => {
		if (document.fonts?.ready) {
			await document.fonts.ready;
		}
	});

	await page.waitForTimeout(200);
}

/** Run an interaction action declared in the registry. */
async function runAction(page, action) {
	const timeout = action.timeout ?? 5000;

	if (action.type === 'click') {
		await page.locator(action.selector).click({ timeout });
		return;
	}

	if (action.type === 'fill') {
		await page.locator(action.selector).fill(action.value ?? '', { timeout });
		return;
	}

	if (action.type === 'press') {
		await page.locator(action.selector ?? 'body').press(action.key, { timeout });
		return;
	}

	if (action.type === 'select') {
		await page.locator(action.selector).selectOption(action.value, { timeout });
		return;
	}

	if (action.type === 'check') {
		await page.locator(action.selector).check({ timeout });
		return;
	}

	if (action.type === 'uncheck') {
		await page.locator(action.selector).uncheck({ timeout });
		return;
	}

	if (action.type === 'waitForSelector') {
		await page.locator(action.selector).waitFor({ state: action.state ?? 'visible', timeout });
		return;
	}

	if (action.type === 'waitForText') {
		await page.getByText(action.text, { exact: Boolean(action.exact) }).first().waitFor({ timeout });
		return;
	}

	if (action.type === 'wait') {
		await page.waitForTimeout(action.ms ?? 250);
		return;
	}

	throw new Error(`Unsupported visual walkthrough action type: ${action.type}`);
}

/** Capture a page state. */
async function captureState(browser, pageConfig, stateConfig) {
	const context = await browser.newContext({
		ignoreHTTPSErrors: true,
		reducedMotion: 'reduce',
		viewport: {
			width: 1440,
			height: 1200,
		},
	});

	const page = await context.newPage();
	const stateId = stateConfig.id || 'default';
	const screenshotFile = `${slugify(pageConfig.group)}__${slugify(pageConfig.id)}__${slugify(stateId)}.png`;
	const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotFile);
	const url = new URL(pageConfig.path, baseURL).toString();
	const started = Date.now();

	try {
		const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

		if (!response) {
			throw new Error(`No HTTP response for ${url}`);
		}

		if (!response.ok()) {
			throw new Error(`HTTP ${response.status()} for ${url}`);
		}

		await settlePage(page);

		for (const action of stateConfig.actions || []) {
			await runAction(page, action);
			await settlePage(page);
		}

		await page.screenshot({
			path: screenshotPath,
			fullPage: true,
			animations: 'disabled',
		});

		return {
			id: stateId,
			title: stateConfig.title || 'Default state',
			description: stateConfig.description || '',
			status: 'captured',
			url,
			durationMs: Date.now() - started,
			screenshot: `screenshots/${screenshotFile}`,
		};
	} finally {
		await context.close();
	}
}

/** Capture every registered page and state. */
async function captureReport() {
	validateRegistry();

	fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
	ensureDir(SCREENSHOTS_DIR);

	const browser = await chromium.launch({ headless: true });
	const capturedPages = [];
	const failures = [];

	try {
		for (const pageConfig of visualWalkthroughConfig.pages) {
			const states = [
				{
					id: 'default',
					title: 'Default state',
					description: 'Initial loaded page state.',
				},
				...(pageConfig.states || []),
			];

			const capturedStates = [];

			for (const stateConfig of states) {
				try {
					const state = await captureState(browser, pageConfig, stateConfig);
					capturedStates.push(state);
					console.log(`[visual-walkthrough] captured ${pageConfig.id}/${state.id}`);
				} catch (error) {
					const failure = {
						page: pageConfig.id,
						state: stateConfig.id || 'default',
						message: error.message,
					};

					capturedStates.push({
						id: failure.state,
						title: stateConfig.title || 'Default state',
						description: stateConfig.description || '',
						status: 'failed',
						url: new URL(pageConfig.path, baseURL).toString(),
						error: failure.message,
					});

					failures.push(failure);
					console.error(`[visual-walkthrough] failed ${failure.page}/${failure.state}: ${failure.message}`);
				}
			}

			capturedPages.push({
				id: pageConfig.id,
				title: pageConfig.title,
				group: pageConfig.group || 'Application',
				path: pageConfig.path,
				description: pageConfig.description || '',
				states: capturedStates,
			});
		}
	} finally {
		await browser.close();
	}

	const manifest = {
		title: visualWalkthroughConfig.title,
		description: visualWalkthroughConfig.description,
		startedAt,
		baseURL,
		pageCount: capturedPages.length,
		stateCount: capturedPages.reduce((total, page) => total + page.states.length, 0),
		failureCount: failures.length,
		pages: capturedPages,
		failures,
	};

	writeReport(manifest);

	if (failures.length > 0) {
		throw new Error(`Visual walkthrough failed for ${failures.length} state(s).`);
	}
}

/** Group pages by report group. */
function groupPages(pages) {
	const groups = new Map();

	for (const page of pages) {
		if (!groups.has(page.group)) groups.set(page.group, []);
		groups.get(page.group).push(page);
	}

	return [...groups.entries()];
}

/** Render the HTML report. */
function renderHtml(manifest) {
	const groups = groupPages(manifest.pages);

	return `<!doctype html>
<html lang="en-GB">
<head>
	<meta charset="utf-8" />
	<title>${escapeHtml(manifest.title)}</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<style>
		body {
			font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			margin: 24px;
			line-height: 1.45;
			color: #111;
			background: #fff;
		}

		header {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			gap: 16px;
			flex-wrap: wrap;
			border-bottom: 1px solid #d8d8d8;
			margin-bottom: 24px;
			padding-bottom: 16px;
		}

		h1 {
			margin: 0 0 8px;
		}

		h2 {
			margin-top: 32px;
			border-bottom: 1px solid #e5e5e5;
			padding-bottom: 8px;
		}

		h3 {
			margin: 0 0 4px;
		}

		.badge {
			background: #eef;
			border: 1px solid #99c;
			border-radius: 6px;
			display: inline-block;
			padding: 6px 10px;
		}

		.meta {
			color: #444;
			margin: 0;
		}

		.group {
			margin-bottom: 40px;
		}

		.page-card {
			border: 1px solid #d8d8d8;
			border-radius: 8px;
			margin: 18px 0;
			overflow: hidden;
		}

		.page-card__header {
			background: #f7f7f7;
			border-bottom: 1px solid #d8d8d8;
			padding: 14px 16px;
		}

		.states {
			display: grid;
			gap: 18px;
			grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
			padding: 16px;
		}

		.state {
			border: 1px solid #e5e5e5;
			border-radius: 6px;
			overflow: hidden;
			background: #fff;
		}

		.state__header {
			padding: 10px 12px;
			border-bottom: 1px solid #e5e5e5;
		}

		.state__header p {
			margin: 4px 0 0;
		}

		.state img {
			display: block;
			width: 100%;
			height: auto;
		}

		.failed {
			border-color: #d4351c;
		}

		.failed .state__header {
			background: #fff4f2;
		}

		.summary {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
			justify-content: flex-end;
		}
	</style>
</head>
<body>
	<header>
		<div>
			<h1>${escapeHtml(manifest.title)}</h1>
			<p class="meta">${escapeHtml(manifest.description)}</p>
			<p class="meta">Base URL: ${escapeHtml(manifest.baseURL)}</p>
			<p class="meta">Run started: ${escapeHtml(manifest.startedAt)}</p>
		</div>
		<div class="summary">
			<span class="badge">${manifest.pageCount} pages</span>
			<span class="badge">${manifest.stateCount} states</span>
			<span class="badge">${manifest.failureCount} failures</span>
		</div>
	</header>
	${groups
		.map(
			([group, pages]) => `
	<section class="group" id="${escapeHtml(slugify(group))}">
		<h2>${escapeHtml(group)}</h2>
		${pages
			.map(
				(page) => `
		<article class="page-card" id="${escapeHtml(page.id)}">
			<div class="page-card__header">
				<h3>${escapeHtml(page.title)}</h3>
				<p class="meta">${escapeHtml(page.path)}</p>
				<p class="meta">${escapeHtml(page.description)}</p>
			</div>
			<div class="states">
				${page.states
					.map(
						(state) => `
				<section class="state ${state.status === 'failed' ? 'failed' : ''}">
					<div class="state__header">
						<h4>${escapeHtml(state.title)}</h4>
						<p class="meta">${escapeHtml(state.status)} · ${escapeHtml(state.url)}</p>
						${state.description ? `<p>${escapeHtml(state.description)}</p>` : ''}
						${state.error ? `<p>${escapeHtml(state.error)}</p>` : ''}
					</div>
					${state.screenshot ? `<a href="${escapeHtml(state.screenshot)}"><img loading="lazy" src="${escapeHtml(state.screenshot)}" alt="${escapeHtml(page.title)}: ${escapeHtml(state.title)}" /></a>` : ''}
				</section>`
					)
					.join('')}
			</div>
		</article>`
			)
			.join('')}
	</section>`
		)
		.join('')}
</body>
</html>`;
}

/** Write manifest and HTML report. */
function writeReport(manifest) {
	fs.writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
	fs.writeFileSync(INDEX_FILE, renderHtml(manifest));
	console.log(`[visual-walkthrough] report written to ${INDEX_FILE}`);
}

await captureReport();
