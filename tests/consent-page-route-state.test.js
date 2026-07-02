import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/consent/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/consent.njk", "utf8");
const controllerSource = fs.readFileSync("public/js/consent-page.js", "utf8");
const stylesheetSource = fs.readFileSync("public/css/consent.css", "utf8");
const rendererSource = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");
const generatedCssTargetsSource = fs.readFileSync("scripts/styles/generated-css-targets.mjs", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "rel=\"modulepreload\" href=\"/js/consent-page.js\"", "consent page");
includes(pageSource, "src=\"/js/consent-page.js\"", "consent page");
includes(pageSource, "src=\"/components/layout.js\" defer", "consent page");
includes(pageSource, "src=\"/js/govuk-frontend-init.js\" defer", "consent page");
includes(pageSource, "href=\"/assets/govuk/govuk-frontend.css\"", "consent page");
includes(pageSource, "href=\"/css/consent.css\"", "consent page");
includes(pageSource, "class=\"govuk-width-container researchops-utility-page researchops-consent-page\"", "consent page");
includes(pageSource, "Link a consent record to a research session.", "consent page");
includes(pageSource, "consent-form", "consent page");
includes(pageSource, "id=\"consent-records-section\"", "consent page");
includes(pageSource, "aria-labelledby=\"consent-records-title\"", "consent page");
assert.match(pageSource, /id="consent-records-section"[\s\S]*?hidden/, "Consent records section is hidden initially");
includes(pageSource, "class=\"govuk-form-group\"", "consent page");
includes(pageSource, "class=\"govuk-select govuk-!-width-two-thirds\"", "consent page");
includes(pageSource, "class=\"govuk-input govuk-input--width-10\"", "consent page");
includes(pageSource, "How to write retention duration", "consent page");
includes(pageSource, "P1Y6M", "consent page");
includes(pageSource, "PT2H", "consent page");
includes(pageSource, "class=\"govuk-hint researchops-utility-page__status consent-status\"", "consent page");
includes(pageSource, "researchops-utility-page__results consent-records", "consent page");
includes(pageSource, "id=\"session\"", "consent page");
includes(pageSource, "id=\"basis\"", "consent page");
includes(pageSource, "id=\"ret\"", "consent page");
includes(pageSource, "id=\"notes\"", "consent page");
includes(pageSource, "id=\"link\"", "consent page");
includes(pageSource, "id=\"status\"", "consent page");
includes(pageSource, "id=\"consents\"", "consent page");
excludes(pageSource, "href=\"/css/screen.css\"", "consent page");
excludes(pageSource, "stored in this browser", "consent page");
excludes(pageSource, "local prototype records", "consent page");
excludes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "consent page");
excludes(pageSource, "href=\"/css/govuk/govuk-forms.css\"", "consent page");
excludes(pageSource, "class=\"card consent-panel\"", "consent page");
excludes(pageSource, "<script type=\"module\">", "consent page");
excludes(pageSource, "../src/sdk/researchops_sdk_v1.0.0.js", "consent page");
excludes(pageSource, "./scripts/shared.js", "consent page");

includes(templateSource, "{% extends \"layouts/researchops.njk\" %}", "consent template");
includes(templateSource, "govuk/components/input/macro.njk", "consent template");
includes(templateSource, "govuk/components/select/macro.njk", "consent template");
includes(templateSource, "govuk/components/button/macro.njk", "consent template");
includes(templateSource, "govuk/components/details/macro.njk", "consent template");
includes(templateSource, "govukInput({", "consent template");
includes(templateSource, "govukSelect({", "consent template");
includes(templateSource, "govukButton({", "consent template");
includes(templateSource, "govukDetails({", "consent template");
includes(rendererSource, "template: 'pages/consent.njk'", "GOV.UK page renderer");
includes(rendererSource, "output: 'public/pages/consent/index.html'", "GOV.UK page renderer");
includes(generatedCssTargetsSource, "name: 'Consent utility route stylesheet'", "generated CSS targets");
includes(generatedCssTargetsSource, "source: 'src/styles/researchops-utility-pages.scss'", "generated CSS targets");
includes(generatedCssTargetsSource, "output: 'public/css/consent.css'", "generated CSS targets");

includes(controllerSource, "function readStoredEntities", "consent page controller");
includes(controllerSource, "function searchEntities", "consent page controller");
includes(controllerSource, "function linkConsent", "consent page controller");
includes(controllerSource, "async function loadConsents", "consent page controller");
includes(controllerSource, "consent-records-section", "consent page controller");
includes(controllerSource, "consentsSection.hidden = consents.length === 0", "consent page controller");
includes(controllerSource, "async function saveConsent", "consent page controller");
includes(controllerSource, "localStorage", "consent page controller");
includes(controllerSource, "window.__ropsConsent", "consent page controller");
includes(controllerSource, "govuk-summary-card", "consent page controller");
includes(controllerSource, "govuk-summary-list", "consent page controller");
excludes(controllerSource, "No consent records yet.", "consent page controller");

includes(stylesheetSource, "Repo:       /src/styles/researchops-utility-pages.scss", "consent stylesheet");
includes(stylesheetSource, ".researchops-utility-page__section", "consent stylesheet");
includes(stylesheetSource, ".researchops-utility-page__form-row", "consent stylesheet");
includes(stylesheetSource, ".researchops-utility-page__results", "consent stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "consent stylesheet");
excludes(stylesheetSource, ".consent-panel", "consent stylesheet");
excludes(stylesheetSource, ".consent-records .item", "consent stylesheet");
