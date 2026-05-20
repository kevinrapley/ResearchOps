import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const packageLock = fs.readFileSync('package-lock.json', 'utf8');
const sassEntry = fs.readFileSync('src/styles/govuk.scss', 'utf8');
const copyScript = fs.readFileSync('scripts/govuk/copy-govuk-assets.mjs', 'utf8');
const renderScript = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');
const initScript = fs.readFileSync('public/js/govuk-frontend-init.js', 'utf8');
const layoutTemplate = fs.readFileSync('src/govuk/templates/layouts/researchops.njk', 'utf8');
const homeTemplate = fs.readFileSync('src/govuk/templates/pages/home.njk', 'utf8');

const representativePages = [
	'public/index.html',
	'public/pages/account/index.html',
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
assert.equal(packageJson.scripts.build, 'npm run build:govuk && npm run build:govuk-pages');
assert.equal(
	packageJson.scripts['build:govuk'],
	'sass --load-path=node_modules --no-source-map --style=compressed src/styles/govuk.scss public/assets/govuk/govuk-frontend.css && node scripts/govuk/copy-govuk-assets.mjs',
);
assert.equal(packageJson.scripts['build:govuk-pages'], 'node scripts/govuk/render-govuk-pages.mjs');
assert.match(packageLock, /"govuk-frontend": "\^6\.0\.0"/);
assert.match(packageLock, /"nunjucks": "\^3\.2\.4"/);
assert.match(packageLock, /"node_modules\/govuk-frontend"/);
assert.match(packageLock, /"version": "6\.1\.0"/);

assert.match(sassEntry, /@import ['"]govuk-frontend\/dist\/govuk['"];/);
assert.match(copyScript, /node_modules\/govuk-frontend\/dist\/govuk/);
assert.match(copyScript, /public\/assets\/govuk/);
assert.match(copyScript, /govuk-frontend\.min\.js/);
assert.match(renderScript, /new nunjucks\.Environment/);
assert.match(renderScript, /node_modules\/govuk-frontend\/dist/);
assert.match(renderScript, /pages\/home\.njk/);
assert.match(renderScript, /pages\/account\.njk/);
assert.match(renderScript, /pages\/start-overview\.njk/);
assert.match(initScript, /import \{ initAll \} from '\/assets\/govuk\/govuk-frontend\.min\.js';/);
assert.match(initScript, /initAll\(\{ scope \}\);/);
assert.match(initScript, /x-include:loaded/);

assert.match(layoutTemplate, /govuk\/components\/header\/macro\.njk/);
assert.match(layoutTemplate, /govukHeader\(\{/);
assert.match(layoutTemplate, /productName: serviceName/);
assert.match(layoutTemplate, /govuk\/components\/service-navigation\/macro\.njk/);
assert.match(layoutTemplate, /govukServiceNavigation\(\{/);
assert.match(layoutTemplate, /govuk\/components\/footer\/macro\.njk/);
assert.match(homeTemplate, /govuk\/components\/button\/macro\.njk/);
assert.match(homeTemplate, /govuk\/components\/tag\/macro\.njk/);

for (const path of representativePages) {
	const page = fs.readFileSync(path, 'utf8');
	assert.match(page, /\/assets\/govuk\/govuk-frontend\.css/, `${path} should load generated GOV.UK Frontend CSS`);
	assert.match(page, /<html class="govuk-template" lang="en">/, `${path} should use the GOV.UK template class`);
	assert.match(page, /class="govuk-template__body"/, `${path} should use GOV.UK template body class`);
	assert.match(page, /govuk-frontend-supported/, `${path} should include GOV.UK Frontend support snippet`);
	assert.match(page, /govuk-header__product-name/, `${path} should render GOV.UK header product name from the macro`);
	assert.match(page, /ResearchOps Demo Suite/, `${path} should render the ResearchOps service name`);
	assert.match(page, /govuk-service-navigation/, `${path} should render GOV.UK service navigation`);
	assert.match(page, /govuk-footer/, `${path} should render GOV.UK footer`);

	for (const customAsset of customCssAssets) {
		assert.equal(page.includes(customAsset), false, `${path} should not load custom GOV.UK clone CSS asset ${customAsset}`);
	}

	assert.equal(page.includes('<x-include'), false, `${path} should not use custom x-include page chrome`);
}

for (const path of [
	'public/assets/govuk/govuk-frontend.css',
	'public/assets/govuk/govuk-frontend.min.js',
	'public/assets/govuk/assets/fonts/light-94a07e06a1-v2.woff2',
	'public/assets/govuk/assets/fonts/bold-b542beb274-v2.woff2',
	'public/assets/govuk/assets/manifest.json',
	'public/assets/govuk/assets/rebrand/manifest.json',
]) {
	assert.equal(fs.existsSync(path), true, `${path} should exist`);
}
