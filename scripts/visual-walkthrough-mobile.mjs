/* eslint-env node */

/**
 * @file scripts/visual-walkthrough-mobile.mjs
 * @summary Add mobile screenshots and viewport navigation to the generated visual walkthrough report.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DESKTOP_DEVICE_ID = 'desktop';
const MOBILE_DEVICE_ID = 'mobile';
const DESKTOP_OUTPUT_DIR = 'reports-site';
const MOBILE_OUTPUT_DIR = 'reports-site-mobile';
const SCREENSHOTS_DIR = path.join(DESKTOP_OUTPUT_DIR, 'screenshots');
const MOBILE_SCREENSHOTS_DIR = path.join(SCREENSHOTS_DIR, MOBILE_DEVICE_ID);
const MOBILE_TEMP_SCRIPT = path.join('scripts', '.visual-walkthrough-mobile.generated.mjs');
const MANIFEST_FILE = path.join(DESKTOP_OUTPUT_DIR, 'manifest.json');
const INDEX_FILE = path.join(DESKTOP_OUTPUT_DIR, 'index.html');

const captureDevices = [
	{
		id: DESKTOP_DEVICE_ID,
		title: 'Desktop',
		description: 'Chromium desktop viewport, 1440px by 1200px.',
	},
	{
		id: MOBILE_DEVICE_ID,
		title: 'Mobile',
		description: 'Playwright Chromium using iPhone mobile device emulation.',
	},
];

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

function assertPresent(filePath, message) {
	if (!fs.existsSync(filePath)) throw new Error(message);
}

function mobileScriptSource() {
	const source = fs.readFileSync(path.join('scripts', 'visual-walkthrough.mjs'), 'utf8');
	const imported = source.replace(
		"import { chromium } from 'playwright';",
		"import { chromium, devices } from 'playwright';"
	);
	const outputRetargeted = imported.replace(
		"const OUTPUT_DIR = 'reports-site';",
		"const OUTPUT_DIR = 'reports-site-mobile';"
	);
	const contextPattern =
		/const context = await browser\.newContext\(\{[\s\S]*?ignoreHTTPSErrors: true,[\s\S]*?reducedMotion: 'reduce',[\s\S]*?viewport: \{[\s\S]*?width: 1440,[\s\S]*?height: 1200,[\s\S]*?\},[\s\S]*?\}\);/;
	const mobileContext = `const mobileDeviceOptions = devices['iPhone 14'] || devices['iPhone 13'] || {
		hasTouch: true,
		isMobile: true,
		userAgent:
			'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
		viewport: {
			width: 390,
			height: 844,
		},
	};
	const context = await browser.newContext({
		...mobileDeviceOptions,
		ignoreHTTPSErrors: true,
		reducedMotion: 'reduce',
	});`;
	const transformed = outputRetargeted.replace(contextPattern, mobileContext);

	if (transformed === outputRetargeted) {
		throw new Error('Could not rewrite visual walkthrough context for mobile capture.');
	}

	return transformed;
}

function runMobileWalkthrough() {
	fs.rmSync(MOBILE_OUTPUT_DIR, { recursive: true, force: true });
	fs.writeFileSync(MOBILE_TEMP_SCRIPT, mobileScriptSource());
	try {
		execFileSync(process.execPath, [MOBILE_TEMP_SCRIPT], { stdio: 'inherit' });
	} finally {
		fs.rmSync(MOBILE_TEMP_SCRIPT, { force: true });
	}
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function mobileStateFor(mobileManifest, pageId, stateId) {
	return mobileManifest.pages
		.find((page) => page.id === pageId)
		?.states.find((state) => state.id === stateId);
}

function copyMobileScreenshot(mobileState) {
	if (!mobileState?.screenshot) return null;
	ensureDir(MOBILE_SCREENSHOTS_DIR);
	const source = path.join(MOBILE_OUTPUT_DIR, mobileState.screenshot);
	const destinationName = path.basename(mobileState.screenshot);
	const destination = path.join(MOBILE_SCREENSHOTS_DIR, destinationName);
	fs.copyFileSync(source, destination);
	return `screenshots/${MOBILE_DEVICE_ID}/${destinationName}`;
}

function enhanceManifest(desktopManifest, mobileManifest) {
	const failures = [...(desktopManifest.failures || []), ...(mobileManifest.failures || [])];
	const pages = desktopManifest.pages.map((page) => ({
		...page,
		states: page.states.map((state) => {
			const mobileState = mobileStateFor(mobileManifest, page.id, state.id);
			const mobileScreenshot = copyMobileScreenshot(mobileState);
			const screenshots = [];

			if (state.screenshot) {
				screenshots.push({
					id: DESKTOP_DEVICE_ID,
					title: 'Desktop',
					description: captureDevices[0].description,
					url: state.url,
					durationMs: state.durationMs,
					screenshot: state.screenshot,
				});
			}

			if (mobileScreenshot) {
				screenshots.push({
					id: MOBILE_DEVICE_ID,
					title: 'Mobile',
					description: captureDevices[1].description,
					url: mobileState.url,
					durationMs: mobileState.durationMs,
					screenshot: mobileScreenshot,
				});
			}

			return {
				...state,
				screenshots,
			};
		}),
	}));
	const screenshotCount = pages.reduce(
		(total, page) =>
			total +
			page.states.reduce((stateTotal, state) => stateTotal + (state.screenshots?.length || 0), 0),
		0
	);

	return {
		...desktopManifest,
		devices: captureDevices,
		screenshotCount,
		failureCount: failures.length,
		pages,
		failures,
	};
}

function groupPages(pages) {
	const groups = new Map();
	for (const page of pages) {
		if (!groups.has(page.group)) groups.set(page.group, []);
		groups.get(page.group).push(page);
	}
	return [...groups.entries()];
}

function renderDeviceNavigation(devicesConfig) {
	return `
		<nav class="device-nav" aria-label="Screenshot viewport">
			<p class="device-nav__label">Screenshot view</p>
			${devicesConfig
				.map(
					(device, index) => `
			<button type="button" class="device-nav__button" data-device-control="${escapeHtml(device.id)}" aria-pressed="${index === 0 ? 'true' : 'false'}">${escapeHtml(device.title)}</button>`
				)
				.join('')}
		</nav>`;
}

function renderScreenshot(state, page) {
	return (state.screenshots || [])
		.map(
			(screenshot) => `
					<a class="device-shot" data-device="${escapeHtml(screenshot.id)}" href="${escapeHtml(screenshot.screenshot)}">
						<span class="sr-only">${escapeHtml(screenshot.title)} screenshot: </span><img loading="lazy" src="${escapeHtml(screenshot.screenshot)}" alt="${escapeHtml(page.title)}: ${escapeHtml(state.title)} — ${escapeHtml(screenshot.title)}" />
					</a>`
		)
		.join('');
}

function renderHtml(manifest) {
	const groups = groupPages(manifest.pages);
	const defaultDevice = manifest.devices?.[0]?.id || DESKTOP_DEVICE_ID;

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
		.badge { background: #eef; border: 1px solid #99c; border-radius: 6px; display: inline-block; padding: 6px 10px; }
		.meta { color: #444; margin: 0; }
		.group { margin-bottom: 40px; }
		.page-card { border: 1px solid #d8d8d8; border-radius: 8px; margin: 18px 0; overflow: hidden; }
		.page-card__header { background: #f7f7f7; border-bottom: 1px solid #d8d8d8; padding: 14px 16px; }
		.states { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); padding: 16px; }
		.state { border: 1px solid #e5e5e5; border-radius: 6px; overflow: hidden; background: #fff; }
		.state__header { padding: 10px 12px; border-bottom: 1px solid #e5e5e5; }
		.state__header p { margin: 4px 0 0; }
		.state img { display: block; width: 100%; height: auto; }
		.failed { border-color: #d4351c; }
		.failed .state__header { background: #fff4f2; }
		.summary { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
		.device-nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
		.device-nav__label { font-weight: 700; margin: 0 8px 0 0; }
		.device-nav__button { background: #fff; border: 2px solid #1d70b8; border-radius: 4px; color: #1d70b8; cursor: pointer; font: inherit; padding: 8px 12px; }
		.device-nav__button[aria-pressed="true"] { background: #1d70b8; color: #fff; }
		.device-shot { display: none; }
		body[data-device="desktop"] .device-shot[data-device="desktop"], body[data-device="mobile"] .device-shot[data-device="mobile"] { display: block; }
		.sr-only { border: 0; clip: rect(0 0 0 0); height: 1px; margin: -1px; overflow: hidden; padding: 0; position: absolute; white-space: nowrap; width: 1px; }
		@media (max-width: 700px) { body { margin: 12px; } .states { grid-template-columns: 1fr; padding: 12px; } }
	</style>
</head>
<body data-device="${escapeHtml(defaultDevice)}">
	<header>
		<div>
			<h1>${escapeHtml(manifest.title)}</h1>
			<p class="meta">${escapeHtml(manifest.description)}</p>
			<p class="meta">Base URL: ${escapeHtml(manifest.baseURL)}</p>
			<p class="meta">Run started: ${escapeHtml(manifest.startedAt)}</p>
			${renderDeviceNavigation(manifest.devices || [])}
		</div>
		<div class="summary">
			<span class="badge">${manifest.pageCount} pages</span>
			<span class="badge">${manifest.stateCount} states</span>
			<span class="badge">${manifest.screenshotCount || 0} screenshots</span>
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
					${renderScreenshot(state, page)}
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
			const buttons = [...document.querySelectorAll('[data-device-control]')];
			function setDevice(device) {
				document.body.dataset.device = device;
				for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.deviceControl === device));
				try { window.localStorage.setItem('visual-walkthrough-device', device); } catch {}
			}
			for (const button of buttons) button.addEventListener('click', () => setDevice(button.dataset.deviceControl));
			try {
				const saved = window.localStorage.getItem('visual-walkthrough-device');
				if (saved && buttons.some((button) => button.dataset.deviceControl === saved)) setDevice(saved);
			} catch {}
		})();
	</script>
</body>
</html>`;
}

assertPresent(
	MANIFEST_FILE,
	'Run scripts/visual-walkthrough.mjs before adding mobile screenshots.'
);
runMobileWalkthrough();
const manifest = enhanceManifest(
	readJson(MANIFEST_FILE),
	readJson(path.join(MOBILE_OUTPUT_DIR, 'manifest.json'))
);
fs.writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(INDEX_FILE, renderHtml(manifest));
fs.rmSync(MOBILE_OUTPUT_DIR, { recursive: true, force: true });
