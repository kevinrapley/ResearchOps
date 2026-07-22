import assert from "node:assert/strict";
import fs from "node:fs";
import { publishedGovukPage } from './helpers/published-govuk-pages.mjs';

const pageSource = await publishedGovukPage("public/pages/notes/index.html");
const templateSource = fs.readFileSync("src/govuk/templates/pages/notes.njk", "utf8");
const controllerSource = fs.readFileSync("public/js/notes-page.js", "utf8");
const stylesheetSource = fs.readFileSync("public/css/notes.css", "utf8");
const generatedCssTargetsSource = fs.readFileSync("scripts/styles/generated-css-targets.mjs", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "rel=\"modulepreload\" href=\"/js/notes-page.js\"", "notes page");
includes(pageSource, "src=\"/js/notes-page.js\"", "notes page");
includes(pageSource, "src=\"/components/layout.js", "notes page");
includes(pageSource, "src=\"/js/govuk-frontend-init.js", "notes page");
includes(pageSource, "href=\"/assets/govuk/govuk-frontend.css\"", "notes page");
includes(pageSource, "href=\"/css/notes.css\"", "notes page");
includes(pageSource, "class=\"govuk-width-container researchops-utility-page researchops-notes-page\"", "notes page");
includes(pageSource, "id=\"session-notes-section\"", "notes page");
includes(pageSource, "aria-labelledby=\"session-notes-title\"", "notes page");
assert.match(pageSource, /id="session-notes-section"[\s\S]*?hidden/, "Session notes section is hidden initially");
includes(pageSource, "class=\"govuk-select notes-session-select govuk-!-width-two-thirds\"", "notes page");
includes(pageSource, "notes-editor", "notes page");
includes(pageSource, "class=\"govuk-hint researchops-utility-page__status notes-status\"", "notes page");
includes(pageSource, "notes-list", "notes page");
includes(pageSource, "class=\"govuk-form-group\"", "notes page");
includes(pageSource, "class=\"govuk-textarea\"", "notes page");
includes(pageSource, "id=\"session\"", "notes page");
includes(pageSource, "id=\"text\"", "notes page");
includes(pageSource, "id=\"tags\"", "notes page");
includes(pageSource, "id=\"save\"", "notes page");
includes(pageSource, "id=\"notes\"", "notes page");
excludes(pageSource, "href=\"/css/screen.css\"", "notes page");
excludes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "notes page");
excludes(pageSource, "href=\"/css/govuk/govuk-forms.css\"", "notes page");
excludes(pageSource, "class=\"card notes-panel\"", "notes page");
excludes(pageSource, "<textarea id=\"text\" placeholder", "notes page");
excludes(pageSource, "<script type=\"module\">", "notes page");
excludes(pageSource, "../src/sdk/researchops_sdk_v1.0.0.js", "notes page");
excludes(pageSource, "./scripts/shared.js", "notes page");

includes(templateSource, "{% extends \"layouts/researchops.njk\" %}", "notes template");
includes(templateSource, "govuk/components/input/macro.njk", "notes template");
includes(templateSource, "govuk/components/select/macro.njk", "notes template");
includes(templateSource, "govuk/components/textarea/macro.njk", "notes template");
includes(templateSource, "govuk/components/button/macro.njk", "notes template");
includes(templateSource, "govukInput({", "notes template");
includes(templateSource, "govukSelect({", "notes template");
includes(templateSource, "govukTextarea({", "notes template");
includes(templateSource, "govukButton({", "notes template");
includes(generatedCssTargetsSource, "name: 'Notes utility route stylesheet'", "generated CSS targets");
includes(generatedCssTargetsSource, "source: 'src/styles/researchops-utility-pages.scss'", "generated CSS targets");
includes(generatedCssTargetsSource, "output: 'public/css/notes.css'", "generated CSS targets");

includes(controllerSource, "function readStoredEntities", "notes page controller");
includes(controllerSource, "function searchEntities", "notes page controller");
includes(controllerSource, "function addNote", "notes page controller");
includes(controllerSource, "function addTag", "notes page controller");
includes(controllerSource, "async function populateSessions", "notes page controller");
includes(controllerSource, "async function loadNotes", "notes page controller");
includes(controllerSource, "session-notes-section", "notes page controller");
includes(controllerSource, "notesSection.hidden = false", "notes page controller");
includes(controllerSource, "function saveNote", "notes page controller");
includes(controllerSource, "localStorage", "notes page controller");
includes(controllerSource, "window.__ropsNotes", "notes page controller");
includes(controllerSource, "govuk-summary-card", "notes page controller");
includes(controllerSource, "govuk-tag", "notes page controller");

includes(stylesheetSource, "Repo:       /src/styles/researchops-utility-pages.scss", "notes stylesheet");
includes(stylesheetSource, ".researchops-utility-page__section", "notes stylesheet");
includes(stylesheetSource, ".researchops-utility-page__form-row", "notes stylesheet");
includes(stylesheetSource, ".researchops-utility-page__results", "notes stylesheet");
includes(stylesheetSource, ".researchops-utility-page__tag-list", "notes stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "notes stylesheet");
excludes(stylesheetSource, ".notes-panel", "notes stylesheet");
excludes(stylesheetSource, ".notes-list .tag", "notes stylesheet");
