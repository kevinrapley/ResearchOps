import assert from 'node:assert/strict';
import fs from 'node:fs';

const pageSource = fs.readFileSync('public/pages/projects/outcomes/index.html', 'utf8');
const templateSource = fs.readFileSync('src/govuk/templates/pages/projects-outcomes.njk', 'utf8');
const stylesheetSource = fs.readFileSync('public/css/outcomes.css', 'utf8');
const stylesheetScssSource = fs.readFileSync('src/styles/outcomes.scss', 'utf8');
const packageSource = fs.readFileSync('package.json', 'utf8');
const generatedCssTargetsSource = fs.readFileSync('scripts/styles/generated-css-targets.mjs', 'utf8');
const controllerSource = fs.readFileSync('public/js/outcomes-page.js', 'utf8');
const impactTrackerSource = fs.readFileSync('public/components/impact-tracker.js', 'utf8');
const rendererSource = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, 'href="/assets/govuk/govuk-frontend.css"', 'outcomes page');
includes(pageSource, 'href="/css/outcomes.css?v=20260603-form-interactions"', 'outcomes page');
includes(pageSource, 'rel="modulepreload" href="/js/outcomes-page.js?v=20260603-form-interactions"', 'outcomes page');
includes(pageSource, 'src="/components/layout.js" defer', 'outcomes page');
includes(pageSource, 'src="/components/impact-tracker.js?v=20260603-form-interactions"', 'outcomes page');
includes(pageSource, 'src="/js/outcomes-page.js?v=20260603-form-interactions"', 'outcomes page');
includes(pageSource, 'class="outcomes-hero"', 'outcomes page');
includes(pageSource, 'class="outcomes-tracker"', 'outcomes page');
includes(pageSource, 'class="outcomes-form"', 'outcomes page');
includes(pageSource, 'class="outcomes-table-wrap"', 'outcomes page');
includes(pageSource, 'class="govuk-table govuk-!-margin-top-6 outcomes-table"', 'outcomes page');
includes(pageSource, 'id="impact-tracker"', 'outcomes page');
includes(pageSource, 'id="impact-form"', 'outcomes page');
includes(pageSource, 'id="impact-insightId"', 'outcomes page');
includes(pageSource, 'id="impact-error-summary"', 'outcomes page');
includes(pageSource, 'id="impact-submit"', 'outcomes page');
includes(pageSource, 'id="impact-table"', 'outcomes page');
excludes(pageSource, 'href="/css/screen.css"', 'outcomes page');
excludes(pageSource, 'href="/css/govuk/govuk-forms.css"', 'outcomes page');
excludes(pageSource, 'class="dashboard-hero outcomes-hero"', 'outcomes page');
excludes(pageSource, 'class="govuk-form-group outcomes-form"', 'outcomes page');
excludes(pageSource, 'class="govuk-button outcomes-actions"', 'outcomes page');
excludes(pageSource, 'id="back-to-project"', 'outcomes page');
excludes(pageSource, 'data-api-origin="https://rops-api.digikev-kevin-rapley.workers.dev"', 'outcomes page');
excludes(pageSource, '<script type="module">', 'outcomes page');
excludes(pageSource, 'Math.random().toString(36)', 'outcomes page');

includes(templateSource, 'govukTable({', 'outcomes template');
includes(templateSource, 'govukErrorSummary({', 'outcomes template');
includes(templateSource, 'govukRadios({', 'outcomes template');
includes(templateSource, 'govukDateInput({', 'outcomes template');
includes(templateSource, 'id: "impact-table"', 'outcomes template');
excludes(templateSource, '<table id="impact-table"', 'outcomes template');
excludes(templateSource, 'govukSelect({', 'outcomes template');

includes(stylesheetScssSource, '.outcomes-form-layout', 'outcomes SCSS source');
includes(stylesheetScssSource, '.outcomes-guidance-panel', 'outcomes SCSS source');
includes(stylesheetScssSource, '.impact-record-action-cell', 'outcomes SCSS source');
includes(stylesheetScssSource, '.govuk-date-input', 'outcomes SCSS source');
includes(stylesheetScssSource, '/* transparency begins in the cascade */', 'outcomes SCSS source');
includes(packageSource, 'build:outcomes', 'package build scripts');
includes(packageSource, 'node scripts/styles/build-generated-css.mjs public/css/outcomes.css', 'package build scripts');
includes(generatedCssTargetsSource, "source: 'src/styles/outcomes.scss'", 'generated CSS targets');
includes(generatedCssTargetsSource, "output: 'public/css/outcomes.css'", 'generated CSS targets');

includes(stylesheetSource, '.outcomes-hero', 'outcomes stylesheet');
includes(stylesheetSource, '.outcomes-tracker', 'outcomes stylesheet');
includes(stylesheetSource, '.outcomes-form', 'outcomes stylesheet');
includes(stylesheetSource, '.outcomes-guidance-panel', 'outcomes stylesheet');
includes(stylesheetSource, '.outcomes-table-wrap', 'outcomes stylesheet');
includes(stylesheetSource, '.impact-record-action-cell', 'outcomes stylesheet');
includes(stylesheetSource, '/* transparency begins in the cascade */', 'outcomes stylesheet');

includes(rendererSource, 'outcomesScriptVersion', 'GOV.UK renderer');
includes(rendererSource, 'cacheBustOutcomesPageScripts', 'GOV.UK renderer');
includes(rendererSource, '20260603-form-interactions', 'GOV.UK renderer');

includes(controllerSource, 'function initOutcomesPage', 'outcomes controller');
includes(controllerSource, 'URLSearchParams', 'outcomes controller');
includes(controllerSource, 'impact-tracker', 'outcomes controller');
includes(controllerSource, 'breadcrumb-project', 'outcomes controller');
includes(controllerSource, 'data-guidance-key', 'outcomes controller');
includes(controllerSource, 'showValidationErrors', 'outcomes controller');
includes(controllerSource, 'clearDynamicErrorDescriptions', 'outcomes controller');
includes(controllerSource, 'setAttribute(\'novalidate\'', 'outcomes controller');
includes(controllerSource, 'removeAttribute(\'required\')', 'outcomes controller');
excludes(controllerSource, 'alert(', 'outcomes controller');

includes(impactTrackerSource, 'impact-form', 'impact tracker component');
includes(impactTrackerSource, 'impact-table', 'impact tracker component');
includes(impactTrackerSource, 'impact-error-summary', 'impact tracker component');
includes(impactTrackerSource, 'IMPCT-RCD', 'impact tracker reference format');
includes(impactTrackerSource, 'colspan="7"', 'impact tracker action row');
includes(impactTrackerSource, 'data-impact-edit', 'impact tracker edit action');
includes(impactTrackerSource, 'data-impact-confirm-delete', 'impact tracker delete confirmation');
includes(impactTrackerSource, 'method: isUpdate ? "PATCH" : "POST"', 'impact tracker update endpoint');
includes(impactTrackerSource, 'method: "DELETE"', 'impact tracker delete endpoint');
excludes(impactTrackerSource, 'window.confirm', 'impact tracker component');
excludes(impactTrackerSource, 'alert("Metric name is required")', 'impact tracker component');
