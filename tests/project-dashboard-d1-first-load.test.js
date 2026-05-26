import assert from "node:assert/strict";
import fs from "node:fs";

const controllerSource = fs.readFileSync("public/js/project-dashboard.js", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/project-dashboard.njk", "utf8");
const previewWorkerWorkflow = fs.readFileSync(".github/workflows/deploy-passwordless-preview-worker.yml", "utf8");

function controllerIncludes(text) {
	assert.equal(controllerSource.includes(text), true, `Expected project-dashboard.js to include: ${text}`);
}

function templateIncludes(text) {
	assert.equal(templateSource.includes(text), true, `Expected project-dashboard.njk to include: ${text}`);
}

function templateExcludes(text) {
	assert.equal(templateSource.includes(text), false, `Expected project-dashboard.njk not to include: ${text}`);
}

function workflowIncludes(text) {
	assert.equal(previewWorkerWorkflow.includes(text), true, `Expected preview Worker workflow to include: ${text}`);
}

controllerIncludes("function loadProjectFromD1List");
controllerIncludes("/api/projects?limit=200");
controllerIncludes("Project not found in D1-first project list");
controllerIncludes("loadProjectFromRecord(projectId)");
controllerIncludes("project-service-stage-tag");
controllerIncludes("project-stage-tag");

templateIncludes("project-dashboard-d1-first-20260526");
templateIncludes("project-dashboard-mural-optional-20260526");
templateExcludes("projects-api-proxy-20260514");

workflowIncludes(".passwordless-preview.secrets.json");
