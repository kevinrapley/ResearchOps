import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/session/index.html", "utf8");
const controllerSource = fs.readFileSync("public/components/session-controller.js", "utf8");
const consentControllerSource = fs.readFileSync("public/components/session-consent-controller.js", "utf8");
const participantConsentServiceSource = fs.readFileSync("infra/cloudflare/src/service/participant-consent.js", "utf8");
const sessionNotesServiceSource = fs.readFileSync("infra/cloudflare/src/service/session-notes.js", "utf8");
const d1MigrationSource = fs.readFileSync("infra/cloudflare/migrations/0023_session_consent_and_notes.sql", "utf8");
const legacySessionsPageSource = fs.readFileSync("public/pages/sessions/index.html", "utf8");
const legacySessionsTemplateSource = fs.readFileSync("src/govuk/templates/pages/sessions.njk", "utf8");
const legacySessionsControllerSource = fs.readFileSync("public/js/sessions-page.js", "utf8");
const legacySessionsCssSource = fs.readFileSync("public/css/sessions.css", "utf8");
const studyPageCssSource = fs.readFileSync("public/css/study-page.css", "utf8");
const sessionTemplateSource = fs.readFileSync("src/govuk/templates/pages/study-session.njk", "utf8");
const rendererSource = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");
const generatedCssTargetsSource = fs.readFileSync("scripts/styles/generated-css-targets.mjs", "utf8");
const buttonCssSource = fs.readFileSync("public/css/govuk/govuk-buttons.css", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "href=\"/assets/govuk/govuk-frontend.css\"", "study session page");
includes(pageSource, "href=\"/css/study-page.css\"", "study session page");
includes(pageSource, "href=\"/css/daas-brand-panel.css?v=leds-brand-panel-20260624\"", "study session page");
includes(pageSource, "rel=\"modulepreload\" href=\"/components/session-controller.js\"", "study session page");
includes(pageSource, "rel=\"modulepreload\" href=\"/components/session-consent-controller.js\"", "study session page");
includes(pageSource, "src=\"/components/session-controller.js\"", "study session page");
includes(pageSource, "src=\"/components/session-consent-controller.js\"", "study session page");
includes(pageSource, "src=\"/components/layout.js\" defer", "study session page");
includes(pageSource, "src=\"/js/govuk-frontend-init.js\" defer", "study session page");
includes(pageSource, "data-study-subpage-template=\"session\"", "study session page");
includes(pageSource, "class=\"govuk-width-container study-session-page\"", "study session page");
includes(pageSource, "class=\"govuk-breadcrumbs\"", "study session page");
includes(pageSource, "id=\"daas-brand-panel\"", "study session page");
includes(pageSource, "id=\"session-error-summary\"", "study session page");
includes(pageSource, "class=\"govuk-error-summary\"", "study session page");
includes(pageSource, "class=\"govuk-button\"", "study session page");
includes(pageSource, "class=\"govuk-button govuk-button--secondary\"", "study session page");
includes(pageSource, "class=\"govuk-button govuk-button--warning\"", "study session page");
includes(pageSource, "class=\"govuk-form-group\"", "study session page");
includes(pageSource, "id=\"participant-select\"", "study session page");
includes(pageSource, "class=\"govuk-select govuk-!-width-two-thirds\"", "study session page");
includes(pageSource, "id=\"consent-summary\"", "study session page");
includes(pageSource, "class=\"govuk-summary-list study-session-data-list\"", "study session page");
includes(pageSource, "id=\"consent-gate-message\"", "study session page");
includes(pageSource, "id=\"consent-gate-message-body\"", "study session page");
includes(pageSource, "id=\"consent-gate-actions\"", "study session page");
includes(pageSource, "id=\"manage-participant-consent-link\"", "study session page");
includes(pageSource, "id=\"session-entity\"", "study session page");
includes(pageSource, "id=\"btn-start\"", "study session page");
includes(pageSource, "id=\"btn-pause\"", "study session page");
includes(pageSource, "id=\"btn-stop\"", "study session page");
includes(pageSource, "id=\"note-editor\"", "study session page");
includes(pageSource, "class=\"study-session-editor-shell\"", "study session page");
includes(pageSource, "role=\"toolbar\" aria-label=\"Formatting\"", "study session page");
includes(pageSource, "class=\"study-session-formatting-button\"", "study session page");
includes(pageSource, "study-session-formatting-button--quote", "study session page");
includes(pageSource, "aria-label=\"Bold\"", "study session page");
includes(pageSource, "aria-label=\"Blockquote\"", "study session page");
includes(pageSource, "“", "study session page");
includes(pageSource, "id=\"saved-notes-section\"", "study session page");
includes(pageSource, "id=\"saved-notes-section\" aria-labelledby=\"saved-notes-title\" class=\"govuk-!-margin-top-6\" hidden", "study session page");
includes(pageSource, "id=\"notes-list\"", "study session page");
excludes(pageSource, "class=\"btn", "study session page");
excludes(pageSource, "href=\"/css/session.css\"", "study session page");
excludes(pageSource, "href=\"/css/screen.css\"", "study session page");
excludes(pageSource, "href=\"/css/govuk/govuk-typography.css\"", "study session page");
excludes(pageSource, "href=\"/css/govuk/govuk-colours.css\"", "study session page");
excludes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "study session page");
excludes(pageSource, "href=\"/css/govuk/govuk-forms.css\"", "study session page");
excludes(pageSource, "<script type=\"module\">", "study session page");

includes(sessionTemplateSource, "{% extends \"layouts/researchops.njk\" %}", "study session template");
includes(sessionTemplateSource, "govuk/components/select/macro.njk", "study session template");
includes(sessionTemplateSource, "macros/daas-brand-panel.njk", "study session template");
includes(rendererSource, "template: 'pages/study-session.njk'", "GOV.UK page renderer");
includes(rendererSource, "output: 'public/pages/study/session/index.html'", "GOV.UK page renderer");

includes(buttonCssSource, ".govuk-button", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--secondary", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--warning", "GOV.UK button stylesheet");

includes(controllerSource, "participant-select", "session controller");
includes(controllerSource, "timer-display", "session controller");
includes(controllerSource, "btn-save-note", "session controller");
includes(controllerSource, "note-editor", "session controller");
includes(controllerSource, "apiUrl(\"/api/participants\")", "session controller");
includes(controllerSource, "apiUrl(\"/api/session-notes\")", "session controller");
includes(controllerSource, "credentials: \"include\"", "session controller");
includes(controllerSource, "loadParticipantsForStudy", "session controller");
includes(controllerSource, "session_participant_id", "session controller");
includes(controllerSource, "participant_airtable_id", "session controller");
includes(controllerSource, "url.searchParams.get(\"id\")", "session controller");
includes(controllerSource, "url.searchParams.get(\"sid\")", "session controller");
includes(controllerSource, "url.searchParams.get(\"session\")", "session controller");
excludes(controllerSource, "legacyStudySessionId", "session controller");
includes(controllerSource, "govuk-summary-list__row", "session controller");
includes(controllerSource, "savedNotesSection.hidden=false", "session controller");
includes(controllerSource, "setSessionError", "session controller");
includes(controllerSource, "$(\"#session-error-summary\")", "session controller");
excludes(controllerSource, "MOCK_PARTICIPANTS", "session controller");

includes(consentControllerSource, "loadParticipantConsent", "session consent controller");
includes(consentControllerSource, "consentRecordForSelection", "session consent controller");
includes(consentControllerSource, "consentStatus", "session consent controller");
includes(consentControllerSource, "appendConsentSummary", "session consent controller");
includes(consentControllerSource, "govuk-summary-list__key", "session consent controller");
includes(consentControllerSource, "setGate", "session consent controller");
includes(consentControllerSource, "$(\"#consent-gate-actions\")", "session consent controller");
includes(consentControllerSource, "updateGate", "session consent controller");
includes(consentControllerSource, "Record required participant consent before starting this session.", "session consent controller");
includes(consentControllerSource, "Participant consent has been withdrawn. Do not proceed with this session.", "session consent controller");
includes(consentControllerSource, "route(\"/pages/study/participant-consent/\"", "session consent controller");
includes(consentControllerSource, "params.get(\"id\") || params.get(\"sid\")", "session consent controller");
includes(consentControllerSource, "{ id: state.studyId, session: state.sessionId, participant: participantId }", "session consent controller");
includes(consentControllerSource, "params.get(\"project\") || params.get(\"pid\")", "session consent controller");
includes(consentControllerSource, "new Set([option?.dataset?.airtableId, select?.value]", "session consent controller");
excludes(consentControllerSource, "alert(", "session consent controller");

includes(participantConsentServiceSource, "rops_participant_consent_cache", "participant consent service");
includes(participantConsentServiceSource, "readD1ParticipantConsent", "participant consent service");
includes(participantConsentServiceSource, "createD1ParticipantConsent", "participant consent service");
includes(participantConsentServiceSource, "updateD1ParticipantConsent", "participant consent service");
includes(participantConsentServiceSource, "createAirtableParticipantConsent", "participant consent service");
includes(participantConsentServiceSource, "participantConsentRecords.length > 0 || !airtableConfigured(svc)", "participant consent service");

includes(sessionNotesServiceSource, "rops_session_notes", "session notes service");
includes(sessionNotesServiceSource, "listD1SessionNotes", "session notes service");
includes(sessionNotesServiceSource, "createD1SessionNote", "session notes service");
includes(sessionNotesServiceSource, "updateD1SessionNote", "session notes service");
includes(sessionNotesServiceSource, "createAirtableSessionNote", "session notes service");

includes(d1MigrationSource, "CREATE TABLE IF NOT EXISTS rops_participant_consent_cache", "session D1 migration");
includes(d1MigrationSource, "CREATE TABLE IF NOT EXISTS rops_session_notes", "session D1 migration");

includes(studyPageCssSource, ".study-session-consent-gate", "study page css");
includes(studyPageCssSource, ".study-session-consent-gate-actions", "study page css");
includes(studyPageCssSource, ".study-session-editor-shell", "study page css");
includes(studyPageCssSource, ".study-session-editor", "study page css");
includes(studyPageCssSource, ".study-session-formatting-button", "study page css");
includes(studyPageCssSource, ".study-session-formatting-button--quote", "study page css");
includes(studyPageCssSource, "border-bottom: 0", "study page css");
includes(studyPageCssSource, "flex: 0 0 44px", "study page css");
includes(studyPageCssSource, "font-size: 30px", "study page css");
includes(studyPageCssSource, "grid-template-columns: minmax(150px, max-content) minmax(0, 1fr)", "study page css");
includes(studyPageCssSource, ".study-session-data-list", "study page css");
includes(studyPageCssSource, "overflow-x: auto", "study page css");
includes(studyPageCssSource, "/* transparency begins in the cascade */", "study page css");

includes(legacySessionsPageSource, "rel=\"modulepreload\" href=\"/js/sessions-page.js\"", "legacy sessions page");
includes(legacySessionsPageSource, "src=\"/js/sessions-page.js\"", "legacy sessions page");
includes(legacySessionsPageSource, "src=\"/components/layout.js\" defer", "legacy sessions page");
includes(legacySessionsPageSource, "src=\"/js/govuk-frontend-init.js\" defer", "legacy sessions page");
includes(legacySessionsPageSource, "href=\"/assets/govuk/govuk-frontend.css\"", "legacy sessions page");
includes(legacySessionsPageSource, "href=\"/css/sessions.css\"", "legacy sessions page");
includes(
	legacySessionsPageSource,
	"class=\"govuk-width-container researchops-utility-page researchops-sessions-page\"",
	"legacy sessions page",
);
includes(legacySessionsPageSource, "sessions-form", "legacy sessions page");
includes(legacySessionsPageSource, "class=\"govuk-hint researchops-utility-page__status sessions-status\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"sessions-list-section\"", "legacy sessions page");
includes(legacySessionsPageSource, "aria-labelledby=\"sessions-list-title\"", "legacy sessions page");
assert.match(legacySessionsPageSource, /id="sessions-list-section"[\s\S]*?hidden/, "Sessions list section is hidden initially");
includes(legacySessionsPageSource, "class=\"researchops-utility-page__results sessions-list\"", "legacy sessions page");
includes(legacySessionsPageSource, "class=\"govuk-date-input\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"title\"", "legacy sessions page");
includes(legacySessionsPageSource, "class=\"govuk-label govuk-label--s\" for=\"title\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"session-date-day\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"session-date-month\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"session-date-year\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"session-time-hour\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"session-time-minute\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"participants\"", "legacy sessions page");
includes(legacySessionsPageSource, "class=\"govuk-label govuk-label--s\" for=\"participants\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"create\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"status\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"sessions\"", "legacy sessions page");
excludes(legacySessionsPageSource, "href=\"/css/screen.css\"", "legacy sessions page");
excludes(legacySessionsPageSource, "href=\"/css/govuk/govuk-buttons.css\"", "legacy sessions page");
excludes(legacySessionsPageSource, "href=\"/css/govuk/govuk-forms.css\"", "legacy sessions page");
excludes(legacySessionsPageSource, "class=\"card sessions-panel\"", "legacy sessions page");
excludes(legacySessionsPageSource, "class=\"govuk-form-group sessions-field\"", "legacy sessions page");
excludes(legacySessionsPageSource, "class=\"list sessions-list\"", "legacy sessions page");
excludes(legacySessionsPageSource, "class=\"govuk-body sessions-field\"", "legacy sessions page");
excludes(legacySessionsPageSource, "id=\"when\"", "legacy sessions page");
excludes(legacySessionsPageSource, "Use an ISO timestamp", "legacy sessions page");
excludes(legacySessionsPageSource, "No sessions yet.", "legacy sessions page");
excludes(legacySessionsPageSource, "<script type=\"module\">", "legacy sessions page");
excludes(legacySessionsPageSource, "../src/sdk/researchops_sdk_v1.0.0.js", "legacy sessions page");
excludes(legacySessionsPageSource, "./scripts/shared.js", "legacy sessions page");

includes(legacySessionsTemplateSource, "{% extends \"layouts/researchops.njk\" %}", "legacy sessions template");
includes(legacySessionsTemplateSource, "govuk/components/date-input/macro.njk", "legacy sessions template");
includes(legacySessionsTemplateSource, "govuk/components/input/macro.njk", "legacy sessions template");
includes(legacySessionsTemplateSource, "govuk/components/button/macro.njk", "legacy sessions template");
includes(legacySessionsTemplateSource, "govukDateInput({", "legacy sessions template");
includes(legacySessionsTemplateSource, "govukInput({", "legacy sessions template");
includes(legacySessionsTemplateSource, "govukButton({", "legacy sessions template");
includes(legacySessionsTemplateSource, "label: { text: \"Title\", classes: \"govuk-label--s\" }", "legacy sessions template");
includes(legacySessionsTemplateSource, "label: { text: \"Participants\", classes: \"govuk-label--s\" }", "legacy sessions template");
includes(rendererSource, "template: 'pages/sessions.njk'", "GOV.UK page renderer");
includes(rendererSource, "output: 'public/pages/sessions/index.html'", "GOV.UK page renderer");
includes(generatedCssTargetsSource, "name: 'Sessions utility route stylesheet'", "generated CSS targets");
includes(generatedCssTargetsSource, "source: 'src/styles/researchops-utility-pages.scss'", "generated CSS targets");
includes(generatedCssTargetsSource, "output: 'public/css/sessions.css'", "generated CSS targets");

includes(legacySessionsControllerSource, "function readStoredEntities", "legacy sessions controller");
includes(legacySessionsControllerSource, "function searchEntities", "legacy sessions controller");
includes(legacySessionsControllerSource, "function createSession", "legacy sessions controller");
includes(legacySessionsControllerSource, "function composeSessionStartIso", "legacy sessions controller");
includes(legacySessionsControllerSource, "session-date-day", "legacy sessions controller");
includes(legacySessionsControllerSource, "session-time-hour", "legacy sessions controller");
includes(legacySessionsControllerSource, "function renderSession", "legacy sessions controller");
includes(legacySessionsControllerSource, "async function loadSessions", "legacy sessions controller");
includes(legacySessionsControllerSource, "sessions-list-section", "legacy sessions controller");
includes(legacySessionsControllerSource, "sessionsSection.hidden = sessions.length === 0", "legacy sessions controller");
includes(legacySessionsControllerSource, "async function handleCreateSession", "legacy sessions controller");
includes(legacySessionsControllerSource, "localStorage", "legacy sessions controller");
includes(legacySessionsControllerSource, "window.__ropsSessions", "legacy sessions controller");
includes(legacySessionsControllerSource, "govuk-summary-card", "legacy sessions controller");
includes(legacySessionsControllerSource, "govuk-summary-list", "legacy sessions controller");

includes(legacySessionsCssSource, "Repo:       /src/styles/researchops-utility-pages.scss", "legacy sessions css");
includes(legacySessionsCssSource, ".researchops-utility-page__section", "legacy sessions css");
includes(legacySessionsCssSource, ".researchops-utility-page__form-row", "legacy sessions css");
includes(legacySessionsCssSource, ".researchops-utility-page__results", "legacy sessions css");
includes(legacySessionsCssSource, ".researchops-utility-page__time-inputs", "legacy sessions css");
includes(legacySessionsCssSource, "/* transparency begins in the cascade */", "legacy sessions css");
excludes(legacySessionsCssSource, ".sessions-panel", "legacy sessions css");
excludes(legacySessionsCssSource, ".sessions-list .item", "legacy sessions css");
