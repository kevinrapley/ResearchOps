import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/synthesize/index.html", "utf8");
const controllerSource = fs.readFileSync("public/js/synthesize-page.js", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "rel=\"modulepreload\" href=\"/js/synthesize-page.js\"", "synthesize page");
includes(pageSource, "src=\"/js/synthesize-page.js\"", "synthesize page");
includes(pageSource, "src=\"/components/layout.js\" defer", "synthesize page");
includes(pageSource, "href=\"/css/screen.css\"", "synthesize page");
includes(pageSource, "id=\"filter\"", "synthesize page");
includes(pageSource, "id=\"evidence\"", "synthesize page");
includes(pageSource, "id=\"clusters\"", "synthesize page");
includes(pageSource, "id=\"newCluster\"", "synthesize page");
includes(pageSource, "id=\"addCluster\"", "synthesize page");
includes(pageSource, "id=\"clusterSelect\"", "synthesize page");
includes(pageSource, "id=\"themeLabel\"", "synthesize page");
includes(pageSource, "id=\"themeDesc\"", "synthesize page");
includes(pageSource, "id=\"publish\"", "synthesize page");
includes(pageSource, "id=\"status\"", "synthesize page");
excludes(pageSource, "<script type=\"module\">", "synthesize page");
excludes(pageSource, "../src/sdk/researchops_sdk_v1.0.0.js", "synthesize page");
excludes(pageSource, "./scripts/shared.js", "synthesize page");

includes(controllerSource, "function readStoredEntities", "synthesize page controller");
includes(controllerSource, "function searchEntities", "synthesize page controller");
includes(controllerSource, "function createCluster", "synthesize page controller");
includes(controllerSource, "function publishTheme", "synthesize page controller");
includes(controllerSource, "async function loadEvidence", "synthesize page controller");
includes(controllerSource, "async function loadClusters", "synthesize page controller");
includes(controllerSource, "async function addCluster", "synthesize page controller");
includes(controllerSource, "async function handlePublishTheme", "synthesize page controller");
includes(controllerSource, "localStorage", "synthesize page controller");
includes(controllerSource, "window.__ropsSynthesize", "synthesize page controller");
