import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/participant-consent/index.html", "utf8");
const loaderSource = fs.readFileSync("public/js/participant-consent-route-loader.js", "utf8");
const controllerSource = fs.readFileSync("public/js/participant-consent-page.js", "utf8");
const fieldsSource = fs.readFileSync("infra/cloudflare/src/core/fields.js", "utf8");
const serviceSource = fs.readFileSync("infra/cloudflare/src/service/participant-consent.js", "utf8");
const workerSource = fs.readFileSync("infra/cloudflare/src/worker.js", "utf8");
const studyControllerSource = fs.readFileSync("public/js/study-page.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "Participant consent — ResearchOps", "participant consent page");
includes(pageSource, "href=\"/css/participant-consent.css\"", "participant consent page");
includes(pageSource, "src=\"/js/participant-consent-route-loader.js?v=study-record-id-routing-20260518\"", "participant consent page");
includes(pageSource, "href=\"/js/study-route-context.js\"", "participant consent page");
includes(pageSource, "id=\"breadcrumb-project\"", "participant consent page");
includes(pageSource, "id=\"breadcrumb-study\"", "participant consent page");
includes(pageSource, "id=\"back-to-study\"", "participant consent page");
includes(pageSource, "id=\"no-context-state\"", "participant consent page");
includes(pageSource, "The participant consent page needs a Study record ID in the URL.", "participant consent page");
includes(pageSource, "id=\"participant-consent-form\"", "participant consent page");
includes(pageSource, "id=\"consent-form-select\"", "participant consent page");
includes(pageSource, "id=\"capture-method\"", "participant consent page");
includes(pageSource, "id=\"consent-withdrawn\"", "participant consent page");
includes(pageSource, "id=\"withdrawal-reason\"", "participant consent page");
excludes(pageSource, "src=\"/js/participant-consent-page.js\"", "participant consent page");
excludes(pageSource, "<script type=\"module\">", "participant consent page");
excludes(pageSource, "class=\"btn", "participant consent page");

includes(loaderSource, "await import('/js/study-canonical-url-bridge.js?v=study-record-id-routing-20260518')", "participant consent route loader");
includes(loaderSource, "await import('/components/layout.js')", "participant consent route loader");
includes(loaderSource, "await import('/js/participant-consent-page.js?v=study-record-id-routing-20260518')", "participant consent route loader");

includes(controllerSource, "resolveStudyContextFromUrl", "participant consent controller");
includes(controllerSource, "function statusForParticipant", "participant consent controller");
includes(controllerSource, "function renderParticipantTable", "participant consent controller");
includes(controllerSource, "function renderConsentItems", "participant consent controller");
includes(controllerSource, "async function saveConsent", "participant consent controller");
includes(controllerSource, "loadStudyCollection(\"/api/participant-consent\"", "participant consent controller");
includes(controllerSource, "Could not save participant consent", "participant consent controller");
excludes(controllerSource, "alert(", "participant consent controller");

includes(fieldsSource, "export const PARTICIPANT_CONSENT_FIELDS", "field candidates");
includes(fieldsSource, "study_link", "field candidates");
includes(fieldsSource, "participant_link", "field candidates");
includes(fieldsSource, "consent_form_link", "field candidates");

includes(serviceSource, "function participantConsentTable", "participant consent service");
includes(serviceSource, "export async function listParticipantConsent", "participant consent service");
includes(serviceSource, "export async function createParticipantConsent", "participant consent service");
includes(serviceSource, "export async function updateParticipantConsent", "participant consent service");

includes(workerSource, "async function handleParticipantConsent", "worker");
includes(workerSource, "service.listParticipantConsent", "worker");

includes(studyControllerSource, "const studyParams = { id: studyId }", "study page controller");
includes(studyControllerSource, "loadStudyCollection(\"/api/participant-consent\"", "study page controller");
includes(studyControllerSource, "route(\"/pages/study/participant-consent/\", studyParams)", "study page controller");
