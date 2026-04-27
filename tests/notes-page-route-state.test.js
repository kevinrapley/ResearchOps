import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/notes/index.html", "utf8");
const controllerSource = fs.readFileSync("public/js/notes-page.js", "utf8");
const stylesheetSource = fs.readFileSync("public/css/notes.css", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "rel=\"modulepreload\" href=\"/js/notes-page.js\"", "notes page");
includes(pageSource, "src=\"/js/notes-page.js\"", "notes page");
includes(pageSource, "src=\"/components/layout.js\" defer", "notes page");
includes(pageSource, "href=\"/css/screen.css\"", "notes page");
includes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "notes page");
includes(pageSource, "href=\"/css/govuk/govuk-forms.css\"", "notes page");
includes(pageSource, "href=\"/css/notes.css\"", "notes page");
includes(pageSource, "class=\"card notes-panel\"", "notes page");
includes(pageSource, "class=\"govuk-select notes-session-select\"", "notes page");
includes(pageSource, "class=\"notes-editor\"", "notes page");
includes(pageSource, "class=\"govuk-hint notes-status\"", "notes page");
includes(pageSource, "class=\"notes-list\"", "notes page");
includes(pageSource, "class=\"govuk-form-group\"", "notes page");
includes(pageSource, "class=\"govuk-textarea\"", "notes page");
includes(pageSource, "id=\"session\"", "notes page");
includes(pageSource, "id=\"text\"", "notes page");
includes(pageSource, "id=\"tags\"", "notes page");
includes(pageSource, "id=\"save\"", "notes page");
includes(pageSource, "id=\"notes\"", "notes page");
excludes(pageSource, "<textarea id=\"text\" placeholder", "notes page");
excludes(pageSource, "<script type=\"module\">", "notes page");
excludes(pageSource, "../src/sdk/researchops_sdk_v1.0.0.js", "notes page");
excludes(pageSource, "./scripts/shared.js", "notes page");

includes(controllerSource, "function readStoredEntities", "notes page controller");
includes(controllerSource, "function searchEntities", "notes page controller");
includes(controllerSource, "function addNote", "notes page controller");
includes(controllerSource, "function addTag", "notes page controller");
includes(controllerSource, "async function populateSessions", "notes page controller");
includes(controllerSource, "async function loadNotes", "notes page controller");
includes(controllerSource, "function saveNote", "notes page controller");
includes(controllerSource, "localStorage", "notes page controller");
includes(controllerSource, "window.__ropsNotes", "notes page controller");

includes(stylesheetSource, ".notes-panel", "notes stylesheet");
includes(stylesheetSource, ".notes-session-select", "notes stylesheet");
includes(stylesheetSource, ".notes-editor", "notes stylesheet");
includes(stylesheetSource, ".notes-status", "notes stylesheet");
includes(stylesheetSource, ".notes-list", "notes stylesheet");
includes(stylesheetSource, ".notes-list .item", "notes stylesheet");
includes(stylesheetSource, ".notes-list .tag", "notes stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "notes stylesheet");
