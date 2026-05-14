import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/project-dashboard/index.html", "utf8");
const controllerSource = fs.readFileSync("public/js/project-dashboard.js", "utf8");
const dashboardCssSource = fs.readFileSync("public/css/project-dashboard.css", "utf8");
const buttonCssSource = fs.readFileSync("public/css/govuk/govuk-buttons.css", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "href=\"/css/screen.css\"", "project dashboard page");
includes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "project dashboard page");
includes(pageSource, "href=\"/css/project-dashboard.css\"", "project dashboard page");
includes(pageSource, "/js/project-dashboard.js", "project dashboard page");
includes(pageSource, "rel=\"modulepreload\" href=\"/js/project-dashboard.js\"", "project dashboard page");
includes(pageSource, "id=\"project-title\"", "project dashboard page");
includes(pageSource, "id=\"journal-link\"", "project dashboard page");
includes(pageSource, "id=\"outcomes-link\"", "project dashboard page");
includes(pageSource, "id=\"mural-integration\"", "project dashboard page");
includes(pageSource, "id=\"add-stakeholder-form\"", "project dashboard page");
includes(pageSource, "id=\"add-objective-form\"", "project dashboard page");
includes(pageSource, "id=\"add-user-group-form\"", "project dashboard page");
includes(pageSource, "id=\"add-participant-link\"", "project dashboard page");
includes(pageSource, "id=\"import-participants-link\"", "project dashboard page");
includes(pageSource, "id=\"add-study-link\"", "project dashboard page");
includes(pageSource, "id=\"add-insight-link\"", "project dashboard page");
includes(pageSource, "class=\"section\"", "project dashboard page");
includes(pageSource, "class=\"section__header\"", "project dashboard page");
includes(pageSource, "class=\"section__title govuk-heading-m\"", "project dashboard page");
includes(pageSource, "class=\"section__body section__grid\"", "project dashboard page");
includes(pageSource, "class=\"govuk-button\"", "project dashboard page");
includes(pageSource, "class=\"govuk-button govuk-button--secondary\"", "project dashboard page");
excludes(pageSource, "id=\"study-dialog\"", "project dashboard page");
excludes(pageSource, "class=\"btn", "project dashboard page");
excludes(pageSource, "class=\"dashboard-section\"", "project dashboard page");
excludes(pageSource, "class=\"dashboard-section__header\"", "project dashboard page");
excludes(pageSource, "class=\"dashboard-section__title govuk-heading-m\"", "project dashboard page");
excludes(pageSource, "class=\"dashboard-section__body dashboard-section__grid\"", "project dashboard page");
excludes(pageSource, "<script type=\"module\">", "project dashboard page");
excludes(pageSource, "data-api-origin=\"https://rops-api.digikev-kevin-rapley.workers.dev\"", "project dashboard page");

includes(controllerSource, "const API_ORIGIN", "project dashboard controller");
includes(controllerSource, "window.API_ORIGIN", "project dashboard controller");
includes(controllerSource, "async function loadProject(projectId)", "project dashboard controller");
includes(controllerSource, "/api/projects/${encodeURIComponent(projectId)}", "project dashboard controller");
includes(controllerSource, "async function loadStudies", "project dashboard controller");
includes(controllerSource, "function renderProject", "project dashboard controller");
includes(controllerSource, "function renderStudies", "project dashboard controller");
includes(controllerSource, "async function saveProjectPatch", "project dashboard controller");
includes(controllerSource, "function initStakeholderForm", "project dashboard controller");
includes(controllerSource, "function initObjectiveForm", "project dashboard controller");
includes(controllerSource, "function initUserGroupForm", "project dashboard controller");
includes(controllerSource, "function initProjectActions", "project dashboard controller");
includes(controllerSource, "data-project-id", "project dashboard controller");
includes(controllerSource, "credentials: \"include\"", "project dashboard controller");
includes(controllerSource, "/api/projects", "project dashboard controller");
includes(controllerSource, "/api/studies", "project dashboard controller");
includes(controllerSource, "method: \"PATCH\"", "project dashboard controller");
excludes(controllerSource, "function pickProject", "project dashboard controller");
excludes(controllerSource, "async function loadProjects", "project dashboard controller");
excludes(controllerSource, "function initStudyModal", "project dashboard controller");

includes(buttonCssSource, ".govuk-button", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--secondary", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--warning", "GOV.UK button stylesheet");
includes(buttonCssSource, ".btn", "GOV.UK button stylesheet legacy alias");
includes(buttonCssSource, ".btn--secondary", "GOV.UK button stylesheet legacy alias");
includes(buttonCssSource, ".btn--outline", "GOV.UK button stylesheet legacy alias");

includes(dashboardCssSource, ".pill--neutral", "project dashboard stylesheet");
includes(dashboardCssSource, ".dashboard-action-panel", "project dashboard stylesheet");
includes(dashboardCssSource, ".dashboard-action-status", "project dashboard stylesheet");
includes(dashboardCssSource, "/* transparency begins in the cascade */", "project dashboard stylesheet");
excludes(dashboardCssSource, "#study-dialog", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.dashboard-hero {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.kv__list {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.board {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.board__item {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.section {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.section__header {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.section__body {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.section__grid {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.dashboard-section {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.dashboard-section__header {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.dashboard-section__body {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.dashboard-section__grid {", "project dashboard stylesheet");
excludes(dashboardCssSource, "\n.dropzone {", "project dashboard stylesheet");
