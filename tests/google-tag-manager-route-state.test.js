import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { visualWalkthroughConfig } from '../visual-walkthrough.config.mjs';

const containerId = 'GTM-KGGFK4KW';
const loaderPath = '/js/google-tag-manager.js';
const noscriptUrl = `https://www.googletagmanager.com/ns.html?id=${containerId}`;
const layout = fs.readFileSync('src/govuk/templates/layouts/researchops.njk', 'utf8');
const normaliser = fs.readFileSync('scripts/govuk/normalise-service-pages.mjs', 'utf8');
const sharedHead = fs.readFileSync('public/partials/html-head.html', 'utf8');
const loader = fs.readFileSync('public/js/google-tag-manager.js', 'utf8');
const worker = fs.readFileSync('public/_worker.js', 'utf8');
const headers = fs.readFileSync('public/_headers', 'utf8');

function outputPathForRoute(route) {
	if (route === '/') return 'public/index.html';
	return path.join('public', route.replace(/^\//, ''));
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertGoogleTagManager(page, pagePath) {
	const headEnd = page.search(/<\/head>/i);
	const scriptPosition = page.indexOf(loaderPath);
	assert.ok(scriptPosition >= 0, `${pagePath} should load the GTM container script`);
	assert.ok(scriptPosition < headEnd, `${pagePath} should load GTM from the document head`);
	assert.match(
		page,
		new RegExp(
			`<body\\b[^>]*>\\s*(?:<!-- Google Tag Manager \\(noscript\\) -->\\s*)?<noscript>\\s*<iframe\\s+src="${escapeRegExp(noscriptUrl)}"`,
		),
		`${pagePath} should place the GTM noscript fallback immediately after the body start`,
	);
	assert.equal(page.split(loaderPath).length - 1, 1, `${pagePath} should include one GTM script`);
	assert.equal(page.split(noscriptUrl).length - 1, 1, `${pagePath} should include one GTM noscript fallback`);
	assert.equal(page.includes('gtm.start'), false, `${pagePath} should not include a second inline GTM bootstrap`);
}

assert.ok(layout.includes(loaderPath), 'shared Nunjucks layout should load the first-party GTM bootstrap');
assert.ok(layout.includes(noscriptUrl), 'shared Nunjucks layout should include the GTM noscript fallback');
assert.ok(sharedHead.includes(loaderPath), 'shared HTML head partial should load the first-party GTM bootstrap');
assert.match(normaliser, /GOOGLE_TAG_MANAGER_CONTAINER_ID = 'GTM-KGGFK4KW'/, 'normaliser should manage the GTM container');
assert.match(normaliser, /GOOGLE_TAG_MANAGER_LOADER_PATH = '\/js\/google-tag-manager\.js'/, 'normaliser should load GTM through the first-party bootstrap');
assert.match(normaliser, /ensureGoogleTagManagerNoscript/, 'normaliser should add the GTM noscript fallback');
assert.match(loader, /https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=\$\{containerId\}/, 'first-party bootstrap should load GTM');
assert.match(loader, /'GTM-KGGFK4KW'/, 'first-party bootstrap should use the configured GTM container');
assert.doesNotMatch(worker, /https:\/\/www\.googletagmanager\.com/, 'Pages Worker CSP should block GTM while analytics consent governance is open');
assert.doesNotMatch(worker, /https:\/\/\*\.google-analytics\.com/, 'Pages Worker CSP should block GA4 collection while analytics consent governance is open');
assert.match(worker, /img-src 'self' data:/, 'Pages Worker CSP should block third-party image beacons');
assert.match(worker, /frame-src 'none'/, 'Pages Worker CSP should block the GTM noscript iframe');
assert.doesNotMatch(headers, /https:\/\/www\.googletagmanager\.com/, 'static CSP should block GTM for every HTML route');
assert.doesNotMatch(headers, /https:\/\/\*\.google-analytics\.com/, 'static CSP should block GA4 collection for every HTML route');
assert.equal((headers.match(/frame-src 'none'/g) || []).length, 3, 'static CSP should block third-party frames for every HTML route');

const deployablePagePaths = [
	...visualWalkthroughConfig.pages.map(({ path: route }) => outputPathForRoute(route)),
	'public/clear.html',
	'public/pages/account/sign-in/index.html',
	'public/pages/team/registration-requests/index.html',
];

for (const pagePath of deployablePagePaths) {
	assertGoogleTagManager(fs.readFileSync(pagePath, 'utf8'), pagePath);
}

const legacySynthesisRedirect = fs.readFileSync('public/pages/synthesize/index.html', 'utf8');
assert.equal(legacySynthesisRedirect.includes(loaderPath), false, 'legacy synthesis redirect should not load GTM');
assert.equal(legacySynthesisRedirect.includes(noscriptUrl), false, 'legacy synthesis redirect should not include the GTM noscript fallback');
