import assert from "node:assert/strict";
import fs from "node:fs";

const controllerSource = fs.readFileSync(
	"public/js/project-dashboard.js",
	"utf8",
);
const templateSource = fs.readFileSync(
	"src/govuk/templates/pages/project-dashboard.njk",
	"utf8",
);
const workflowSource = fs.readFileSync(
	".github/workflows/deploy-passwordless-preview-worker.yml",
	"utf8",
);

function includes(source, text) {
	assert.ok(source.includes(text));
}

function excludes(source, text) {
	assert.equal(source.includes(text), false);
}

[
	"function loadProjectFromD1List",
	"/api/projects?limit=200",
	"Project not found in D1-first project list",
	"loadProjectFromRecord(projectId)",
	"project-service-stage-tag",
	"project-stage-tag",
].forEach((text) => includes(controllerSource, text));

includes(templateSource, "project-dashboard-d1-first-20260526");
includes(templateSource, "project-dashboard-mural-optional-20260526");
excludes(templateSource, "projects-api-proxy-20260514");
includes(workflowSource, ".passwordless-preview.secrets.json");
