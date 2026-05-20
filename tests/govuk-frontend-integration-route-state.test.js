import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const packageLock = fs.readFileSync('package-lock.json', 'utf8');
const sassEntry = fs.readFileSync('src/styles/govuk.scss', 'utf8');
const copyScript = fs.readFileSync('scripts/govuk/copy-govuk-assets.mjs', 'utf8');
const initScript = fs.readFileSync('public/js/govuk-frontend-init.js', 'utf8');
const headerPartial = fs.readFileSync('public/partials/header.html', 'utf8');

const representativePages = [
	'public/index.html',
	'public/pages/account/index.html',
	'public/pages/start/overview/index.html',
	'public/partials/html-head.html',
];

const representativeFullPages = representativePages.filter((pagePath) => pagePath !== 'public/partials/html-head.html');

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
assert.equal(
	packageJson.scripts['build:govuk'],
	'sass --load-path=node_modules --no-source-map --style=compressed src/styles/govuk.scss public/assets/govuk/govuk-frontend.css && node scripts/govuk/copy-govuk-assets.mjs',
);
assert.match(packageLock, /"govuk-frontend": "\^6\.0\.0"/);
assert.match(packageLock, /"node_modules\/govuk-frontend"/);
assert.match(packageLock, /"version": "6\.1\.0"/);

assert.match(sassEntry, /@import ['"]govuk-frontend\/dist\/govuk['"];/);
assert.match(copyScript, /node_modules\/govuk-frontend\/dist\/govuk/);
assert.match(copyScript, /public\/assets\/govuk/);
assert.match(copyScript, /govuk-frontend\.min\.js/);
assert.match(initScript, /import \{ initAll \} from '\/assets\/govuk\/govuk-frontend\.min\.js';/);
assert.match(initScript, /initAll\(\{ scope \}\);/);
assert.match(initScript, /x-include:loaded/);

for (const path of representativePages) {
	const page = fs.readFileSync(path, 'utf8');
	assert.match(page, /\/assets\/govuk\/govuk-frontend\.css/, `${path} should load generated GOV.UK Frontend CSS`);

	for (const customAsset of customCssAssets) {
		assert.equal(page.includes(customAsset), false, `${path} should not load custom GOV.UK clone CSS asset ${customAsset}`);
	}
}

for (const path of representativeFullPages) {
	const page = fs.readFileSync(path, 'utf8');
	assert.match(page, /<html class="govuk-template" lang="en">/, `${path} should use the GOV.UK template class`);
	assert.match(page, /class="govuk-template__body"/, `${path} should use GOV.UK template body class`);
	assert.match(page, /govuk-frontend-supported/, `${path} should include GOV.UK Frontend support snippet`);
	assert.match(page, /\/js\/govuk-frontend-init\.js/, `${path} should initialise GOV.UK Frontend JavaScript`);
}

assert.equal(headerPartial.includes('/css/govuk/govuk-header-service-brand.css'), false);
assert.equal(headerPartial.includes('/css/govuk/govuk-main-content-focus.css'), false);
assert.equal(headerPartial.includes('govuk-header__homepage-link'), false);
assert.match(headerPartial, /govuk-header__content/);
assert.match(headerPartial, /govuk-header__service-name/);

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
