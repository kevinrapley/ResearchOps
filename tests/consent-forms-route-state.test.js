import assert from "node:assert/strict";
import fs from "node:fs";

const studyPageSource = fs.readFileSync("public/pages/study/index.html", "utf8");
const studyControllerSource = fs.readFileSync("public/js/study-page.js", "utf8");
const pageSource = fs.readFileSync("public/pages/study/consent-forms/index.html", "utf8");
const loaderSource = fs.readFileSync("public/js/consent-forms-route-loader.js", "utf8");
const controllerSource = fs.readFileSync("public/js/consent-forms-page.js", "utf8");
const cssSource = fs.readFileSync("public/css/consent-forms.css", "utf8");
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
includes(studyControllerSource, "#link-consent-forms", "study page controller");
includes(studyControllerSource, "const studyParams = { id: studyId }", "study page controller");
includes(studyControllerSource, "route(\"/pages/study/consent-forms/\", studyParams)", "study page controller");
excludes(studyControllerSource, "route(\"/pages/study/consent-forms/\", params)", "study page controller");

includes(pageSource, "<html class=\"govuk-template\" lang=\"en\">", "consent forms page");
includes(pageSource, "/assets/govuk/govuk-frontend.css", "consent forms page");
includes(pageSource, "/js/consent-forms-route-loader.js?v=study-record-id-routing-20260518", "consent forms page");
includes(pageSource, "/css/govuk/govuk-buttons.css", "consent forms page");
includes(pageSource, "/css/govuk/govuk-forms.css", "consent forms page");
includes(pageSource, "/css/consent-forms.css", "consent forms page");
includes(pageSource, "class=\"govuk-button\"", "consent forms page");
includes(pageSource, "class=\"govuk-button govuk-button--secondary\"", "consent forms page");
includes(pageSource, "class=\"govuk-form-group\"", "consent forms page");
includes(pageSource, "id=\"consent-error\"", "consent forms page");
includes(pageSource, "role=\"alert\"", "consent forms page");
includes(pageSource, "id=\"new-consent-form\"", "consent forms page");
includes(pageSource, "id=\"consent-form-list\"", "consent forms page");
includes(pageSource, "id=\"consent-form-editor\"", "consent forms page");
includes(pageSource, "id=\"consent-source\"", "consent forms page");
includes(pageSource, "id=\"consent-preview\"", "consent forms page");
includes(pageSource, "id=\"consent-variables\"", "consent forms page");
includes(pageSource, "id=\"consent-items\"", "consent forms page");
excludes(pageSource, "src=\"/js/consent-forms-page.js\"", "consent forms page");
excludes(pageSource, "class=\"btn", "consent forms page");

includes(loaderSource, "await import('/js/study-canonical-url-bridge.js?v=study-record-id-routing-20260518')", "route loader");
includes(loaderSource, "await import('/components/layout.js')", "route loader");
includes(loaderSource, "await import('/js/consent-forms-page.js?v=study-record-id-routing-20260518')", "route loader");

includes(controllerSource, "resolveStudyContextFromUrl", "controller");
includes(controllerSource, "function renderMustache", "controller");
includes(controllerSource, "function renderMarkdown", "controller");
includes(controllerSource, "consentItems", "controller");
includes(controllerSource, "study_airtable_id: state.sid", "controller");
includes(controllerSource, "apiUrl(\"/api/consent-forms\")", "controller");
includes(controllerSource, "/api/consent-forms/${encodeURIComponent(id)}/publish", "controller");
includes(controllerSource, "Enter valid JSON", "controller");
includes(controllerSource, "Missing Study record ID in URL", "controller");
excludes(controllerSource, "rops-api.digikev-kevin-rapley.workers.dev", "controller");
excludes(controllerSource, "alert(", "controller");

includes(cssSource, ".consent-layout", "css");
includes(cssSource, ".consent-form-list__button", "css");
includes(cssSource, ".consent-preview", "css");
includes(cssSource, "/* transparency begins in the cascade */", "css");

includes(workerSource, "handleConsentForms", "worker");
includes(workerSource, "/api/consent-forms", "worker");
includes(workerSource, "service.listConsentForms", "worker");
includes(workerSource, "service.createConsentForm", "worker");
includes(workerSource, "service.publishConsentForm", "worker");

includes(serviceSource, "export async function listConsentForms", "service");
includes(serviceSource, "export async function createConsentForm", "service");
includes(serviceSource, "export async function publishConsentForm", "service");
includes(serviceSource, "AIRTABLE_TABLE_CONSENT_FORMS", "service");
includes(serviceSource, "CONSENT_FORM_LINK_FIELD_CANDIDATES", "service");
includes(serviceSource, "CONSENT_FORM_FIELD_NAMES", "service");

includes(serviceIndexSource, "./consent-forms.js", "service index");
includes(serviceIndexSource, "listConsentForms", "service index");
includes(serviceIndexSource, "publishConsentForm", "service index");

includes(fieldsSource, "CONSENT_FORM_LINK_FIELD_CANDIDATES", "fields");
includes(fieldsSource, "CONSENT_FORM_FIELD_NAMES", "fields");
includes(fieldsSource, "Consent Items (JSON)", "fields");
