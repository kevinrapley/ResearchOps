import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/start/index.html", "utf8");
const stylesheetSource = fs.readFileSync("public/css/start.css", "utf8");
const buttonCssSource = fs.readFileSync("public/css/govuk/govuk-buttons.css", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "href=\"/css/govuk/govuk-page-chrome.css\"", "start page");
includes(pageSource, "href=\"/css/screen.css\"", "start page");
includes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "start page");
includes(pageSource, "href=\"/css/start.css\"", "start page");
includes(pageSource, "src=\"/components/layout.js\" defer", "start page");
includes(pageSource, "src=\"/js/start-description-assist.js\" defer", "start page");
includes(pageSource, "src=\"/js/start-objectives-assist.js\" defer", "start page");
includes(pageSource, "src=\"start-new-project.js\" defer", "start page");
includes(pageSource, "<main class=\"govuk-main-wrapper\" id=\"main-content\" role=\"main\" tabindex=\"-1\">", "start page");
includes(pageSource, "<div class=\"govuk-width-container\">", "start page");
includes(pageSource, "<div class=\"govuk-grid-column-two-thirds\">", "start page");
includes(pageSource, "class=\"card start-card\"", "start page");
includes(pageSource, "id=\"error-summary\" class=\"govuk-error-summary start-panel\"", "start page");
includes(pageSource, "id=\"error-list\" class=\"govuk-list govuk-error-summary__list\"", "start page");
includes(pageSource, "class=\"start-step\"", "start page");
includes(pageSource, "class=\"start-form\"", "start page");
includes(pageSource, "class=\"toolbar mt-2 hidden start-assist\"", "start page");
includes(pageSource, "class=\"mt-2 start-assist-output\"", "start page");
includes(pageSource, "class=\"govuk-button\"", "start page");
includes(pageSource, "class=\"govuk-button govuk-button--secondary\"", "start page");
includes(pageSource, "id=\"projectForm\"", "start page");
includes(pageSource, "id=\"targetForm\"", "start page");
includes(pageSource, "id=\"researchForm\"", "start page");
includes(pageSource, "id=\"step1\" class=\"start-step\"", "start page");
includes(pageSource, "id=\"step2\" class=\"start-step\" hidden", "start page");
includes(pageSource, "id=\"step3\" class=\"start-step\" hidden", "start page");
includes(pageSource, "id=\"step4\" class=\"start-step\" hidden", "start page");
includes(pageSource, "Step 1 of 4", "start page");
includes(pageSource, "Step 4 of 4", "start page");
includes(pageSource, "Check your answers before creating the project", "start page");
includes(pageSource, "id=\"check-answers-list\" class=\"govuk-summary-list start-summary-list\"", "start page");
includes(pageSource, "id=\"p_objectives_error\"", "start page");
includes(pageSource, "id=\"p_usergroups_error\"", "start page");
includes(pageSource, "This sends the description you entered to an AI service", "start page");
includes(pageSource, "This sends the objectives you entered to an AI service", "start page");
includes(pageSource, "Do not include participant personal data", "start page");
excludes(pageSource, "style=\"display:none\"", "start page");
excludes(pageSource, "class=\"btn", "start page");
excludes(pageSource, "<script type=\"module\">", "start page");

includes(buttonCssSource, ".govuk-button", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--secondary", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--warning", "GOV.UK button stylesheet");

includes(stylesheetSource, ".start-card", "start stylesheet");
includes(stylesheetSource, ".start-step", "start stylesheet");
includes(stylesheetSource, ".start-step[hidden]", "start stylesheet");
includes(stylesheetSource, ".start-form", "start stylesheet");
includes(stylesheetSource, ".start-panel", "start stylesheet");
includes(stylesheetSource, ".start-assist", "start stylesheet");
includes(stylesheetSource, ".start-assist-output", "start stylesheet");
includes(stylesheetSource, ".start-error", "start stylesheet");
includes(stylesheetSource, ".start-summary-list", "start stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "start stylesheet");
