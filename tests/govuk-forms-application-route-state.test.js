import assert from "node:assert/strict";
import fs from "node:fs";
import { publishedGovukPage } from './helpers/published-govuk-pages.mjs';

const legacyFormRoutes = [
	"public/pages/study/index.html",
	"public/pages/study/guides/index.html",
	"public/pages/study/consent-forms/index.html",
	"public/pages/study/participants/index.html",
];

const generatedGovukFormRoutes = [
	"public/pages/search/index.html",
	"public/pages/notes/index.html",
	"public/pages/consent/index.html",
	"public/pages/sessions/index.html",
];

function read(path) {
	return fs.readFileSync(path, "utf8");
}

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

function includesLabel(source, htmlFor, text, label) {
	assert.match(
		source,
		new RegExp(`<label class="govuk-label" for="${htmlFor}">\\s*${text}\\s*</label>`),
		`Expected ${label} to include GOV.UK label ${text} for ${htmlFor}`
	);
}

for (const route of legacyFormRoutes) {
	const source = await publishedGovukPage(route);
	includes(source, "href=\"/css/govuk/govuk-forms.css\"", route);
	includes(source, "govuk-form-group", route);
	includes(source, "govuk-label", route);
}

for (const route of generatedGovukFormRoutes) {
	const source = await publishedGovukPage(route);
	includes(source, "href=\"/assets/govuk/govuk-frontend.css\"", route);
	excludes(source, "href=\"/css/govuk/govuk-forms.css\"", route);
	includes(source, "govuk-form-group", route);
	includes(source, "govuk-label", route);
}

const startPage = await publishedGovukPage("public/pages/start/index.html");
includes(startPage, "href=\"/assets/govuk/govuk-frontend.css\"", "Start route");
excludes(startPage, "href=\"/css/govuk/govuk-forms.css\"", "Start route");
includes(startPage, "id=\"error-summary\"", "Start route");
includes(startPage, "class=\"govuk-error-summary start-panel\"", "Start route");
includes(startPage, "class=\"govuk-textarea\"", "Start route");
includes(startPage, "class=\"govuk-button-group cta\"", "Start route");
includes(startPage, "Give the project a name and description.", "Start route");
includes(startPage, "ResearchOps will start the project in Discovery with the status Goal setting &amp; problem defining.", "Start route");
excludes(startPage, "class=\"govuk-select\"", "Start route");
excludes(startPage, "id=\"p_phase\"", "Start route");
excludes(startPage, "id=\"p_status\"", "Start route");
excludes(startPage, "<label class=\"govuk-body\"", "Start route");
excludes(startPage, "class=\"form-group\"", "Start route");

const searchPage = await publishedGovukPage("public/pages/search/index.html");
includesLabel(searchPage, "q", "Search text", "Search route");
includes(searchPage, "class=\"govuk-select\"", "Search route");
includes(searchPage, "id=\"type\"", "Search route");
excludes(searchPage, "class=\"govuk-body search-type-label\"", "Search route");

const notesPage = await publishedGovukPage("public/pages/notes/index.html");
includesLabel(notesPage, "session", "Session", "Notes route");
includes(notesPage, "class=\"govuk-textarea\"", "Notes route");
includes(notesPage, "id=\"text\"", "Notes route");
excludes(notesPage, "<textarea id=\"text\" placeholder", "Notes route");

const consentPage = await publishedGovukPage("public/pages/consent/index.html");
includesLabel(consentPage, "basis", "Lawful basis", "Consent route");
includes(consentPage, "aria-describedby=\"ret-hint\"", "Consent route");
excludes(consentPage, "<label class=\"govuk-body consent-field\">", "Consent route");

const sessionsPage = await publishedGovukPage("public/pages/sessions/index.html");
includes(sessionsPage, "class=\"govuk-date-input\"", "Sessions route");
includes(sessionsPage, "id=\"session-date-day\"", "Sessions route");
includes(sessionsPage, "id=\"session-time-hour\"", "Sessions route");
includes(sessionsPage, "id=\"session-time-minute\"", "Sessions route");
excludes(sessionsPage, "Use an ISO timestamp", "Sessions route");
excludes(sessionsPage, "<label class=\"govuk-body sessions-field\">", "Sessions route");

const studySessionPage = await publishedGovukPage("public/pages/study/session/index.html");
includes(studySessionPage, "href=\"/assets/govuk/govuk-frontend.css\"", "Study session route");
excludes(studySessionPage, "href=\"/css/govuk/govuk-forms.css\"", "Study session route");
includes(studySessionPage, "id=\"participant-select\"", "Study session route");
includes(studySessionPage, "class=\"govuk-select govuk-!-width-two-thirds\"", "Study session route");
includes(studySessionPage, "id=\"note-input\"", "Study session route");
excludes(studySessionPage, "href=\"/css/session.css\"", "Study session route");

const participantConsentPage = await publishedGovukPage("public/pages/study/participant-consent/index.html");
const participantConsentTemplate = read("src/govuk/templates/pages/study-participant-consent.njk");
includes(participantConsentPage, "href=\"/assets/govuk/govuk-frontend.css\"", "Participant consent route");
includes(participantConsentPage, "href=\"/css/participant-consent.css\"", "Participant consent route");
excludes(participantConsentPage, "href=\"/css/govuk/govuk-forms.css\"", "Participant consent route");
excludes(participantConsentPage, "href=\"/css/govuk/govuk-tables.css\"", "Participant consent route");
includes(participantConsentTemplate, "govukSelect({", "Participant consent template");
includes(participantConsentTemplate, "govukInput({", "Participant consent template");
excludes(participantConsentPage, "id=\"back-to-study\"", "Participant consent route");

const synthesizePage = await publishedGovukPage("public/pages/study/synthesis/index.html");
const synthesizeTemplate = read("src/govuk/templates/pages/study-synthesis.njk");
includes(synthesizeTemplate, 'id: "tag-filter"', "Synthesize template");
includes(synthesizeTemplate, 'text: "Filter by tag"', "Synthesize template");
includes(synthesizePage, "<label class=\"govuk-label\" for=\"target-cluster\">", "Synthesize route");
includes(synthesizePage, "Choose the group to add evidence to", "Synthesize route");
includes(synthesizeTemplate, 'id: "cluster-label"', "Synthesize template");
includes(synthesizeTemplate, 'text: "Cluster grouping name"', "Synthesize template");
includes(synthesizePage, "<label class=\"govuk-label\" for=\"theme-cluster\">", "Synthesize route");
includes(synthesizePage, "Choose the group to turn into a theme", "Synthesize route");
includes(synthesizePage, "aria-describedby=\"add-selected-evidence-hint\"", "Synthesize route");
includes(synthesizePage, "aria-describedby=\"create-cluster-hint\"", "Synthesize route");
includes(synthesizePage, "aria-describedby=\"create-theme-hint\"", "Synthesize route");
includes(synthesizePage, "id=\"add-selected-evidence\"", "Synthesize route");
includes(synthesizePage, "id=\"create-cluster\"", "Synthesize route");
includes(synthesizePage, "id=\"create-theme\"", "Synthesize route");
includes(synthesizePage, "disabled=\"disabled\"", "Synthesize route");
includes(synthesizePage, "Add selected evidence", "Synthesize route");
includes(synthesizePage, "Create cluster grouping", "Synthesize route");
includes(synthesizePage, "Create theme", "Synthesize route");
excludes(synthesizePage, "<textarea id=\"themeDesc\"", "Synthesize route");

const dashboardPage = await publishedGovukPage("public/pages/project-dashboard/index.html");
includes(dashboardPage, "href=\"/assets/govuk/govuk-frontend.css\"", "Project Dashboard route");
includes(dashboardPage, "id=\"add-stakeholder-form\"", "Project Dashboard route");
includes(dashboardPage, "id=\"add-objective-form\"", "Project Dashboard route");
includes(dashboardPage, "id=\"add-user-group-form\"", "Project Dashboard route");
includes(dashboardPage, "aria-describedby=\"objective-text-hint\"", "Project Dashboard route");
includes(dashboardPage, "id=\"add-participant-link\"", "Project Dashboard route");
includes(dashboardPage, "id=\"import-participants-link\"", "Project Dashboard route");
includes(dashboardPage, "id=\"add-study-link\"", "Project Dashboard route");
excludes(dashboardPage, "href=\"/css/govuk/govuk-forms.css\"", "Project Dashboard route");
excludes(dashboardPage, "id=\"study-dialog\"", "Project Dashboard route");

const projectParticipantsPage = await publishedGovukPage("public/pages/project-dashboard/participants/index.html");
includes(projectParticipantsPage, "href=\"/assets/govuk/govuk-frontend.css\"", "Project participant route");
excludes(projectParticipantsPage, "href=\"/css/govuk/govuk-forms.css\"", "Project participant route");
includes(projectParticipantsPage, "id=\"add-participant-form\"", "Project participant route");
includes(projectParticipantsPage, "id=\"participant-error-summary\"", "Project participant route");
includes(projectParticipantsPage, "id=\"study-select\"", "Project participant route");
includes(projectParticipantsPage, "id=\"participant-first-name\"", "Project participant route");
includes(projectParticipantsPage, "id=\"participant-family-name\"", "Project participant route");
includes(projectParticipantsPage, "id=\"create-study-link\"", "Project participant route");
includes(projectParticipantsPage, "href=\"/pages/study/new/?id=\"", "Project participant route");
excludes(projectParticipantsPage, "href=\"/pages/study/new/?pid=\"", "Project participant route");

const studyParticipantsPage = await publishedGovukPage("public/pages/study/participants/index.html");
includes(studyParticipantsPage, "id=\"p_first_name\"", "Study participants route");
includes(studyParticipantsPage, "id=\"p_family_name\"", "Study participants route");
includes(studyParticipantsPage, "Participant reference (optional)", "Study participants route");
includes(studyParticipantsPage, "class=\"govuk-checkboxes\"", "Study participants route");
includes(studyParticipantsPage, "Preferred contact methods", "Study participants route");
includes(studyParticipantsPage, "class=\"govuk-date-input\"", "Study participants route");
includes(studyParticipantsPage, "id=\"s_date-day\"", "Study participants route");
includes(studyParticipantsPage, "id=\"s_time-hour\"", "Study participants route");
excludes(studyParticipantsPage, "type=\"datetime-local\"", "Study participants route");

const participantImportPage = await publishedGovukPage("public/pages/project-dashboard/participants/import/index.html");
includes(participantImportPage, "href=\"/assets/govuk/govuk-frontend.css\"", "Participant import route");
excludes(participantImportPage, "href=\"/css/govuk/govuk-forms.css\"", "Participant import route");
includes(participantImportPage, "id=\"import-participants-form\"", "Participant import route");
includes(participantImportPage, "id=\"import-error-summary\"", "Participant import route");
includes(participantImportPage, "id=\"participants-csv\"", "Participant import route");
includes(participantImportPage, "id=\"preview-csv\"", "Participant import route");
includes(participantImportPage, "id=\"preview-section\"", "Participant import route");
includes(participantImportPage, "href=\"/pages/study/new/?id=\"", "Participant import route");
