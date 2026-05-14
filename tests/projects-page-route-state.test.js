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
includes(pageSource, "src=\"/js/projects-page.js", "Projects page");

includes(controllerSource, "credentials: \"include\"", "Projects controller");
includes(controllerSource, "id: firstPresent(p.id, p.airtableId, p.recordId)", "Projects controller");
includes(controllerSource, "projectDashboardHref", "Projects controller");
includes(controllerSource, "setStartProjectVisible", "Projects controller");
excludes(controllerSource, "projects.csv", "Projects controller");

includes(dashboardSource, "async function loadProject(projectId)", "Project dashboard controller");
includes(dashboardSource, "credentials: \"include\"", "Project dashboard controller");
includes(dashboardSource, "projectAirtableId", "Project dashboard controller");

includes(workerSource, "listProjectRecords(request, env, authContext)", "Worker");
includes(workerSource, "getProjectRecord(request, env, projectId, authContext)", "Worker");

includes(projectReadRouteSource, "AIRTABLE_TABLE_PROJECTS", "Project read route");
includes(projectReadRouteSource, "Record ID", "Project read route");
includes(projectReadRouteSource, "isAirtableRecordId", "Project read route");
excludes(projectReadRouteSource, "PID-", "Project read route");
