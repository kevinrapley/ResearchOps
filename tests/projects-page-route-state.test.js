import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/projects/index.html", "utf8");
const controllerSource = fs.readFileSync("public/js/projects-page.js", "utf8");
const dashboardSource = fs.readFileSync("public/js/project-dashboard.js", "utf8");
const workerSource = fs.readFileSync("infra/cloudflare/src/worker.js", "utf8");
const projectReadRouteSource = fs.readFileSync("infra/cloudflare/src/service/project-record-routes.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "id=\"list\" class=\"projects-list\"", "Projects page");
includes(pageSource, "class=\"projects-page-actions\" hidden", "Projects page");
includes(pageSource, "src=\"/js/projects-page.js?v=projects-api-proxy-20260514\"", "Projects page");
includes(pageSource, "rel=\"modulepreload\" href=\"/js/projects-page.js?v=projects-api-proxy-20260514\"", "Projects page");
excludes(pageSource, "rops-api.digikev-kevin-rapley.workers.dev", "Projects page");

includes(controllerSource, "credentials: \"include\"", "Projects controller");
includes(controllerSource, "resolveApiBase", "Projects controller");
includes(controllerSource, "function apiUrl", "Projects controller");
includes(controllerSource, "apiUrl(\"/api/projects\")", "Projects controller");
includes(controllerSource, "id: firstPresent(p.id, p.airtableId, p.recordId)", "Projects controller");
includes(controllerSource, "projectDashboardHref", "Projects controller");
includes(controllerSource, "setStartProjectVisible", "Projects controller");
excludes(controllerSource, "projects.csv", "Projects controller");
excludes(controllerSource, "rops-api.digikev-kevin-rapley.workers.dev", "Projects controller");
excludes(controllerSource, "location.hostname.endsWith(\"pages.dev\")", "Projects controller");

// Records that cannot safely build a real Airtable-backed dashboard link
// must be hidden from the rendered list. The controller validates more than
// presence of an id: the id must be a rec... Airtable record id, the phase
// must be project-like, and malformed identity fragments or UUID statuses
// are blocked from card rendering.
includes(controllerSource, "function isAirtableRecordId", "Projects controller");
includes(controllerSource, "function isRenderableProject", "Projects controller");
includes(controllerSource, "projects: projects.filter(isRenderableProject)", "Projects controller");
includes(controllerSource, "VALID_PROJECT_PHASES", "Projects controller");
includes(controllerSource, "looksLikeUuid", "Projects controller");
includes(controllerSource, "function malformedBanner", "Projects controller");
includes(
	controllerSource,
	"[projects-page] /api/projects returned project records that cannot be rendered safely",
	"Projects controller",
);
excludes(controllerSource, "if (!project.id) return \"\"", "Projects controller");
excludes(controllerSource, "function unrenderableProjectCard", "Projects controller");

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
