/* eslint-env node */

/**
 * @file scripts/visual-walkthrough.mjs
 * @summary Generate the application visual walkthrough report from a registered page/state catalogue.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { visualWalkthroughConfig } from '../visual-walkthrough.config.mjs';
import {
	synthesisDefaultState,
	synthesisVisualStates,
} from '../visual-walkthrough.synthesis-states.mjs';
import { buildStateAcceptanceGherkin } from './researchops-state-acceptance.mjs';

const OUTPUT_DIR = 'reports-site';
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');
const MANIFEST_FILE = path.join(OUTPUT_DIR, 'manifest.json');
const INDEX_FILE = path.join(OUTPUT_DIR, 'index.html');
const DEFAULT_BASE_URL = 'https://researchops.pages.dev/';
const DEFAULT_PROFILES = [
	{
		id: 'desktop',
		title: 'Desktop',
		description: 'Desktop Chromium viewport, 1440 × 1200.',
		contextOptions: {
			viewport: {
				width: 1440,
				height: 1200,
			},
		},
	},
];

const startedAt = new Date().toISOString();
const baseURL = normalizeBaseURL(
	process.env.BASE_URL || process.env.PAGES_URL || process.env.PREVIEW_URL || DEFAULT_BASE_URL
);
const captureProfiles = (visualWalkthroughConfig.profiles || DEFAULT_PROFILES).map((profile) => ({
	...profile,
	id: slugify(profile.id || profile.title || 'profile'),
	title: profile.title || profile.id || 'Profile',
	description: profile.description || '',
	contextOptions: profile.contextOptions || {},
}));

function normalizeBaseURL(value) {
	const url = String(value || '').trim();
	if (!url) return DEFAULT_BASE_URL;
	return url.endsWith('/') ? url : `${url}/`;
}

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

function routeFromPublicFile(filePath) {
	const relativePath = path.relative(visualWalkthroughConfig.publicRoot, filePath).replaceAll(path.sep, '/');
	return relativePath === 'index.html' ? '/' : `/${relativePath}`;
}

function listHtmlFiles(dir) {
	if (!fs.existsSync(dir)) return [];

	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);
		if (entry.isDirectory()) files.push(...listHtmlFiles(entryPath));
		if (entry.isFile() && entry.name.endsWith('.html')) files.push(entryPath);
	}

	return files.sort();
}

function getDiscoveredApplicationRoutes() {
	const excluded = new Set(visualWalkthroughConfig.excludedRoutes || []);
	return listHtmlFiles(visualWalkthroughConfig.publicRoot)
		.map(routeFromPublicFile)
		.filter((route) => !excluded.has(route));
}

function validateRegistry() {
	const registeredRoutes = new Set(visualWalkthroughConfig.pages.map((page) => page.path));
	const registeredIds = new Set();
	const profileIds = new Set();
	const failures = [];

	for (const profile of captureProfiles) {
		if (!profile.id) failures.push('Every visual walkthrough profile must have an id.');
		if (profileIds.has(profile.id)) failures.push(`Duplicate visual walkthrough profile id: ${profile.id}`);
		profileIds.add(profile.id);
	}

	for (const page of visualWalkthroughConfig.pages) {
		if (registeredIds.has(page.id)) failures.push(`Duplicate page id: ${page.id}`);
		registeredIds.add(page.id);
		if (!page.path.startsWith('/')) failures.push(`Page path must start with /: ${page.id}`);
	}

	for (const route of getDiscoveredApplicationRoutes()) {
		if (!registeredRoutes.has(route)) failures.push(`Missing visual walkthrough registry entry for route: ${route}`);
	}

	if (failures.length > 0) {
		throw new Error(`Visual walkthrough registry is incomplete:\n- ${failures.join('\n- ')}`);
	}
}

function pageCaptureConfig(pageConfig) {
	if (pageConfig.id !== 'synthesize') return pageConfig;

	return {
		...pageConfig,
		title: 'Study synthesis',
		description: 'Study-scoped evidence grouping and theme creation page.',
		defaultState: synthesisDefaultState,
		states: [...(pageConfig.states || []), ...synthesisVisualStates],
	};
}

async function settlePage(page) {
	await page.waitForLoadState('domcontentloaded');
	try {
		await page.waitForLoadState('networkidle', { timeout: 3000 });
	} catch {
		// Some pages keep network connections open. Visual evidence capture should continue.
	}
	await page.locator('body').waitFor({ state: 'visible', timeout: 5000 });
	await page.evaluate(async () => {
		if (document.fonts?.ready) await document.fonts.ready;
	});
	await page.waitForTimeout(200);
}

async function registerMockRoutes(page, stateConfig) {
	for (const mockRoute of stateConfig.mockRoutes || []) {
		await page.route(mockRoute.url, async (route) => {
			const request = route.request();
			const requestMethod = request.method().toUpperCase();
			const expectedMethod = String(mockRoute.method || requestMethod).toUpperCase();

			if (requestMethod !== expectedMethod) {
				await route.fallback();
				return;
			}

			const body = typeof mockRoute.body === 'string' ? mockRoute.body : JSON.stringify(mockRoute.body ?? {});
			await route.fulfill({
				status: mockRoute.status ?? 200,
				contentType: mockRoute.contentType || 'application/json',
				headers: mockRoute.headers || {},
				body,
			});
		});
	}
}

async function runAction(page, action) {
	const timeout = action.timeout ?? 5000;

	if (action.type === 'click') return page.locator(action.selector).click({ timeout });
	if (action.type === 'fill') return page.locator(action.selector).fill(action.value ?? '', { timeout });
	if (action.type === 'press') return page.locator(action.selector ?? 'body').press(action.key, { timeout });
	if (action.type === 'select') return page.locator(action.selector).selectOption(action.value, { timeout });
	if (action.type === 'check') return page.locator(action.selector).check({ timeout });
	if (action.type === 'uncheck') return page.locator(action.selector).uncheck({ timeout });
	if (action.type === 'waitForSelector') return page.locator(action.selector).waitFor({ state: action.state ?? 'visible', timeout });
	if (action.type === 'waitForText') return page.getByText(action.text, { exact: Boolean(action.exact) }).first().waitFor({ timeout });
	if (action.type === 'wait') return page.waitForTimeout(action.ms ?? 250);

	throw new Error(`Unsupported visual walkthrough action type: ${action.type}`);
}

async function captureState(browser, pageConfig, stateConfig, profile) {
	const context = await browser.newContext({
		ignoreHTTPSErrors: true,
		reducedMotion: 'reduce',
		...profile.contextOptions,
	});
	const page = await context.newPage();
	const stateId = stateConfig.id || 'default';
	const screenshotFile = `${slugify(pageConfig.group)}__${slugify(pageConfig.id)}__${slugify(stateId)}.png`;
	const screenshotDir = path.join(SCREENSHOTS_DIR, profile.id);
	const screenshotPath = path.join(screenshotDir, screenshotFile);
	const statePath = stateConfig.path || pageConfig.path;
	const url = new URL(statePath, baseURL).toString();
	const started = Date.now();

	try {
		ensureDir(screenshotDir);
		await registerMockRoutes(page, stateConfig);
		const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
		if (!response) throw new Error(`No HTTP response for ${url}`);
		if (!response.ok()) throw new Error(`HTTP ${response.status()} for ${url}`);

		await settlePage(page);
		for (const action of stateConfig.actions || []) {
			await runAction(page, action);
			await settlePage(page);
		}

		await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });

		return {
			profile: profile.id,
			profileTitle: profile.title,
			status: 'captured',
			url,
			durationMs: Date.now() - started,
			screenshot: `screenshots/${profile.id}/${screenshotFile}`,
		};
	} finally {
		await context.close();
	}
}

function createFailedCapture(pageConfig, stateConfig, profile, error) {
	return {
		profile: profile.id,
		profileTitle: profile.title,
		status: 'failed',
		url: new URL(stateConfig.path || pageConfig.path, baseURL).toString(),
		error: error.message,
	};
}

async function captureReport() {
	validateRegistry();
	fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
	ensureDir(SCREENSHOTS_DIR);

	const browser = await chromium.launch({ headless: true });
	const capturedPages = [];
	const failures = [];

	try {
		for (const rawPageConfig of visualWalkthroughConfig.pages) {
			const pageConfig = pageCaptureConfig(rawPageConfig);
			const defaultState = pageConfig.defaultState || {
				id: 'default',
				title: 'Default state',
				description: 'Initial loaded page state.',
			};
			const states = [defaultState, ...(pageConfig.states || [])];
			const capturedStates = [];

			for (const stateConfig of states) {
				const state = {
					id: stateConfig.id || 'default',
					title: stateConfig.title || 'Default state',
					description: stateConfig.description || '',
					url: new URL(stateConfig.path || pageConfig.path, baseURL).toString(),
					status: 'captured',
					captures: [],
				};

				for (const profile of captureProfiles) {
					try {
						const capture = await captureState(browser, pageConfig, stateConfig, profile);
						state.captures.push(capture);
						if (profile.id === captureProfiles[0]?.id) state.screenshot = capture.screenshot;
						console.log(`[visual-walkthrough] captured ${pageConfig.id}/${state.id}/${profile.id}`);
					} catch (error) {
						const failure = {
							page: pageConfig.id,
							state: state.id,
							profile: profile.id,
							message: error.message,
						};
						state.status = 'failed';
						state.captures.push(createFailedCapture(pageConfig, stateConfig, profile, error));
						failures.push(failure);
						console.error(
							`[visual-walkthrough] failed ${failure.page}/${failure.state}/${failure.profile}: ${failure.message}`
						);
					}
				}

				state.acceptanceCriteria = buildStateAcceptanceGherkin(pageConfig, state, stateConfig);
				capturedStates.push(state);
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

	const stateCount = capturedPages.reduce((total, page) => total + page.states.length, 0);
	const captureCount = capturedPages.reduce(
		(total, page) => total + page.states.reduce((stateTotal, state) => stateTotal + state.captures.length, 0),
		0
	);
	const manifest = {
		title: visualWalkthroughConfig.title,
		description: visualWalkthroughConfig.description,
		startedAt,
		baseURL,
		profiles: captureProfiles.map((profile) => ({
			id: profile.id,
			title: profile.title,
			description: profile.description,
		})),
		pageCount: capturedPages.length,
		stateCount,
		captureCount,
		failureCount: failures.length,
		pages: capturedPages,
		failures,
	};

	writeReport(manifest);
	if (failures.length > 0) throw new Error(`Visual walkthrough failed for ${failures.length} capture(s).`);
}

function groupPages(pages) {
	const groups = new Map();
	for (const page of pages) {
		if (!groups.has(page.group)) groups.set(page.group, []);
		groups.get(page.group).push(page);
	}
	return [...groups.entries()];
}

function renderProfileSwitcher(profiles) {
	return `
		<nav class="profile-switcher" aria-label="Screenshot profile">
			<p class="profile-switcher__label">Screenshot set</p>
			<div class="profile-switcher__controls">
				${profiles
					.map(
						(profile) => `
				<button type="button" class="profile-switcher__button" data-profile-filter="${escapeHtml(profile.id)}" aria-pressed="false">
					${escapeHtml(profile.title)}
				</button>`
					)
					.join('')}
			</div>
		</nav>`;
}

function renderStateAcceptanceCriteria(state) {
	if (!state.acceptanceCriteria) return '';

	return `
					<details class="state-acceptance-criteria" data-state-acceptance-criteria>
						<summary>Gherkin acceptance criteria for this state</summary>
						<pre class="gherkin-criteria"><code>${escapeHtml(state.acceptanceCriteria)}</code></pre>
					</details>`;
}

function renderCapture(page, state, capture) {
	const failedClass = capture.status === 'failed' ? ' failed' : '';
	return `
				<section class="capture${failedClass}" data-profile="${escapeHtml(capture.profile)}">
					<div class="capture__header">
						<h5>${escapeHtml(capture.profileTitle)}</h5>
						<p class="meta">${escapeHtml(capture.status)} · ${escapeHtml(capture.url)}</p>
						${capture.error ? `<p>${escapeHtml(capture.error)}</p>` : ''}
					</div>
					${capture.screenshot ? `<a href="${escapeHtml(capture.screenshot)}"><img loading="lazy" src="${escapeHtml(capture.screenshot)}" alt="${escapeHtml(page.title)}: ${escapeHtml(state.title)} — ${escapeHtml(capture.profileTitle)}" /></a>` : ''}
				</section>`;
}

function renderHtml(manifest) {
	const groups = groupPages(manifest.pages);

	return `<!doctype html>
<html lang="en-GB">
<head>
	<meta charset="utf-8" />
	<title>${escapeHtml(manifest.title)}</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<style>
		body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; line-height: 1.45; color: #111; background: #fff; }
		header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; border-bottom: 1px solid #d8d8d8; margin-bottom: 24px; padding-bottom: 16px; }
		h1 { margin: 0 0 8px; }
		h2 { margin-top: 32px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; }
		h3 { margin: 0 0 4px; }
		h4 { margin: 0 0 4px; }
		h5 { margin: 0 0 4px; font-size: 1rem; }
		.badge { background: #eef; border: 1px solid #99c; border-radius: 6px; display: inline-block; padding: 6px 10px; }
		.meta { color: #444; margin: 0; }
		.group { margin-bottom: 40px; }
		.profile-switcher { align-items: center; display: flex; flex-wrap: wrap; gap: 12px; margin: 0 0 24px; }
		.profile-switcher__label { font-weight: 700; margin: 0; }
		.profile-switcher__controls { display: flex; flex-wrap: wrap; gap: 8px; }
		.profile-switcher__button { background: #f3f2f1; border: 2px solid #0b0c0c; border-radius: 0; cursor: pointer; font: inherit; padding: 8px 12px; }
		.profile-switcher__button[aria-pressed="true"] { background: #1d70b8; color: #fff; }
		.page-card { border: 1px solid #d8d8d8; border-radius: 8px; margin: 18px 0; overflow: hidden; }
		.page-card__header { background: #f7f7f7; border-bottom: 1px solid #d8d8d8; padding: 14px 16px; }
		.states { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); padding: 16px; }
		.state { border: 1px solid #e5e5e5; border-radius: 6px; overflow: hidden; background: #fff; }
		.state__header { padding: 10px 12px; border-bottom: 1px solid #e5e5e5; }
		.state__header p { margin: 4px 0 0; }
		.state-acceptance-criteria { border-top: 1px solid #e5e5e5; padding: 10px 12px; }
		.state-acceptance-criteria summary { color: #1d70b8; cursor: pointer; font-weight: 700; }
		.state-acceptance-criteria summary:focus { outline: 3px solid #ffdd00; outline-offset: 2px; }
		.gherkin-criteria { background: #f3f2f1; border: 1px solid #b1b4b6; margin: 8px 0 0; overflow-x: auto; padding: 12px; white-space: pre-wrap; }
		.gherkin-criteria code { font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace; }
		.capture { border-top: 1px solid #e5e5e5; }
		.capture:first-of-type { border-top: 0; }
		.capture__header { padding: 10px 12px; border-bottom: 1px solid #e5e5e5; }
		.capture img { display: block; width: 100%; height: auto; }
		.failed { border-color: #d4351c; }
		.failed .state__header, .failed .capture__header { background: #fff4f2; }
		.summary { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
		[hidden] { display: none !important; }
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
			<span class="badge">${manifest.captureCount} screenshots</span>
			<span class="badge">${manifest.failureCount} failures</span>
		</div>
	</header>
	${renderProfileSwitcher(manifest.profiles)}
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
					</div>
					${renderStateAcceptanceCriteria(state)}
					${state.captures.map((capture) => renderCapture(page, state, capture)).join('')}
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
	<script>
		(() => {
			const buttons = Array.from(document.querySelectorAll('[data-profile-filter]'));
			const captures = Array.from(document.querySelectorAll('[data-profile]'));
			function activate(profile) {
				document.body.dataset.activeProfile = profile;
				for (const button of buttons) {
					button.setAttribute('aria-pressed', String(button.dataset.profileFilter === profile));
				}
				for (const capture of captures) {
					capture.hidden = capture.dataset.profile !== profile;
				}
			}
			for (const button of buttons) {
				button.addEventListener('click', () => activate(button.dataset.profileFilter));
			}
			activate(buttons[0]?.dataset.profileFilter || 'desktop');
		})();
	</script>
</body>
</html>`;
}

function writeReport(manifest) {
	fs.writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
	fs.writeFileSync(INDEX_FILE, renderHtml(manifest));
	console.log(`[visual-walkthrough] report written to ${INDEX_FILE}`);
}

await captureReport();
