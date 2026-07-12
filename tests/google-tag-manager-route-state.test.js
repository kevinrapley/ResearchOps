import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { visualWalkthroughConfig } from '../visual-walkthrough.config.mjs';

const containerId = 'GTM-KGGFK4KW';
const scriptUrl = 'https://www.googletagmanager.com/gtm.js?id=';
const noscriptUrl = `https://www.googletagmanager.com/ns.html?id=${containerId}`;
const layout = fs.readFileSync('src/govuk/templates/layouts/researchops.njk', 'utf8');
const normaliser = fs.readFileSync('scripts/govuk/normalise-service-pages.mjs', 'utf8');
const sharedHead = fs.readFileSync('public/partials/html-head.html', 'utf8');

function outputPathForRoute(route) {
	if (route === '/') return 'public/index.html';
	return path.join('public', route.replace(/^\//, ''));
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertGoogleTagManager(page, pagePath) {
	const headEnd = page.search(/<\/head>/i);
	const scriptPosition = page.indexOf(scriptUrl);
	assert.ok(scriptPosition >= 0, `${pagePath} should load the GTM container script`);
	assert.ok(scriptPosition < headEnd, `${pagePath} should load GTM from the document head`);
	assert.match(page, new RegExp(`['"]${containerId}['"]`), `${pagePath} should use the configured GTM container`);
	assert.match(
		page,
		new RegExp(
			`<body\\b[^>]*>\\s*(?:<!-- Google Tag Manager \\(noscript\\) -->\\s*)?<noscript>\\s*<iframe\\s+src="${escapeRegExp(noscriptUrl)}"`,
		),
		`${pagePath} should place the GTM noscript fallback immediately after the body start`,
	);
	assert.equal(page.split(scriptUrl).length - 1, 1, `${pagePath} should include one GTM script`);
	assert.equal(page.split(noscriptUrl).length - 1, 1, `${pagePath} should include one GTM noscript fallback`);
}

assert.ok(layout.includes(scriptUrl), 'shared Nunjucks layout should load GTM');
assert.ok(layout.includes(noscriptUrl), 'shared Nunjucks layout should include the GTM noscript fallback');
assert.ok(sharedHead.includes(scriptUrl), 'shared HTML head partial should load GTM');
assert.match(normaliser, /GOOGLE_TAG_MANAGER_CONTAINER_ID = 'GTM-KGGFK4KW'/, 'normaliser should manage the GTM container');
assert.match(normaliser, /ensureGoogleTagManagerNoscript/, 'normaliser should add the GTM noscript fallback');

const deployablePagePaths = [
	...visualWalkthroughConfig.pages.map(({ path: route }) => outputPathForRoute(route)),
	'public/pages/synthesize/index.html',
	'public/clear.html',
];

for (const pagePath of deployablePagePaths) {
	assertGoogleTagManager(fs.readFileSync(pagePath, 'utf8'), pagePath);
}
