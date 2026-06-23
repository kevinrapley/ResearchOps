import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/project-dashboard/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/project-dashboard.njk", "utf8");
const controllerSource = fs.readFileSync("public/js/project-dashboard.js", "utf8");
const dashboardContextSource = fs.readFileSync("public/js/project-dashboard-context.js", "utf8");
const participantListSource = fs.readFileSync("public/js/project-dashboard-participants-list.js", "utf8");
const muralIntegrationSource = fs.readFileSync("public/components/mural-integration.js", "utf8");
const muralStateSource = fs.readFileSync("public/components/project-dashboard-mural-state.js", "utf8");
const dashboardCssSource = fs.readFileSync("public/css/project-dashboard.css", "utf8");
const dashboardSassSource = fs.readFileSync("src/styles/project-dashboard.scss", "utf8");
const daasPanelMacroSource = fs.readFileSync("src/govuk/templates/macros/daas-brand-panel.njk", "utf8");
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
excludes(templateSource, "id=\"mural-status\"", "project dashboard template");
excludes(templateSource, "class=\"rops-mural-status\"", "project dashboard template");
includes(templateSource, "id: \"mural-connect\",\n\t\t\t\t\t\t\t\t\thidden: \"hidden\"", "project dashboard template");
includes(templateSource, "id=\"journal-link\"", "project dashboard template");
includes(templateSource, "id=\"outcomes-card-link\"", "project dashboard template");
includes(templateSource, "{% from \"macros/daas-brand-panel.njk\" import daasBrandPanel %}", "project dashboard template");
includes(templateSource, "{{ daasBrandPanel() }}", "project dashboard template");
includes(templateSource, "class=\"rops-dashboard-layout\"", "project dashboard template");
includes(templateSource, "class=\"rops-dashboard-sidebar\"", "project dashboard template");
includes(templateSource, "class=\"govuk-summary-card rops-project-areas-nav\"", "project dashboard template");
includes(templateSource, "class=\"rops-dashboard-content\"", "project dashboard template");
assert.equal(
	templateSource.indexOf("{{ daasBrandPanel() }}") < templateSource.indexOf("class=\"rops-dashboard-layout\""),
	true,
	"Expected DaaS brand panel to render before the dashboard layout",
);
assert.equal(
	templateSource.indexOf("class=\"rops-dashboard-sidebar\"") <
		templateSource.indexOf("class=\"rops-dashboard-content\""),
	true,
	"Expected dashboard sidebar to render before dashboard content",
);
assert.equal(
	templateSource.indexOf("class=\"govuk-summary-card rops-project-areas-nav\"") <
		templateSource.indexOf("<section class=\"govuk-summary-card\" id=\"reflexive-journal\">"),
	true,
	"Expected project areas navigation to render before the reflexive journal panel",
);
assert.equal(
	templateSource.indexOf("<section class=\"govuk-summary-card\" id=\"reflexive-journal\">") <
		templateSource.indexOf("class=\"rops-dashboard-content\""),
	true,
	"Expected reflexive journal panel to render in the sidebar before dashboard content",
);
includes(daasPanelMacroSource, "id=\"daas-brand-panel\"", "DaaS brand panel macro");
includes(daasPanelMacroSource, "class=\"rops-daas-brand-panel\"", "DaaS brand panel macro");
includes(daasPanelMacroSource, "/images/brands/daas-logo.svg", "DaaS brand panel macro");
includes(templateSource, "id=\"kv-project-stage\"", "project dashboard template");
includes(templateSource, "Loading service stage", "project dashboard template");
includes(templateSource, "Loading project stage", "project dashboard template");
includes(templateSource, "Mural optional", "project dashboard template");
includes(templateSource, "project-dashboard.js?v=project-dashboard-daas-brand-20260616", "project dashboard template");
includes(templateSource, "project-dashboard.css?v=project-dashboard-daas-brand-20260616", "project dashboard template");
includes(templateSource, "project-dashboard-participants-list.js?v=participant-list-reveal-hide-20260602", "project dashboard template");
excludes(templateSource, "project-dashboard-participants-list.js?v=participant-list-controls-20260601", "project dashboard template");
includes(templateSource, "text: \"Dashboard\"", "project dashboard template");
includes(templateSource, "id: \"breadcrumb-project\"", "project dashboard template");
includes(templateSource, "href: \"/pages/project-dashboard/?id=\"", "project dashboard template");
includes(templateSource, "rops-planning-grid", "project dashboard template");
includes(templateSource, "id: \"add-stakeholder-toggle\"", "project dashboard template");
includes(templateSource, "\"aria-controls\": \"add-stakeholder-panel\"", "project dashboard template");
excludes(templateSource, "rops-summary-card-button", "project dashboard template");
excludes(templateSource, "id=\"mural-open\"", "project dashboard template");
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
includes(pageSource, "id=\"breadcrumb-project\"", "project dashboard page");
includes(pageSource, "id=\"daas-brand-panel\"", "project dashboard page");
excludes(pageSource, "id=\"mural-status\"", "project dashboard page");
excludes(pageSource, "class=\"rops-mural-status\"", "project dashboard page");
includes(pageSource, "class=\"rops-daas-brand-panel\"", "project dashboard page");
includes(pageSource, "class=\"rops-dashboard-layout\"", "project dashboard page");
includes(pageSource, "class=\"rops-dashboard-sidebar\"", "project dashboard page");
includes(pageSource, "class=\"govuk-summary-card rops-project-areas-nav\"", "project dashboard page");
includes(pageSource, "class=\"rops-dashboard-content\"", "project dashboard page");
includes(pageSource, "id=\"mural-connect\"", "project dashboard page");
includes(pageSource, "hidden", "project dashboard page");
assert.equal(
	pageSource.indexOf("id=\"daas-brand-panel\"") < pageSource.indexOf("class=\"rops-dashboard-layout\""),
	true,
	"Expected DaaS brand panel to stay before the dashboard layout",
);
assert.equal(
	pageSource.indexOf("class=\"rops-dashboard-sidebar\"") < pageSource.indexOf("class=\"rops-dashboard-content\""),
	true,
	"Expected dashboard sidebar to render before dashboard content",
);
assert.equal(
	pageSource.indexOf("class=\"govuk-summary-card rops-project-areas-nav\"") <
		pageSource.indexOf("<section class=\"govuk-summary-card\" id=\"reflexive-journal\">"),
	true,
	"Expected project areas navigation to render before the reflexive journal panel",
);
assert.equal(
	pageSource.indexOf("<section class=\"govuk-summary-card\" id=\"reflexive-journal\">") <
		pageSource.indexOf("class=\"rops-dashboard-content\""),
	true,
	"Expected reflexive journal panel to render in the sidebar before dashboard content",
);
includes(pageSource, "/images/brands/daas-logo.svg", "project dashboard page");
includes(pageSource, "project-dashboard.js?v=project-dashboard-daas-brand-20260616", "project dashboard page");
includes(pageSource, "project-dashboard.css?v=project-dashboard-daas-brand-20260616", "project dashboard page");
includes(pageSource, "Project", "project dashboard page");
includes(pageSource, "Dashboard", "project dashboard page");
includes(pageSource, "id=\"mural-connect\"", "project dashboard page");
includes(pageSource, "id=\"mural-setup\"", "project dashboard page");
excludes(pageSource, "id=\"mural-open\"", "project dashboard page");
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
includes(controllerSource, "return await loadProjectFromRecord(projectId);", "project dashboard controller");
includes(controllerSource, "falling back to project list endpoint", "project dashboard controller");
includes(controllerSource, "function renderProject", "project dashboard controller");
includes(controllerSource, "function renderProjectBrand", "project dashboard controller");
includes(controllerSource, "function normaliseBrandKey", "project dashboard controller");
includes(controllerSource, "project.teamName", "project dashboard controller");
includes(controllerSource, "teamNames: normaliseCommaList(project.teamNames ?? project.team_names ?? project[\"Team Names\"])", "project dashboard controller");
includes(controllerSource, "function brandValues", "project dashboard controller");
includes(controllerSource, "project.teamNames", "project dashboard controller");
includes(controllerSource, ".flatMap(brandValues)", "project dashboard controller");
includes(controllerSource, "rops-daas-brand-panel--visible", "project dashboard controller");
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

includes(dashboardContextSource, "[\"breadcrumb-project\", \"/pages/project-dashboard/\", \"id\"]", "project dashboard context controller");
includes(dashboardContextSource, "projectScopedHref(path, queryKey, projectId, hash)", "project dashboard context controller");
includes(dashboardContextSource, "link.setAttribute(\"href\", href)", "project dashboard context controller");

includes(participantListSource, "const PARTICIPANT_PAGE_SIZE = 10", "participant list controller");
includes(participantListSource, "participantJson(`/api/participants/contact?participant=", "participant list controller");
includes(participantListSource, "data-participant-reveal", "participant list controller");
includes(participantListSource, "data-participant-hide", "participant list controller");
includes(participantListSource, "Hide details", "participant list controller");
includes(participantListSource, "function hideParticipant", "participant list controller");
includes(participantListSource, "PRIVATE_DETAIL_FIELDS", "participant list controller");
includes(participantListSource, "First name", "participant list controller");
includes(participantListSource, "Family name", "participant list controller");
includes(participantListSource, "Search participants", "participant list controller");
includes(participantListSource, "Sort participants", "participant list controller");
includes(participantListSource, ">A-Z</option>", "participant list controller");
includes(participantListSource, ">Z-A</option>", "participant list controller");
includes(participantListSource, ">First to last</option>", "participant list controller");
includes(participantListSource, ">Last to first</option>", "participant list controller");
includes(participantListSource, ">User group</option>", "participant list controller");
includes(participantListSource, "data-participants-page=\"previous\"", "participant list controller");
includes(participantListSource, "data-participants-page=\"next\"", "participant list controller");
includes(participantListSource, "function applyStudyTitleFit", "participant list controller");
includes(participantListSource, "element.textContent = fitted ? `${prefix}${fitted}…` : `${prefix}…`;", "participant list controller");
includes(participantListSource, "if (!participant.can_reveal_contact) return \"\";", "participant list controller");
excludes(participantListSource, "Details revealed", "participant list controller");
excludes(participantListSource, "Contact details restricted", "participant list controller");

includes(muralIntegrationSource, "Project Dashboard ↔ Mural wiring with GOV.UK Frontend dashboard state", "Mural integration component");
includes(muralIntegrationSource, "location.hostname.endsWith(\"pages.dev\")", "Mural integration component");
includes(muralIntegrationSource, "function resolveApiBase()", "Mural integration component");
includes(muralIntegrationSource, "document.documentElement?.dataset?.apiOrigin", "Mural integration component");
includes(muralIntegrationSource, "window.API_ORIGIN", "Mural integration component");
includes(muralIntegrationSource, "return \"\";", "Mural integration component");
includes(muralIntegrationSource, "function projectDashboardPath(projectId)", "Mural integration component");
includes(muralIntegrationSource, "function wireConnectButton(projectId)", "Mural integration component");
includes(muralIntegrationSource, "function verify()", "Mural integration component");
includes(muralIntegrationSource, "function resolveBoard(projectId)", "Mural integration component");
includes(muralIntegrationSource, "function updateSetupState()", "Mural integration component");
includes(muralIntegrationSource, "function setSetupAsCreate(projectId, projectName)", "Mural integration component");
includes(muralIntegrationSource, "function setSetupAsOpen(projectId, boardUrl)", "Mural integration component");
includes(muralIntegrationSource, "function observeProjectMeta()", "Mural integration component");
includes(muralIntegrationSource, "function hideConnectButton()", "Mural integration component");
includes(muralIntegrationSource, "function disableAll()", "Mural integration component");
includes(muralIntegrationSource, "function disableAll() {\n\t\thideConnectButton();", "Mural integration component");
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
excludes(muralIntegrationSource, "https://rops-api.digikev-kevin-rapley.workers.dev", "Mural integration component");

includes(muralStateSource, "Normalises Project Dashboard Mural action presentation", "Project Dashboard Mural state bridge");
includes(muralStateSource, "function hideLegacyOpenAction()", "Project Dashboard Mural state bridge");
includes(muralStateSource, "legacyOpen.hidden = true", "Project Dashboard Mural state bridge");
includes(muralStateSource, "function normaliseSetupActionLabel()", "Project Dashboard Mural state bridge");
includes(muralStateSource, 'setup.textContent = "Open Mural board";', "Project Dashboard Mural state bridge");
includes(muralStateSource, "new MutationObserver", "Project Dashboard Mural state bridge");
excludes(muralStateSource, "intentionally inert", "Project Dashboard Mural state bridge");
excludes(muralStateSource, "syncDashboardPresentation", "Project Dashboard Mural state bridge");

includes(dashboardSassSource, ".rops-dashboard-header", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-daas-brand-panel", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-dashboard-layout", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-dashboard-sidebar", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-project-areas-nav", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-dashboard-grid > .govuk-summary-card", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-dashboard-grid {\n\tdisplay: grid;\n\tgap: 30px;", "project dashboard Sass source");
includes(dashboardSassSource, "grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);", "project dashboard Sass source");
includes(dashboardSassSource, "align-self: start;", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-dashboard-sidebar > .govuk-summary-card", "project dashboard Sass source");
includes(dashboardSassSource, "margin-bottom: 0;", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-link-panel .govuk-button", "project dashboard Sass source");
includes(dashboardSassSource, "margin-bottom: 8px;", "project dashboard Sass source");
includes(dashboardSassSource, "#mural-connect[hidden]", "project dashboard Sass source");
includes(dashboardSassSource, "display: none;", "project dashboard Sass source");
excludes(dashboardSassSource, ".rops-mural-status", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-dashboard-sidebar {\n\t\tposition: sticky;", "project dashboard Sass source");
includes(dashboardSassSource, "position: sticky;", "project dashboard Sass source");
includes(dashboardSassSource, "top: 1rem;", "project dashboard Sass source");
includes(dashboardSassSource, "@media (min-width: 40.0625em)", "project dashboard Sass source");
includes(dashboardSassSource, "#1a1d35", "project dashboard Sass source");
includes(dashboardSassSource, "home-office-digital-triangles.svg", "project dashboard Sass source");
includes(dashboardSassSource, "background-position: right -3rem bottom -7rem;", "project dashboard Sass source");
includes(dashboardSassSource, "background-size: 50% 200%;", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-study-list", "project dashboard Sass source");
includes(dashboardSassSource, ".dashboard-action-panel", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-planning-grid", "project dashboard Sass source");
includes(dashboardSassSource, "minmax(170px, 1fr) minmax(0, 1fr);", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-participant-list-controls", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-study-title-truncated", "project dashboard Sass source");
includes(dashboardSassSource, "text-overflow: ellipsis;", "project dashboard Sass source");
includes(dashboardSassSource, "/* transparency begins in the cascade */", "project dashboard Sass source");
includes(dashboardCssSource, ".rops-dashboard-header", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-daas-brand-panel", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-dashboard-layout", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-dashboard-sidebar", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-project-areas-nav", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-dashboard-grid > .govuk-summary-card", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-dashboard-grid {\n\tdisplay: grid;\n\tgap: 30px;", "project dashboard stylesheet");
includes(dashboardCssSource, "grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);", "project dashboard stylesheet");
includes(dashboardCssSource, "align-self: start;", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-dashboard-sidebar > .govuk-summary-card", "project dashboard stylesheet");
includes(dashboardCssSource, "margin-bottom: 0;", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-link-panel .govuk-button", "project dashboard stylesheet");
includes(dashboardCssSource, "margin-bottom: 8px;", "project dashboard stylesheet");
includes(dashboardCssSource, "#mural-connect[hidden]", "project dashboard stylesheet");
includes(dashboardCssSource, "display: none;", "project dashboard stylesheet");
excludes(dashboardCssSource, ".rops-mural-status", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-dashboard-sidebar {\n\t\tposition: sticky;", "project dashboard stylesheet");
includes(dashboardCssSource, "position: sticky;", "project dashboard stylesheet");
includes(dashboardCssSource, "top: 1rem;", "project dashboard stylesheet");
includes(dashboardCssSource, "@media (min-width: 40.0625em)", "project dashboard stylesheet");
includes(dashboardCssSource, "#1a1d35", "project dashboard stylesheet");
includes(dashboardCssSource, "home-office-digital-triangles.svg", "project dashboard stylesheet");
includes(dashboardCssSource, "background-position: right -3rem bottom -7rem", "project dashboard stylesheet");
includes(dashboardCssSource, "background-size: 50% 200%", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-study-list", "project dashboard stylesheet");
includes(dashboardCssSource, ".dashboard-action-panel", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-planning-grid", "project dashboard stylesheet");
includes(dashboardCssSource, "minmax(170px, 1fr) minmax(0, 1fr);", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-participant-list-controls", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-study-title-truncated", "project dashboard stylesheet");
includes(dashboardCssSource, "text-overflow: ellipsis;", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.section {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.dashboard-section {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.board {", "project dashboard stylesheet");
