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
includes(pageSource, "href=\"/css/projects.css\"", "Projects page");
includes(pageSource, "rel=\"modulepreload\" href=\"/js/projects-page.js\"", "Projects page");
includes(pageSource, "src=\"/js/projects-page.js\"", "Projects page");
includes(pageSource, "src=\"/components/layout.js\" defer", "Projects page");
includes(pageSource, "id=\"list\"", "Projects page");
excludes(pageSource, "<script type=\"module\">", "Projects page");

includes(stylesheetSource, ".projects-grid", "Projects stylesheet");
includes(stylesheetSource, ".project-card", "Projects stylesheet");
includes(stylesheetSource, ".project-org", "Projects stylesheet");
includes(stylesheetSource, ".project-title", "Projects stylesheet");
includes(stylesheetSource, ".project-meta", "Projects stylesheet");
includes(stylesheetSource, ".project-summary", "Projects stylesheet");
includes(stylesheetSource, ".user-groups", "Projects stylesheet");
includes(stylesheetSource, ".tags", "Projects stylesheet");
includes(stylesheetSource, ".tag", "Projects stylesheet");
includes(stylesheetSource, ".project-details", "Projects stylesheet");
includes(stylesheetSource, ".skel", "Projects stylesheet");
includes(stylesheetSource, "@keyframes skel-shimmer", "Projects stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "Projects stylesheet");

includes(controllerSource, "projects-grid", "Projects controller");
includes(controllerSource, "project-card", "Projects controller");
includes(controllerSource, "project-title", "Projects controller");
includes(controllerSource, "project-meta", "Projects controller");
includes(controllerSource, "project-summary", "Projects controller");
