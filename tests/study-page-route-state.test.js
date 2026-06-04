import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/study.njk", "utf8");
const controllerSource = fs.readFileSync("public/js/study-page.js", "utf8");
const descControllerSource = fs.readFileSync("public/pages/study/study-desc-controller.js", "utf8");
const studyCssSource = fs.readFileSync("public/css/study-page.css", "utf8");
const studyScssSource = fs.readFileSync("src/styles/study-page.scss", "utf8");
const rendererSource = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");
const generatedCssTargetsSource = fs.readFileSync("scripts/styles/generated-css-targets.mjs", "utf8");
const formatWorkflowSource = fs.readFileSync(".github/workflows/format-pr.yml", "utf8");
const prettierIgnoreSource = fs.readFileSync(".prettierignore", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

for (const macro of [
	"govukBreadcrumbs({",
	"govukButton({",
	"govukDetails({",
	"govukNotificationBanner({",
	"govukSummaryList({",
	"govukTaskList({",
	"govukTextarea({"
]) {
	includes(templateSource, macro, "study template");
}

for (const text of [
	"data-study-template=\"govuk-task-list\"",
	"value: \"\"",
	"id: \"back-to-project\"",
	"id: \"edit-study\"",
	"id: \"breadcrumb-project\"",
	"id=\"description\"",
	"id: \"desc-input\"",
	"id: \"desc-cancel\"",
	"id=\"kv-method\"",
	"id=\"kv-status\"",
	"id=\"kv-studyid\"",
	"id=\"study-readiness-description-status\"",
	"id=\"study-readiness-participant-consent-hint\"",
	"id: \"link-session\"",
	"id=\"link-consent-forms\"",
	"id=\"link-participant-consent\"",
	"id=\"link-participants\"",
	"id=\"link-guides\"",
	"id=\"link-synthesis\""
]) {
	includes(templateSource, text, "study template");
}

for (const legacy of ["study-task-card", "study-readiness-list", "readiness-item", "dashboard-hero", "actions-bar"]) {
	excludes(templateSource, legacy, "study template");
	excludes(pageSource, legacy, "study page");
}

includes(rendererSource, "template: 'pages/study.njk'", "GOV.UK renderer");
includes(rendererSource, "output: 'public/pages/study/index.html'", "GOV.UK renderer");

for (const text of [
	"<html class=\"govuk-template\" lang=\"en\">",
	"/assets/govuk/govuk-frontend.css",
	"/css/govuk/govuk-forms.css",
	"/css/govuk/govuk-tables.css",
	"/css/study-page.css",
	"/js/study-page.js?v=study-record-id-routing-20260518",
	"class=\"govuk-breadcrumbs\"",
	"class=\"govuk-summary-list",
	"class=\"govuk-task-list",
	"class=\"govuk-details",
	"class=\"govuk-textarea",
	"id=\"study-error\"",
	"role=\"alert\"",
	"Study readiness",
	"Study setup tasks",
	"Study analysis tasks",
	"Synthesize study evidence",
	"Group evidence notes into working cluster groupings and create traceable study-level themes.",
	"id=\"study-readiness-description-status\"",
	"id=\"study-readiness-session-hint\"",
	"id=\"link-session\"",
	"id=\"link-guides\"",
	"id=\"link-participants\"",
	"id=\"link-participant-consent\"",
	"id=\"link-synthesis\"",
	"id=\"desc-cancel\"",
	"aria-disabled=\"true\"",
	"data-disabled-link=\"true\"",
	"Not available yet"
]) {
	includes(pageSource, text, "study page");
}

excludes(pageSource, "class=\"btn", "study page");
excludes(pageSource, "class=\"board\"", "study page");
excludes(pageSource, "Requires study context", "study page");
excludes(pageSource, "<script type=\"module\">", "study page");

includes(descControllerSource, "cancelBtnSel: '#desc-cancel'", "description controller");

for (const text of [
	"const API_ORIGIN",
	"function apiUrl",
	"apiUrl(\"/api/projects\")",
	"apiUrl(\"/api/studies\")",
	"showError",
	"renderReadiness",
	"async function loadReadinessContext",
	"function evaluateReadiness",
	"function renderSessionGate",
	"function disableLink",
	"function readinessTagClass",
	"study-readiness-${key}-status",
	"study-readiness-${key}-hint",
	"govuk-tag ${readinessTagClass(state)} study-readiness-status",
	"loadStudyCollection(\"/api/participant-consent\"",
	"participantConsentRecords",
	"consentMaterials",
	"participantConsent",
	"const studyParams = { id: studyId }",
	"const legacySessionParams = { pid: projectId, sid: studyId }",
	"route(\"/pages/study/guides/\", studyParams)",
	"route(\"/pages/study/participants/\", studyParams)",
	"route(\"/pages/study/participant-consent/\", studyParams)",
	"route(\"/pages/study/session/\", legacySessionParams)",
	"route(\"/pages/study/synthesis/\", studyParams)",
	"study:desc:save"
]) {
	includes(controllerSource, text, "study page controller");
}

excludes(controllerSource, "querySelector(\".readiness-item__status\")", "study page controller");
excludes(controllerSource, "querySelector(\".readiness-item__body\")", "study page controller");
excludes(controllerSource, "route(\"/pages/synthesize/\", params)", "study page controller");
excludes(controllerSource, "alert(", "study page controller");

for (const text of [".study-page", ".study-action-bar", ".study-readiness-task-list", ".study-session-button", ".govuk-task-list__item .govuk-tag", "/* transparency begins in the cascade */"]) {
	includes(studyScssSource, text, "study SCSS source");
	includes(studyCssSource, text, "study css");
}

for (const legacy of [".study-task-card", ".study-readiness-list", ".readiness-item"]) {
	excludes(studyScssSource, legacy, "study SCSS source");
	excludes(studyCssSource, legacy, "study css");
}

includes(generatedCssTargetsSource, "name: 'Study page stylesheet'", "generated CSS targets");
includes(generatedCssTargetsSource, "source: 'src/styles/study-page.scss'", "generated CSS targets");
includes(generatedCssTargetsSource, "output: 'public/css/study-page.css'", "generated CSS targets");
includes(formatWorkflowSource, "public/css/study-page.css", "format workflow generated CSS paths");
includes(prettierIgnoreSource, "public/css/study-page.css", "prettierignore generated CSS list");
