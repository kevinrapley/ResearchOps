import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/search/index.html", "utf8");
const controllerSource = fs.readFileSync("public/js/search-page.js", "utf8");

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
