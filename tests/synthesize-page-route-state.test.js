import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/synthesize/index.html", "utf8");
const controllerSource = fs.readFileSync("public/js/synthesize-page.js", "utf8");
const stylesheetSource = fs.readFileSync("public/css/synthesize.css", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "rel=\"modulepreload\" href=\"/js/synthesize-page.js?v=study-synthesis-20260501\"", "synthesize page");
includes(pageSource, "src=\"/js/synthesize-page.js?v=study-synthesis-20260501\"", "synthesize page");
includes(pageSource, "src=\"/components/layout.js\" defer", "synthesize page");
includes(pageSource, "href=\"/css/screen.css\"", "synthesize page");
includes(pageSource, "href=\"/css/synthesize.css?v=study-synthesis-20260501\"", "synthesize page");
includes(pageSource, "id=\"synthesis-error\"", "synthesize page");
includes(pageSource, "id=\"synthesis-error-list\"", "synthesize page");
includes(pageSource, "id=\"synthesis-status\"", "synthesize page");
includes(pageSource, "id=\"synthesis-title\"", "synthesize page");
includes(pageSource, "id=\"study-context-text\"", "synthesize page");
includes(pageSource, "id=\"breadcrumb-project\"", "synthesize page");
includes(pageSource, "id=\"breadcrumb-study\"", "synthesize page");
includes(pageSource, "id=\"back-to-study\"", "synthesize page");
includes(pageSource, "id=\"summary-evidence-count\"", "synthesize page");
includes(pageSource, "id=\"summary-theme-count\"", "synthesize page");
includes(pageSource, "id=\"synthesis-workspace\"", "synthesize page");
includes(pageSource, "id=\"tag-filter\"", "synthesize page");
includes(pageSource, "id=\"target-cluster\"", "synthesize page");
includes(pageSource, "id=\"add-selected-evidence\"", "synthesize page");
includes(pageSource, "id=\"evidence-empty\"", "synthesize page");
includes(pageSource, "id=\"evidence-list\"", "synthesize page");
includes(pageSource, "id=\"cluster-form\"", "synthesize page");
includes(pageSource, "id=\"cluster-label\"", "synthesize page");
includes(pageSource, "id=\"cluster-description\"", "synthesize page");
includes(pageSource, "id=\"create-cluster\"", "synthesize page");
includes(pageSource, "id=\"cluster-list\"", "synthesize page");
includes(pageSource, "id=\"theme-form\"", "synthesize page");
includes(pageSource, "id=\"theme-cluster\"", "synthesize page");
includes(pageSource, "id=\"theme-label\"", "synthesize page");
includes(pageSource, "id=\"theme-description\"", "synthesize page");
includes(pageSource, "id=\"create-theme\"", "synthesize page");
includes(pageSource, "id=\"theme-list\"", "synthesize page");
excludes(pageSource, "id=\"filter\"", "synthesize page");
excludes(pageSource, "id=\"newCluster\"", "synthesize page");
excludes(pageSource, "id=\"publish\"", "synthesize page");
excludes(pageSource, "<script type=\"module\">", "synthesize page");

includes(controllerSource, "const API_ORIGIN", "synthesize page controller");
includes(controllerSource, "function apiUrl", "synthesize page controller");
includes(controllerSource, "function loadStudySynthesis", "synthesize page controller");
includes(controllerSource, "/api/synthesis/evidence", "synthesize page controller");
includes(controllerSource, "/api/synthesis", "synthesize page controller");
includes(controllerSource, "/api/synthesis/clusters", "synthesize page controller");
includes(controllerSource, "/api/synthesis/themes", "synthesize page controller");
includes(controllerSource, "function renderEvidence", "synthesize page controller");
includes(controllerSource, "async function createCluster", "synthesize page controller");
includes(controllerSource, "async function addSelectedEvidenceToCluster", "synthesize page controller");
includes(controllerSource, "async function createTheme", "synthesize page controller");
includes(controllerSource, "The synthesis page needs a study ID in the URL.", "synthesize page controller");
includes(controllerSource, "window.__ropsSynthesize", "synthesize page controller");
excludes(controllerSource, "localStorage", "synthesize page controller");
excludes(controllerSource, "function readStoredEntities", "synthesize page controller");
excludes(controllerSource, "alert(", "synthesize page controller");

includes(stylesheetSource, ".synthesis-hero", "synthesize stylesheet");
includes(stylesheetSource, ".synthesis-grid", "synthesize stylesheet");
includes(stylesheetSource, ".synthesis-panel", "synthesize stylesheet");
includes(stylesheetSource, ".evidence-card", "synthesize stylesheet");
includes(stylesheetSource, ".cluster-card", "synthesize stylesheet");
includes(stylesheetSource, ".theme-card", "synthesize stylesheet");
includes(stylesheetSource, ".synthesis-empty", "synthesize stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "synthesize stylesheet");
excludes(stylesheetSource, ".synthesize-grid", "synthesize stylesheet");
excludes(stylesheetSource, ".synthesize-filter", "synthesize stylesheet");
