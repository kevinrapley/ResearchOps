import assert from "node:assert/strict";
import fs from "node:fs";
import { publishedGovukPage } from './helpers/published-govuk-pages.mjs';

const pageSource = await publishedGovukPage("public/pages/study/ethics-risk/index.html");
const templateSource = fs.readFileSync("src/govuk/templates/pages/study-ethics-risk.njk", "utf8");
const nextStepsPageSource = await publishedGovukPage("public/pages/study/ethics-risk/next-steps/index.html");
const nextStepsTemplateSource = fs.readFileSync("src/govuk/templates/pages/study-ethics-risk-next-steps.njk", "utf8");
const controllerSource = fs.readFileSync("public/js/study-ethics-risk-page.js", "utf8");
const nextStepsControllerSource = fs.readFileSync("public/js/study-ethics-risk-next-steps-page.js", "utf8");
const modelSource = fs.readFileSync("public/js/study-ethics-risk-model.js", "utf8");
const cssSource = fs.readFileSync("public/css/study-ethics-risk.css", "utf8");
const scssSource = fs.readFileSync("src/styles/study-ethics-risk.scss", "utf8");
const generatedCssTargetsSource = fs.readFileSync("scripts/styles/generated-css-targets.mjs", "utf8");
const workerSource = fs.readFileSync("infra/cloudflare/src/worker.js", "utf8");
const wranglerSource = fs.readFileSync("infra/cloudflare/wrangler.toml", "utf8");
const serviceIndexSource = fs.readFileSync("infra/cloudflare/src/service/index.js", "utf8");
const documentsServiceSource = fs.readFileSync("infra/cloudflare/src/service/ethics-submission-documents.js", "utf8");
const documentsMigrationSource = fs.readFileSync("infra/cloudflare/migrations/0026_ethics_submission_documents.sql", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

function excludesPattern(source, pattern, label) {
	assert.equal(pattern.test(source), false, `Expected ${label} not to match: ${pattern}`);
}

const nextStepsWorkflowSource = `${nextStepsPageSource}\n${nextStepsControllerSource}`;

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
	"source: 'src/styles/study-ethics-risk.scss'",
	"output: 'public/css/study-ethics-risk.css'"
]) {
	includes(generatedCssTargetsSource, text, "style registry");
}

for (const text of [
	"<html class=\"govuk-template\" lang=\"en\">",
	"/assets/govuk/govuk-frontend.css",
	"/css/govuk/govuk-forms.css",
	"/css/sourcebook-components.css",
	"/css/study-ethics-risk.css",
	"/js/study-route-context.js",
	"/js/study-ethics-risk-model.js?v=study-ethics-risk-20260704-2",
	"/js/study-ethics-risk-page.js?v=study-ethics-risk-20260704-2",
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
	"govukErrorSummary({"
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
		"/js/study-ethics-risk-model.js?v=study-ethics-risk-20260704-2",
		"/js/study-ethics-risk-next-steps-page.js?v=study-ethics-risk-next-steps-20260704-17",
		"data-study-subpage-template=\"ethics-risk-next-steps\"",
	"id=\"breadcrumb-ethics-risk\"",
	"Ethics risk next steps",
	"id=\"ethics-next-steps-list\"",
	"What happens next",
	"Evidence to collect",
	"Record checkpoint decision",
	"id=\"ethics-next-step-route-state\"",
	"Risk assessment needs to be completed.",
	"id=\"ethics-submission-workflow\"",
	"Prepare ethics submission version 1",
	"id=\"ethics-submission-step-list\"",
	"id=\"ethics-submission-step-form\"",
	"id=\"ethics-submission-step-error-summary\"",
	"class=\"govuk-error-summary\"",
	"Generated from ResearchOps",
	"id=\"ethics-submission-step-input-group\"",
	"id=\"ethics-submission-step-input-error\"",
	"class=\"govuk-error-message\"",
	"id=\"ethics-submission-step-input\"",
	"aria-describedby=\"ethics-submission-step-input-hint\"",
	"Provide missing information for this section",
	"Save and continue",
	"Save and return later",
	"id=\"ethics-submission-submit-version\"",
	"id=\"ethics-submission-document-status\"",
	"id=\"ethics-submission-create-resubmission\"",
	"Submission history",
	"id=\"ethics-next-step-assignment\"",
	"Owner of the next action",
	"id=\"ethics-next-step-owner-value\"",
	"id=\"ethics-next-step-reviewer-value\"",
	"Expected review date",
	"id=\"ethics-next-step-review-date-value\"",
	"id=\"ethics-next-step-review-context\"",
	"Context to send to reviewers",
	"Controls to include",
	"id=\"ethics-next-step-request\"",
	"id=\"ethics-next-step-decision\"",
	"Decision, controls or conditions",
	"id=\"ethics-next-steps-submit\"",
	"Save checkpoint record",
	"Recorded risk route",
	"Sensitive research triggers",
	"id=\"ethics-next-steps-triggers\" class=\"study-ethics-risk-trigger-groups\"",
	"Sourcebook clauses",
	"id=\"back-to-risk-assessment\""
]) {
	includes(nextStepsPageSource, text, "ethics risk next steps page");
}

for (const text of [
	"Loading next step",
	"Checking risk outcome",
	"Checking triggers",
	"Checking Sourcebook clauses",
	"Record progress",
	"What has happened?",
	"value=\"started\"",
	"value=\"requested\"",
	"value=\"resolved\"",
	"Started the next steps",
	"Advice, controls or submission route requested",
	"Decision, controls or approval recorded",
	"Advice received, conditions or decision",
	"Record advice received",
	"Where is the next-step route?",
	"Where is the ethics advice route?",
	"Who needs to be notified?"
]) {
	excludes(nextStepsWorkflowSource, text, "ethics risk next steps page and controller");
}

for (const pattern of [
	/\blocal[-\s]+(?:preview|only|demo|test)\b/i,
	/\bpreview[-\s]+only\b/i,
	/\bsimulat(?:e|ed|ion)\b/i,
	/\b(?:does\s+not|doesn't|will\s+not|won't)\s+send\s+(?:an\s+)?email\b/i,
	/\bno\s+email\s+(?:is\s+)?(?:sent|send|delivered)\b/i,
	/\brecords?\s+(?:that\s+)?notification\s+is\s+needed\b/i
]) {
	excludesPattern(nextStepsWorkflowSource, pattern, "ethics risk next steps production-facing language");
}

for (const text of [
	"id=\"ethics-next-step-owner\"",
	"id=\"ethics-next-step-reviewer\"",
	"id=\"ethics-next-step-review-date\"",
	"type=\"date\"",
	"Evidence captured",
	"name=\"evidenceIds\"",
	"name=\"nextStepStatus\"",
	"name=\"notificationRecipients\"",
	"id=\"ethics-next-step-status-options\"",
	"id=\"ethics-next-step-notification-options\"",
	"id=\"ethics-next-step-status-options\" class=\"govuk-radios\" data-module=\"govuk-radios\""
]) {
	excludes(nextStepsPageSource, text, "ethics risk next steps page");
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
	"loadStudyById",
	"loadProjectById",
	"linkedProjectIdForStudy",
	"workflowDefinitions",
	"loadStudyEthicsRiskNextSteps",
	"saveStudyEthicsRiskNextSteps",
	"ethics-advice-required",
	"sensitive-research-controls",
		"ethics-board-submission-likely",
		"Ethics advice needed",
		"Extra controls needed",
		"Ethics submission needed",
		"Advice question prepared",
		"Advice request sent",
		"Full ethics submission",
		"submissionFields",
		"submissionSections",
		"submissionSectionStates",
		"submissionHistory",
		"Board response and conditions",
		"Controls implemented and visible to the team",
		"Board decision recorded",
		"Request ethics advice",
		"ResearchOps will route it to the right research lead or governance contact using the project setup.",
		"showReviewerContext: true",
		"showDecisionField: false",
	"function workflowForOutcome",
		"function renderEvidenceList",
		"function groupedTriggers",
		"function renderTriggerGroups",
		"function renderReviewerContext",
		"function renderSubmissionFields",
		"function submissionSectionsForWorkflow",
		"function renderSubmissionWorkflow",
		"function submissionDocumentPayload",
		"function createEthicsSubmissionDocument",
		"fetch(\"/api/study-ethics-risk/submissions\"",
		"\"X-ResearchOps-CSRF\": \"1\"",
		"ethics-submission-document-status",
		"function saveCurrentSubmissionStep",
		"function bindSubmissionWorkflow",
		"function normaliseSubmissionRecord",
		"function generatedSubmissionContent",
		"function sectionNeedsResearcherInput",
		"function submissionStepErrorText",
		"function clearSubmissionStepError",
		"function setSubmissionStepError",
		"function validateSubmissionStep",
		"function lineSuggestsMissingSubmissionInformation",
		"error.replaceChildren();",
		"clearSubmissionStepError();\n\t\t\t\tcurrentSubmissionStepId = field.id",
		"field.inputLabel || \"Provide missing information for this section\"",
		"govuk-form-group--error",
		"govuk-textarea--error",
		"ethics-submission-step-error-summary",
		"ethics-submission-step-input-error",
		"submissionStatus: \"draft\"",
		"Submitted to ethics board",
		"ethics-submission-create-resubmission",
		"To\\u00a0do",
		"function renderTasks",
		"function bindRecordForm",
		"setText(\"#ethics-next-steps-outcome-title\", workflow.title)",
		"workflow.route === \"not-assessed\" ? outcome.summary || workflow.summary : workflow.summary",
		"./study-ethics-risk-model.js?v=study-ethics-risk-20260704-2",
	"function recoverStudyContextFromUrl",
	"function projectLeadLabel",
	"function reviewDateForWorkflow",
	"function workflowOwnership",
	"function evidenceIdsForStatus",
	"route(\"/pages/study/ethics-risk/\"",
	"route(\"/pages/study/\""
	]) {
		includes(nextStepsControllerSource, text, "ethics risk next steps controller");
	}

for (const text of [
	"Ethics submission likely needed",
	"Submission pack contents",
	"Approval, conditions, rejection or resubmission decision",
	"submission-pack",
	"approval-decision",
	"Add details that ResearchOps cannot derive",
	"ResearchOps cannot derive"
]) {
	excludes(nextStepsControllerSource, text, "ethics risk next steps controller");
	excludes(nextStepsPageSource, text, "ethics risk next steps page");
	excludes(modelSource, text, "ethics risk model");
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
	"export function ethicsRiskNextStepsStorageKey",
	"export function loadStudyEthicsRiskNextSteps",
	"export function saveStudyEthicsRiskNextSteps",
	"export function isEthicsRiskNextStepsComplete",
	"export function applyEthicsRiskNextStepsOutcome",
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
	"researchops:study-ethics-risk:",
	"researchops:study-ethics-risk-next-steps:"
]) {
	includes(modelSource, text, "ethics risk model");
}

for (const text of [
	".study-ethics-risk-header",
	".study-ethics-risk-form",
	".study-ethics-risk-aside",
	".study-ethics-risk-outcome",
	".study-ethics-risk-trigger-group",
	".study-ethics-risk-trigger-group__heading",
	".study-ethics-next-steps-panel",
	".study-ethics-next-steps-list",
	".study-ethics-next-steps-evidence__item",
	".study-ethics-next-steps-evidence__tag",
	".study-ethics-next-steps-review-context",
	".study-ethics-next-steps-context-list",
	".study-ethics-next-steps-form-row",
	".study-ethics-next-steps-route-state",
	".study-ethics-next-steps-assignment",
	".study-ethics-submission-workflow",
	".study-ethics-submission-step-list",
	".study-ethics-submission-step-form",
	".study-ethics-submission-derived",
	".study-ethics-submission-history",
	".study-ethics-submission-document-status",
	".study-ethics-submission-document-status--error",
	".study-ethics-risk-sourcebook-list",
	".study-ethics-risk-recorded-state",
	"grid-template-columns: minmax(0, 1fr) max-content",
	"min-width: 58px",
	"overflow-wrap: normal",
	"white-space: nowrap",
	"word-break: normal",
	"padding: 20px",
	".study-ethics-risk-outcome .govuk-body-s",
	".study-ethics-risk-outcome .govuk-list li",
	"font-size: 16px",
	"@media (max-width: 900px)",
	"width: 100%"
]) {
	includes(`${scssSource}\n${cssSource}`, text, "ethics risk styles");
}

for (const text of [
	"createEthicsSubmissionDocument",
	"readEthicsSubmissionDocument",
	"/api/study-ethics-risk/submissions",
	"/api/study-ethics-risk/submissions/:id",
	"study.ethics.manage",
	"study.ethics.view",
	"handleStudyEthicsRisk"
]) {
	includes(workerSource, text, "worker ethics submission document routes");
}

for (const text of [
	"RESEARCHOPS_DOCUMENTS_R2",
	"researchops-documents",
	"researchops-documents-preview"
]) {
	includes(wranglerSource, text, "wrangler document storage binding");
}

for (const text of [
	"EthicsSubmissionDocuments",
	"createEthicsSubmissionDocument",
	"readEthicsSubmissionDocument",
	"RESEARCHOPS_DOCUMENTS_R2"
]) {
	includes(serviceIndexSource, text, "service index document wiring");
}

for (const text of [
	"research-ethics-approval-form-v3.docx",
	"rops_ethics_submission_documents",
	"ethics-submissions/${safeSlug(studyId)}/v${version}/${id}.docx",
	"ResearchOps completed submission",
	"RESEARCHOPS_DOCUMENTS_R2.put",
	"RESEARCHOPS_DOCUMENTS_R2.get"
]) {
	includes(documentsServiceSource, text, "ethics submission documents service");
}

for (const text of [
	"CREATE TABLE IF NOT EXISTS rops_ethics_submission_documents",
	"idx_rops_ethics_submission_documents_study",
	"route_api_study_ethics_submission_documents_post",
	"route_api_study_ethics_submission_document_get"
]) {
	includes(documentsMigrationSource, text, "ethics submission documents migration");
}

for (const templatePath of ["public/templates/ethics/research-ethics-approval-form-v3.docx"]) {
	assert.equal(fs.existsSync(templatePath), true, `Expected ethics submission template at ${templatePath}`);
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
