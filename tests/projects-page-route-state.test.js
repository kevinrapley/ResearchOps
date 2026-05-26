import assert from "node:assert/strict";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const pageSource = fs.readFileSync("public/pages/projects/index.html", "utf8");
const projectsTemplate = fs.readFileSync("src/govuk/templates/pages/projects.njk", "utf8");
const controllerSource = fs.readFileSync("public/js/projects-page.js", "utf8");
const projectsSass = fs.readFileSync("src/styles/projects.scss", "utf8");
const projectsCss = fs.readFileSync("public/css/projects.css", "utf8");
const renderScript = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");
const dashboardSource = fs.readFileSync("public/js/project-dashboard.js", "utf8");
const workerSource = fs.readFileSync("infra/cloudflare/src/worker.js", "utf8");
const projectReadRouteSource = fs.readFileSync("infra/cloudflare/src/service/project-record-routes.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(packageJson.scripts.build, "npm run build:projects", "package build script");
includes(packageJson.scripts["build:projects"], "src/styles/projects.scss public/css/projects.css", "package build scripts");

includes(renderScript, "template: 'pages/projects.njk'", "GOV.UK page renderer");
includes(renderScript, "output: 'public/pages/projects/index.html'", "GOV.UK page renderer");
includes(renderScript, "activeNavigation: 'Projects'", "GOV.UK page renderer");

for (const source of [projectsTemplate, pageSource]) {
	includes(source, "id=\"project-summary-card-template\"", "Projects summary-card source");
	includes(source, "class=\"govuk-summary-card rops-project-card\"", "Projects summary-card source");
	includes(source, "class=\"govuk-summary-card__title-wrapper\"", "Projects summary-card source");
	includes(source, "class=\"govuk-summary-card__actions\"", "Projects summary-card source");
	includes(source, "class=\"govuk-summary-list govuk-summary-list--no-border rops-project-summary-list\"", "Projects summary-card source");
	includes(source, "class=\"govuk-summary-list__row\"", "Projects summary-card source");
	includes(source, "class=\"govuk-details rops-project-details\"", "Projects summary-card source");
	includes(source, "class=\"govuk-details__summary\"", "Projects summary-card source");
	includes(source, "class=\"govuk-details__text\"", "Projects summary-card source");
	includes(source, "data-project-field=\"name\"", "Projects summary-card source");
	includes(source, "data-project-field=\"team\"", "Projects summary-card source");
	includes(source, "data-project-list=\"user-groups\"", "Projects summary-card source");
	includes(source, "data-project-list=\"stakeholders\"", "Projects summary-card source");
	includes(source, "data-project-list=\"objectives\"", "Projects summary-card source");
	excludes(source, "class=\"card\"", "Projects summary-card source");
	excludes(source, "project-meta", "Projects summary-card source");
	excludes(source, "project-title", "Projects summary-card source");
	excludes(source, "class=\"tag\"", "Projects summary-card source");
}

includes(pageSource, "id=\"list\" class=\"projects-list\"", "Projects page");
includes(pageSource, "class=\"projects-page-actions\" hidden", "Projects page");
includes(pageSource, "projects-govuk-summary-card-20260524", "Projects page");
includes(pageSource, "class=\"govuk-notification-banner govuk-notification-banner--error projects-error-state\"", "Projects page");
includes(pageSource, "class=\"govuk-inset-text projects-empty-state\"", "Projects page");
excludes(pageSource, "rops-api.digikev-kevin-rapley.workers.dev", "Projects page");

includes(controllerSource, "credentials: \"include\"", "Projects controller");
includes(controllerSource, "resolveApiBase", "Projects controller");
includes(controllerSource, "function apiUrl", "Projects controller");
includes(controllerSource, "apiUrl(\"/api/projects\")", "Projects controller");
includes(controllerSource, "id: firstPresent(p.id, p.airtableId, p.recordId)", "Projects controller");
includes(controllerSource, "projectDashboardHref", "Projects controller");
includes(controllerSource, "setStartProjectVisible", "Projects controller");
includes(controllerSource, "const TEMPLATE_IDS", "Projects controller");
includes(controllerSource, "function templateContent", "Projects controller");
includes(controllerSource, "function populateProjectCard", "Projects controller");
includes(controllerSource, "function createProjectCard", "Projects controller");
includes(controllerSource, "data-project-field", "Projects controller");
includes(controllerSource, "data-project-list", "Projects controller");
includes(controllerSource, "container.replaceChildren", "Projects controller");
excludes(controllerSource, "projects.csv", "Projects controller");
excludes(controllerSource, "rops-api.digikev-kevin-rapley.workers.dev", "Projects controller");
excludes(controllerSource, "location.hostname.endsWith(\"pages.dev\")", "Projects controller");
excludes(controllerSource, "class=\"card\"", "Projects controller");
excludes(controllerSource, "project-meta", "Projects controller");
excludes(controllerSource, "project-title", "Projects controller");
excludes(controllerSource, "project-details", "Projects controller");

includes(controllerSource, "function isAirtableRecordId", "Projects controller");
includes(controllerSource, "function isRenderableProject", "Projects controller");
includes(controllerSource, "projects: projects.filter(isRenderableProject)", "Projects controller");
includes(controllerSource, "VALID_PROJECT_PHASES", "Projects controller");
includes(controllerSource, "looksLikeUuid", "Projects controller");
includes(controllerSource, "function malformedBanner", "Projects controller");
includes(controllerSource, "[projects-page] /api/projects returned project records that cannot be rendered safely", "Projects controller");
excludes(controllerSource, "if (!project.id) return \"\"", "Projects controller");
excludes(controllerSource, "function unrenderableProjectCard", "Projects controller");

for (const source of [projectsSass, projectsCss]) {
	includes(source, "Repo:       /src/styles/projects.scss", "Projects route stylesheet");
	includes(source, ".rops-project-details__columns", "Projects route stylesheet");
	includes(source, "grid-template-columns: 1fr 1fr;", "Projects route stylesheet");
	includes(source, "/* transparency begins in the cascade */", "Projects route stylesheet");
	excludes(source, ".govuk-summary-card", "Projects route stylesheet");
	excludes(source, ".govuk-details__summary", "Projects route stylesheet");
	excludes(source, ".govuk-tag", "Projects route stylesheet");
	excludes(source, ".project-title", "Projects route stylesheet");
	excludes(source, ".project-meta", "Projects route stylesheet");
	excludes(source, ".tag", "Projects route stylesheet");
}

includes(dashboardSource, "async function loadProject(projectId)", "Project dashboard controller");
includes(dashboardSource, "credentials: \"include\"", "Project dashboard controller");
includes(dashboardSource, "projectAirtableId", "Project dashboard controller");
excludes(dashboardSource, "rops-api.digikev-kevin-rapley.workers.dev", "Project dashboard controller");
excludes(dashboardSource, "location.hostname.endsWith(\"pages.dev\")", "Project dashboard controller");

includes(workerSource, "listProjectRecords(request, env, authContext)", "Worker");
includes(workerSource, "getProjectRecord(request, env, projectId, authContext)", "Worker");

includes(projectReadRouteSource, "AIRTABLE_TABLE_PROJECTS", "Project read route");
includes(projectReadRouteSource, "Record ID", "Project read route");
includes(projectReadRouteSource, "isAirtableRecordId", "Project read route");
excludes(projectReadRouteSource, "PID-", "Project read route");
