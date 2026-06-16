import assert from 'node:assert/strict';
import fs from 'node:fs';

const homeTemplate = fs.readFileSync('src/govuk/templates/pages/home.njk', 'utf8');
const homePage = fs.readFileSync('public/index.html', 'utf8');
const homeCss = fs.readFileSync('public/assets/researchops/researchops-home.css', 'utf8');

assert.match(
	homeTemplate,
	/class="govuk-grid-column-two-thirds researchops-home-hero__content-column"/
);
assert.match(homePage, /class="govuk-grid-column-two-thirds researchops-home-hero__content-column"/);
assert.match(homePage, /class="govuk-grid-column-one-third researchops-home-hero__image-column"/);
assert.match(homePage, /class="researchops-home-hero__image"/);

assert.match(
	homeCss,
	/@media \(min-width: 40\.0625em\) \{[\s\S]*?\.researchops-home-hero__content-column \{[\s\S]*?width: 55%;[\s\S]*?\.researchops-home-hero__image-column \{[\s\S]*?width: 45%;[\s\S]*?padding-right: 0;[\s\S]*?padding-left: 0;/
);
assert.match(
	homeCss,
	/\.researchops-home-hero__image \{[\s\S]*?width: 100%;[\s\S]*?max-width: 100%;[\s\S]*?height: auto;/
);
