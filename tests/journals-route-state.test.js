import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/projects/journals/index.html", "utf8");
const tabsSource = fs.readFileSync("public/js/journal-tabs.js", "utf8");
const muralSyncSource = fs.readFileSync("public/js/journal-mural-sync-compact.js", "utf8");
const excerptsSource = fs.readFileSync("public/components/journal-excerpts.js", "utf8");
const buttonCssSource = fs.readFileSync("public/css/govuk/govuk-buttons.css", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "journals page");
includes(pageSource, "rel=\"modulepreload\" href=\"/js/journal-tabs.js\"", "journals page");
includes(pageSource, "rel=\"modulepreload\" href=\"/js/journal-mural-sync-compact.js\"", "journals page");
includes(pageSource, "rel=\"modulepreload\" href=\"/components/journal-excerpts.js\"", "journals page");
includes(pageSource, "src=\"/js/journal-tabs.js\"", "journals page");
includes(pageSource, "src=\"/js/journal-mural-sync-compact.js\"", "journals page");
includes(pageSource, "src=\"/components/journal-excerpts.js\"", "journals page");
includes(pageSource, "class=\"govuk-button\"", "journals page");
includes(pageSource, "class=\"govuk-button govuk-button--secondary", "journals page");
includes(pageSource, "id=\"journal-entries\"", "journals page");
includes(pageSource, "id=\"codes\"", "journals page");
includes(pageSource, "id=\"memos\"", "journals page");
includes(pageSource, "id=\"analysis\"", "journals page");
includes(pageSource, "id=\"coding-panel\"", "journals page");
excludes(pageSource, "class=\"btn", "journals page");
excludes(pageSource, "<script type=\"module\">", "journals page");

includes(buttonCssSource, ".govuk-button", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--secondary", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--warning", "GOV.UK button stylesheet");

includes(tabsSource, "tab:shown", "journal tabs module");
includes(muralSyncSource, "mural", "journal mural sync module");
includes(excerptsSource, "function renderEntries", "journal excerpts module");
includes(excerptsSource, "function loadEntries", "journal excerpts module");
includes(excerptsSource, "/api/journal-entries", "journal excerpts module");
includes(excerptsSource, "journal:entry:delete", "journal excerpts module");
includes(excerptsSource, "document.addEventListener(\"DOMContentLoaded\", setup)", "journal excerpts module");
