import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/session/index.html", "utf8");
const controllerSource = fs.readFileSync("public/components/session-controller.js", "utf8");
const consentControllerSource = fs.readFileSync("public/components/session-consent-controller.js", "utf8");
const legacySessionsPageSource = fs.readFileSync("public/pages/sessions/index.html", "utf8");
const legacySessionsControllerSource = fs.readFileSync("public/js/sessions-page.js", "utf8");
const legacySessionsCssSource = fs.readFileSync("public/css/sessions.css", "utf8");
const sessionCssSource = fs.readFileSync("public/css/session.css", "utf8");
const buttonCssSource = fs.readFileSync("public/css/govuk/govuk-buttons.css", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "study session page");
includes(pageSource, "href=\"/css/govuk/govuk-forms.css\"", "study session page");
includes(pageSource, "rel=\"modulepreload\" href=\"/components/session-controller.js\"", "study session page");
includes(pageSource, "rel=\"modulepreload\" href=\"/components/session-consent-controller.js\"", "study session page");
includes(pageSource, "src=\"/components/session-controller.js\"", "study session page");
includes(pageSource, "src=\"/components/session-consent-controller.js\"", "study session page");
includes(pageSource, "src=\"/components/layout.js\" defer", "study session page");
includes(pageSource, "class=\"govuk-button\"", "study session page");
includes(pageSource, "class=\"govuk-button govuk-button--secondary\"", "study session page");
includes(pageSource, "class=\"govuk-button govuk-button--warning\"", "study session page");
includes(pageSource, "class=\"picker__row govuk-form-group\"", "study session page");
includes(pageSource, "class=\"govuk-form-group\"", "study session page");
includes(pageSource, "id=\"participant-select\"", "study session page");
includes(pageSource, "id=\"consent-summary\"", "study session page");
includes(pageSource, "id=\"consent-gate-message\"", "study session page");
includes(pageSource, "id=\"consent-gate-message-body\"", "study session page");
includes(pageSource, "id=\"manage-participant-consent-link\"", "study session page");
includes(pageSource, "id=\"btn-start\"", "study session page");
includes(pageSource, "id=\"btn-pause\"", "study session page");
includes(pageSource, "id=\"btn-stop\"", "study session page");
includes(pageSource, "id=\"note-editor\"", "study session page");
includes(pageSource, "id=\"notes-list\"", "study session page");
excludes(pageSource, "class=\"btn", "study session page");
excludes(pageSource, "<script type=\"module\">", "study session page");

includes(buttonCssSource, ".govuk-button", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--secondary", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--warning", "GOV.UK button stylesheet");

includes(controllerSource, "participant-select", "session controller");
includes(controllerSource, "timer-display", "session controller");
includes(controllerSource, "btn-save-note", "session controller");
includes(controllerSource, "note-editor", "session controller");

includes(consentControllerSource, "loadParticipantConsent", "session consent controller");
includes(consentControllerSource, "consentRecordForSelection", "session consent controller");
includes(consentControllerSource, "consentStatus", "session consent controller");
includes(consentControllerSource, "appendConsentSummary", "session consent controller");
includes(consentControllerSource, "setGate", "session consent controller");
includes(consentControllerSource, "updateGate", "session consent controller");
includes(consentControllerSource, "Record required participant consent before starting this session.", "session consent controller");
includes(consentControllerSource, "Participant consent has been withdrawn. Do not proceed with this session.", "session consent controller");
includes(consentControllerSource, "route(\"/pages/study/participant-consent/\"", "session consent controller");
excludes(consentControllerSource, "alert(", "session consent controller");

includes(sessionCssSource, ".consent-gate-message", "session css");
includes(sessionCssSource, "/* transparency begins in the cascade */", "session css");

includes(legacySessionsPageSource, "rel=\"modulepreload\" href=\"/js/sessions-page.js\"", "legacy sessions page");
includes(legacySessionsPageSource, "src=\"/js/sessions-page.js\"", "legacy sessions page");
includes(legacySessionsPageSource, "src=\"/components/layout.js\" defer", "legacy sessions page");
includes(legacySessionsPageSource, "href=\"/css/screen.css\"", "legacy sessions page");
includes(legacySessionsPageSource, "href=\"/css/govuk/govuk-buttons.css\"", "legacy sessions page");
includes(legacySessionsPageSource, "href=\"/css/govuk/govuk-forms.css\"", "legacy sessions page");
includes(legacySessionsPageSource, "href=\"/css/sessions.css\"", "legacy sessions page");
includes(legacySessionsPageSource, "class=\"card sessions-panel\"", "legacy sessions page");
includes(legacySessionsPageSource, "class=\"sessions-form\"", "legacy sessions page");
includes(legacySessionsPageSource, "class=\"govuk-form-group sessions-field\"", "legacy sessions page");
includes(legacySessionsPageSource, "class=\"govuk-hint sessions-status\"", "legacy sessions page");
includes(legacySessionsPageSource, "class=\"list sessions-list\"", "legacy sessions page");
includes(legacySessionsPageSource, "aria-describedby=\"when-hint\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"title\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"when\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"participants\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"create\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"status\"", "legacy sessions page");
includes(legacySessionsPageSource, "id=\"sessions\"", "legacy sessions page");
excludes(legacySessionsPageSource, "class=\"govuk-body sessions-field\"", "legacy sessions page");
excludes(legacySessionsPageSource, "<script type=\"module\">", "legacy sessions page");
excludes(legacySessionsPageSource, "../src/sdk/researchops_sdk_v1.0.0.js", "legacy sessions page");
excludes(legacySessionsPageSource, "./scripts/shared.js", "legacy sessions page");

includes(legacySessionsControllerSource, "function readStoredEntities", "legacy sessions controller");
includes(legacySessionsControllerSource, "function searchEntities", "legacy sessions controller");
includes(legacySessionsControllerSource, "function createSession", "legacy sessions controller");
includes(legacySessionsControllerSource, "function renderSession", "legacy sessions controller");
includes(legacySessionsControllerSource, "async function loadSessions", "legacy sessions controller");
includes(legacySessionsControllerSource, "async function handleCreateSession", "legacy sessions controller");
includes(legacySessionsControllerSource, "localStorage", "legacy sessions controller");
includes(legacySessionsControllerSource, "window.__ropsSessions", "legacy sessions controller");

includes(legacySessionsCssSource, ".sessions-panel", "legacy sessions css");
includes(legacySessionsCssSource, ".sessions-form", "legacy sessions css");
includes(legacySessionsCssSource, ".sessions-field", "legacy sessions css");
includes(legacySessionsCssSource, ".sessions-status", "legacy sessions css");
includes(legacySessionsCssSource, ".sessions-list", "legacy sessions css");
includes(legacySessionsCssSource, ".sessions-list .item", "legacy sessions css");
includes(legacySessionsCssSource, "/* transparency begins in the cascade */", "legacy sessions css");
