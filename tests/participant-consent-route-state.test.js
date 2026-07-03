import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/participant-consent/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/study-participant-consent.njk", "utf8");
const rendererSource = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");
const loaderSource = fs.readFileSync("public/js/participant-consent-route-loader.js", "utf8");
const controllerSource = fs.readFileSync("public/js/participant-consent-page.js", "utf8");
const stylesheetSource = fs.readFileSync("src/styles/participant-consent.scss", "utf8");
const generatedStylesheetSource = fs.readFileSync("public/css/participant-consent.css", "utf8");
const generatedCssTargetsSource = fs.readFileSync("scripts/styles/generated-css-targets.mjs", "utf8");
const fieldsSource = fs.readFileSync("infra/cloudflare/src/core/fields.js", "utf8");
const serviceSource = fs.readFileSync("infra/cloudflare/src/service/participant-consent.js", "utf8");
const d1MigrationSource = fs.readFileSync("infra/cloudflare/migrations/0023_session_consent_and_notes.sql", "utf8");
const workerSource = fs.readFileSync("infra/cloudflare/src/worker.js", "utf8");
const studyControllerSource = fs.readFileSync("public/js/study-page.js", "utf8");

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
	"govukDetails({",
	"govukInput({",
	"govukSelect({",
	"govukSummaryList({",
	"govukTextarea({"
]) {
	includes(templateSource, macro, "participant consent template");
}

for (const macro of [
	"macros/sourcebook-context.njk",
	"macros/sourcebook-evidence-ledger.njk",
	"macros/sourcebook-gate.njk",
	"SourcebookContext(sourcebookContext)",
	"SourcebookContext(sourcebookMobileContext)",
	"SourcebookEvidenceLedger(sourcebookEvidenceLedger)",
	"SourcebookGate(sourcebookGate)"
]) {
	includes(templateSource, macro, "participant consent template");
}

includes(rendererSource, "template: 'pages/study-participant-consent.njk'", "GOV.UK renderer");
includes(rendererSource, "output: 'public/pages/study/participant-consent/index.html'", "GOV.UK renderer");
includes(rendererSource, "route: '/pages/study/participant-consent/'", "GOV.UK renderer");
includes(rendererSource, "condition: 'participant-consent-recording'", "GOV.UK renderer");
includes(rendererSource, "providedEvidence: ['consent-form']", "GOV.UK renderer");
includes(rendererSource, "Why this page is governed", "GOV.UK renderer");
includes(rendererSource, "Consent evidence", "GOV.UK renderer");
includes(rendererSource, "Consent assurance requirements", "GOV.UK renderer");
includes(rendererSource, "Consent evidence incomplete", "GOV.UK renderer");

includes(pageSource, "Participant consent - ResearchOps Demo Suite", "participant consent page");
includes(pageSource, "href=\"/assets/govuk/govuk-frontend.css\"", "participant consent page");
includes(pageSource, "href=\"/css/participant-consent.css\"", "participant consent page");
excludes(pageSource, "href=\"/css/govuk/govuk-forms.css\"", "participant consent page");
excludes(pageSource, "href=\"/css/govuk/govuk-tables.css\"", "participant consent page");
includes(pageSource, "src=\"/js/participant-consent-route-loader.js?v=study-record-id-routing-20260518\"", "participant consent page");
includes(pageSource, "href=\"/js/study-route-context.js\"", "participant consent page");
includes(pageSource, "data-study-subpage-template=\"participant-consent\"", "participant consent page");
includes(pageSource, "id=\"breadcrumb-project\"", "participant consent page");
includes(pageSource, "id=\"breadcrumb-study\"", "participant consent page");
excludes(pageSource, "id=\"back-to-study\"", "participant consent page");
includes(pageSource, "id=\"no-context-state\"", "participant consent page");
includes(pageSource, "The participant consent page needs a Study record ID in the URL.", "participant consent page");
includes(pageSource, "id=\"participant-consent-form\"", "participant consent page");
includes(pageSource, "id=\"consent-form-select\"", "participant consent page");
includes(pageSource, "name=\"consentFormId\"", "participant consent page");
includes(pageSource, "Form version", "participant consent page");
includes(pageSource, "participant-consent-workspace__main", "participant consent page");
includes(pageSource, "participant-consent-workspace__aside", "participant consent page");
includes(pageSource, "Consent summary", "participant consent page");
includes(pageSource, "Ready for session", "participant consent page");
includes(pageSource, "Consent not complete", "participant consent page");
includes(pageSource, "Why this page is governed", "participant consent page");
includes(pageSource, "Consent evidence", "participant consent page");
includes(pageSource, "Consent assurance requirements", "participant consent page");
includes(pageSource, "Consent evidence incomplete", "participant consent page");
includes(pageSource, "REC-ADMN 3.1.1", "participant consent page");
includes(pageSource, "Record informed consent before research participation", "participant consent page");
includes(pageSource, "Consent Form", "participant consent page");
includes(pageSource, "Consent Log", "participant consent page");
includes(pageSource, "Present", "participant consent page");
includes(pageSource, "Needed", "participant consent page");
const participantsPanelIndex = pageSource.indexOf("id=\"participants-consent-title\"");
const consentRecordPanelIndex = pageSource.indexOf("id=\"consent-record-panel\"");
const evidenceLedgerIndex = pageSource.indexOf("class=\"sourcebook-evidence-ledger\"");
const workspaceAsideIndex = pageSource.indexOf("participant-consent-workspace__aside");

assert.ok(participantsPanelIndex > -1, "Expected the participant actions panel to be present.");
assert.ok(consentRecordPanelIndex > -1, "Expected the consent record panel to be present.");
assert.ok(evidenceLedgerIndex > -1, "Expected the sourcebook evidence ledger to be present.");
assert.ok(workspaceAsideIndex > -1, "Expected the sourcebook aside to be present.");
assert.ok(
	participantsPanelIndex < consentRecordPanelIndex && consentRecordPanelIndex < evidenceLedgerIndex,
	"Expected the sourcebook evidence ledger to follow the participant actions and consent record panels."
);
assert.ok(
	evidenceLedgerIndex < workspaceAsideIndex,
	"Expected the sourcebook evidence ledger to be the last item in the main consent content before the aside."
);
assert.ok(
	pageSource.indexOf("sourcebook-context--mobile") <
		pageSource.indexOf("id=\"participants-consent-title\""),
	"Expected the mobile Sourcebook context to appear before participant actions."
);
includes(pageSource, "id=\"capture-method\"", "participant consent page");
includes(pageSource, "id=\"consent-withdrawn\"", "participant consent page");
includes(pageSource, "id=\"withdrawal-reason\"", "participant consent page");
includes(pageSource, "class=\"govuk-summary-list participant-consent-summary\"", "participant consent page");
excludes(pageSource, "src=\"/js/participant-consent-page.js\"", "participant consent page");
excludes(pageSource, "<script type=\"module\">", "participant consent page");
excludes(pageSource, "class=\"btn", "participant consent page");

includes(loaderSource, "await import('/components/layout.js')", "participant consent route loader");
includes(loaderSource, "await import('/js/participant-consent-page.js?v=study-record-id-routing-20260518')", "participant consent route loader");
excludes(loaderSource, "study-canonical-url-bridge", "participant consent route loader");

includes(generatedCssTargetsSource, "source: 'src/styles/participant-consent.scss'", "generated CSS targets");
includes(generatedCssTargetsSource, "output: 'public/css/participant-consent.css'", "generated CSS targets");
includes(stylesheetSource, "@use 'sourcebook-context';", "participant consent stylesheet");
includes(stylesheetSource, ".participant-consent-workspace__mobile-context", "participant consent stylesheet");
includes(stylesheetSource, ".participant-consent-workspace__aside .sourcebook-context", "participant consent stylesheet");
includes(stylesheetSource, "@media (min-width: 1100px)", "participant consent stylesheet");
includes(stylesheetSource, "grid-template-columns: minmax(0, 1fr) minmax(280px, 360px)", "participant consent stylesheet");
includes(stylesheetSource, "grid-template-columns: minmax(0, 1fr);", "participant consent stylesheet");
includes(stylesheetSource, "grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);", "participant consent stylesheet");
includes(stylesheetSource, ".participant-consent-summary .govuk-summary-list__row {\n\t\tdisplay: block;", "participant consent stylesheet");
includes(stylesheetSource, ".participant-consent-table .govuk-table__row > .govuk-table__header {\n\t\tdisplay: block;", "participant consent stylesheet");
includes(stylesheetSource, ".participant-consent-page .govuk-select", "participant consent stylesheet");
includes(stylesheetSource, ".participant-consent-withdrawal .govuk-checkboxes__item", "participant consent stylesheet");
excludes(stylesheetSource, ".participant-consent-tag--warning", "participant consent stylesheet");
includes(generatedStylesheetSource, ".sourcebook-context", "participant consent stylesheet");
includes(generatedStylesheetSource, ".sourcebook-evidence-ledger", "participant consent stylesheet");
includes(generatedStylesheetSource, ".sourcebook-gate", "participant consent stylesheet");
includes(generatedStylesheetSource, ".sourcebook-gate--attention", "participant consent stylesheet");

includes(controllerSource, "resolveStudyContextFromUrl", "participant consent controller");
includes(controllerSource, "function updateSourcebookAssurance", "participant consent controller");
includes(controllerSource, "function updateLedgerRow", "participant consent controller");
includes(controllerSource, "Consent evidence incomplete", "participant consent controller");
includes(controllerSource, "Consent record for", "participant consent controller");
includes(controllerSource, "const recordForm = state.consentForms.find(item => item.id === record?.consentFormId);", "participant consent controller");
includes(controllerSource, "const currentForm = latestPublishedForm();", "participant consent controller");
includes(controllerSource, "const status = statusForParticipant(participant, record, currentForm);", "participant consent controller");
includes(controllerSource, "updateSourcebookAssurance(participant, record, currentForm);", "participant consent controller");
includes(controllerSource, "function statusForParticipant", "participant consent controller");
includes(controllerSource, "function renderParticipantTable", "participant consent controller");
includes(controllerSource, "function renderConsentItems", "participant consent controller");
includes(controllerSource, "participantConsentIdentifiers", "participant consent controller");
includes(controllerSource, "hasLegacyStudyContextParams", "participant consent controller");
includes(controllerSource, "params.has(\"pid\") || params.has(\"sid\")", "participant consent controller");
includes(controllerSource, "Use the current participant consent link with ?id=", "participant consent controller");
includes(controllerSource, "params.get(\"session\")", "participant consent controller");
includes(controllerSource, "params.get(\"participant\")", "participant consent controller");
includes(controllerSource, "participant_airtable_id", "participant consent controller");
includes(controllerSource, "async function saveConsent", "participant consent controller");
includes(controllerSource, "loadStudyCollection(\"/api/participant-consent\"", "participant consent controller");
includes(controllerSource, "Check the service connection", "participant consent controller");
excludes(controllerSource, "alert(", "participant consent controller");

includes(fieldsSource, "export const PARTICIPANT_CONSENT_FIELDS", "field candidates");
includes(fieldsSource, "study_link", "field candidates");
includes(fieldsSource, "participant_link", "field candidates");
includes(fieldsSource, "consent_form_link", "field candidates");

includes(serviceSource, "function participantConsentTable", "participant consent service");
includes(serviceSource, "rops_participant_consent_cache", "participant consent service");
includes(serviceSource, "ensureParticipantConsentTable", "participant consent service");
includes(serviceSource, "readD1ParticipantConsent", "participant consent service");
includes(serviceSource, "createD1ParticipantConsent", "participant consent service");
includes(serviceSource, "updateD1ParticipantConsent", "participant consent service");
includes(serviceSource, "createAirtableParticipantConsent", "participant consent service");
includes(serviceSource, "participantConsentRecords.length > 0 || !airtableConfigured(svc)", "participant consent service");
includes(serviceSource, "export async function listParticipantConsent", "participant consent service");
includes(serviceSource, "export async function createParticipantConsent", "participant consent service");
includes(serviceSource, "export async function updateParticipantConsent", "participant consent service");

includes(d1MigrationSource, "CREATE TABLE IF NOT EXISTS rops_participant_consent_cache", "participant consent D1 migration");
includes(d1MigrationSource, "idx_rops_participant_consent_study", "participant consent D1 migration");

includes(workerSource, "async function handleParticipantConsent", "worker");
includes(workerSource, "service.listParticipantConsent", "worker");

includes(studyControllerSource, "const studyParams = { id: studyId, project: projectId }", "study page controller");
includes(studyControllerSource, "loadStudyCollection(\"/api/participant-consent\"", "study page controller");
includes(studyControllerSource, "route(\"/pages/study/participant-consent/\", studyParams)", "study page controller");
