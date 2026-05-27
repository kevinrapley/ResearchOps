import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/projects/journals/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/projects-journals.njk", "utf8");
const layoutSource = fs.readFileSync("src/govuk/templates/layouts/researchops.njk", "utf8");
const renderGovukPagesSource = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");
const tabsSource = fs.readFileSync("public/js/journal-tabs.js", "utf8");
const muralSyncSource = fs.readFileSync("public/js/journal-mural-sync-compact.js", "utf8");
const excerptsSource = fs.readFileSync("public/components/journal-excerpts.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(renderGovukPagesSource, "template: 'pages/projects-journals.njk'", "GOV.UK page renderer");
includes(renderGovukPagesSource, "output: 'public/pages/projects/journals/index.html'", "GOV.UK page renderer");

includes(layoutSource, "<x-include src=\"/partials/header.html\"", "GOV.UK layout");
includes(layoutSource, "<x-include src=\"/partials/footer.html\"></x-include>", "GOV.UK layout");
excludes(layoutSource, "fallbackHeaderHtml", "GOV.UK layout");
excludes(layoutSource, "fallbackFooterHtml", "GOV.UK layout");

includes(templateSource, "{% extends \"layouts/researchops.njk\" %}", "journals GOV.UK template");
includes(templateSource, "{% block head %}", "journals GOV.UK template");
includes(templateSource, "{% block content %}", "journals GOV.UK template");
includes(templateSource, "{% block scripts %}", "journals GOV.UK template");
includes(templateSource, "id=\"journal-entries\"", "journals GOV.UK template");
includes(templateSource, "id=\"codes\"", "journals GOV.UK template");
includes(templateSource, "id=\"memos\"", "journals GOV.UK template");
includes(templateSource, "id=\"analysis\"", "journals GOV.UK template");
includes(templateSource, "id=\"coding-panel\"", "journals GOV.UK template");
excludes(templateSource, "<html", "journals GOV.UK template");
excludes(templateSource, "<body", "journals GOV.UK template");
excludes(templateSource, "<x-include src=\"/partials/header.html\"", "journals GOV.UK template");
excludes(templateSource, "<x-include src=\"/partials/footer.html\"", "journals GOV.UK template");
excludes(templateSource, "href=\"/css/govuk/govuk-buttons.css\"", "journals GOV.UK template");
excludes(templateSource, "href=\"/css/govuk/govuk-forms.css\"", "journals GOV.UK template");
excludes(templateSource, "href=\"/css/screen.css\"", "journals GOV.UK template");

includes(pageSource, "class=\"govuk-template\"", "journals page");
includes(pageSource, "href=\"/assets/govuk/govuk-frontend.css\"", "journals page");
includes(pageSource, "<x-include src=\"/partials/header.html\"", "journals page");
includes(pageSource, "<x-include src=\"/partials/footer.html\"", "journals page");
includes(pageSource, "class=\"govuk-main-wrapper\"", "journals page");
includes(pageSource, "id=\"main-content\"", "journals page");
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
excludes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "journals page");
excludes(pageSource, "href=\"/css/govuk/govuk-forms.css\"", "journals page");
excludes(pageSource, "href=\"/css/screen.css\"", "journals page");
excludes(pageSource, "class=\"btn", "journals page");
excludes(pageSource, "<script type=\"module\">", "journals page");

includes(tabsSource, "tab:shown", "journal tabs module");
includes(muralSyncSource, "mural", "journal mural sync module");
includes(excerptsSource, "function renderEntries", "journal excerpts module");
includes(excerptsSource, "function loadEntries", "journal excerpts module");
includes(excerptsSource, "/api/journal-entries", "journal excerpts module");
includes(excerptsSource, "journal:entry:delete", "journal excerpts module");
includes(excerptsSource, "document.addEventListener(\"DOMContentLoaded\", setup)", "journal excerpts module");
