import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { visualWalkthroughConfig } from '../visual-walkthrough.config.mjs';
import { publishedGovukPage } from './helpers/published-govuk-pages.mjs';

const containerId = 'GTM-KGGFK4KW';
const loaderPath = '/js/google-tag-manager.js';
const noscriptUrl = `https://www.googletagmanager.com/ns.html?id=${containerId}`;
const layout = fs.readFileSync('src/govuk/templates/layouts/researchops.njk', 'utf8');
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
assert.match(loader, /https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=\$\{containerId\}/, 'first-party bootstrap should load GTM');
assert.match(loader, /'GTM-KGGFK4KW'/, 'first-party bootstrap should use the configured GTM container');
assert.match(worker, /img-src 'self' data: https:\/\/www\.googletagmanager\.com/, 'Pages Worker CSP should allow GTM image requests');
assert.match(worker, /img-src 'self' data: https:\/\/www\.googletagmanager\.com https:\/\/\*\.google-analytics\.com/, 'Pages Worker CSP should allow GA4 image requests');
assert.match(worker, /connect-src[^;]+https:\/\/\*\.google-analytics\.com https:\/\/\*\.analytics\.google\.com/, 'Pages Worker CSP should allow GA4 collection requests');
assert.match(worker, /https:\/\/www\.googletagmanager\.com/, 'Pages Worker CSP should allow GTM scripts and frames');
assert.match(worker, /frame-src https:\/\/www\.googletagmanager\.com/, 'Pages Worker CSP should allow the GTM noscript iframe');
assert.equal((headers.match(/https:\/\/www\.googletagmanager\.com/g) || []).length, 9, 'static CSP should allow GTM image requests, scripts and frames for every HTML route');
assert.equal((headers.match(/https:\/\/\*\.google-analytics\.com/g) || []).length, 6, 'static CSP should allow GA4 image and collection requests for every HTML route');
assert.equal((headers.match(/https:\/\/\*\.analytics\.google\.com/g) || []).length, 3, 'static CSP should allow GA4 collection requests for every HTML route');

const deployablePagePaths = [
	...visualWalkthroughConfig.pages.map(({ path: route }) => outputPathForRoute(route)),
	'public/clear.html',
];
const staticPagePaths = new Set([
	'public/clear.html',
	'public/pages/account/sign-in/index.html',
	'public/pages/team/registration-requests/index.html',
]);

for (const pagePath of deployablePagePaths) {
	const page = staticPagePaths.has(pagePath)
		? fs.readFileSync(pagePath, 'utf8')
		: await publishedGovukPage(pagePath);
	assertGoogleTagManager(page, pagePath);
}

const legacySynthesisRedirect = fs.readFileSync('public/pages/synthesize/index.html', 'utf8');
assert.equal(legacySynthesisRedirect.includes(loaderPath), false, 'legacy synthesis redirect should not load GTM');
assert.equal(legacySynthesisRedirect.includes(noscriptUrl), false, 'legacy synthesis redirect should not include the GTM noscript fallback');
