import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const packageLock = fs.readFileSync('package-lock.json', 'utf8');
const sassEntry = fs.readFileSync('src/styles/govuk.scss', 'utf8');
const generatedCss = fs.readFileSync('public/assets/govuk/govuk-frontend.css', 'utf8');
const generatedHomeCss = fs.readFileSync('public/assets/researchops/researchops-home.css', 'utf8');
const homeSassEntry = fs.readFileSync('src/styles/researchops-home.scss', 'utf8');
const copyScript = fs.readFileSync('scripts/govuk/copy-govuk-assets.mjs', 'utf8');
const renderScript = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');
const initScript = fs.readFileSync('public/js/govuk-frontend-init.js', 'utf8');
const layoutTemplate = fs.readFileSync('src/govuk/templates/layouts/researchops.njk', 'utf8');
const homeTemplate = fs.readFileSync('src/govuk/templates/pages/home.njk', 'utf8');
const sharedHeader = fs.readFileSync('public/partials/header.html', 'utf8');
const sharedFooter = fs.readFileSync('public/partials/footer.html', 'utf8');
const sharedLayoutLoader = fs.readFileSync('public/components/layout.js', 'utf8');
const sharedHead = fs.readFileSync('public/partials/html-head.html', 'utf8');
const renderedHomePage = fs.readFileSync('public/index.html', 'utf8');

const representativePages = [
	'public/index.html',
	'public/pages/account/index.html',
	'public/pages/projects/index.html',
	'public/pages/start/overview/index.html',
];

const customCssAssets = [
	'/css/govuk/govuk-typography.css',
	'/css/govuk/govuk-colours.css',
	'/css/govuk/govuk-page-chrome.css',
	'/css/govuk/govuk-buttons.css',
	'/css/govuk/govuk-forms.css',
	'/css/govuk/govuk-frontend-v6.css',
	'/css/govuk/govuk-header-service-brand.css',
	'/css/govuk/govuk-main-content-focus.css',
	'/css/screen.css',
	'/css/home-lifecycle.css',
];

assert.equal(packageJson.dependencies['govuk-frontend'], '^6.0.0');
assert.equal(packageJson.devDependencies.sass, '^1.94.2');
assert.equal(packageJson.devDependencies.nunjucks, '^3.2.4');
assert.equal(packageJson.scripts.build, 'npm run build:govuk && npm run build:researchops && npm run build:govuk-pages');
assert.equal(
	packageJson.scripts['build:govuk'],
	'sass --load-path=node_modules --no-source-map --style=compressed src/styles/govuk.scss public/assets/govuk/govuk-frontend.css && node scripts/govuk/copy-govuk-assets.mjs',
);
assert.equal(
	packageJson.scripts['build:researchops'],
	'sass --load-path=node_modules --no-source-map --style=compressed src/styles/researchops-home.scss public/assets/researchops/researchops-home.css',
);
assert.equal(packageJson.scripts['build:govuk-pages'], 'node scripts/govuk/render-govuk-pages.mjs');
assert.match(packageLock, /"govuk-frontend": "\^6\.0\.0"/);
assert.match(packageLock, /"nunjucks": "\^3\.2\.4"/);
assert.match(packageLock, /"node_modules\/govuk-frontend"/);
assert.match(packageLock, /"version": "6\.1\.0"/);

assert.match(sassEntry, /\$govuk-page-width: 1020px;/);
assert.match(sassEntry, /@import ['"]govuk-frontend\/dist\/govuk['"];/);
assert.match(generatedCss, /\.govuk-width-container\{max-width:1020px/);
assert.match(homeSassEntry, /\.researchops-step-grid/);
assert.match(homeSassEntry, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
assert.match(homeSassEntry, /\.researchops-next-actions/);
assert.match(homeSassEntry, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
assert.match(homeSassEntry, /\.researchops-next-action:not\(:last-child\) \{/);
assert.match(homeSassEntry, /border-right: 1px solid govuk-colour\('mid-grey'\);/);
assert.match(generatedHomeCss, /\.researchops-step-grid/);
assert.match(generatedHomeCss, /\.researchops-step-grid\{[^}]*grid-template-columns:repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
assert.match(generatedHomeCss, /\.researchops-next-actions/);
assert.match(generatedHomeCss, /\.researchops-next-actions\{[^}]*grid-template-columns:repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
assert.match(generatedHomeCss, /\.researchops-next-action:not\(:last-child\)\{border-right:1px solid #cecece\}/);
assert.match(copyScript, /node_modules\/govuk-frontend\/dist\/govuk/);
assert.match(copyScript, /public\/assets\/govuk/);
assert.match(copyScript, /govuk-frontend\.min\.js/);
assert.match(renderScript, /new nunjucks\.Environment/);
assert.match(renderScript, /node_modules\/govuk-frontend\/dist/);
assert.match(renderScript, /pages\/home\.njk/);
assert.match(renderScript, /pages\/account\.njk/);
assert.match(renderScript, /pages\/start-overview\.njk/);
assert.match(renderScript, /activeNavigation: 'Home'/);
assert.match(renderScript, /activeNavigation: 'Start Research Project'/);
assert.match(initScript, /import \{ initAll \} from '\/assets\/govuk\/govuk-frontend\.min\.js';/);
assert.match(initScript, /initAll\(\{ scope \}\);/);
assert.match(initScript, /x-include:loaded/);

assert.match(layoutTemplate, /\/components\/layout\.js/);
assert.match(layoutTemplate, /<x-include src="\/partials\/header\.html"/);
assert.match(layoutTemplate, /<x-include src="\/partials\/footer\.html"><\/x-include>/);
assert.match(layoutTemplate, /activeNavigation \| default/);
assert.doesNotMatch(layoutTemplate, /\/components\/govuk-layout\.js/);
assert.doesNotMatch(layoutTemplate, /govuk\/components\/header\/macro\.njk/);
assert.doesNotMatch(layoutTemplate, /govuk\/components\/footer\/macro\.njk/);
assert.match(homeTemplate, /govuk\/components\/button\/macro\.njk/);
assert.match(homeTemplate, /govuk\/components\/tag\/macro\.njk/);
assert.match(homeTemplate, /assets\/researchops\/researchops-home\.css\?v=govuk-home-grid-20260524/);
assert.match(homeTemplate, /researchops-step-card/);
assert.match(homeTemplate, /researchops-next-actions/);

assert.match(renderedHomePage, /assets\/researchops\/researchops-home\.css\?v=govuk-home-grid-20260524/);
assert.match(renderedHomePage, /class="researchops-step-grid"/);
assert.match(renderedHomePage, /class="researchops-next-actions"/);
assert.match(renderedHomePage, /class="researchops-next-action"/);

assert.match(sharedHead, /\/assets\/govuk\/govuk-frontend\.css/);
assert.match(sharedHead, /\/css\/govuk\/govuk-frontend-v6\.css/);
assert.match(sharedHeader, /class="govuk-skip-link" href="#main-content"/);
assert.match(sharedHeader, /class="govuk-header"/);
assert.match(sharedHeader, /govuk-header__product-name/);
assert.match(sharedHeader, /ResearchOps Demo Suite/);
assert.match(sharedHeader, /researchops-header__crown/);
assert.match(sharedHeader, /researchops-header__wordmark">GOV\.UK</);
assert.match(sharedHeader, /aria-label="GOV\.UK ResearchOps Demo Suite home"/);
assert.doesNotMatch(sharedHeader, /<text\b[^>]*>GOV\.UK<\/text>/);
assert.match(sharedHeader, /class="govuk-service-navigation"/);
assert.match(sharedHeader, /data-active="\{\{active\}\}"/);
assert.match(sharedHeader, /govuk-phase-banner/);
assert.match(sharedHeader, /\/css\/govuk\/govuk-header-service-brand\.css/);
assert.match(sharedHeader, /\/css\/govuk\/govuk-main-content-focus\.css/);
assert.match(sharedHeader, /ensurePageChromeStylesheet/);
assert.match(sharedHeader, /ensureMainContentTarget/);
assert.match(sharedFooter, /class="govuk-footer"/);
assert.match(sharedFooter, /class="govuk-width-container govuk-footer__container"/);
assert.match(sharedFooter, /govuk-footer__meta/);
assert.match(sharedFooter, /aria-hidden="true"/);
assert.match(sharedFooter, /Open Government Licence v3\.0/);
assert.match(sharedLayoutLoader, /class XInclude extends HTMLElement/);
assert.match(sharedLayoutLoader, /customElements\.define\("x-include", XInclude\)/);
assert.match(sharedLayoutLoader, /x-include:loaded/);
assert.match(sharedLayoutLoader, /GOVUK_FRONTEND_V6_STYLESHEET/);
assert.match(sharedLayoutLoader, /ensureGovukFrontendV6Stylesheet/);

for (const path of representativePages) {
	const page = fs.readFileSync(path, 'utf8');
	assert.match(page, /\/assets\/govuk\/govuk-frontend\.css/, `${path} should load generated GOV.UK Frontend CSS`);
	assert.match(page, /<html class="govuk-template" lang="en">/, `${path} should use the GOV.UK template class`);
	assert.match(page, /class="govuk-template__body"/, `${path} should use GOV.UK template body class`);
	assert.match(page, /govuk-frontend-supported/, `${path} should include GOV.UK Frontend support snippet`);
	assert.match(page, /\/components\/layout\.js/, `${path} should load the shared x-include loader`);
	assert.match(page, /\/js\/govuk-frontend-init\.js/, `${path} should load GOV.UK Frontend initialisation`);
	assert.match(page, /<x-include src="\/partials\/header\.html"/, `${path} should include shared GOV.UK header chrome`);
	assert.match(page, /<x-include src="\/partials\/footer\.html"><\/x-include>/, `${path} should include shared GOV.UK footer chrome`);
	assert.doesNotMatch(page, /<header class="govuk-header"/, `${path} should not hardcode the GOV.UK header`);
	assert.doesNotMatch(page, /<footer class="govuk-footer"/, `${path} should not hardcode the GOV.UK footer`);

	for (const customAsset of customCssAssets) {
		assert.equal(page.includes(customAsset), false, `${path} should not load custom GOV.UK clone CSS asset ${customAsset}`);
	}
}

for (const path of [
	'public/assets/govuk/govuk-frontend.css',
	'public/assets/govuk/govuk-frontend.min.js',
	'public/assets/researchops/researchops-home.css',
	'public/assets/govuk/assets/fonts/light-94a07e06a1-v2.woff2',
	'public/assets/govuk/assets/fonts/bold-b542beb274-v2.woff2',
	'public/assets/govuk/assets/manifest.json',
	'public/assets/govuk/assets/rebrand/manifest.json',
]) {
	assert.equal(fs.existsSync(path), true, `${path} should exist`);
}
