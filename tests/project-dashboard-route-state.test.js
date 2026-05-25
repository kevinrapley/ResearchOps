import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/project-dashboard/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/project-dashboard.njk", "utf8");
const controllerSource = fs.readFileSync("public/js/project-dashboard.js", "utf8");
const dashboardCssSource = fs.readFileSync("public/css/project-dashboard.css", "utf8");
const dashboardSassSource = fs.readFileSync("src/styles/project-dashboard.scss", "utf8");
const renderGovukPagesSource = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");
const muralStateSource = fs.readFileSync("public/components/project-dashboard-mural-state.js", "utf8");
const passwordlessPreviewWorkflowSource = fs.readFileSync(
	".github/workflows/deploy-passwordless-preview-worker.yml",
	"utf8",
);

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(renderGovukPagesSource, "template: 'pages/project-dashboard.njk'", "GOV.UK page renderer");
includes(renderGovukPagesSource, "output: 'public/pages/project-dashboard/index.html'", "GOV.UK page renderer");
includes(renderGovukPagesSource, "pageTitle: 'Project dashboard - ResearchOps Demo Suite'", "GOV.UK page renderer");

includes(templateSource, "{% from \"govuk/components/button/macro.njk\" import govukButton %}", "project dashboard template");
includes(templateSource, "govukButton({", "project dashboard template");
includes(templateSource, "id: \"mural-connect\"", "project dashboard template");
includes(templateSource, "id: \"mural-setup\"", "project dashboard template");
includes(templateSource, "id: \"mural-open\"", "project dashboard template");
includes(templateSource, "id=\"mural-integration\"", "project dashboard template");
includes(templateSource, "/components/project-dashboard-mural-state.js", "project dashboard template");
includes(templateSource, "id=\"journal-link\"", "project dashboard template");
includes(templateSource, "id: \"journal-button-link\"", "project dashboard template");
includes(templateSource, "id=\"outcomes-link\"", "project dashboard template");
includes(templateSource, "id=\"outcomes-card-link\"", "project dashboard template");
includes(templateSource, "id=\"project-stage-tag\"", "project dashboard template");
includes(templateSource, "id=\"kv-project-stage\"", "project dashboard template");
excludes(templateSource, "In progress", "project dashboard template");
excludes(templateSource, "Add a project note", "project dashboard template");
excludes(templateSource, "Setup checks", "project dashboard template");
excludes(templateSource, "class=\"section\"", "project dashboard template");
excludes(templateSource, "class=\"dashboard-section", "project dashboard template");
excludes(templateSource, "href=\"/css/screen.css\"", "project dashboard template");
excludes(templateSource, "href=\"/css/govuk/govuk-buttons.css\"", "project dashboard template");

includes(pageSource, "class=\"govuk-template\"", "project dashboard page");
includes(pageSource, "href=\"/assets/govuk/govuk-frontend.css\"", "project dashboard page");
includes(pageSource, "href=\"/css/project-dashboard.css?v=project-dashboard-govuk-existing-model-20260525\"", "project dashboard page");
includes(pageSource, "<x-include src=\"/partials/header.html\"", "project dashboard page");
includes(pageSource, "<x-include src=\"/partials/footer.html\"", "project dashboard page");
includes(pageSource, "id=\"project-title\"", "project dashboard page");
includes(pageSource, "id=\"project-service-stage-tag\"", "project dashboard page");
includes(pageSource, "id=\"project-stage-tag\"", "project dashboard page");
includes(pageSource, "id=\"mural-summary-tag\"", "project dashboard page");
includes(pageSource, "class=\"govuk-summary-card\"", "project dashboard page");
includes(pageSource, "class=\"govuk-summary-list\"", "project dashboard page");
includes(pageSource, "id=\"reflexive-journal\"", "project dashboard page");
includes(pageSource, "id=\"mural-integration\"", "project dashboard page");
includes(pageSource, "id=\"journal-link\"", "project dashboard page");
includes(pageSource, "id=\"journal-button-link\"", "project dashboard page");
includes(pageSource, "id=\"mural-connect\"", "project dashboard page");
includes(pageSource, "id=\"mural-setup\"", "project dashboard page");
includes(pageSource, "id=\"mural-open\"", "project dashboard page");
includes(pageSource, "Open reflexive journal", "project dashboard page");
includes(pageSource, "Create Mural board", "project dashboard page");
includes(pageSource, "Open Mural board", "project dashboard page");
includes(pageSource, "id=\"studies-list\"", "project dashboard page");
includes(pageSource, "id=\"add-study-link\"", "project dashboard page");
includes(pageSource, "id=\"stakeholders-list\"", "project dashboard page");
includes(pageSource, "id=\"objectives-list\"", "project dashboard page");
includes(pageSource, "id=\"user-groups-list\"", "project dashboard page");
includes(pageSource, "id=\"participants-list\"", "project dashboard page");
includes(pageSource, "id=\"insights-list\"", "project dashboard page");
includes(pageSource, "/components/project-dashboard-mural-state.js", "project dashboard page");
excludes(pageSource, "href=\"/css/screen.css\"", "project dashboard page");
excludes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "project dashboard page");
excludes(pageSource, "href=\"/css/govuk/govuk-forms.css\"", "project dashboard page");
excludes(pageSource, "class=\"section\"", "project dashboard page");
excludes(pageSource, "class=\"dashboard-section", "project dashboard page");
excludes(pageSource, "In progress", "project dashboard page");
excludes(pageSource, "Add a project note", "project dashboard page");
excludes(pageSource, "Setup checks", "project dashboard page");

includes(controllerSource, "const API_ORIGIN", "project dashboard controller");
includes(controllerSource, "resolveApiBase", "project dashboard controller");
includes(controllerSource, "function renderProject", "project dashboard controller");
includes(controllerSource, "function renderStudies", "project dashboard controller");
includes(controllerSource, "function studyStatusTagClass", "project dashboard controller");
includes(controllerSource, "class=\"govuk-link govuk-!-font-weight-bold\"", "project dashboard controller");
includes(controllerSource, "class=\"govuk-body-s rops-study-description\"", "project dashboard controller");
includes(controllerSource, "class=\"govuk-tag ${studyStatusTagClass(status)}\"", "project dashboard controller");
includes(controllerSource, "setLinkHref(\"journal-button-link\"", "project dashboard controller");
includes(controllerSource, "setLinkHref(\"outcomes-card-link\"", "project dashboard controller");
includes(controllerSource, "data-project-id", "project dashboard controller");
includes(controllerSource, "credentials: \"include\"", "project dashboard controller");
includes(controllerSource, "method: \"PATCH\"", "project dashboard controller");
excludes(controllerSource, "alert(\"Could not load project.\");", "project dashboard controller");
excludes(controllerSource, "class=\"item\"", "project dashboard controller");
excludes(controllerSource, "class=\"lede\"", "project dashboard controller");
excludes(controllerSource, "style=\"margin-top:4px;\"", "project dashboard controller");
excludes(controllerSource, "rops-api.digikev-kevin-rapley.workers.dev", "project dashboard controller");

includes(muralStateSource, "function syncProjectTags", "Project Dashboard Mural state bridge");
includes(muralStateSource, "function syncMuralPresentation", "Project Dashboard Mural state bridge");
includes(muralStateSource, "mural-account-state", "Project Dashboard Mural state bridge");
includes(muralStateSource, "mural-board-state", "Project Dashboard Mural state bridge");
includes(muralStateSource, "mural-open", "Project Dashboard Mural state bridge");
includes(muralStateSource, "main-content", "Project Dashboard Mural state bridge");

includes(dashboardSassSource, ".rops-dashboard-header", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-study-list", "project dashboard Sass source");
includes(dashboardSassSource, ".dashboard-action-panel", "project dashboard Sass source");
includes(dashboardSassSource, "/* transparency begins in the cascade */", "project dashboard Sass source");
includes(dashboardCssSource, ".rops-dashboard-header", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-study-list", "project dashboard stylesheet");
includes(dashboardCssSource, ".dashboard-action-panel", "project dashboard stylesheet");
includes(dashboardCssSource, "/* transparency begins in the cascade */", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.section {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.dashboard-section {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.board {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.kv__list {", "project dashboard stylesheet");

includes(passwordlessPreviewWorkflowSource, "- main", "preview Worker workflow");
includes(passwordlessPreviewWorkflowSource, '- "feature/**"', "preview Worker workflow");
includes(passwordlessPreviewWorkflowSource, '- "chore/**"', "preview Worker workflow");
includes(passwordlessPreviewWorkflowSource, '- "test/**"', "preview Worker workflow");
includes(passwordlessPreviewWorkflowSource, '- "fix/**"', "preview Worker workflow");
includes(passwordlessPreviewWorkflowSource, '- "perf/**"', "preview Worker workflow");
includes(passwordlessPreviewWorkflowSource, '- "hotfix/**"', "preview Worker workflow");
excludes(
	passwordlessPreviewWorkflowSource,
	"branches: [ fix/team-admin-sign-in-journey ]",
	"preview Worker workflow",
);
