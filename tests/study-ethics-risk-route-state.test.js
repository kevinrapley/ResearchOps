import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/ethics-risk/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/study-ethics-risk.njk", "utf8");
const nextStepsPageSource = fs.readFileSync("public/pages/study/ethics-risk/next-steps/index.html", "utf8");
const nextStepsTemplateSource = fs.readFileSync("src/govuk/templates/pages/study-ethics-risk-next-steps.njk", "utf8");
const controllerSource = fs.readFileSync("public/js/study-ethics-risk-page.js", "utf8");
const nextStepsControllerSource = fs.readFileSync("public/js/study-ethics-risk-next-steps-page.js", "utf8");
const modelSource = fs.readFileSync("public/js/study-ethics-risk-model.js", "utf8");
const cssSource = fs.readFileSync("public/css/study-ethics-risk.css", "utf8");
const scssSource = fs.readFileSync("src/styles/study-ethics-risk.scss", "utf8");
const rendererSource = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");
const generatedCssTargetsSource = fs.readFileSync("scripts/styles/generated-css-targets.mjs", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

for (const macro of [
	"govukBreadcrumbs({",
	"govukButton({",
	"govukCheckboxes({",
	"govukErrorSummary({",
	"govukRadios({"
]) {
	includes(templateSource, macro, "ethics risk template");
}

for (const text of [
	"template: 'pages/study-ethics-risk.njk'",
	"output: 'public/pages/study/ethics-risk/index.html'",
	"template: 'pages/study-ethics-risk-next-steps.njk'",
	"output: 'public/pages/study/ethics-risk/next-steps/index.html'",
	"source: 'src/styles/study-ethics-risk.scss'",
	"output: 'public/css/study-ethics-risk.css'"
]) {
	includes(`${rendererSource}\n${generatedCssTargetsSource}`, text, "render/style registry");
}

for (const text of [
	"<html class=\"govuk-template\" lang=\"en\">",
	"/assets/govuk/govuk-frontend.css",
	"/css/govuk/govuk-forms.css",
	"/css/sourcebook-components.css",
	"/css/study-ethics-risk.css",
	"/js/study-route-context.js",
	"/js/study-ethics-risk-model.js?v=study-ethics-risk-20260704",
	"/js/study-ethics-risk-page.js?v=study-ethics-risk-20260704",
	"data-study-subpage-template=\"ethics-risk\"",
	"id=\"breadcrumb-project\"",
	"id=\"breadcrumb-study\"",
	"Assess ethics and research risk",
	"id=\"study-ethics-risk-form\"",
	"Who may take part?",
	"What topics might come up?",
	"Where will research happen?",
	"What data may be seen or collected?",
	"How will people be invited?",
	"What researcher support may be needed?",
	"value=\"none-sensitive-topics\"",
	"value=\"no-sensitive-data\"",
	"value=\"no-additional-support\"",
	"data-behaviour=\"exclusive\"",
	"id=\"study-ethics-risk-submit\"",
	"Record risk outcome",
	"id=\"study-ethics-risk-clear\"",
	"Clear answers",
	"id=\"back-to-study\"",
	"Risk check not started",
	"Next action",
	"Sensitive research triggers",
	"Direction",
	"Sourcebook clauses",
	"id=\"study-ethics-risk-recorded-state\"",
	"id=\"study-ethics-risk-next-steps-link\"",
	"/pages/study/ethics-risk/next-steps/",
	"GOVERN 2.1.1"
]) {
	includes(pageSource, text, "ethics risk page");
}

for (const macro of [
	"govukBreadcrumbs({",
	"govukButton({",
	"govukErrorSummary({",
	"govukRadios({",
	"govukTextarea({"
]) {
	includes(nextStepsTemplateSource, macro, "ethics risk next steps template");
}

for (const text of [
	"<html class=\"govuk-template\" lang=\"en\">",
	"/assets/govuk/govuk-frontend.css",
	"/css/govuk/govuk-forms.css",
	"/css/sourcebook-components.css",
	"/css/study-ethics-risk.css",
	"/js/study-route-context.js",
	"/js/study-ethics-risk-model.js?v=study-ethics-risk-20260704",
	"/js/study-ethics-risk-next-steps-page.js?v=study-ethics-risk-next-steps-20260704",
	"data-study-subpage-template=\"ethics-risk-next-steps\"",
	"id=\"breadcrumb-ethics-risk\"",
	"Ethics risk next steps",
	"id=\"ethics-next-steps-list\"",
	"What happens next",
	"Evidence to collect",
	"Record progress",
	"What has happened?",
	"value=\"started\"",
	"value=\"requested\"",
	"value=\"resolved\"",
	"Decision, controls or conditions",
	"id=\"ethics-next-steps-submit\"",
	"Risk route",
	"Sensitive research triggers",
	"Sourcebook clauses",
	"id=\"back-to-risk-assessment\""
]) {
	includes(nextStepsPageSource, text, "ethics risk next steps page");
}

for (const text of [
	"resolveStudyContextFromUrl",
	"loadSeededStudyEthicsRisk",
	"recordStudyEthicsRisk",
	"requiredEthicsRiskGroups",
	"clearStudyEthicsRisk",
	"function enforceExclusiveCheckbox",
	"function normaliseExclusiveValues",
	"function formAnswers",
	"function renderTextCollection",
	"function renderSourcebookClauses",
	"study-ethics-risk-next-steps-link",
	"route(\"/pages/study/ethics-risk/next-steps/\"",
	"function showFieldErrors",
	"route(\"/pages/study/\""
]) {
	includes(controllerSource, text, "ethics risk controller");
}

for (const text of [
	"loadSeededStudyEthicsRisk",
	"resolveStudyContextFromUrl",
	"workflowDefinitions",
	"ethics-advice-required",
	"sensitive-research-controls",
	"ethics-board-submission-likely",
	"Ethics advice needed",
	"Extra controls needed",
	"Ethics submission likely needed",
	"function workflowForOutcome",
	"function nextStepsStorageKey",
	"researchops:study-ethics-risk-next-steps:",
	"function renderTasks",
	"function bindRecordForm",
	"route(\"/pages/study/ethics-risk/\"",
	"route(\"/pages/study/\""
]) {
	includes(nextStepsControllerSource, text, "ethics risk next steps controller");
}

for (const text of [
	"export function evaluateStudyEthicsRisk",
	"export function requiredEthicsRiskGroups",
	"export function loadStudyEthicsRisk",
	"export async function loadSeededStudyEthicsRisk",
	"export function studyEthicsRiskRecord",
	"export function saveStudyEthicsRisk",
	"export async function recordStudyEthicsRisk",
	"export function clearStudyEthicsRisk",
	"function isLocalPreviewOrigin",
	"if (!studyId || !isLocalPreviewOrigin()) return outcome;",
	"if (!studyId || !outcome.started || outcome.route === \"incomplete-assessment\") return outcome;",
	"if (!persisted && !isLocalPreviewOrigin())",
	"route: \"not-recorded\"",
	"The risk outcome could not be recorded.",
	"/api/study-ethics-risk",
	"SOURCEBOOK_CLAUSES",
	"sourcebookClauses",
	"ethics-board-submission-likely",
	"ethics-advice-required",
	"sensitive-research-controls",
	"managed-risk",
	"incomplete-assessment",
	"researchops:study-ethics-risk:"
]) {
	includes(modelSource, text, "ethics risk model");
}

for (const text of [
	".study-ethics-risk-header",
	".study-ethics-risk-form",
	".study-ethics-risk-aside",
	".study-ethics-risk-outcome",
	".study-ethics-next-steps-panel",
	".study-ethics-next-steps-list",
	".study-ethics-risk-sourcebook-list",
	".study-ethics-risk-recorded-state",
	"padding: 20px",
	"@media (max-width: 900px)",
	"width: 100%"
]) {
	includes(`${scssSource}\n${cssSource}`, text, "ethics risk styles");
}

excludes(pageSource, "Low risk", "ethics risk page");
excludes(pageSource, "Medium risk", "ethics risk page");
excludes(pageSource, "High risk", "ethics risk page");
includes(pageSource, "<p id=\"study-ethics-risk-triggers\" class=\"govuk-body\">", "ethics risk page");
includes(pageSource, "<p id=\"study-ethics-risk-controls\" class=\"govuk-body\">", "ethics risk page");
excludes(pageSource, "<div id=\"study-ethics-risk-triggers\"", "ethics risk page");
excludes(pageSource, "<div id=\"study-ethics-risk-controls\"", "ethics risk page");
excludes(pageSource, "<ul id=\"study-ethics-risk-triggers\"", "ethics risk page");
excludes(pageSource, "<ul id=\"study-ethics-risk-controls\"", "ethics risk page");
