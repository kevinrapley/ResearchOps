import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = {
	template: fs.readFileSync('src/govuk/templates/pages/home.njk', 'utf8'),
	renderPages: fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8'),
	styles: fs.readFileSync('src/styles/researchops-home.scss', 'utf8'),
	publicHtml: fs.readFileSync('public/index.html', 'utf8'),
	publicCss: fs.readFileSync('public/assets/researchops/researchops-home.css', 'utf8'),
	previewCss: fs.readFileSync('assets/researchops/researchops-home.css', 'utf8'),
};

function has(source, text, label) {
	assert.equal(source.includes(text), true, `${label} should include ${text}`);
}

function lacks(source, text, label) {
	assert.equal(source.includes(text), false, `${label} should not include ${text}`);
}

has(files.template, '{% from "govuk/components/breadcrumbs/macro.njk" import govukBreadcrumbs %}', 'home template');
has(files.template, '<div class="app-masthead researchops-home-masthead">', 'home template');
has(files.template, 'id: "home-breadcrumbs"', 'home template');
has(files.template, '<section class="researchops-home-hero" aria-labelledby="home-title">', 'home template');
has(files.template, 'Objective orientated applied user research done well.', 'home template');
lacks(files.template, 'repository-masthead', 'home template');

has(files.renderPages, "bodyClass: 'researchops-home-front-page'", 'GOV.UK page renderer');
has(files.renderPages, "activeNavigation: 'Home'", 'GOV.UK page renderer');

has(files.styles, '.researchops-home-front-page', 'home stylesheet');
has(files.styles, ".govuk-service-navigation[data-active='Home']", 'home stylesheet');
has(files.styles, '.govuk-phase-banner .govuk-tag', 'home stylesheet');
has(files.styles, '.researchops-home-masthead', 'home stylesheet');
has(files.styles, '.researchops-home-masthead .govuk-breadcrumbs__link', 'home stylesheet');
has(files.styles, '.researchops-home-hero', 'home stylesheet');
lacks(files.styles, "data-active='Research Repository'", 'home stylesheet');

has(files.publicHtml, '<body class="govuk-template__body researchops-home-front-page">', 'rendered home page');
has(files.publicHtml, '<div class="app-masthead researchops-home-masthead">', 'rendered home page');
has(files.publicHtml, 'id="home-breadcrumbs"', 'rendered home page');
has(files.publicHtml, '<section class="researchops-home-hero" aria-labelledby="home-title">', 'rendered home page');
has(files.publicHtml, 'href="/assets/researchops/researchops-home.css?v=home-masthead-20260608"', 'rendered home page');

for (const [label, source] of [
	['public home CSS', files.publicCss],
	['preview home CSS', files.previewCss],
]) {
	has(source, '.researchops-home-front-page', label);
	has(source, '.researchops-home-masthead', label);
	has(source, '.researchops-home-hero', label);
	has(source, 'data-active', label);
	has(source, 'Home', label);
}
