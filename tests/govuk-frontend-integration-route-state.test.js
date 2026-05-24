import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const sassEntry = fs.readFileSync('src/styles/govuk.scss', 'utf8');
const generatedCss = fs.readFileSync('public/assets/govuk/govuk-frontend.css', 'utf8');
const layoutTemplate = fs.readFileSync('src/govuk/templates/layouts/researchops.njk', 'utf8');
const projectsTemplate = fs.readFileSync('src/govuk/templates/pages/projects.njk', 'utf8');
const sharedHead = fs.readFileSync('public/partials/html-head.html', 'utf8');
const sharedHeader = fs.readFileSync('public/partials/header.html', 'utf8');
const sharedFooter = fs.readFileSync('public/partials/footer.html', 'utf8');
const layoutLoader = fs.readFileSync('public/components/layout.js', 'utf8');
const renderedProjectsPage = fs.readFileSync('public/pages/projects/index.html', 'utf8');

const representativePages = [
	'public/index.html',
	'public/pages/account/index.html',
	'public/pages/projects/index.html',
	'public/pages/start/overview/index.html',
];

const legacyCloneAssets = [
	'/css/govuk/govuk-typography.css',
	'/css/govuk/govuk-colours.css',
	'/css/govuk/govuk-page-chrome.css',
	'/css/govuk/govuk-buttons.css',
	'/css/govuk/govuk-forms.css',
	'/css/govuk/govuk-frontend-v6.css',
	'/css/screen.css',
	'/css/home-lifecycle.css',
];

assert.equal(packageJson.dependencies['govuk-frontend'], '^6.0.0');
assert.equal(packageJson.devDependencies.sass, '^1.94.2');
assert.equal(packageJson.devDependencies.nunjucks, '^3.2.4');
assert.equal(
	packageJson.scripts.build,
	'npm run build:govuk && npm run build:researchops && npm run build:projects && npm run build:govuk-pages',
);
assert.equal(
	packageJson.scripts['build:govuk'],
	'sass --load-path=node_modules --no-source-map --style=compressed src/styles/govuk.scss public/assets/govuk/govuk-frontend.css && node scripts/govuk/copy-govuk-assets.mjs',
);
assert.equal(
	packageJson.scripts['build:projects'],
	'sass --load-path=node_modules --no-source-map src/styles/projects.scss public/css/projects.css',
);

assert.match(sassEntry, /\$govuk-page-width: 1020px;/);
assert.match(sassEntry, /\$govuk-assets-path: '\/assets\/govuk\/assets\/';/);
assert.match(sassEntry, /@import ['"]govuk-frontend\/dist\/govuk['"];/);
assert.match(generatedCss, /\.govuk-width-container\{max-width:1020px/);
assert.match(generatedCss, /\.govuk-button/);
assert.match(generatedCss, /font-family:GDS Transport/);
assert.match(generatedCss, /\.govuk-summary-card/);
assert.match(generatedCss, /\.govuk-details/);
assert.match(generatedCss, /\.govuk-tag/);

assert.match(layoutTemplate, /\/components\/layout\.js/);
assert.match(layoutTemplate, /<x-include src="\/partials\/header\.html"/);
assert.match(layoutTemplate, /<x-include src="\/partials\/footer\.html"><\/x-include>/);
assert.doesNotMatch(layoutTemplate, /\/components\/govuk-layout\.js/);

assert.match(sharedHead, /\/assets\/govuk\/govuk-frontend\.css/);
assert.doesNotMatch(sharedHead, /\/css\/govuk\/govuk-frontend-v6\.css/);
assert.match(sharedHeader, /class="govuk-header"/);
assert.match(sharedHeader, /ResearchOps Demo Suite/);
assert.match(sharedFooter, /class="govuk-width-container govuk-footer__container"/);

assert.match(layoutLoader, /class XInclude extends HTMLElement/);
assert.match(layoutLoader, /customElements\.define\("x-include", XInclude\)/);
assert.match(layoutLoader, /x-include:loaded/);
assert.doesNotMatch(layoutLoader, /GOVUK_FRONTEND_V6_STYLESHEET/);
assert.doesNotMatch(layoutLoader, /ensureGovukFrontendV6Stylesheet/);
assert.doesNotMatch(layoutLoader, /govuk-frontend-v6\.css/);

assert.match(projectsTemplate, /govuk\/components\/button\/macro\.njk/);
assert.match(projectsTemplate, /id="project-summary-card-template"/);
assert.match(projectsTemplate, /govuk-summary-card rops-project-card/);
assert.match(projectsTemplate, /govuk-summary-list govuk-summary-list--no-border rops-project-summary-list/);
assert.match(projectsTemplate, /govuk-details rops-project-details/);
assert.doesNotMatch(projectsTemplate, /class="card"/);
assert.doesNotMatch(projectsTemplate, /project-meta/);

assert.match(renderedProjectsPage, /govuk-summary-card rops-project-card/);
assert.match(renderedProjectsPage, /class="govuk-button govuk-button--secondary"/);
assert.match(renderedProjectsPage, /data-module="govuk-button"/);
assert.doesNotMatch(renderedProjectsPage, /\/css\/govuk\/govuk-frontend-v6\.css/);

for (const path of representativePages) {
	const page = fs.readFileSync(path, 'utf8');
	assert.match(page, /\/assets\/govuk\/govuk-frontend\.css/, `${path} should load generated GOV.UK Frontend CSS`);
	assert.match(page, /<html class="govuk-template" lang="en">/, `${path} should use the GOV.UK template class`);
	assert.match(page, /class="govuk-template__body"/, `${path} should use GOV.UK template body class`);
	assert.match(page, /\/components\/layout\.js/, `${path} should load the shared x-include loader`);
	assert.match(page, /\/js\/govuk-frontend-init\.js/, `${path} should load GOV.UK Frontend initialisation`);
	assert.match(page, /<x-include src="\/partials\/header\.html"/, `${path} should include shared GOV.UK header chrome`);
	assert.match(page, /<x-include src="\/partials\/footer\.html"><\/x-include>/, `${path} should include shared GOV.UK footer chrome`);
	for (const asset of legacyCloneAssets) {
		assert.equal(page.includes(asset), false, `${path} should not load legacy clone CSS asset ${asset}`);
	}
}

for (const path of [
	'public/assets/govuk/govuk-frontend.css',
	'public/assets/govuk/govuk-frontend.min.js',
	'public/assets/govuk/assets/fonts/light-94a07e06a1-v2.woff2',
	'public/assets/govuk/assets/fonts/bold-b542beb274-v2.woff2',
]) {
	assert.equal(fs.existsSync(path), true, `${path} should exist`);
}
