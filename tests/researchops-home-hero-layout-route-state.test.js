import assert from 'node:assert/strict';
import fs from 'node:fs';
import { publishedGovukPage } from './helpers/published-govuk-pages.mjs';

const homeTemplate = fs.readFileSync('src/govuk/templates/pages/home.njk', 'utf8');
const homePage = await publishedGovukPage('public/index.html');
const homeStyles = fs.readFileSync('src/styles/researchops-home.scss', 'utf8');
const heroStyles = fs.readFileSync('src/styles/_hero-phase-banner.scss', 'utf8');
const homeCss = fs.readFileSync('public/assets/researchops/researchops-home.css', 'utf8');
const homeOfficeBrandCss = fs.readFileSync('public/css/brands/home-office.css', 'utf8');
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
assert.match(homePage, /researchops-home\.css\?v=home-phase-banner-seam-20260626/);
assert.match(homeTemplate, /researchops-home\.css\?v=home-phase-banner-seam-20260626/);
assert.match(homeStyles, /@use 'hero-phase-banner' as hero;/);
assert.match(homeStyles, /@include hero\.researchops-hero-page\('\.researchops-home-front-page', 'Home'\);/);
assert.match(heroStyles, /@mixin researchops-hero-page\(\$page-selector, \$active-nav\)/);

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
	/\.researchops-home-front-page \.govuk-template__header \.govuk-service-navigation\[data-active=Home\] \{[\s\S]*?border-top: 1px solid rgba\(255, 255, 255, 0\.35\);[\s\S]*?border-bottom: 1px solid rgba\(255, 255, 255, 0\.35\);/
);
assert.match(
	homeOfficeBrandCss,
	/html\[data-researchops-brand=home-office\] \.govuk-header \{[\s\S]*?border-bottom: 4px solid #732282;/
);
assert.doesNotMatch(
	homeOfficeBrandCss,
	/html\[data-researchops-brand=home-office\] \.researchops-home-front-page \.govuk-header/
);
assert.match(
	homeCss,
	/\.researchops-home-front-page \.govuk-phase-banner \{[\s\S]*?border-bottom: 0;[\s\S]*?padding-bottom: 0;[\s\S]*?clip-path: inset\(0 -100vmax -1px\);/
);
assert.match(
	homeCss,
	/\.researchops-home-front-page \.govuk-phase-banner__content \{[\s\S]*?align-items: baseline;[\s\S]*?width: 100%;[\s\S]*?padding-bottom: 10px;[\s\S]*?border-bottom: 1px solid rgba\(255, 255, 255, 0\.35\);/
);
assert.match(explainerScript, /prefersReducedMotion/);
assert.match(explainerScript, /prefers-reduced-motion: reduce/);
