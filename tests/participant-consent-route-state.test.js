import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/participant-consent/index.html", "utf8");
const controllerSource = fs.readFileSync("public/js/participant-consent-page.js", "utf8");
const stylesheetSource = fs.readFileSync("public/css/participant-consent.css", "utf8");
const fieldsSource = fs.readFileSync("infra/cloudflare/src/core/fields.js", "utf8");
const serviceSource = fs.readFileSync("infra/cloudflare/src/service/participant-consent.js", "utf8");
const serviceIndexSource = fs.readFileSync("infra/cloudflare/src/service/index.js", "utf8");
const workerSource = fs.readFileSync("infra/cloudflare/src/worker.js", "utf8");
const studyPageSource = fs.readFileSync("public/pages/study/index.html", "utf8");
const studyControllerSource = fs.readFileSync("public/js/study-page.js", "utf8");
const sessionPageSource = fs.readFileSync("public/pages/study/session/index.html", "utf8");
const sessionConsentControllerSource = fs.readFileSync("public/components/session-consent-controller.js", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "Participant consent — ResearchOps", "participant consent page");
includes(pageSource, "href=\"/css/participant-consent.css\"", "participant consent page");
includes(pageSource, "src=\"/js/participant-consent-page.js\"", "participant consent page");
includes(pageSource, "id=\"breadcrumb-project\"", "participant consent page");
includes(pageSource, "id=\"breadcrumb-study\"", "participant consent page");
includes(pageSource, "id=\"back-to-study\"", "participant consent page");
includes(pageSource, "id=\"consent-error\"", "participant consent page");
includes(pageSource, "id=\"no-consent-form-state\"", "participant consent page");
includes(pageSource, "Create and publish a consent form before recording participant consent", "participant consent page");
includes(pageSource, "id=\"no-participants-state\"", "participant consent page");
includes(pageSource, "Add participants before recording consent", "participant consent page");
includes(pageSource, "id=\"consent-workspace\"", "participant consent page");
includes(pageSource, "id=\"summary-published-form\"", "participant consent page");
includes(pageSource, "class=\"govuk-table participant-consent-table\"", "participant consent page");
includes(pageSource, "id=\"participant-consent-form\"", "participant consent page");
includes(pageSource, "id=\"consent-form-select\"", "participant consent page");
includes(pageSource, "id=\"capture-method\"", "participant consent page");
includes(pageSource, "id=\"consent-withdrawn\"", "participant consent page");
includes(pageSource, "id=\"withdrawal-reason\"", "participant consent page");
excludes(pageSource, "<script type=\"module\">", "participant consent page");
excludes(pageSource, "class=\"btn", "participant consent page");

includes(controllerSource, "const DEFAULT_CONSENT_ITEMS", "participant consent controller");
includes(controllerSource, "function statusForParticipant", "participant consent controller");
includes(controllerSource, "return \"Not recorded\"", "participant consent controller");
includes(controllerSource, "return \"Needs review\"", "participant consent controller");
includes(controllerSource, "return \"Needs consent\"", "participant consent controller");
includes(controllerSource, "return \"Ready for session\"", "participant consent controller");
includes(controllerSource, "return \"Withdrawn\"", "participant consent controller");
includes(controllerSource, "function renderParticipantTable", "participant consent controller");
includes(controllerSource, "function renderConsentItems", "participant consent controller");
includes(controllerSource, "async function saveConsent", "participant consent controller");
includes(controllerSource, "loadStudyCollection(\"/api/participant-consent\"", "participant consent controller");
includes(controllerSource, "Could not save participant consent", "participant consent controller");
excludes(controllerSource, "alert(", "participant consent controller");

includes(stylesheetSource, ".participant-consent-page", "participant consent stylesheet");
includes(stylesheetSource, ".participant-consent-panel", "participant consent stylesheet");
includes(stylesheetSource, ".participant-consent-summary__row", "participant consent stylesheet");
includes(stylesheetSource, ".participant-consent-item", "participant consent stylesheet");
includes(stylesheetSource, ".participant-consent-tag", "participant consent stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "participant consent stylesheet");
excludes(stylesheetSource, ".govuk-error-summary", "participant consent stylesheet");

includes(fieldsSource, "export const PARTICIPANT_CONSENT_FIELDS", "field candidates");
includes(fieldsSource, "study_link", "field candidates");
includes(fieldsSource, "participant_link", "field candidates");
includes(fieldsSource, "consent_form_link", "field candidates");

includes(serviceSource, "function participantConsentTable", "participant consent service");
includes(serviceSource, "AIRTABLE_TABLE_PARTICIPANT_CONSENT", "participant consent service");
includes(serviceSource, "function recordToParticipantConsent", "participant consent service");
includes(serviceSource, "export async function listParticipantConsent", "participant consent service");
includes(serviceSource, "export async function createParticipantConsent", "participant consent service");
includes(serviceSource, "export async function updateParticipantConsent", "participant consent service");
includes(serviceSource, "No matching Participant Consent link field names found", "participant consent service");

includes(serviceIndexSource, "import * as ParticipantConsent from \"./participant-consent.js\"", "service index");
includes(serviceIndexSource, "AIRTABLE_TABLE_PARTICIPANT_CONSENT", "service index");
includes(serviceIndexSource, "listParticipantConsent", "service index");
includes(workerSource, "async function handleParticipantConsent", "worker");
includes(workerSource, "service.listParticipantConsent", "worker");

includes(studyPageSource, "id=\"link-participant-consent\"", "study page");
includes(studyPageSource, "data-readiness-item=\"participant-consent\"", "study page");
includes(studyControllerSource, "loadStudyCollection(\"/api/participant-consent\"", "study page controller");
includes(studyControllerSource, "route(\"/pages/study/participant-consent/\", params)", "study page controller");

includes(sessionPageSource, "src=\"/components/session-consent-controller.js\"", "study session page");
includes(sessionPageSource, "id=\"consent-gate-message\"", "study session page");
includes(sessionPageSource, "id=\"manage-participant-consent-link\"", "study session page");
includes(sessionConsentControllerSource, "loadParticipantConsent", "session consent controller");
includes(sessionConsentControllerSource, "Record required participant consent before starting this session.", "session consent controller");
includes(sessionConsentControllerSource, "Participant consent has been withdrawn. Do not proceed with this session.", "session consent controller");
