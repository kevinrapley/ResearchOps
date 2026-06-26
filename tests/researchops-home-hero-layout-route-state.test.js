import assert from 'node:assert/strict';
import fs from 'node:fs';

const homeTemplate = fs.readFileSync('src/govuk/templates/pages/home.njk', 'utf8');
const homePage = fs.readFileSync('public/index.html', 'utf8');
const homeCss = fs.readFileSync('public/assets/researchops/researchops-home.css', 'utf8');
const explainerScript = fs.readFileSync('public/js/researchops-explainer-animation.js', 'utf8');

assert.match(
	homeTemplate,
	/class="govuk-grid-column-two-thirds researchops-home-hero__content-column"/
);
assert.match(homePage, /class="govuk-grid-column-two-thirds researchops-home-hero__content-column"/);
assert.match(homePage, /class="govuk-grid-column-one-third researchops-home-hero__image-column"/);
assert.match(homePage, /class="researchops-explainer" data-researchops-explainer/);
assert.match(homePage, /data-svg="\/images\/home-masthead-researchops-illustration\.svg"/);
assert.match(homePage, /src="\/audio\/researchops-explainer\.m4a"/);
assert.match(homePage, /Text alternative for audio explainer/);
assert.match(homePage, /ResearchOps helps public service teams plan, run and reuse user research/);
assert.match(homePage, /researchops-home\.css\?v=home-phase-banner-contained-20260626/);
assert.match(homeTemplate, /researchops-home\.css\?v=home-phase-banner-contained-20260626/);

assert.match(
	homeCss,
	/@media \(min-width: 40\.0625em\) \{[\s\S]*?\.researchops-home-hero__content-column \{[\s\S]*?width: 55%;[\s\S]*?\.researchops-home-hero__image-column \{[\s\S]*?width: 45%;[\s\S]*?padding-right: 0;[\s\S]*?padding-left: 0;/
);
assert.match(
	homeCss,
	/\.researchops-explainer \{[\s\S]*?aspect-ratio: 1700\/950;[\s\S]*?overflow: visible;/
);
assert.doesNotMatch(homeCss, /\.researchops-explainer \{[\s\S]*?background: #732282;/);
assert.match(
	homeCss,
	/\.researchops-explainer-transcript \.govuk-details__summary[\s\S]*?color: #ffffff;/
);
assert.match(
	homeCss,
	/\.researchops-home-front-page \.govuk-phase-banner \{[\s\S]*?border-bottom: 0;[\s\S]*?padding-bottom: 0;/
);
assert.match(
	homeCss,
	/\.researchops-home-front-page \.govuk-phase-banner__content \{[\s\S]*?align-items: baseline;[\s\S]*?width: 100%;[\s\S]*?padding-bottom: 10px;[\s\S]*?border-bottom: 1px solid rgba\(255, 255, 255, 0\.35\);/
);
assert.match(explainerScript, /prefersReducedMotion/);
assert.match(explainerScript, /prefers-reduced-motion: reduce/);
