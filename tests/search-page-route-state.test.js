import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/search/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/search.njk", "utf8");
const controllerSource = fs.readFileSync("public/js/search-page.js", "utf8");
const stylesheetSource = fs.readFileSync("public/css/search.css", "utf8");
const rendererSource = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");
const generatedCssTargetsSource = fs.readFileSync("scripts/styles/generated-css-targets.mjs", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "rel=\"modulepreload\" href=\"/js/search-page.js\"", "search page");
includes(pageSource, "src=\"/js/search-page.js\"", "search page");
includes(pageSource, "src=\"/components/layout.js", "search page");
includes(pageSource, "src=\"/js/govuk-frontend-init.js", "search page");
includes(pageSource, "href=\"/assets/govuk/govuk-frontend.css\"", "search page");
includes(pageSource, "href=\"/css/search.css\"", "search page");
includes(pageSource, "class=\"govuk-width-container researchops-utility-page researchops-search-page\"", "search page");
includes(pageSource, "id=\"search-results-section\"", "search page");
includes(pageSource, "aria-labelledby=\"search-results-title\"", "search page");
assert.match(pageSource, /id="search-results-section"[\s\S]*?hidden/, "Search results section is hidden initially");
includes(pageSource, "search-results", "search page");
includes(pageSource, "class=\"govuk-form-group\"", "search page");
includes(pageSource, "class=\"govuk-select\"", "search page");
includes(pageSource, "id=\"q\"", "search page");
includes(pageSource, "id=\"type\"", "search page");
includes(pageSource, "id=\"go\"", "search page");
includes(pageSource, "id=\"results\"", "search page");
excludes(pageSource, "href=\"/css/screen.css\"", "search page");
excludes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "search page");
excludes(pageSource, "href=\"/css/govuk/govuk-forms.css\"", "search page");
excludes(pageSource, "class=\"card search-panel\"", "search page");
excludes(pageSource, "class=\"search-controls\"", "search page");
excludes(pageSource, "class=\"govuk-label search-type-label\"", "search page");
excludes(pageSource, "class=\"govuk-body search-type-label\"", "search page");
excludes(pageSource, "<script type=\"module\">", "search page");
excludes(pageSource, "../src/sdk/researchops_sdk_v1.0.0.js", "search page");
excludes(pageSource, "./scripts/shared.js", "search page");

includes(templateSource, "{% extends \"layouts/researchops.njk\" %}", "search template");
includes(templateSource, "govuk/components/input/macro.njk", "search template");
includes(templateSource, "govuk/components/select/macro.njk", "search template");
includes(templateSource, "govuk/components/button/macro.njk", "search template");
includes(templateSource, "govukInput({", "search template");
includes(templateSource, "govukSelect({", "search template");
includes(templateSource, "govukButton({", "search template");
excludes(templateSource, "SourcebookGate(sourcebookGate)", "search template");
excludes(templateSource, "SourcebookContext(sourcebookContext)", "search template");
excludes(templateSource, "SourcebookEvidenceLedger(sourcebookEvidenceLedger)", "search template");
includes(rendererSource, "template: 'pages/search.njk'", "GOV.UK page renderer");
includes(rendererSource, "output: 'public/pages/search/index.html'", "GOV.UK page renderer");
includes(generatedCssTargetsSource, "name: 'Search utility route stylesheet'", "generated CSS targets");
includes(generatedCssTargetsSource, "source: 'src/styles/researchops-utility-pages.scss'", "generated CSS targets");
includes(generatedCssTargetsSource, "output: 'public/css/search.css'", "generated CSS targets");

includes(controllerSource, "function readStoredEntities", "search page controller");
includes(controllerSource, "function searchEntities", "search page controller");
includes(controllerSource, "function renderItem", "search page controller");
includes(controllerSource, "function runSearch", "search page controller");
includes(controllerSource, "search-form", "search page controller");
includes(controllerSource, "searchForm?.addEventListener(\"submit\"", "search page controller");
includes(controllerSource, "event.preventDefault();", "search page controller");
includes(controllerSource, "search-results-section", "search page controller");
includes(controllerSource, "resultsSection.hidden = false", "search page controller");
includes(controllerSource, "localStorage", "search page controller");
includes(controllerSource, "window.__ropsSearch", "search page controller");
includes(controllerSource, "govuk-summary-card", "search page controller");
includes(controllerSource, "govuk-tag", "search page controller");
includes(controllerSource, "govuk-details", "search page controller");

includes(stylesheetSource, "Repo:       /src/styles/researchops-utility-pages.scss", "search stylesheet");
includes(stylesheetSource, ".researchops-utility-page__section", "search stylesheet");
includes(stylesheetSource, ".researchops-utility-page__form-row", "search stylesheet");
includes(stylesheetSource, "align-items: end", "search stylesheet");
includes(stylesheetSource, ".researchops-utility-page__results", "search stylesheet");
includes(stylesheetSource, ".researchops-utility-page__raw", "search stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "search stylesheet");
excludes(stylesheetSource, ".search-panel", "search stylesheet");
excludes(stylesheetSource, ".search-type-label", "search stylesheet");
