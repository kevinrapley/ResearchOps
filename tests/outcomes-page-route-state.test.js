import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/projects/outcomes/index.html", "utf8");
const stylesheetSource = fs.readFileSync("public/css/outcomes.css", "utf8");
const controllerSource = fs.readFileSync("public/js/outcomes-page.js", "utf8");
const impactTrackerSource = fs.readFileSync("public/components/impact-tracker.js", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "href=\"/css/screen.css\"", "outcomes page");
includes(pageSource, "href=\"/css/outcomes.css\"", "outcomes page");
includes(pageSource, "rel=\"modulepreload\" href=\"/js/outcomes-page.js\"", "outcomes page");
includes(pageSource, "src=\"/components/layout.js\" defer", "outcomes page");
includes(pageSource, "src=\"/components/impact-tracker.js\"", "outcomes page");
includes(pageSource, "src=\"/js/outcomes-page.js\"", "outcomes page");
includes(pageSource, "class=\"dashboard-hero outcomes-hero\"", "outcomes page");
includes(pageSource, "class=\"outcomes-tracker\"", "outcomes page");
includes(pageSource, "class=\"govuk-form-group outcomes-form\"", "outcomes page");
includes(pageSource, "class=\"govuk-button outcomes-actions\"", "outcomes page");
includes(pageSource, "class=\"outcomes-table-wrap\"", "outcomes page");
includes(pageSource, "class=\"govuk-table govuk-!-margin-top-6 outcomes-table\"", "outcomes page");
includes(pageSource, "id=\"impact-tracker\"", "outcomes page");
includes(pageSource, "id=\"impact-form\"", "outcomes page");
includes(pageSource, "id=\"impact-insightId\"", "outcomes page");
includes(pageSource, "id=\"impact-table\"", "outcomes page");
excludes(pageSource, "data-api-origin=\"https://rops-api.digikev-kevin-rapley.workers.dev\"", "outcomes page");
excludes(pageSource, "<script type=\"module\">", "outcomes page");
excludes(pageSource, "Math.random().toString(36)", "outcomes page");

includes(stylesheetSource, ".outcomes-hero", "outcomes stylesheet");
includes(stylesheetSource, ".outcomes-tracker", "outcomes stylesheet");
includes(stylesheetSource, ".outcomes-form", "outcomes stylesheet");
includes(stylesheetSource, ".outcomes-actions", "outcomes stylesheet");
includes(stylesheetSource, ".outcomes-table-wrap", "outcomes stylesheet");
includes(stylesheetSource, ".outcomes-table", "outcomes stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "outcomes stylesheet");

includes(controllerSource, "function initOutcomesPage", "outcomes controller");
includes(controllerSource, "URLSearchParams", "outcomes controller");
includes(controllerSource, "impact-tracker", "outcomes controller");
includes(controllerSource, "breadcrumb-project", "outcomes controller");
includes(controllerSource, "back-link", "outcomes controller");
includes(controllerSource, "impact-insightId", "outcomes controller");
includes(controllerSource, "window.crypto", "outcomes controller");

includes(impactTrackerSource, "impact-form", "impact tracker component");
includes(impactTrackerSource, "impact-table", "impact tracker component");
