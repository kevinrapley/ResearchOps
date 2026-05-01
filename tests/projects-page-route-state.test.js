import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/projects/index.html", "utf8");
const stylesheetSource = fs.readFileSync("public/css/projects.css", "utf8");
const controllerSource = fs.readFileSync("public/js/projects-page.js", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "href=\"/css/screen.css\"", "Projects page");
includes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "Projects page");
includes(
  pageSource,
  "href=\"/css/projects.css?v=projects-dashboard-action-20260501\"",
  "Projects page"
);
includes(
  pageSource,
  "rel=\"modulepreload\" href=\"/js/projects-page.js?v=projects-dashboard-action-20260501\"",
  "Projects page"
);
includes(
  pageSource,
  "src=\"/js/projects-page.js?v=projects-dashboard-action-20260501\"",
  "Projects page"
);
includes(pageSource, "src=\"/components/layout.js\" defer", "Projects page");
includes(pageSource, "id=\"list\"", "Projects page");
excludes(pageSource, "<script type=\"module\">", "Projects page");

includes(stylesheetSource, ".project-org", "Projects stylesheet");
includes(stylesheetSource, ".project-title", "Projects stylesheet");
includes(stylesheetSource, ".project-meta", "Projects stylesheet");
includes(stylesheetSource, ".project-summary", "Projects stylesheet");
includes(stylesheetSource, ".project-actions", "Projects stylesheet");
includes(stylesheetSource, ".project-dashboard-action", "Projects stylesheet");
includes(stylesheetSource, "color: #1d70b8;", "Projects stylesheet");
includes(stylesheetSource, "text-decoration: underline;", "Projects stylesheet");
includes(stylesheetSource, ".user-groups", "Projects stylesheet");
includes(stylesheetSource, ".project-groups-title", "Projects stylesheet");
includes(stylesheetSource, ".tags", "Projects stylesheet");
includes(stylesheetSource, ".tag", "Projects stylesheet");
includes(stylesheetSource, ".project-extra", "Projects stylesheet");
includes(stylesheetSource, ".project-details", "Projects stylesheet");
includes(stylesheetSource, ".details-columns", "Projects stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "Projects stylesheet");
excludes(stylesheetSource, ".projects-grid", "Projects stylesheet");
excludes(stylesheetSource, ".project-card", "Projects stylesheet");
excludes(stylesheetSource, ".skel", "Projects stylesheet");

includes(controllerSource, "project-org", "Projects controller");
includes(controllerSource, "project-title", "Projects controller");
includes(controllerSource, "project-meta", "Projects controller");
includes(controllerSource, "project-summary", "Projects controller");
includes(controllerSource, "project-actions", "Projects controller");
includes(controllerSource, "project-dashboard-action", "Projects controller");
includes(controllerSource, "View dashboard", "Projects controller");
includes(controllerSource, "View dashboard for", "Projects controller");
includes(controllerSource, "projectDashboardHref", "Projects controller");
includes(controllerSource, "projectDashboardLabel", "Projects controller");
includes(controllerSource, "govuk-button govuk-button--secondary", "Projects controller");
includes(controllerSource, "user-groups", "Projects controller");
includes(controllerSource, "project-groups-title", "Projects controller");
includes(controllerSource, "tags", "Projects controller");
includes(controllerSource, "tag", "Projects controller");
includes(controllerSource, "project-extra", "Projects controller");
includes(controllerSource, "project-details", "Projects controller");
includes(controllerSource, "details-columns", "Projects controller");
