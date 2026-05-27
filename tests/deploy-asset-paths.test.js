import assert from 'node:assert/strict';
import fs from 'node:fs';

const requiredPreviewAssetPaths = [
	'assets/researchops/researchops-home.css',
	'public/assets/researchops/researchops-home.css',
	'public/assets/govuk/govuk-frontend.css',
	'public/assets/govuk/govuk-frontend.min.js',
	'public/assets/govuk/assets/fonts/light-94a07e06a1-v2.woff2',
	'public/assets/govuk/assets/fonts/bold-b542beb274-v2.woff2',
	'public/assets/govuk/assets/fonts/light-f591b13f7d-v2.woff',
	'public/assets/govuk/assets/fonts/bold-affa96571d-v2.woff',
	'public/assets/govuk/assets/images/govuk-crest.svg',
	'public/css/govuk/govuk-typography.css',
	'public/_redirects',
];

for (const assetPath of requiredPreviewAssetPaths) {
	assert.equal(fs.existsSync(assetPath), true, `${assetPath} should exist for preview deployment`);
}

const topLevelHomeCss = fs.readFileSync('assets/researchops/researchops-home.css', 'utf8');
const publicHomeCss = fs.readFileSync('public/assets/researchops/researchops-home.css', 'utf8');
const govukFrontendCss = fs.readFileSync('public/assets/govuk/govuk-frontend.css', 'utf8');
const footerPartial = fs.readFileSync('public/partials/footer.html', 'utf8');
const legacyTypographyCss = fs.readFileSync('public/css/govuk/govuk-typography.css', 'utf8');
const redirects = fs.readFileSync('public/_redirects', 'utf8');

const requiredGovukFrontendSelectors = [
	'.govuk-width-container',
	'.govuk-main-wrapper',
	'.govuk-grid-row',
	'.govuk-header',
	'.govuk-service-navigation',
	'.govuk-phase-banner',
	'.govuk-footer',
	'.govuk-summary-card',
	'.govuk-details',
];

assert.equal(topLevelHomeCss, publicHomeCss.endsWith('\n') ? publicHomeCss : `${publicHomeCss}\n`);
assert.match(topLevelHomeCss, /grid-template-columns:repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
assert.match(topLevelHomeCss, /grid-template-columns:repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
assert.match(
	topLevelHomeCss,
	/\.researchops-next-action:not\(:last-child\)\{border-right:1px solid #cecece\}/
);
assert.doesNotMatch(
	govukFrontendCss,
	/Can't find stylesheet to import|src\/styles\/govuk\.scss|body::before/
);
assert.match(govukFrontendCss, /--govuk-frontend-version:\s*"6\./);

for (const selector of requiredGovukFrontendSelectors) {
	assert.ok(
		govukFrontendCss.includes(selector),
		`${selector} should exist in the GOV.UK frontend CSS asset`
	);
}

assert.ok(
	footerPartial.includes('class="govuk-width-container govuk-footer__container"'),
	'shared footer should keep the width-constrained GOV.UK footer container contract'
);
assert.match(legacyTypographyCss, /^@import url\('\/assets\/govuk\/govuk-frontend\.css'\);/);
assert.match(redirects, /\/assets\/fonts\/\*\s+\/assets\/govuk\/assets\/fonts\/:splat\s+200/);
assert.match(
	redirects,
	/\/assets\/images\/govuk-crest\.svg\s+\/assets\/govuk\/assets\/images\/govuk-crest\.svg\s+200/
);
