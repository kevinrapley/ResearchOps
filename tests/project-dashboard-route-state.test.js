import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/project-dashboard/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/project-dashboard.njk", "utf8");
const controllerSource = fs.readFileSync("public/js/project-dashboard.js", "utf8");
const muralIntegrationSource = fs.readFileSync("public/components/mural-integration.js", "utf8");
const muralStateSource = fs.readFileSync("public/components/project-dashboard-mural-state.js", "utf8");
const dashboardCssSource = fs.readFileSync("public/css/project-dashboard.css", "utf8");
const dashboardSassSource = fs.readFileSync("src/styles/project-dashboard.scss", "utf8");
const layoutSource = fs.readFileSync("src/govuk/templates/layouts/researchops.njk", "utf8");
const renderGovukPagesSource = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(renderGovukPagesSource, "template: 'pages/project-dashboard.njk'", "GOV.UK page renderer");
includes(renderGovukPagesSource, "output: 'public/pages/project-dashboard/index.html'", "GOV.UK page renderer");

includes(layoutSource, "<x-include src=\"/partials/header.html\"", "GOV.UK layout");
includes(layoutSource, "<x-include src=\"/partials/footer.html\"></x-include>", "GOV.UK layout");
excludes(layoutSource, "fallbackHeaderHtml", "GOV.UK layout");
excludes(layoutSource, "fallbackFooterHtml", "GOV.UK layout");

includes(templateSource, "{% from \"govuk/components/button/macro.njk\" import govukButton %}", "project dashboard template");
includes(templateSource, "id=\"mural-integration\"", "project dashboard template");
includes(templateSource, "id=\"journal-link\"", "project dashboard template");
includes(templateSource, "id=\"outcomes-card-link\"", "project dashboard template");
includes(templateSource, "id=\"kv-project-stage\"", "project dashboard template");
includes(templateSource, "Loading service stage", "project dashboard template");
includes(templateSource, "Loading project stage", "project dashboard template");
includes(templateSource, "Mural optional", "project dashboard template");
excludes(templateSource, "Service stage not recorded", "project dashboard template");
excludes(templateSource, "Project stage not recorded", "project dashboard template");
excludes(templateSource, "Mural not checked", "project dashboard template");
excludes(templateSource, "Add a project note", "project dashboard template");
excludes(templateSource, "Setup checks", "project dashboard template");
excludes(templateSource, "class=\"section\"", "project dashboard template");
excludes(templateSource, "href=\"/css/screen.css\"", "project dashboard template");

includes(pageSource, "class=\"govuk-template\"", "project dashboard page");
includes(pageSource, "href=\"/assets/govuk/govuk-frontend.css\"", "project dashboard page");
includes(pageSource, "<x-include src=\"/partials/header.html\"", "project dashboard page");
includes(pageSource, "<x-include src=\"/partials/footer.html\"", "project dashboard page");
includes(pageSource, "class=\"govuk-summary-card\"", "project dashboard page");
includes(pageSource, "class=\"govuk-summary-list\"", "project dashboard page");
includes(pageSource, "id=\"project-title\"", "project dashboard page");
includes(pageSource, "id=\"mural-connect\"", "project dashboard page");
includes(pageSource, "id=\"mural-setup\"", "project dashboard page");
includes(pageSource, "id=\"mural-open\"", "project dashboard page");
includes(pageSource, "id=\"studies-list\"", "project dashboard page");
excludes(pageSource, "href=\"/css/screen.css\"", "project dashboard page");
excludes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "project dashboard page");
excludes(pageSource, "href=\"/css/govuk/govuk-forms.css\"", "project dashboard page");
excludes(pageSource, "Add a project note", "project dashboard page");
excludes(pageSource, "Setup checks", "project dashboard page");

includes(controllerSource, "const API_ORIGIN", "project dashboard controller");
includes(controllerSource, "resolveApiBase", "project dashboard controller");
includes(controllerSource, "fetchWithTimeout", "project dashboard controller");
includes(controllerSource, "AbortController", "project dashboard controller");
includes(controllerSource, "function renderProject", "project dashboard controller");
includes(controllerSource, "function renderStudies", "project dashboard controller");
includes(controllerSource, "function setTagText", "project dashboard controller");
includes(controllerSource, "project[\"Service stage\"]", "project dashboard controller");
includes(controllerSource, "project[\"Project stage\"]", "project dashboard controller");
includes(controllerSource, "setTagText(\"project-service-stage-tag\", project.phase", "project dashboard controller");
includes(controllerSource, "setTagText(\"project-stage-tag\", project.status", "project dashboard controller");
includes(controllerSource, "method: \"PATCH\"", "project dashboard controller");
includes(controllerSource, "credentials: \"include\"", "project dashboard controller");
includes(controllerSource, "class=\"govuk-link govuk-!-font-weight-bold\"", "project dashboard controller");
excludes(controllerSource, "Service stage not recorded", "project dashboard controller");
excludes(controllerSource, "Project stage not recorded", "project dashboard controller");
excludes(controllerSource, "rops-api.digikev-kevin-rapley.workers.dev", "project dashboard controller");
excludes(controllerSource, "alert(\"Could not load project.\");", "project dashboard controller");

includes(muralIntegrationSource, "Project Dashboard ↔ Mural wiring with GOV.UK Frontend dashboard state", "Mural integration component");
includes(muralIntegrationSource, "location.hostname.endsWith(\"pages.dev\")", "Mural integration component");
includes(muralIntegrationSource, "https://rops-api.digikev-kevin-rapley.workers.dev", "Mural integration component");
includes(muralIntegrationSource, "function projectDashboardPath(projectId)", "Mural integration component");
includes(muralIntegrationSource, "function wireConnectButton(projectId)", "Mural integration component");
includes(muralIntegrationSource, "function verify()", "Mural integration component");
includes(muralIntegrationSource, "function resolveBoard(projectId)", "Mural integration component");
includes(muralIntegrationSource, "function updateSetupState()", "Mural integration component");
includes(muralIntegrationSource, "function setSetupAsCreate(projectId, projectName)", "Mural integration component");
includes(muralIntegrationSource, "function setSetupAsOpen(projectId, boardUrl)", "Mural integration component");
includes(muralIntegrationSource, "function observeProjectMeta()", "Mural integration component");
includes(muralIntegrationSource, "function hideConnectButton()", "Mural integration component");
includes(muralIntegrationSource, "function setGovukTag(el, text, modifier = \"govuk-tag--grey\")", "Mural integration component");
includes(muralIntegrationSource, "function setOpenLinkState(enabled, boardUrl = \"\")", "Mural integration component");
includes(muralIntegrationSource, "jsonFetch(addDebug(`${API_ORIGIN}/api/health`)).catch(() => {});", "Mural integration component");
includes(muralIntegrationSource, "`${API_ORIGIN}/api/mural/auth?uid=${encodeURIComponent(uid())}&return=${encodeURIComponent(backPath)}`", "Mural integration component");
includes(muralIntegrationSource, "`${API_ORIGIN}/api/mural/verify?uid=${encodeURIComponent(uid())}`", "Mural integration component");
includes(muralIntegrationSource, "`${API_ORIGIN}/api/mural/setup`", "Mural integration component");
includes(muralIntegrationSource, "`${API_ORIGIN}/api/mural/resolve?projectId=${encodeURIComponent(pid)}&uid=${encodeURIComponent(uid())}`", "Mural integration component");
includes(muralIntegrationSource, "Mural optional", "Mural integration component");
includes(muralIntegrationSource, "Connect if needed", "Mural integration component");
includes(muralIntegrationSource, "Create or open manually", "Mural integration component");
includes(muralIntegrationSource, "Board linked", "Mural integration component");
includes(muralIntegrationSource, "mural-account-state", "Mural integration component");
includes(muralIntegrationSource, "mural-board-state", "Mural integration component");
includes(muralIntegrationSource, "mural-summary-tag", "Mural integration component");
includes(muralIntegrationSource, "mural-open", "Mural integration component");
excludes(muralIntegrationSource, "Mural has not been checked yet", "Mural integration component");
excludes(muralIntegrationSource, "Mural not checked", "Mural integration component");
excludes(muralIntegrationSource, "const backAbs = absolutePagesUrl", "Mural integration component");
excludes(muralIntegrationSource, "return=${encodeURIComponent(backAbs)}", "Mural integration component");
excludes(muralIntegrationSource, "function absolutePagesUrl(pathAndQuery)", "Mural integration component");

includes(muralStateSource, "intentionally inert", "Project Dashboard Mural state bridge");
includes(muralStateSource, "export {};", "Project Dashboard Mural state bridge");
excludes(muralStateSource, "MutationObserver", "Project Dashboard Mural state bridge");
excludes(muralStateSource, "requestAnimationFrame", "Project Dashboard Mural state bridge");
excludes(muralStateSource, "syncDashboardPresentation", "Project Dashboard Mural state bridge");

includes(dashboardSassSource, ".rops-dashboard-header", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-study-list", "project dashboard Sass source");
includes(dashboardSassSource, ".dashboard-action-panel", "project dashboard Sass source");
includes(dashboardSassSource, "/* transparency begins in the cascade */", "project dashboard Sass source");
includes(dashboardCssSource, ".rops-dashboard-header", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-study-list", "project dashboard stylesheet");
includes(dashboardCssSource, ".dashboard-action-panel", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.section {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.dashboard-section {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.board {", "project dashboard stylesheet");