import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/synthesis/index.html", "utf8");
const loaderSource = fs.readFileSync("public/js/synthesis-route-loader.js", "utf8");
const controllerSource = fs.readFileSync("public/js/synthesize-page.js", "utf8");
const stylesheetSource = fs.readFileSync("public/css/synthesize.css", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "<html class=\"govuk-template\" lang=\"en\">", "synthesis page");
includes(pageSource, "/assets/govuk/govuk-frontend.css", "synthesis page");
includes(pageSource, "/components/layout.js", "synthesis page");
includes(pageSource, "/js/govuk-frontend-init.js", "synthesis page");
includes(pageSource, "src=\"/partials/header.html\"", "synthesis page");
includes(pageSource, "src=\"/partials/footer.html\"", "synthesis page");
includes(pageSource, "/js/synthesis-route-loader.js?v=study-record-id-routing-20260518", "synthesis page");
includes(pageSource, "href=\"/css/screen.css\"", "synthesis page");
includes(pageSource, "href=\"/css/synthesize.css?v=study-synthesis-20260501-progressive-disclosure\"", "synthesis page");

for (const id of [
	"synthesis-error",
	"synthesis-error-list",
	"synthesis-status",
	"synthesis-title",
	"study-context-text",
	"breadcrumb-project",
	"breadcrumb-study",
	"back-to-study",
	"summary-evidence-count",
	"summary-theme-count",
	"no-evidence-state",
	"capture-evidence-link",
	"synthesis-workspace",
	"clusters-section",
	"evidence-section",
	"themes-locked",
	"themes-section",
	"tag-filter",
	"target-cluster",
	"add-selected-evidence",
	"add-selected-evidence-hint",
	"evidence-empty",
	"evidence-list",
	"cluster-form",
	"cluster-label",
	"cluster-description",
	"create-cluster",
	"create-cluster-hint",
	"cluster-list",
	"theme-form",
	"theme-cluster",
	"theme-label",
	"theme-description",
	"create-theme",
	"create-theme-hint",
	"theme-list",
]) {
	includes(pageSource, `id=\"${id}\"`, "synthesis page");
}

includes(pageSource, "Group study evidence into themes you can trace back to source notes.", "synthesis page");
includes(pageSource, "Capture evidence before starting synthesis", "synthesis page");
includes(pageSource, "Capture evidence in a session", "synthesis page");
includes(pageSource, "Working cluster groupings", "synthesis page");
includes(pageSource, "Create a working cluster grouping before selecting evidence.", "synthesis page");
includes(pageSource, "disabled>Create cluster grouping</button>", "synthesis page");
includes(pageSource, "disabled>Create theme</button>", "synthesis page");
excludes(pageSource, "id=\"filter\"", "synthesis page");
excludes(pageSource, "id=\"newCluster\"", "synthesis page");
excludes(pageSource, "id=\"publish\"", "synthesis page");
excludes(pageSource, "<script type=\"module\">", "synthesis page");

includes(loaderSource, "study-canonical-url-bridge.js?v=study-record-id-routing-20260518", "synthesis loader");
includes(loaderSource, "components/layout.js", "synthesis loader");
includes(loaderSource, "synthesize-page.js?v=study-record-id-routing-20260518", "synthesis loader");

for (const marker of [
	"const API_ORIGIN",
	"function apiUrl",
	"function workflowState",
	"function updateWorkflowVisibility",
	"function loadStudySynthesis",
	"/api/synthesis/evidence",
	"/api/synthesis",
	"/api/synthesis/clusters",
	"/api/synthesis/themes",
	"window.__ropsSynthesize",
]) {
	includes(controllerSource, marker, "synthesis controller");
}

for (const selector of [
	".synthesis-hero",
	".synthesis-flow",
	".synthesis-panel",
	".evidence-card",
	".cluster-card",
	".theme-card",
]) {
	includes(stylesheetSource, selector, "synthesis stylesheet");
}

includes(stylesheetSource, "/* transparency begins in the cascade */", "synthesis stylesheet");
