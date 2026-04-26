import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/project-dashboard/index.html", "utf8");
const controllerSource = fs.readFileSync("public/js/project-dashboard.js", "utf8");
const dashboardCssSource = fs.readFileSync("public/css/project-dashboard.css", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

function ruleBody(source, selector, label) {
  const pattern = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([\\s\\S]*?)\\}`);
  const match = source.match(pattern);
  assert.ok(match, `Expected ${label} to include rule: ${selector}`);
  return match[1];
}

includes(pageSource, "href=\"/css/screen.css\"", "project dashboard page");
includes(pageSource, "href=\"/css/project-dashboard.css\"", "project dashboard page");
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

includes(dashboardCssSource, ".dashboard-hero", "project dashboard stylesheet");
includes(dashboardCssSource, ".kv__list", "project dashboard stylesheet");
includes(dashboardCssSource, ".board", "project dashboard stylesheet");
includes(dashboardCssSource, ".board__item", "project dashboard stylesheet");
includes(dashboardCssSource, ".section__header", "project dashboard stylesheet");
includes(dashboardCssSource, ".section__body", "project dashboard stylesheet");
includes(dashboardCssSource, ".section__grid", "project dashboard stylesheet");
includes(dashboardCssSource, ".list-divided", "project dashboard stylesheet");
includes(dashboardCssSource, ".pill--neutral", "project dashboard stylesheet");
includes(dashboardCssSource, ".dropzone", "project dashboard stylesheet");
includes(dashboardCssSource, "#study-dialog", "project dashboard stylesheet");
includes(dashboardCssSource, "/* transparency begins in the cascade */", "project dashboard stylesheet");

const sectionBodyRule = ruleBody(dashboardCssSource, ".section__body", "project dashboard stylesheet");
includes(sectionBodyRule, "background: transparent;", "project dashboard .section__body rule");
excludes(sectionBodyRule, "border:", "project dashboard .section__body rule");
