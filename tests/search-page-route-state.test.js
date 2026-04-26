import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/search/index.html", "utf8");
const controllerSource = fs.readFileSync("public/js/search-page.js", "utf8");
const stylesheetSource = fs.readFileSync("public/css/search.css", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "rel=\"modulepreload\" href=\"/js/search-page.js\"", "search page");
includes(pageSource, "src=\"/js/search-page.js\"", "search page");
includes(pageSource, "src=\"/components/layout.js\" defer", "search page");
includes(pageSource, "href=\"/css/screen.css\"", "search page");
includes(pageSource, "href=\"/css/search.css\"", "search page");
includes(pageSource, "class=\"card search-panel\"", "search page");
includes(pageSource, "class=\"search-controls\"", "search page");
includes(pageSource, "class=\"govuk-body search-type-label\"", "search page");
includes(pageSource, "class=\"search-results\"", "search page");
includes(pageSource, "id=\"q\"", "search page");
includes(pageSource, "id=\"type\"", "search page");
includes(pageSource, "id=\"go\"", "search page");
includes(pageSource, "id=\"results\"", "search page");
excludes(pageSource, "<script type=\"module\">", "search page");
excludes(pageSource, "../src/sdk/researchops_sdk_v1.0.0.js", "search page");
excludes(pageSource, "./scripts/shared.js", "search page");

includes(controllerSource, "function readStoredEntities", "search page controller");
includes(controllerSource, "function searchEntities", "search page controller");
includes(controllerSource, "function renderItem", "search page controller");
includes(controllerSource, "function runSearch", "search page controller");
includes(controllerSource, "localStorage", "search page controller");
includes(controllerSource, "window.__ropsSearch", "search page controller");

includes(stylesheetSource, ".search-panel", "search stylesheet");
includes(stylesheetSource, ".search-controls", "search stylesheet");
includes(stylesheetSource, ".search-type-label", "search stylesheet");
includes(stylesheetSource, ".search-results", "search stylesheet");
includes(stylesheetSource, ".result", "search stylesheet");
includes(stylesheetSource, ".type", "search stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "search stylesheet");
