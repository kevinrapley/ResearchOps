import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/project-dashboard/index.html", "utf8");
const controllerSource = fs.readFileSync("public/js/project-dashboard.js", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "/js/project-dashboard.js", "project dashboard page");
includes(pageSource, "rel=\"modulepreload\" href=\"/js/project-dashboard.js\"", "project dashboard page");
includes(pageSource, "id=\"project-title\"", "project dashboard page");
includes(pageSource, "id=\"journal-link\"", "project dashboard page");
includes(pageSource, "id=\"outcomes-link\"", "project dashboard page");
includes(pageSource, "id=\"mural-integration\"", "project dashboard page");
includes(pageSource, "id=\"study-dialog\"", "project dashboard page");
excludes(pageSource, "<script type=\"module\">", "project dashboard page");
excludes(pageSource, "data-api-origin=\"https://rops-api.digikev-kevin-rapley.workers.dev\"", "project dashboard page");

includes(controllerSource, "const API_ORIGIN", "project dashboard controller");
includes(controllerSource, "window.API_ORIGIN", "project dashboard controller");
includes(controllerSource, "function pickProject", "project dashboard controller");
includes(controllerSource, "async function loadProjects", "project dashboard controller");
includes(controllerSource, "async function loadStudies", "project dashboard controller");
includes(controllerSource, "function renderProject", "project dashboard controller");
includes(controllerSource, "function renderStudies", "project dashboard controller");
includes(controllerSource, "function initStudyModal", "project dashboard controller");
includes(controllerSource, "data-project-id", "project dashboard controller");
includes(controllerSource, "/api/projects", "project dashboard controller");
includes(controllerSource, "/api/studies", "project dashboard controller");
