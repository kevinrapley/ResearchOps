import assert from "node:assert/strict";
import fs from "node:fs";

const controllerSource = fs.readFileSync("public/js/project-dashboard.js", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/project-dashboard.njk", "utf8");
const previewWorkerWorkflow = fs.readFileSync(".github/workflows/deploy-passwordless-preview-worker.yml", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

const controllerExpectations = [
  "function loadProjectFromD1List",
  "/api/projects?limit=200",
  "Project not found in D1-first project list",
  "loadProjectFromRecord(projectId)",
  "project-service-stage-tag",
  "project-stage-tag"
];

for (const text of controllerExpectations) {
  includes(controllerSource, text, "Project Dashboard controller");
}

includes(templateSource, "project-dashboard-d1-first-20260526", "Project Dashboard template");
includes(templateSource, "project-dashboard-mural-optional-20260526", "Project Dashboard template");
excludes(templateSource, "projects-api-proxy-20260514", "Project Dashboard template");

includes(previewWorkerWorkflow, ".passwordless-preview.secrets.json", "Passwordless preview Worker deploy workflow");
