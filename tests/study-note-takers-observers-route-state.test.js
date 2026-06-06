import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
	return fs.readFileSync(path, "utf8");
}

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

const template = read("src/govuk/templates/pages/study-note-takers-observers.njk");
const page = read("public/pages/study/note-takers-observers/index.html");
const controller = read("public/js/note-takers-observers-page.js");
const loader = read("public/js/note-takers-observers-route-loader.js");
const css = read("public/css/note-takers-observers.css");
const scss = read("src/styles/note-takers-observers.scss");
const renderer = read("scripts/govuk/render-govuk-pages.mjs");
const cssTargets = read("scripts/styles/generated-css-targets.mjs");
const worker = read("infra/cloudflare/src/worker.js");
const serviceIndex = read("infra/cloudflare/src/service/index.js");
const service = read("infra/cloudflare/src/service/study-support.js");
const migration = read("infra/cloudflare/migrations/0013_study_support_people.sql");
const productDoc = read("docs/product/26/06/06/study-note-takers-observers.md");
const studyPage = read("public/pages/study/index.html");
const studyController = read("public/js/study-page.js");

for (const macro of [
	"govukBreadcrumbs({",
	"govukButton({",
	"govukErrorSummary({",
	"govukInput({",
	"govukRadios({",
	"govukTextarea({",
	"govukWarningText({",
	"govukInsetText({"
]) {
	includes(template, macro, "note takers and observers template");
}

for (const text of [
	"data-study-subpage-template=\"note-takers-observers\"",
	"id: \"study-support-breadcrumbs\"",
	"id: \"breadcrumb-project\"",
	"id: \"breadcrumb-study\"",
	"id: \"page-error-summary\"",
	"id=\"study-context-warning\"",
	"id=\"setup-status-tag\"",
	"id=\"setup-status-message\"",
	"Will anyone else join sessions for this study?",
	"Save setup decision",
	"id=\"support-section\"",
	"hidden",
	"id: \"support-role-other\"",
	"id=\"observer-warning\"",
	"Observers should be named in participant-facing information",
	"Add person",
	"Support people for this study"
]) {
	includes(template, text, "note takers and observers template");
}

for (const text of [
	"data-study-subpage-template=\"note-takers-observers\"",
	"id=\"study-support-breadcrumbs\"",
	"id=\"breadcrumb-project\"",
	"id=\"breadcrumb-study\"",
	"id=\"page-error-summary\"",
	"id=\"study-context-warning\"",
	"id=\"setup-status-tag\"",
	"id=\"setup-status-message\"",
	"Will anyone else join sessions for this study?",
	"Save setup decision",
	"id=\"support-section\"",
	"hidden",
	"id=\"support-role-other\"",
	"id=\"observer-warning\"",
	"Observers should be named in participant-facing information",
	"Add person",
	"Support people for this study"
]) {
	includes(page, text, "note takers and observers page");
}

includes(page, "<html class=\"govuk-template\" lang=\"en\">", "note takers and observers page");
includes(page, "/assets/govuk/govuk-frontend.css", "note takers and observers page");
includes(page, "/css/note-takers-observers.css", "note takers and observers page");
includes(page, "/js/note-takers-observers-route-loader.js?v=study-note-takers-observers-20260606", "note takers and observers page");
includes(page, "class=\"govuk-breadcrumbs\"", "note takers and observers page");
includes(page, "class=\"govuk-radios\"", "note takers and observers page");
includes(page, "class=\"govuk-warning-text\"", "note takers and observers page");
includes(page, "class=\"govuk-error-summary\"", "note takers and observers page");
includes(page, "class=\"govuk-table\"", "note takers and observers page");

excludes(page, "Back to study", "note takers and observers page");
excludes(page, "class=\"btn", "note takers and observers page");
excludes(page, "<script type=\"module\">", "note takers and observers page");

includes(loader, "await import('/components/layout.js')", "note takers and observers loader");
includes(loader, "const version = 'study-note-takers-observers-20260606'", "note takers and observers loader");
includes(loader, "await import(`/js/study-canonical-url-bridge.js?v=${version}`)", "note takers and observers loader");
includes(loader, "await import(`/js/note-takers-observers-page.js?v=${version}`)", "note takers and observers loader");

for (const text of [
	"resolveStudyContextFromUrl",
	"apiUrl('/api/study-support')",
	"apiUrl('/api/study-support/setup')",
	"apiUrl('/api/study-support/people')",
	"method: 'PUT'",
	"method: 'POST'",
	"method: 'DELETE'",
	"if (section) section.hidden = !(state.setup.saved && state.setup.decision === 'yes')",
	"payload.role === 'other' && !payload.roleOther",
	"selectedRadio('role') !== 'observer'",
	"data-action=\"ask-remove\"",
	"data-action=\"confirm-remove\"",
	"Yes, remove this person"
]) {
	includes(controller, text, "note takers and observers controller");
}

for (const source of [scss, css]) {
	includes(source, ".study-support-status", "note takers and observers styles");
	includes(source, "border-left: 5px solid #1d70b8", "note takers and observers styles");
	includes(source, ".study-support-form-section", "note takers and observers styles");
	includes(source, ".study-support-remove-confirmation", "note takers and observers styles");
	includes(source, "font-family:", "note takers and observers styles");
	includes(source, "@media (max-width: 699px)", "note takers and observers styles");
}

includes(renderer, "template: 'pages/study-note-takers-observers.njk'", "GOV.UK renderer");
includes(renderer, "output: 'public/pages/study/note-takers-observers/index.html'", "GOV.UK renderer");
includes(cssTargets, "source: 'src/styles/note-takers-observers.scss'", "generated CSS targets");
includes(cssTargets, "output: 'public/css/note-takers-observers.css'", "generated CSS targets");

includes(studyPage, "id=\"link-note-takers-observers\"", "study page");
includes(studyPage, "Confirm who, if anyone, will join sessions beyond the lead researcher.", "study page");
includes(studyController, "route(\"/pages/study/note-takers-observers/\", studyParams)", "study page controller");
includes(studyController, "loadStudySupportSetup(studyId)", "study page controller");
includes(studyController, "renderSupportSetupStatus(readinessContext.supportSetup)", "study page controller");

for (const text of [
	"CREATE TABLE IF NOT EXISTS rops_study_support_setup",
	"CREATE TABLE IF NOT EXISTS rops_study_support_people",
	"role_other TEXT",
	"attendance_scope TEXT NOT NULL",
	"active INTEGER NOT NULL DEFAULT 1"
]) {
	includes(migration, text, "study support migration");
}

for (const text of [
	"import * as StudySupport from \"./study-support.js\"",
	"readStudySupport = (origin, url)",
	"saveStudySupportSetup = (req, origin)",
	"createStudySupportPerson = (req, origin)",
	"deleteStudySupportPerson = (origin, personId)"
]) {
	includes(serviceIndex, text, "service index");
}

for (const text of [
	"async function handleStudySupport",
	"apiPath === \"/api/study-support\" && request.method === \"GET\"",
	"apiPath === \"/api/study-support/setup\" && request.method === \"PUT\"",
	"apiPath === \"/api/study-support/people\" && request.method === \"POST\"",
	"apiPath.startsWith(\"/api/study-support/\")"
]) {
	includes(worker, text, "worker routes");
}

for (const text of [
	"const SETUP_TABLE = \"rops_study_support_setup\"",
	"const PEOPLE_TABLE = \"rops_study_support_people\"",
	"function airtableConfigured",
	"listSupportFromAirtable",
	"role === \"other\" && !roleOther",
	"normaliseAttendanceScope",
	"active = 0",
	"export async function readStudySupport",
	"export async function saveStudySupportSetup",
	"export async function createStudySupportPerson",
	"export async function deleteStudySupportPerson"
]) {
	includes(service, text, "study support service");
}

for (const text of [
	"# Study note takers and observers",
	"## Team discussion summary",
	"## User needs",
	"## Acceptance criteria",
	"## Gherkin criteria",
	"## Data model",
	"D1 is the primary store",
	"Airtable is a fallback read source"
]) {
	includes(productDoc, text, "product document");
}
