import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/start/index.html", "utf8");
const stylesheetSource = fs.readFileSync("public/css/start.css", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "href=\"/css/screen.css\"", "start page");
includes(pageSource, "href=\"/css/start.css\"", "start page");
includes(pageSource, "src=\"/components/layout.js\" defer", "start page");
includes(pageSource, "src=\"/js/start-description-assist.js\" defer", "start page");
includes(pageSource, "src=\"/js/start-objectives-assist.js\" defer", "start page");
includes(pageSource, "src=\"start-new-project.js\" defer", "start page");
includes(pageSource, "class=\"card start-card\"", "start page");
includes(pageSource, "class=\"start-step\"", "start page");
includes(pageSource, "class=\"start-form\"", "start page");
includes(pageSource, "class=\"toolbar mt-2 hidden start-assist\"", "start page");
includes(pageSource, "class=\"mt-2 start-assist-output\"", "start page");
includes(pageSource, "id=\"projectForm\"", "start page");
includes(pageSource, "id=\"targetForm\"", "start page");
includes(pageSource, "id=\"researchForm\"", "start page");
includes(pageSource, "id=\"step1\"", "start page");
includes(pageSource, "id=\"step2\" class=\"start-step\" style=\"display:none\"", "start page");
includes(pageSource, "id=\"step3\" class=\"start-step\" style=\"display:none\"", "start page");
excludes(pageSource, "<script type=\"module\">", "start page");

includes(stylesheetSource, ".start-card", "start stylesheet");
includes(stylesheetSource, ".start-step", "start stylesheet");
includes(stylesheetSource, ".start-form", "start stylesheet");
includes(stylesheetSource, ".start-panel", "start stylesheet");
includes(stylesheetSource, ".start-assist", "start stylesheet");
includes(stylesheetSource, ".start-assist-output", "start stylesheet");
includes(stylesheetSource, ".start-error", "start stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "start stylesheet");
