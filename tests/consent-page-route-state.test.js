import assert from "node:assert/strict";
import fs from "node:fs";
import { publishedGovukPage } from './helpers/published-govuk-pages.mjs';

const pageSource = await publishedGovukPage("public/pages/consent/index.html");
const templateSource = fs.readFileSync("src/govuk/templates/pages/consent.njk", "utf8");
const controllerSource = fs.readFileSync("public/js/consent-page.js", "utf8");
const stylesheetSource = fs.readFileSync("public/css/consent.css", "utf8");
const generatedCssTargetsSource = fs.readFileSync("scripts/styles/generated-css-targets.mjs", "utf8");
const gateMacroSource = fs.readFileSync("src/govuk/templates/macros/sourcebook-gate.njk", "utf8");
const macroSource = fs.readFileSync("src/govuk/templates/macros/sourcebook-context.njk", "utf8");
const ledgerMacroSource = fs.readFileSync("src/govuk/templates/macros/sourcebook-evidence-ledger.njk", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "rel=\"modulepreload\" href=\"/js/consent-page.js\"", "consent page");
includes(pageSource, "src=\"/js/consent-page.js\"", "consent page");
includes(pageSource, "src=\"/components/layout.js", "consent page");
includes(pageSource, "src=\"/js/govuk-frontend-init.js", "consent page");
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
includes(pageSource, "class=\"sourcebook-gate sourcebook-gate--blocked\"", "consent page");
includes(pageSource, "Sourcebook gate for consent", "consent page");
includes(pageSource, "Evidence needed", "consent page");
includes(pageSource, "Add evidence before continuing", "consent page");
includes(pageSource, "class=\"sourcebook-context\"", "consent page");
includes(pageSource, "Sourcebook context for consent", "consent page");
includes(pageSource, "REC-ADMN 3.1.1", "consent page");
includes(pageSource, "Record informed consent before research participation", "consent page");
includes(pageSource, "/pages/sourcebook/recruitment-and-administration/#rec-admn-3-1-1", "consent page");
includes(pageSource, "Consent review", "consent page");
includes(pageSource, "class=\"sourcebook-evidence-ledger\"", "consent page");
includes(pageSource, "Evidence ledger for consent", "consent page");
includes(pageSource, "Consent Form", "consent page");
includes(pageSource, "consent-form", "consent page");
includes(pageSource, "Consent Log", "consent page");
includes(pageSource, "consent-log", "consent page");
includes(pageSource, "Needed", "consent page");
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
includes(templateSource, "macros/sourcebook-gate.njk", "consent template");
includes(templateSource, "SourcebookGate(sourcebookGate)", "consent template");
includes(templateSource, "macros/sourcebook-context.njk", "consent template");
includes(templateSource, "SourcebookContext(sourcebookContext)", "consent template");
includes(templateSource, "macros/sourcebook-evidence-ledger.njk", "consent template");
includes(templateSource, "SourcebookEvidenceLedger(sourcebookEvidenceLedger)", "consent template");
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
includes(stylesheetSource, ".sourcebook-gate", "consent stylesheet");
includes(stylesheetSource, ".sourcebook-context", "consent stylesheet");
includes(stylesheetSource, ".sourcebook-evidence-ledger", "consent stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "consent stylesheet");
excludes(stylesheetSource, ".consent-panel", "consent stylesheet");
excludes(stylesheetSource, ".consent-records .item", "consent stylesheet");

includes(gateMacroSource, "{% macro SourcebookGate(params) %}", "sourcebook gate macro");
includes(gateMacroSource, "sourcebook-gate__check", "sourcebook gate macro");
includes(macroSource, "{% macro SourcebookContext(params) %}", "sourcebook context macro");
includes(macroSource, "sourcebook-context__badge", "sourcebook context macro");
includes(ledgerMacroSource, "{% macro SourcebookEvidenceLedger(params) %}", "sourcebook evidence ledger macro");
includes(ledgerMacroSource, "sourcebook-evidence-ledger__tag", "sourcebook evidence ledger macro");
