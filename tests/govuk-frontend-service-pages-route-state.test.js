import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { visualWalkthroughConfig } from '../visual-walkthrough.config.mjs';

function routeToFile(route) {
	if (route === '/') return 'public/index.html';

	const cleanRoute = route.split('?')[0];
	const routePath = cleanRoute.endsWith('/') ? `${cleanRoute}index.html` : cleanRoute;
	return path.join('public', routePath.replace(/^\//, ''));
}

const registeredPagePaths = [...new Set(visualWalkthroughConfig.pages.map((page) => page.path))];

for (const route of registeredPagePaths) {
	const filePath = routeToFile(route);
	if (!fs.existsSync(filePath)) continue;

	const page = fs.readFileSync(filePath, 'utf8');

	assert.match(page, /<html class="govuk-template" lang="en">/, `${filePath} should use GOV.UK template html class`);
	assert.match(page, /class="govuk-template__body"/, `${filePath} should use GOV.UK template body class`);
	assert.match(page, /govuk-frontend-supported/, `${filePath} should include GOV.UK Frontend support snippet`);
	assert.match(page, /\/assets\/govuk\/govuk-frontend\.css/, `${filePath} should load generated GOV.UK Frontend CSS explicitly`);
	assert.match(page, /\/components\/layout\.js/, `${filePath} should load the shared x-include loader explicitly`);
	assert.match(page, /\/js\/govuk-frontend-init\.js/, `${filePath} should initialise GOV.UK Frontend explicitly`);
	assert.match(page, /<x-include\b[^>]*src="\/partials\/header\.html"/, `${filePath} should include shared GOV.UK header chrome`);
	assert.match(page, /<x-include\b[^>]*src="\/partials\/footer\.html"[^>]*><\/x-include>/, `${filePath} should include shared GOV.UK footer chrome`);
	assert.match(page, /<main\b[^>]*id="main-content"/, `${filePath} should expose the skip-link target`);
	assert.match(page, /<main\b[^>]*class="[^"]*govuk-main-wrapper/, `${filePath} should use GOV.UK main wrapper`);
	assert.doesNotMatch(page, /<header class="govuk-header"/, `${filePath} should not hardcode the GOV.UK header`);
	assert.doesNotMatch(page, /<footer class="govuk-footer"/, `${filePath} should not hardcode the GOV.UK footer`);
}
