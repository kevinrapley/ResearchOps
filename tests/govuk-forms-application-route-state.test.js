import assert from "node:assert/strict";
import fs from "node:fs";

const legacyFormRoutes = [
	"public/pages/start/index.html",
	"public/pages/search/index.html",
	"public/pages/notes/index.html",
	"public/pages/consent/index.html",
	"public/pages/sessions/index.html",
	"public/pages/study/synthesis/index.html",
	"public/pages/study/index.html",
	"public/pages/study/guides/index.html",
	"public/pages/study/consent-forms/index.html",
	"public/pages/study/participant-consent/index.html",
	"public/pages/study/participants/index.html",
	"public/pages/study/session/index.html",
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

for (const route of legacyFormRoutes) {
	const source = read(route);
	includes(source, "href=\"/css/govuk/govuk-forms.css\"", route);
	includes(source, "govuk-form-group", route);
	includes(source, "govuk-label", route);
}

const startPage = read("public/pages/start/index.html");
includes(startPage, "id=\"error-summary\" class=\"govuk-error-summary start-panel\"", "Start route");
includes(startPage, "class=\"govuk-textarea\"", "Start route");
includes(startPage, "class=\"govuk-button-group cta\"", "Start route");
includes(startPage, "Give the project a name and description.", "Start route");
includes(startPage, "ResearchOps will start the project in Discovery with the status Goal setting &amp; problem defining.", "Start route");
excludes(startPage, "class=\"govuk-select\"", "Start route");
excludes(startPage, "id=\"p_phase\"", "Start route");
excludes(startPage, "id=\"p_status\"", "Start route");
excludes(startPage, "<label class=\"govuk-body\"", "Start route");
excludes(startPage, "class=\"form-group\"", "Start route");

const searchPage = read("public/pages/search/index.html");
includes(searchPage, "<label class=\"govuk-label\" for=\"q\">Search text</label>", "Search route");
includes(searchPage, "<select id=\"type\" class=\"govuk-select\">", "Search route");
excludes(searchPage, "class=\"govuk-body search-type-label\"", "Search route");

const notesPage = read("public/pages/notes/index.html");
includes(notesPage, "<label class=\"govuk-label\" for=\"session\">Session</label>", "Notes route");
includes(notesPage, "<textarea id=\"text\" class=\"govuk-textarea\"", "Notes route");
excludes(notesPage, "<textarea id=\"text\" placeholder", "Notes route");

const consentPage = read("public/pages/consent/index.html");
includes(consentPage, "<label class=\"govuk-label\" for=\"basis\">Lawful basis</label>", "Consent route");
includes(consentPage, "aria-describedby=\"ret-hint\"", "Consent route");
excludes(consentPage, "<label class=\"govuk-body consent-field\">", "Consent route");

const sessionsPage = read("public/pages/sessions/index.html");
includes(sessionsPage, "<label class=\"govuk-label\" for=\"when\">When</label>", "Sessions route");
includes(sessionsPage, "aria-describedby=\"when-hint\"", "Sessions route");
excludes(sessionsPage, "<label class=\"govuk-body sessions-field\">", "Sessions route");

const synthesizePage = read("public/pages/study/synthesis/index.html");
includes(synthesizePage, "<label class=\"govuk-label\" for=\"tag-filter\">Filter by tag</label>", "Synthesize route");
includes(synthesizePage, "<label class=\"govuk-label\" for=\"target-cluster\">Add selected evidence to</label>", "Synthesize route");
includes(synthesizePage, "<label class=\"govuk-label\" for=\"cluster-label\">Cluster grouping name</label>", "Synthesize route");
includes(synthesizePage, "<label class=\"govuk-label\" for=\"theme-cluster\">Working cluster grouping</label>", "Synthesize route");
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

const dashboardPage = read("public/pages/project-dashboard/index.html");
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

const projectParticipantsPage = read("public/pages/project-dashboard/participants/index.html");
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

const studyParticipantsPage = read("public/pages/study/participants/index.html");
includes(studyParticipantsPage, "id=\"p_first_name\"", "Study participants route");
includes(studyParticipantsPage, "id=\"p_family_name\"", "Study participants route");
includes(studyParticipantsPage, "Participant reference (optional)", "Study participants route");
includes(studyParticipantsPage, "class=\"govuk-checkboxes\"", "Study participants route");
includes(studyParticipantsPage, "Preferred contact methods", "Study participants route");
includes(studyParticipantsPage, "class=\"govuk-date-input\"", "Study participants route");
includes(studyParticipantsPage, "id=\"s_date-day\"", "Study participants route");
includes(studyParticipantsPage, "id=\"s_time-hour\"", "Study participants route");
excludes(studyParticipantsPage, "type=\"datetime-local\"", "Study participants route");

const participantImportPage = read("public/pages/project-dashboard/participants/import/index.html");
includes(participantImportPage, "href=\"/assets/govuk/govuk-frontend.css\"", "Participant import route");
excludes(participantImportPage, "href=\"/css/govuk/govuk-forms.css\"", "Participant import route");
includes(participantImportPage, "id=\"import-participants-form\"", "Participant import route");
includes(participantImportPage, "id=\"import-error-summary\"", "Participant import route");
includes(participantImportPage, "id=\"participants-csv\"", "Participant import route");
includes(participantImportPage, "id=\"preview-csv\"", "Participant import route");
includes(participantImportPage, "id=\"preview-section\"", "Participant import route");
includes(participantImportPage, "href=\"/pages/study/new/?id=\"", "Participant import route");
excludes(participantImportPage, "href=\"/pages/study/new/?pid=\"", "Participant import route");

const outcomesPage = read("public/pages/projects/outcomes/index.html");
includes(outcomesPage, "href=\"/assets/govuk/govuk-frontend.css\"", "Outcomes route");
excludes(outcomesPage, "href=\"/css/govuk/govuk-forms.css\"", "Outcomes route");
excludes(outcomesPage, "href=\"/css/screen.css\"", "Outcomes route");
includes(outcomesPage, "id=\"impact-form\"", "Outcomes route");
includes(outcomesPage, "id=\"impact-error-summary\"", "Outcomes route");
includes(outcomesPage, "id=\"impact-metricName\"", "Outcomes route");
includes(outcomesPage, "id=\"impact-submit\"", "Outcomes route");

const journalsPage = read("public/pages/projects/journals/index.html");
includes(journalsPage, "href=\"/assets/govuk/govuk-frontend.css\"", "Journals route");
includes(journalsPage, "<form id=\"retrieval-form\" novalidate>", "Journals route");
includes(journalsPage, "class=\"govuk-fieldset\"", "Journals route");
includes(journalsPage, "class=\"govuk-radios__input\"", "Journals route");
includes(journalsPage, "<label for=\"code-search-input\" class=\"govuk-label\">Search codes</label>", "Journals route");
excludes(journalsPage, "href=\"/css/govuk/govuk-forms.css\"", "Journals route");
excludes(journalsPage, "class=\"visually-hidden\">Search codes", "Journals route");

const studyPage = read("public/pages/study/index.html");
includes(studyPage, "href=\"/css/govuk/govuk-forms.css\"", "Study route");
includes(studyPage, "class=\"govuk-form-group\"", "Study route");
includes(studyPage, "aria-describedby=\"desc-input-hint\"", "Study route");

const newStudyPage = read("public/pages/study/new/index.html");
includes(newStudyPage, "href=\"/assets/govuk/govuk-frontend.css\"", "Add Study route");
excludes(newStudyPage, "href=\"/css/govuk/govuk-forms.css\"", "Add Study route");
includes(newStudyPage, "id=\"add-study-form\"", "Add Study route");
includes(newStudyPage, "id=\"study-error-summary\"", "Add Study route");
includes(newStudyPage, "id=\"study-method\"", "Add Study route");
includes(newStudyPage, "name=\"method\"", "Add Study route");
includes(newStudyPage, "class=\"govuk-select", "Add Study route");
includes(newStudyPage, "aria-describedby=\"study-notes-hint\"", "Add Study route");
includes(newStudyPage, "id=\"study-submit\"", "Add Study route");

const guidesPage = read("public/pages/study/guides/index.html");
includes(guidesPage, "class=\"govuk-form-group\"", "Guides route");
includes(guidesPage, "editor__title-field", "Guides route");
includes(guidesPage, "class=\"govuk-textarea code-editor__textarea\"", "Guides route");
