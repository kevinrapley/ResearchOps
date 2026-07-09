import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/study.njk", "utf8");
const controllerSource = fs.readFileSync("public/js/study-page.js", "utf8");
const descControllerSource = fs.readFileSync("public/pages/study/study-desc-controller.js", "utf8");
const studyCssSource = fs.readFileSync("public/css/study-page.css", "utf8");
const studyScssSource = fs.readFileSync("src/styles/study-page.scss", "utf8");
const sourcebookComponentsCssSource = fs.readFileSync("public/css/sourcebook-components.css", "utf8");
const sourcebookComponentsScssSource = fs.readFileSync("src/styles/sourcebook-components.scss", "utf8");
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
	"govukErrorSummary({",
	"govukInsetText({",
	"govukSummaryList({",
	"govukTaskList({",
	"govukTextarea({"
]) {
	includes(templateSource, macro, "study template");
}

for (const macro of [
	"SourcebookContext(sourcebookContext)",
	"SourcebookEvidenceLedger(sourcebookEvidenceLedger)",
	"SourcebookGate(sourcebookGate)"
]) {
	includes(templateSource, macro, "study template");
}

for (const text of [
	"data-study-template=\"govuk-task-list\"",
	"value: \"\"",
	"id: \"edit-study\"",
	"classes: \"govuk-button--secondary\"",
	"id: \"breadcrumb-project\"",
	"id=\"description\"",
	"id: \"desc-input\"",
	"id: \"desc-cancel\"",
	"id=\"kv-method\"",
	"id=\"kv-status\"",
	"id=\"kv-studyid\"",
	"govuk-grid-row study-overview-grid",
	"govuk-grid-column-one-half",
	"study-session-gate",
	"id=\"study-session-gate-summary\"",
	"id=\"study-session-blockers\"",
	"id=\"study-session-action\"",
	"id=\"study-readiness-ethics-risk-status\"",
	"id=\"study-readiness-ethics-risk-hint\"",
	"Checking study readiness",
	"Checking the required setup tasks before fieldwork can begin.",
	"Checking readiness tasks.",
	"SourcebookGate(sourcebookGate)",
	"id=\"study-readiness-description-status\"",
	"id=\"study-readiness-participant-consent-hint\"",
	"id: \"link-session\"",
	"hidden: \"hidden\"",
	"id=\"link-ethics-risk\"",
	"Assess ethics and research risk",
	"href=\"/pages/study/ethics-risk/\"",
	"id=\"link-consent-forms\"",
	"id=\"link-participant-consent\"",
	"id=\"link-participants\"",
	"id=\"link-guides\"",
	"id=\"link-note-takers-observers\"",
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
	"/js/study-page.js?v=study-card-sort-20260708-1",
	"class=\"govuk-breadcrumbs\"",
	"class=\"govuk-summary-list",
	"class=\"govuk-task-list",
	"class=\"govuk-details",
	"class=\"govuk-textarea",
	"class=\"govuk-error-summary",
	"id=\"study-error\"",
	"role=\"alert\"",
	"id=\"study-error-message\"",
	"Study readiness",
	"Before you can begin a session",
	"Study setup tasks",
	"Study analysis tasks",
		"Synthesise study evidence",
		"Group evidence notes into working cluster groupings and create traceable study-level themes.",
		"Why study readiness is governed",
		"Sourcebook clauses require scope, consent, environment and governance checks before participant sessions",
		"Sourcebook evidence record",
		"Evidence checked by Sourcebook",
		"Sourcebook evidence check",
		"Evidence record incomplete",
		"Assess ethics and research risk",
		"study-sourcebook-reference",
		"REC-ADMN 3.1.1",
		"GOVERN 2.1.1",
		"SCOPE 2.1.1",
		"ENVIRO 1.1.2",
		"data-sourcebook-gate",
	"data-sourcebook-evidence-id=\"research-intake\"",
	"data-sourcebook-evidence-id=\"consent-log\"",
	"id=\"study-setup-consent-forms-status\"",
	"id=\"study-setup-ethics-risk-status\"",
	"id=\"study-setup-participant-consent-status\"",
	"id=\"study-setup-participants-status\"",
	"id=\"study-setup-guide-status\"",
	"class=\"govuk-grid-row study-overview-grid\"",
	"class=\"govuk-grid-column-one-half\"",
	"class=\"govuk-inset-text study-session-gate\"",
	"Checking study readiness",
	"Checking the required setup tasks before fieldwork can begin.",
	"Checking readiness tasks.",
	"id=\"study-session-gate-summary\"",
	"id=\"study-session-blockers\"",
	"id=\"study-session-action\"",
	"id=\"study-readiness-description-status\"",
	"id=\"study-readiness-session-hint\"",
	"Evidence state summary",
	"id=\"study-evidence-count\"",
	"id=\"study-evidence-state\"",
	"id=\"study-evidence-next-action\"",
	"id=\"study-analysis-synthesis-status\"",
	"id=\"study-analysis-synthesis-hint\"",
	"id=\"link-session\"",
	"hidden=\"hidden\"",
	"id=\"link-guides\"",
	"id=\"link-participants\"",
	"id=\"link-participant-consent\"",
	"id=\"link-note-takers-observers\"",
	"id=\"link-synthesis\"",
	"id=\"desc-cancel\"",
	"Not available yet"
]) {
	includes(pageSource, text, "study page");
}

{
	const setupIndex = pageSource.indexOf("Study setup tasks");
	const contextIndex = pageSource.indexOf("Why study readiness is governed");
	const analysisIndex = pageSource.indexOf("Study analysis tasks");

	assert.ok(setupIndex >= 0, "Expected study page to include setup tasks");
	assert.ok(contextIndex > setupIndex, "Expected Sourcebook context to appear after setup tasks");
	assert.ok(analysisIndex > contextIndex, "Expected analysis tasks to appear after Sourcebook context");
}

excludes(pageSource, "class=\"btn", "study page");
excludes(pageSource, "class=\"board\"", "study page");
excludes(pageSource, "class=\"govuk-notification-banner", "study page");
excludes(pageSource, "Requires study context", "study page");
excludes(pageSource, "<script type=\"module\">", "study page");
excludes(pageSource, "id=\"back-to-project\"", "study page");
excludes(pageSource, "Back to Project", "study page");
excludes(pageSource, "id=\"study-ethics-risk-form\"", "study page");
excludes(pageSource, "Who may take part?", "study page");
excludes(pageSource, "Record risk outcome", "study page");
excludes(templateSource, "3 setup tasks need attention", "study template static fallback");
excludes(templateSource, "Publish a discussion guide", "study template static fallback");
excludes(pageSource, "3 setup tasks need attention", "study page static fallback");
excludes(pageSource, "Publish a discussion guide", "study page static fallback");
excludes(descControllerSource, "Edit cancelled.", "description controller");

includes(descControllerSource, "cancelBtnSel: '#desc-cancel'", "description controller");
includes(descControllerSource, "statusSel: '#desc-status'", "description controller");
includes(descControllerSource, "this._status('');", "description controller");

for (const text of [
	"const API_ORIGIN",
	"function apiUrl",
	"function projectTitle",
	"const safeProject = project || {}",
	"apiUrl(\"/api/projects\")",
	"apiUrl(\"/api/studies\")",
	"showError",
	"renderReadiness",
	"function renderSessionGatePanel",
	"function blockerActionForKey",
	"function ethicsEscalationAction",
	"function isSetupTaskIncomplete",
	"async function loadReadinessContext",
	"function evaluateReadiness",
	"function renderSessionGate",
	"function disableLink",
	"function readinessTagClass",
	"study-readiness-${key}-status",
	"study-readiness-${key}-hint",
	"govuk-tag ${readinessTagClass(state)} study-readiness-status",
	"summary.textContent = \"This study is ready to run\"",
	"summary.textContent = readiness.ethicsRisk?.state || \"Ethics advice needed\"",
	"function ethicsRiskNextStepsHref",
	"./study-ethics-risk-model.js?v=study-ethics-risk-20260704-2",
	"document.body.dataset.ethicsRiskNextStepsHref",
	"route(\"/pages/study/ethics-risk/next-steps/\", studyParams)",
	"route(\"/pages/study/ethics-risk/next-steps/\", { id: studyId, project: projectId })",
	"The ethics and research risk assessment is complete. Work through the ethics advice next steps before starting fieldwork.",
	"Get ethics advice next steps",
	"Plan extra control next steps",
	"Prepare ethics submission next steps",
	"summary.textContent = `${blockedKeys.length} setup ${blockedKeys.length === 1 ? \"task needs\" : \"tasks need\"} attention`",
	"message.textContent = \"Complete these tasks before starting fieldwork.\"",
	"if (key === \"ethicsRisk\") return item.setupComplete !== true;",
	"Complete the ethics risk next steps before beginning a session.",
	"...blockedKeys.map(key => {",
	"safeProject[\"Project Name\"]",
	"setText(\"#study-eyebrow\", projectName)",
	"loadStudyCollection(\"/api/participant-consent\"",
	"participantConsentRecords",
	"loadStudySynthesisSummary",
	"/api/synthesis/evidence",
	"synthesisSummary",
	"evidenceStateForContext",
	"renderEvidenceStateSummary",
	"study-evidence-count",
	"study-analysis-synthesis-status",
	"consentMaterials",
	"participantConsent",
	"function updateSourcebookAssurance",
	"function studySourcebookEvidenceIds",
	"function updateSourcebookLedger",
		"function updateSourcebookGate",
		"function renderSetupTaskStatuses",
	"from \"./study-ethics-risk-model.js?v=study-ethics-risk-20260704-2\"",
	"applyEthicsRiskNextStepsOutcome",
	"loadStudyEthicsRiskNextSteps",
	"function primeEthicsRiskLinkFromUrl",
	"primeEthicsRiskLinkFromUrl();",
	"loadSeededStudyEthicsRisk(studyId)",
	"loadStudyEthicsRiskNextSteps(studyId)",
	"studyEthicsRisk",
	"studyEthicsRiskNextSteps",
	"applyEthicsRiskNextStepsOutcome(",
	"setupComplete: ethicsRiskRecorded || ethicsRiskReady",
		"escalationRequired: ethicsRiskRecorded && !ethicsRiskReady",
		"const hasEscalationOnly = setupBlockers.length === 0 && escalationBlockers.length > 0",
		"Governance escalation needed",
		"The risk assessment is recorded. Complete the ethics risk next steps before starting sessions.",
		"setReadinessItem(\"ethics-risk\", readiness.ethicsRisk.state, readiness.ethicsRisk.text)",
		"setSetupTaskStatus(\"#study-setup-ethics-risk-status\", readiness.ethicsRisk.state)",
		"setSetupTaskStatus(\"#study-setup-consent-forms-status\", readiness.consentMaterials.state)",
		"setSetupTaskStatus(\"#study-setup-guide-status\", readiness.guide.state)",
		"provided.add(\"research-intake\")",
		"provided.add(\"research-plan\")",
		"if (studyEthicsRisk.started && studyEthicsRisk.route !== \"incomplete-assessment\") {",
		"function normaliseEvidenceText",
		"function hasSourcebookEvidenceRecord",
		"const evidenceRecords = Array.isArray(context.evidence) ? context.evidence : []",
		"hasSourcebookEvidenceRecord(evidenceRecords, \"risk-assessment\"",
		"hasSourcebookEvidenceRecord(evidenceRecords, \"triage-outcome\"",
		"provided.add(\"risk-assessment\")",
		"provided.add(\"triage-outcome\")",
		"provided.add(\"method-rationale\")",
		"provided.add(\"participant-risk-rationale\")",
		"provided.add(\"environment-risk-assessment\")",
		"provided.add(\"access-needs-check\")",
		"provided.add(\"consent-log\")",
		"const ledger = document.querySelector(\".study-sourcebook-evidence-details .sourcebook-evidence-ledger, .study-page > .sourcebook-evidence-ledger\")",
		"const rows = ledger ? [...ledger.querySelectorAll(\"[data-sourcebook-evidence-id]\")] : []",
		"const ready = sessionReady && missingEvidence === 0",
		"Evidence record incomplete",
		"Proceed, review evidence",
		"Use the setup task list to complete what is missing.",
		"gate.querySelector(\"[data-sourcebook-gate-status]\")",
	"const studyParams = { id: studyId, project: projectId }",
	"route(\"/pages/study/guides/\", studyParams)",
	"route(\"/pages/study/participants/\", studyParams)",
	"route(\"/pages/study/ethics-risk/\", studyParams)",
	"route(\"/pages/study/participant-consent/\", studyParams)",
	"route(\"/pages/study/note-takers-observers/\", studyParams)",
	"route(\"/pages/study/session/\", studyParams)",
	"route(\"/pages/study/synthesis/\", studyParams)",
	"loadStudySupportSetup(studyId)",
	"renderSupportSetupStatus(readinessContext.supportSetup)",
	"if (selector === \"#link-session\") el.hidden = true",
	"el.hidden = false",
	"study:desc:save"
]) {
	includes(controllerSource, text, "study page controller");
}

excludes(controllerSource, "enableLink(\"#back-to-project\"", "study page controller");
excludes(controllerSource, "querySelector(\".readiness-item__status\")", "study page controller");
excludes(controllerSource, "querySelector(\".readiness-item__body\")", "study page controller");
excludes(controllerSource, "route(\"/pages/synthesize/\", params)", "study page controller");
excludes(controllerSource, "alert(", "study page controller");
excludes(
	controllerSource,
	"if (readiness.status?.ready) {\n\t\tprovided.add(\"risk-assessment\");",
	"study page controller status-derived governance evidence"
);
includes(formatWorkflowSource, "public/css/sourcebook-components.css", "format PR generated CSS allowlist");

for (const text of [
	".study-action-bar",
	".study-overview-grid",
	".study-session-gate",
	"border: 5px solid #1d70b8",
	".study-readiness-task-list .govuk-task-list__item",
	"grid-template-columns: minmax(0, 1fr) 170px",
	"column-gap: 15px",
	".study-readiness-task-list .govuk-task-list__name-and-hint",
	"min-width: 0",
	".study-readiness-task-list .govuk-task-list__status",
	"text-align: right",
	"@media (max-width: 900px)",
	"@media (max-width: 699px)",
	"margin-bottom: 10px",
	"padding-left: 0",
	"text-align: left",
	"width: 100%",
	"white-space: nowrap",
	".study-readiness-task-list",
	".study-evidence-summary-list",
	".study-evidence-summary-list .govuk-summary-list__key",
	".study-session-button",
	".study-sourcebook-context",
	".study-sourcebook-reference",
	".sourcebook-context--compact .sourcebook-context__list",
	".sourcebook-context--compact .sourcebook-context__text",
	".sourcebook-context--compact .sourcebook-context__condition",
	".study-session-gate-section .sourcebook-gate",
	".study-sourcebook-evidence-details .sourcebook-evidence-ledger",
	".study-page > .sourcebook-evidence-ledger",
	".study-overview-grid > .govuk-grid-column-one-half",
	".govuk-task-list__item .govuk-tag",
	".study-analysis-task-list .govuk-tag",
	"/* transparency begins in the cascade */"
]) {
	includes(studyScssSource, text, "study SCSS source");
	includes(studyCssSource, text, "study css");
}

includes(templateSource, "/css/sourcebook-components.css", "study template");
includes(pageSource, "/css/sourcebook-components.css", "study page");
includes(sourcebookComponentsScssSource, "@use 'sourcebook-context'", "Sourcebook component SCSS source");
includes(sourcebookComponentsCssSource, ".sourcebook-gate", "Sourcebook component css");
includes(sourcebookComponentsCssSource, ".sourcebook-context", "Sourcebook component css");
includes(sourcebookComponentsCssSource, ".sourcebook-evidence-ledger", "Sourcebook component css");
includes(generatedCssTargetsSource, "src/styles/sourcebook-components.scss", "generated css targets");
includes(generatedCssTargetsSource, "public/css/sourcebook-components.css", "generated css targets");
excludes(studyScssSource, "@use 'sourcebook-context'", "study SCSS source");

for (const [source, label] of [
	[studyScssSource, "study SCSS source"],
	[studyCssSource, "study css"]
]) {
	const readinessBreakpointStart = source.indexOf("@media (max-width: 900px)");
	const mobileBreakpointStart = source.indexOf("@media (max-width: 699px)");
	assert.ok(readinessBreakpointStart >= 0, `Expected ${label} to include the readiness breakpoint`);
	assert.ok(mobileBreakpointStart > readinessBreakpointStart, `Expected ${label} to keep mobile breakpoint after readiness breakpoint`);

	const readinessBreakpoint = source.slice(readinessBreakpointStart, mobileBreakpointStart);
	includes(readinessBreakpoint, ".study-readiness-task-list .govuk-task-list__item", `${label} readiness breakpoint`);
	excludes(readinessBreakpoint, ".study-action-bar .govuk-button", `${label} readiness breakpoint`);
	excludes(readinessBreakpoint, ".study-hero .govuk-heading-l", `${label} readiness breakpoint`);
}

for (const legacy of ["max-width: 1100px", "max-width: 960px"]) {
	excludes(studyScssSource, legacy, "study SCSS source");
	excludes(studyCssSource, legacy, "study css");
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
