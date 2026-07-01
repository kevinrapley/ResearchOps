import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/synthesis/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/study-synthesis.njk", "utf8");
const rendererSource = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");
const loaderSource = fs.readFileSync("public/js/synthesis-route-loader.js", "utf8");
const controllerSource = fs.readFileSync("public/js/synthesize-page.js", "utf8");
const generatedCssTargetsSource = fs.readFileSync("scripts/styles/generated-css-targets.mjs", "utf8");
const sassSource = fs.readFileSync("src/styles/synthesize.scss", "utf8");
const stylesheetSource = fs.readFileSync("public/css/synthesize.css", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "<html class=\"govuk-template\" lang=\"en\">", "synthesis page");
for (const macro of ["govukBreadcrumbs({", "govukButton({", "govukInput({", "govukSelect({", "govukSummaryList({", "govukTextarea({"]) {
	includes(templateSource, macro, "synthesis template");
}
includes(rendererSource, "template: 'pages/study-synthesis.njk'", "GOV.UK renderer");
includes(rendererSource, "output: 'public/pages/study/synthesis/index.html'", "GOV.UK renderer");
includes(pageSource, "/assets/govuk/govuk-frontend.css", "synthesis page");
includes(pageSource, "/components/layout.js", "synthesis page");
includes(pageSource, "/js/govuk-frontend-init.js", "synthesis page");
includes(pageSource, "src=\"/partials/header.html\"", "synthesis page");
includes(pageSource, "src=\"/partials/footer.html\"", "synthesis page");
includes(pageSource, "/js/synthesis-route-loader.js?v=study-synthesis-20260701-codex-comment-fixes", "synthesis page");
includes(pageSource, "href=\"/css/synthesize.css?v=study-synthesis-20260701-step-output-polish\"", "synthesis page");
includes(pageSource, "data-study-subpage-template=\"synthesis\"", "synthesis page");
includes(generatedCssTargetsSource, "source: 'src/styles/synthesize.scss'", "generated CSS targets");
includes(generatedCssTargetsSource, "output: 'public/css/synthesize.css'", "generated CSS targets");

for (const id of [
	"synthesis-error",
	"synthesis-error-list",
	"synthesis-status",
	"synthesis-title",
	"study-context-text",
	"breadcrumb-project",
	"breadcrumb-study",
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
	"clusters-empty",
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
includes(pageSource, "synthesis-step-layout", "synthesis page");
includes(pageSource, "synthesis-step-controls", "synthesis page");
includes(pageSource, "synthesis-step-output", "synthesis page");
includes(pageSource, "Created working groups", "synthesis page");
includes(pageSource, "Evidence notes", "synthesis page");
includes(pageSource, "Created themes", "synthesis page");
includes(pageSource, "id=\"create-cluster\"", "synthesis page");
includes(pageSource, "disabled=\"disabled\"", "synthesis page");
includes(pageSource, "Create cluster grouping", "synthesis page");
includes(pageSource, "id=\"create-theme\"", "synthesis page");
includes(pageSource, "Create theme", "synthesis page");
excludes(pageSource, "id=\"filter\"", "synthesis page");
excludes(pageSource, "id=\"newCluster\"", "synthesis page");
excludes(pageSource, "id=\"publish\"", "synthesis page");
excludes(pageSource, "id=\"back-to-study\"", "synthesis page");
excludes(pageSource, "Back to study", "synthesis page");
excludes(pageSource, "<script type=\"module\">", "synthesis page");
excludes(pageSource, "href=\"/css/screen.css\"", "synthesis page");

includes(loaderSource, "study-canonical-url-bridge.js?v=study-record-id-routing-20260518", "synthesis loader");
includes(loaderSource, "components/layout.js", "synthesis loader");
includes(loaderSource, "synthesize-page.js?v=study-synthesis-20260701-codex-comment-fixes", "synthesis loader");

for (const marker of [
	"const API_ORIGIN",
	"function apiUrl",
	"function workflowState",
	"function sourceDisplayLabel",
	"function updateWorkflowVisibility",
	"function loadStudySynthesis",
	"/api/synthesis/evidence",
	"/api/synthesis",
	"/api/synthesis/clusters",
	"/api/synthesis/themes",
	"window.__ropsSynthesize",
	"function repositoryCandidateHrefForTheme",
	"function repositoryCandidateHref",
	"data-submit-to-repository",
	"govuk-summary-card",
	"govuk-summary-list govuk-summary-list--no-border",
	"govuk-checkboxes evidence-card",
	"govuk-tag",
	"Force intelligence interview",
	"Service operator interview",
	"Data assurance session",
	"Policy and product review",
]) {
	includes(controllerSource, marker, "synthesis controller");
}

includes(controllerSource, "sampleSummary: `${theme.label || \"Theme\"} is based on ${pluralise(evidenceIds.length, \"source evidence item\")}: ${evidenceIds.join(\", \")}`", "synthesis controller");
excludes(controllerSource, ".map((item) => item.excerpt || item.contentPlain || item.id)", "synthesis controller");

for (const selector of [
	".synthesis-hero",
	".synthesis-flow",
	".synthesis-panel",
	".synthesis-step-layout",
	".synthesis-step-controls",
	".synthesis-step-output",
	".synthesis-output-heading",
	".evidence-card",
	".cluster-card",
	".theme-card",
]) {
	includes(sassSource, selector, "synthesis Sass source");
	includes(stylesheetSource, selector, "synthesis stylesheet");
}

includes(sassSource, "position: sticky", "synthesis Sass source");
includes(stylesheetSource, "position: sticky", "synthesis stylesheet");
includes(sassSource, "grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)", "synthesis Sass source");
includes(stylesheetSource, "grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)", "synthesis stylesheet");
includes(sassSource, "font-size: 16px", "synthesis Sass source");
includes(stylesheetSource, "font-size: 16px", "synthesis stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "synthesis stylesheet");
