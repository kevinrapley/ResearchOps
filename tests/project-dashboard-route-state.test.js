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

function matches(source, pattern, label) {
	assert.match(source, pattern, `Expected ${label} to match: ${pattern}`);
}

function countOccurrences(source, text) {
	return source.split(text).length - 1;
}

function declarationBlock(source, selector, label) {
	const start = source.indexOf(selector);
	assert.notEqual(start, -1, `Expected ${label} to include selector: ${selector}`);
	const end = source.indexOf("}", start);
	assert.notEqual(end, -1, `Expected ${label} selector block to close: ${selector}`);
	return source.slice(start, end);
}

function projectAreasNavSource(source) {
	const start = source.indexOf("class=\"govuk-summary-card rops-project-areas-nav\"");
	if (start === -1) return "";
	const end = source.indexOf("</nav>", start);
	return source.slice(start, end);
}

includes(renderGovukPagesSource, "template: 'pages/project-dashboard.njk'", "GOV.UK page renderer");
includes(renderGovukPagesSource, "output: 'public/pages/project-dashboard/index.html'", "GOV.UK page renderer");

includes(layoutSource, "<x-include src=\"/partials/header.html\"", "GOV.UK layout");
matches(layoutSource, /<x-include src="\/partials\/footer\.html\{% if footerCacheKey %\}\?v=\{\{ footerCacheKey \}\}\{% endif %\}"><\/x-include>/, "GOV.UK layout");
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
	countOccurrences(templateSource, "class=\"govuk-summary-card__content govuk-body-s\""),
	6,
	"Expected non-navigation dashboard panels to use govuk-body-s content wrappers",
);
assert.equal(
	countOccurrences(templateSource, "class=\"govuk-summary-list govuk-body-s\""),
	2,
	"Expected dashboard summary lists to use dl.govuk-body-s",
);
excludes(projectAreasNavSource(templateSource), "govuk-summary-card__content govuk-body-s", "project areas navigation template");
assert.equal(
	templateSource.indexOf("{{ daasBrandPanel() }}") < templateSource.indexOf("class=\"rops-dashboard-layout\""),
	true,
	"Expected DaaS brand panel to render before the dashboard layout",
);
assert.equal(
	templateSource.indexOf("class=\"rops-dashboard-header\"") <
		templateSource.indexOf("class=\"rops-dashboard-sidebar\""),
	true,
	"Expected dashboard header to render before the sidebar in source order",
);
assert.equal(
	templateSource.indexOf("id=\"project-title\"") <
		templateSource.indexOf("class=\"govuk-summary-card rops-project-areas-nav\""),
	true,
	"Expected project title to render before the project areas navigation",
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
includes(daasPanelMacroSource, "id=\"leds-brand-panel\"", "DaaS brand panel macro");
includes(daasPanelMacroSource, "class=\"rops-leds-brand-panel\"", "DaaS brand panel macro");
includes(daasPanelMacroSource, "/images/brands/leds-logo-white.svg", "DaaS brand panel macro");
includes(templateSource, "id=\"kv-project-stage\"", "project dashboard template");
includes(templateSource, "id=\"project-description-region\"", "project dashboard template");
includes(templateSource, "Loading service stage", "project dashboard template");
includes(templateSource, "Loading project stage", "project dashboard template");
includes(templateSource, "Mural optional", "project dashboard template");
includes(templateSource, "project-dashboard.js?v=project-dashboard-leds-brand-panel-20260624", "project dashboard template");
includes(templateSource, "project-dashboard.css?v=project-dashboard-leds-brand-panel-20260624", "project dashboard template");
includes(templateSource, "project-dashboard-participants-list.js?v=participant-list-reveal-hide-20260602", "project dashboard template");
excludes(templateSource, "project-dashboard-participants-list.js?v=participant-list-controls-20260601", "project dashboard template");
includes(templateSource, "text: \"Dashboard\"", "project dashboard template");
includes(templateSource, "id: \"breadcrumb-project\"", "project dashboard template");
includes(templateSource, "href: \"/pages/project-dashboard/?id=\"", "project dashboard template");
includes(templateSource, "rops-planning-grid", "project dashboard template");
includes(templateSource, "id: \"add-stakeholder-toggle\"", "project dashboard template");
includes(templateSource, "\"aria-controls\": \"add-stakeholder-panel\"", "project dashboard template");
includes(templateSource, "href=\"#project-objectives\"", "project dashboard template");
includes(templateSource, "id=\"project-objectives\"", "project dashboard template");
includes(templateSource, "Project Objectives", "project dashboard template");
includes(templateSource, "id=\"objectives-list\"", "project dashboard template");
includes(templateSource, "class=\"rops-objectives-list\" id=\"objectives-list\"", "project dashboard template");
excludes(templateSource, "class=\"govuk-list govuk-list--spaced rops-divided-list\" id=\"objectives-list\"", "project dashboard template");
includes(templateSource, "id: \"add-objective-toggle\"", "project dashboard template");
assert.equal(
	templateSource.indexOf("id=\"stakeholders\"") < templateSource.indexOf("id=\"project-objectives\""),
	true,
	"Expected Project Objectives to render after Stakeholder management",
);
assert.equal(
	templateSource.indexOf("id=\"project-objectives\"") < templateSource.indexOf("id=\"planning\""),
	true,
	"Expected Project Objectives to render before Research planning",
);
assert.equal(
	templateSource.indexOf("id=\"stakeholders\"") < templateSource.indexOf("id=\"objectives-list\""),
	true,
	"Expected objectives list to render outside the Stakeholder management card",
);
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
matches(pageSource, /<x-include src="\/partials\/footer\.html(?:\?[^"]*)?"/, "project dashboard page");
includes(pageSource, "class=\"govuk-summary-card\"", "project dashboard page");
includes(pageSource, "class=\"govuk-summary-list govuk-body-s\"", "project dashboard page");
includes(pageSource, "id=\"project-title\"", "project dashboard page");
includes(pageSource, "id=\"breadcrumb-project\"", "project dashboard page");
includes(pageSource, "id=\"daas-brand-panel\"", "project dashboard page");
includes(pageSource, "id=\"leds-brand-panel\"", "project dashboard page");
excludes(pageSource, "id=\"mural-status\"", "project dashboard page");
excludes(pageSource, "class=\"rops-mural-status\"", "project dashboard page");
includes(pageSource, "class=\"rops-daas-brand-panel\"", "project dashboard page");
includes(pageSource, "class=\"rops-leds-brand-panel\"", "project dashboard page");
includes(pageSource, "class=\"rops-dashboard-layout\"", "project dashboard page");
includes(pageSource, "class=\"rops-dashboard-sidebar\"", "project dashboard page");
includes(pageSource, "class=\"govuk-summary-card rops-project-areas-nav\"", "project dashboard page");
includes(pageSource, "class=\"rops-dashboard-content\"", "project dashboard page");
assert.equal(
	countOccurrences(pageSource, "class=\"govuk-summary-card__content govuk-body-s\""),
	6,
	"Expected rendered non-navigation dashboard panels to use govuk-body-s content wrappers",
);
assert.equal(
	countOccurrences(pageSource, "class=\"govuk-summary-list govuk-body-s\""),
	2,
	"Expected rendered dashboard summary lists to use dl.govuk-body-s",
);
excludes(projectAreasNavSource(pageSource), "govuk-summary-card__content govuk-body-s", "rendered project areas navigation");
includes(pageSource, "id=\"mural-connect\"", "project dashboard page");
includes(pageSource, "hidden", "project dashboard page");
includes(pageSource, "href=\"#project-objectives\"", "project dashboard page");
includes(pageSource, "id=\"project-objectives\"", "project dashboard page");
includes(pageSource, "Project Objectives", "project dashboard page");
includes(pageSource, "id=\"objectives-list\"", "project dashboard page");
includes(pageSource, "class=\"rops-objectives-list\" id=\"objectives-list\"", "project dashboard page");
excludes(pageSource, "class=\"govuk-list govuk-list--spaced rops-divided-list\" id=\"objectives-list\"", "project dashboard page");
includes(pageSource, "id=\"add-objective-toggle\"", "project dashboard page");
assert.equal(
	pageSource.indexOf("id=\"daas-brand-panel\"") < pageSource.indexOf("class=\"rops-dashboard-layout\""),
	true,
	"Expected DaaS brand panel to stay before the dashboard layout",
);
assert.equal(
	pageSource.indexOf("class=\"rops-dashboard-header\"") < pageSource.indexOf("class=\"rops-dashboard-sidebar\""),
	true,
	"Expected rendered dashboard header to come before the sidebar in source order",
);
assert.equal(
	pageSource.indexOf("id=\"project-title\"") <
		pageSource.indexOf("class=\"govuk-summary-card rops-project-areas-nav\""),
	true,
	"Expected rendered project title to come before the project areas navigation",
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
assert.equal(
	pageSource.indexOf("id=\"stakeholders\"") < pageSource.indexOf("id=\"project-objectives\""),
	true,
	"Expected Project Objectives to render after Stakeholder management",
);
assert.equal(
	pageSource.indexOf("id=\"project-objectives\"") < pageSource.indexOf("id=\"planning\""),
	true,
	"Expected Project Objectives to render before Research planning",
);
assert.equal(
	pageSource.indexOf("id=\"stakeholders\"") < pageSource.indexOf("id=\"objectives-list\""),
	true,
	"Expected objectives list to render outside the Stakeholder management card",
);
includes(pageSource, "/images/brands/daas-logo.svg", "project dashboard page");
includes(pageSource, "project-dashboard.js?v=project-dashboard-leds-brand-panel-20260624", "project dashboard page");
includes(pageSource, "project-dashboard.css?v=project-dashboard-leds-brand-panel-20260624", "project dashboard page");
includes(pageSource, "id=\"project-description-region\"", "project dashboard page");
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
includes(controllerSource, "function renderProjectDescription", "project dashboard controller");
includes(controllerSource, "function beginDescriptionEdit", "project dashboard controller");
includes(controllerSource, "data-description-edit", "project dashboard controller");
includes(controllerSource, "data-description-editor", "project dashboard controller");
includes(controllerSource, "await saveProjectPatch({ description: nextDescription });", "project dashboard controller");
includes(controllerSource, "currentProject.description = nextDescription;", "project dashboard controller");
includes(controllerSource, "initDescriptionInlineEditing();", "project dashboard controller");
includes(controllerSource, "function parseObjectiveMarkdownList", "project dashboard controller");
includes(controllerSource, "function objectiveMarkdownItems", "project dashboard controller");
includes(controllerSource, "function objectiveLines", "project dashboard controller");
includes(controllerSource, "function objectiveListHtml", "project dashboard controller");
includes(controllerSource, "line.match(/^\\d+[.)]\\s+(.+)$/)", "project dashboard controller");
includes(controllerSource, "line.match(/^[-*+]\\s+(.+)$/)", "project dashboard controller");
includes(controllerSource, "govuk-list govuk-list--number rops-objective-list", "project dashboard controller");
includes(controllerSource, "govuk-list govuk-list--bullet rops-objective-list__sublist", "project dashboard controller");
includes(controllerSource, "data-objective-edit", "project dashboard controller");
includes(controllerSource, "data-objective-editor-index", "project dashboard controller");
includes(controllerSource, "listItem.classList.add(\"rops-objective-list__item--editing\")", "project dashboard controller");
includes(controllerSource, "textarea?.addEventListener(\"blur\"", "project dashboard controller");
excludes(controllerSource, "}, { once: true });", "project dashboard controller");
includes(controllerSource, "else nextObjectives.splice(index, 1);", "project dashboard controller");
includes(controllerSource, "await saveProjectPatch({ objectives: nextObjectives });", "project dashboard controller");
includes(controllerSource, "currentProject.objectives = nextObjectives;\n\t\t\trenderObjectives(nextObjectives);", "project dashboard controller");
includes(
	controllerSource,
	"list.innerHTML = parsedObjectives.length ? objectiveListHtml(parsedObjectives) : '<p class=\"govuk-body-s\">No objectives yet.</p>';",
	"project dashboard controller",
);
includes(controllerSource, "initObjectiveInlineEditing();", "project dashboard controller");
includes(controllerSource, "event.key !== \"Enter\" && event.key !== \" \"", "project dashboard controller");
includes(controllerSource, "function normaliseBrandKey", "project dashboard controller");
includes(controllerSource, "project.teamName", "project dashboard controller");
includes(controllerSource, "teamNames: normaliseCommaList(project.teamNames ?? project.team_names ?? project[\"Team Names\"])", "project dashboard controller");
includes(controllerSource, "function brandValues", "project dashboard controller");
includes(controllerSource, "project.teamNames", "project dashboard controller");
includes(controllerSource, ".flatMap(brandValues)", "project dashboard controller");
includes(controllerSource, "rops-daas-brand-panel--visible", "project dashboard controller");
includes(controllerSource, "rops-leds-brand-panel--visible", "project dashboard controller");
includes(controllerSource, "function renderStudies", "project dashboard controller");
includes(controllerSource, "function isStudiesUnavailableError", "project dashboard controller");
includes(controllerSource, "if (isStudiesUnavailableError(error)) return [];", "project dashboard controller");
includes(controllerSource, "No studies have been created for this project yet.", "project dashboard controller");
includes(controllerSource, "function setTagText", "project dashboard controller");
includes(controllerSource, "project[\"Service stage\"]", "project dashboard controller");
includes(controllerSource, "project[\"Project stage\"]", "project dashboard controller");
includes(controllerSource, "setTagText(\"project-service-stage-tag\", project.phase", "project dashboard controller");
includes(controllerSource, "setTagText(\"project-stage-tag\", project.status", "project dashboard controller");
includes(controllerSource, "method: \"PATCH\"", "project dashboard controller");
includes(controllerSource, "credentials: \"include\"", "project dashboard controller");
includes(controllerSource, "class=\"govuk-link govuk-!-font-weight-bold\"", "project dashboard controller");
excludes(controllerSource, "Could not load studies", "project dashboard controller");
excludes(controllerSource, "Study records could not be loaded for this project.", "project dashboard controller");
excludes(controllerSource, "Service stage not recorded", "project dashboard controller");
excludes(controllerSource, "Project stage not recorded", "project dashboard controller");
excludes(controllerSource, "rops-api.digikev-kevin-rapley.workers.dev", "project dashboard controller");
excludes(controllerSource, "alert(\"Could not load project.\");", "project dashboard controller");

includes(dashboardSassSource, ".rops-objective-list__display[role='button']", "project dashboard stylesheet");
includes(dashboardSassSource, ".rops-dashboard-description[role='button']", "project dashboard stylesheet");
includes(dashboardSassSource, ".rops-dashboard-description[role='button']:focus", "project dashboard stylesheet");
includes(dashboardSassSource, ".rops-description-editor__textarea", "project dashboard stylesheet");
includes(dashboardSassSource, ".rops-description-editor {\n\twidth: 100%;", "project dashboard stylesheet");
includes(dashboardSassSource, ".rops-description-editor__textarea {\n\tbox-sizing: border-box;\n\tmin-height: 9rem;\n\tresize: vertical;\n\twidth: 100%;", "project dashboard stylesheet");
includes(dashboardSassSource, ".rops-objective-list__display[role='button']:focus", "project dashboard stylesheet");
includes(dashboardSassSource, ".rops-objective-list > .rops-objective-list__item--editing", "project dashboard stylesheet");
includes(dashboardSassSource, "list-style: none;", "project dashboard stylesheet");
includes(dashboardSassSource, ".rops-objective-editor__textarea", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-objective-list__display[role=button]", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-dashboard-description[role=button]", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-dashboard-description[role=button]:focus", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-description-editor__textarea", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-description-editor {\n\twidth: 100%;", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-description-editor__textarea {\n\tbox-sizing: border-box;\n\tmin-height: 9rem;\n\tresize: vertical;\n\twidth: 100%;", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-objective-list__display[role=button]:focus", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-objective-list > .rops-objective-list__item--editing", "project dashboard stylesheet");

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
includes(muralIntegrationSource, "`${API_ORIGIN}/api/mural/auth?return=${encodeURIComponent(backPath)}`", "Mural integration component");
includes(muralIntegrationSource, "`${API_ORIGIN}/api/mural/verify`", "Mural integration component");
includes(muralIntegrationSource, "`${API_ORIGIN}/api/mural/setup`", "Mural integration component");
includes(muralIntegrationSource, "`${API_ORIGIN}/api/mural/resolve?projectId=${encodeURIComponent(pid)}`", "Mural integration component");
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
includes(dashboardSassSource, ".rops-leds-brand-panel", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-dashboard-layout", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-dashboard-sidebar", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-project-areas-nav", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-dashboard-grid > .govuk-summary-card", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-dashboard-grid {\n\tdisplay: grid;\n\tgap: 30px;", "project dashboard Sass source");
includes(dashboardSassSource, "column-gap: 20px;", "project dashboard Sass source");
includes(dashboardSassSource, "row-gap: 30px;", "project dashboard Sass source");
includes(dashboardSassSource, "grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-dashboard-header {\n\t\tgrid-column: 2;\n\t\tgrid-row: 1;", "project dashboard Sass source");
includes(dashboardSassSource, "align-self: start;", "project dashboard Sass source");
includes(dashboardSassSource, "grid-row: 1 / span 2;", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-dashboard-content {\n\t\tgrid-column: 2;\n\t\tgrid-row: 2;", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-dashboard-sidebar > .govuk-summary-card", "project dashboard Sass source");
includes(dashboardSassSource, "margin-bottom: 0;", "project dashboard Sass source");
includes(dashboardSassSource, ".govuk-summary-card:not(.rops-project-areas-nav) .govuk-summary-card__content.govuk-body-s", "project dashboard Sass source");
includes(dashboardSassSource, ".govuk-body,", "project dashboard Sass source");
includes(dashboardSassSource, "dl.govuk-body-s {\n\tfont-size: inherit;\n\tline-height: inherit;", "project dashboard Sass source");
includes(dashboardSassSource, ".govuk-summary-card:not(.rops-project-areas-nav) dl.govuk-body-s", "project dashboard Sass source");
includes(dashboardSassSource, ".govuk-summary-list__value", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-link-panel .govuk-button", "project dashboard Sass source");
includes(dashboardSassSource, "margin-bottom: 8px;", "project dashboard Sass source");
includes(dashboardSassSource, "#mural-connect[hidden]", "project dashboard Sass source");
includes(dashboardSassSource, "display: none;", "project dashboard Sass source");
excludes(dashboardSassSource, ".rops-mural-status", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-dashboard-sidebar {\n\t\tgrid-column: 1;", "project dashboard Sass source");
includes(dashboardSassSource, "position: sticky;", "project dashboard Sass source");
includes(dashboardSassSource, "top: 1rem;", "project dashboard Sass source");
includes(dashboardSassSource, "@media (min-width: 40.0625em)", "project dashboard Sass source");
includes(dashboardSassSource, "#1a1d35", "project dashboard Sass source");
includes(dashboardSassSource, "home-office-digital-triangles.svg", "project dashboard Sass source");
includes(dashboardSassSource, "background-position: right -3rem bottom -7rem;", "project dashboard Sass source");
includes(dashboardSassSource, "background-size: 50% 200%;", "project dashboard Sass source");
const sassLedsOverlayBlock = declarationBlock(
	dashboardSassSource,
	".rops-leds-brand-panel--visible::after",
	"project dashboard Sass source",
);
includes(sassLedsOverlayBlock, "home-office-digital-triangles.svg", "project dashboard LEDS overlay");
includes(sassLedsOverlayBlock, "backdrop-filter: brightness(0.65);", "project dashboard LEDS overlay");
includes(sassLedsOverlayBlock, "background-blend-mode: soft-light;", "project dashboard LEDS overlay");
includes(sassLedsOverlayBlock, "background-position: right -2.5rem bottom -5.75rem;", "project dashboard LEDS overlay");
includes(sassLedsOverlayBlock, "background-size: 50% 200%;", "project dashboard LEDS overlay");
includes(dashboardSassSource, ".rops-study-list", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-objective-list", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-objective-list > li", "project dashboard Sass source");
includes(dashboardSassSource, ".rops-objective-list__sublist > li", "project dashboard Sass source");
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
includes(dashboardCssSource, "column-gap: 20px;", "project dashboard stylesheet");
includes(dashboardCssSource, "row-gap: 30px;", "project dashboard stylesheet");
includes(dashboardCssSource, "grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-dashboard-header {\n\t\tgrid-column: 2;\n\t\tgrid-row: 1;", "project dashboard stylesheet");
includes(dashboardCssSource, "align-self: start;", "project dashboard stylesheet");
includes(dashboardCssSource, "grid-row: 1/span 2;", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-dashboard-content {\n\t\tgrid-column: 2;\n\t\tgrid-row: 2;", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-dashboard-sidebar > .govuk-summary-card", "project dashboard stylesheet");
includes(dashboardCssSource, "margin-bottom: 0;", "project dashboard stylesheet");
includes(dashboardCssSource, ".govuk-summary-card:not(.rops-project-areas-nav) .govuk-summary-card__content.govuk-body-s", "project dashboard stylesheet");
includes(dashboardCssSource, ".govuk-summary-card:not(.rops-project-areas-nav) .govuk-summary-card__content.govuk-body-s .govuk-body", "project dashboard stylesheet");
includes(
	dashboardCssSource,
	".govuk-summary-card:not(.rops-project-areas-nav) .govuk-summary-card__content.govuk-body-s dl.govuk-body-s",
	"project dashboard stylesheet",
);
includes(dashboardCssSource, ".govuk-summary-card:not(.rops-project-areas-nav) dl.govuk-body-s", "project dashboard stylesheet");
includes(dashboardCssSource, ".govuk-summary-list__value", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-link-panel .govuk-button", "project dashboard stylesheet");
includes(dashboardCssSource, "margin-bottom: 8px;", "project dashboard stylesheet");
includes(dashboardCssSource, "#mural-connect[hidden]", "project dashboard stylesheet");
includes(dashboardCssSource, "display: none;", "project dashboard stylesheet");
excludes(dashboardCssSource, ".rops-mural-status", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-dashboard-sidebar {\n\t\tgrid-column: 1;", "project dashboard stylesheet");
includes(dashboardCssSource, "position: sticky;", "project dashboard stylesheet");
includes(dashboardCssSource, "top: 1rem;", "project dashboard stylesheet");
includes(dashboardCssSource, "@media (min-width: 40.0625em)", "project dashboard stylesheet");
includes(dashboardCssSource, "#1a1d35", "project dashboard stylesheet");
includes(dashboardCssSource, "home-office-digital-triangles.svg", "project dashboard stylesheet");
includes(dashboardCssSource, "background-position: right -3rem bottom -7rem", "project dashboard stylesheet");
includes(dashboardCssSource, "background-size: 50% 200%", "project dashboard stylesheet");
const cssLedsOverlayBlock = declarationBlock(
	dashboardCssSource,
	".rops-leds-brand-panel--visible::after",
	"project dashboard stylesheet",
);
includes(cssLedsOverlayBlock, "home-office-digital-triangles.svg", "project dashboard LEDS overlay");
includes(cssLedsOverlayBlock, "backdrop-filter: brightness(0.65)", "project dashboard LEDS overlay");
includes(cssLedsOverlayBlock, "background-blend-mode: soft-light", "project dashboard LEDS overlay");
includes(cssLedsOverlayBlock, "background-position: right -2.5rem bottom -5.75rem", "project dashboard LEDS overlay");
includes(cssLedsOverlayBlock, "background-size: 50% 200%", "project dashboard LEDS overlay");
includes(dashboardCssSource, ".rops-leds-brand-panel", "project dashboard stylesheet");
includes(dashboardCssSource, "#1a1d35", "project dashboard stylesheet");
includes(dashboardCssSource, "leds-panel-background.png", "project dashboard stylesheet");
includes(dashboardCssSource, "mix-blend-mode: screen", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-study-list", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-objective-list", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-objective-list > li", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-objective-list__sublist > li", "project dashboard stylesheet");
includes(dashboardCssSource, ".dashboard-action-panel", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-planning-grid", "project dashboard stylesheet");
includes(dashboardCssSource, "minmax(170px, 1fr) minmax(0, 1fr);", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-participant-list-controls", "project dashboard stylesheet");
includes(dashboardCssSource, ".rops-study-title-truncated", "project dashboard stylesheet");
includes(dashboardCssSource, "text-overflow: ellipsis;", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.section {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.dashboard-section {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.board {", "project dashboard stylesheet");
