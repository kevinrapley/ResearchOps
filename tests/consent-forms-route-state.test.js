import assert from "node:assert/strict";
import fs from "node:fs";

const studyPageSource = fs.readFileSync("public/pages/study/index.html", "utf8");
const studyControllerSource = fs.readFileSync("public/js/study-page.js", "utf8");
const consentPageSource = fs.readFileSync("public/pages/study/consent-forms/index.html", "utf8");
const consentControllerSource = fs.readFileSync("public/js/consent-forms-page.js", "utf8");
const consentCssSource = fs.readFileSync("public/css/consent-forms.css", "utf8");
const workerSource = fs.readFileSync("infra/cloudflare/src/worker.js", "utf8");
const serviceSource = fs.readFileSync("infra/cloudflare/src/service/consent-forms.js", "utf8");
const serviceIndexSource = fs.readFileSync("infra/cloudflare/src/service/index.js", "utf8");
const fieldsSource = fs.readFileSync("infra/cloudflare/src/core/fields.js", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(studyPageSource, "id=\"link-consent-forms\"", "study page");
includes(studyPageSource, "Create consent forms", "study page");
includes(studyPageSource, "Markdown and Mustache", "study page");
includes(studyControllerSource, "#link-consent-forms", "study page controller");
includes(studyControllerSource, "route(\"/pages/study/consent-forms/\", params)", "study page controller");

includes(consentPageSource, "/js/consent-forms-page.js", "consent forms page");
includes(consentPageSource, "/css/consent-forms.css", "consent forms page");
includes(consentPageSource, "id=\"consent-error\"", "consent forms page");
includes(consentPageSource, "role=\"alert\"", "consent forms page");
includes(consentPageSource, "id=\"new-consent-form\"", "consent forms page");
includes(consentPageSource, "id=\"consent-form-list\"", "consent forms page");
includes(consentPageSource, "id=\"consent-form-editor\"", "consent forms page");
includes(consentPageSource, "id=\"consent-source\"", "consent forms page");
includes(consentPageSource, "id=\"consent-preview\"", "consent forms page");
includes(consentPageSource, "id=\"consent-variables\"", "consent forms page");
includes(consentPageSource, "id=\"consent-items\"", "consent forms page");
includes(consentPageSource, "Participant consent responses are managed separately", "consent forms page");

includes(consentControllerSource, "const API_ORIGIN", "consent forms controller");
includes(consentControllerSource, "rops-api.digikev-kevin-rapley.workers.dev", "consent forms controller");
includes(consentControllerSource, "function renderMustache", "consent forms controller");
includes(consentControllerSource, "function renderMarkdown", "consent forms controller");
includes(consentControllerSource, "consentItems", "consent forms controller");
includes(consentControllerSource, "study_airtable_id", "consent forms controller");
includes(consentControllerSource, "apiUrl(\"/api/consent-forms\")", "consent forms controller");
includes(consentControllerSource, "/api/consent-forms/${encodeURIComponent(id)}/publish", "consent forms controller");
includes(consentControllerSource, "Enter valid JSON", "consent forms controller");
excludes(consentControllerSource, "alert(", "consent forms controller");

includes(consentCssSource, ".consent-layout", "consent forms css");
includes(consentCssSource, ".consent-form-list__button", "consent forms css");
includes(consentCssSource, ".consent-preview", "consent forms css");
includes(consentCssSource, "/* transparency begins in the cascade */", "consent forms css");

includes(workerSource, "handleConsentForms", "worker");
includes(workerSource, "/api/consent-forms", "worker");
includes(workerSource, "service.listConsentForms", "worker");
includes(workerSource, "service.createConsentForm", "worker");
includes(workerSource, "service.publishConsentForm", "worker");

includes(serviceSource, "export async function listConsentForms", "consent forms service");
includes(serviceSource, "export async function createConsentForm", "consent forms service");
includes(serviceSource, "export async function readConsentForm", "consent forms service");
includes(serviceSource, "export async function updateConsentForm", "consent forms service");
includes(serviceSource, "export async function publishConsentForm", "consent forms service");
includes(serviceSource, "AIRTABLE_TABLE_CONSENT_FORMS", "consent forms service");
includes(serviceSource, "CONSENT_FORM_LINK_FIELD_CANDIDATES", "consent forms service");
includes(serviceSource, "CONSENT_FORM_FIELD_NAMES", "consent forms service");
includes(serviceSource, "Consent Items (JSON)", "consent forms service");

includes(serviceIndexSource, "./consent-forms.js", "service index");
includes(serviceIndexSource, "listConsentForms", "service index");
includes(serviceIndexSource, "publishConsentForm", "service index");

includes(fieldsSource, "CONSENT_FORM_LINK_FIELD_CANDIDATES", "fields");
includes(fieldsSource, "CONSENT_FORM_FIELD_NAMES", "fields");
