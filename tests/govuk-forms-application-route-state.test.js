import assert from "node:assert/strict";
import fs from "node:fs";

const formRoutes = [
  "public/pages/start/index.html",
  "public/pages/search/index.html",
  "public/pages/notes/index.html",
  "public/pages/consent/index.html",
  "public/pages/sessions/index.html",
  "public/pages/study/synthesis/index.html",
  "public/pages/project-dashboard/index.html",
  "public/pages/project-dashboard/participants/index.html",
  "public/pages/project-dashboard/participants/import/index.html",
  "public/pages/projects/outcomes/index.html",
  "public/pages/projects/journals/index.html",
  "public/pages/study/index.html",
  "public/pages/study/new/index.html",
  "public/pages/study/guides/index.html",
  "public/pages/study/consent-forms/index.html",
  "public/pages/study/participant-consent/index.html",
  "public/pages/study/participants/index.html",
  "public/pages/study/session/index.html"
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

for (const route of formRoutes) {
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
includes(synthesizePage, "disabled>Add selected evidence</button>", "Synthesize route");
includes(synthesizePage, "disabled>Create cluster grouping</button>", "Synthesize route");
includes(synthesizePage, "disabled>Create theme</button>", "Synthesize route");
excludes(synthesizePage, "<textarea id=\"themeDesc\"", "Synthesize route");

const dashboardPage = read("public/pages/project-dashboard/index.html");
includes(dashboardPage, "id=\"add-stakeholder-form\"", "Project Dashboard route");
includes(dashboardPage, "id=\"add-objective-form\"", "Project Dashboard route");
includes(dashboardPage, "id=\"add-user-group-form\"", "Project Dashboard route");
includes(dashboardPage, "aria-describedby=\"objective-text-hint\"", "Project Dashboard route");
includes(dashboardPage, "id=\"add-participant-link\"", "Project Dashboard route");
includes(dashboardPage, "id=\"import-participants-link\"", "Project Dashboard route");
includes(dashboardPage, "id=\"add-study-link\"", "Project Dashboard route");
excludes(dashboardPage, "id=\"study-dialog\"", "Project Dashboard route");

const projectParticipantsPage = read("public/pages/project-dashboard/participants/index.html");
includes(projectParticipantsPage, "id=\"add-participant-form\"", "Project participant route");
includes(projectParticipantsPage, "id=\"participant-error-summary\"", "Project participant route");
includes(projectParticipantsPage, "id=\"study-select\"", "Project participant route");
includes(projectParticipantsPage, "id=\"participant-display-name\"", "Project participant route");
includes(projectParticipantsPage, "id=\"create-study-link\"", "Project participant route");

const participantImportPage = read("public/pages/project-dashboard/participants/import/index.html");
includes(participantImportPage, "id=\"import-participants-form\"", "Participant import route");
includes(participantImportPage, "id=\"import-error-summary\"", "Participant import route");
includes(participantImportPage, "id=\"participants-csv\"", "Participant import route");
includes(participantImportPage, "id=\"preview-csv\"", "Participant import route");
includes(participantImportPage, "id=\"preview-section\"", "Participant import route");

const outcomesPage = read("public/pages/projects/outcomes/index.html");
includes(outcomesPage, "href=\"/css/govuk/govuk-forms.css\"", "Outcomes route");
includes(outcomesPage, "id=\"impact-form\"", "Outcomes route");
includes(outcomesPage, "class=\"govuk-form-group outcomes-form\"", "Outcomes route");

const journalsPage = read("public/pages/projects/journals/index.html");
includes(journalsPage, "<form id=\"retrieval-form\" novalidate>", "Journals route");
includes(journalsPage, "class=\"govuk-fieldset\"", "Journals route");
includes(journalsPage, "class=\"govuk-radios__input\"", "Journals route");
includes(journalsPage, "<label for=\"code-search-input\" class=\"govuk-label\">Search codes</label>", "Journals route");
excludes(journalsPage, "class=\"visually-hidden\">Search codes", "Journals route");

const studyPage = read("public/pages/study/index.html");
includes(studyPage, "href=\"/css/govuk/govuk-forms.css\"", "Study route");
includes(studyPage, "class=\"govuk-form-group\"", "Study route");
includes(studyPage, "aria-describedby=\"desc-input-hint\"", "Study route");

const newStudyPage = read("public/pages/study/new/index.html");
includes(newStudyPage, "id=\"add-study-form\"", "Add Study route");
includes(newStudyPage, "id=\"study-error-summary\"", "Add Study route");
includes(newStudyPage, "id=\"study-method\" name=\"method\" class=\"govuk-select\"", "Add Study route");
includes(newStudyPage, "aria-describedby=\"study-notes-hint\"", "Add Study route");
includes(newStudyPage, "id=\"study-submit\"", "Add Study route");

const guidesPage = read("public/pages/study/guides/index.html");
includes(guidesPage, "class=\"govuk-form-group editor__title-field\"", "Guides route");
includes(guidesPage, "<label class=\"govuk-label\" for=\"pattern-search\">Search patterns</label>", "Guides route");
includes(guidesPage, "class=\"govuk-button-group actions-row\"", "Guides route");

const consentFormsPage = read("public/pages/study/consent-forms/index.html");
includes(consentFormsPage, "href=\"/css/govuk/govuk-forms.css\"", "Consent Forms route");
includes(consentFormsPage, "aria-describedby=\"consent-variables-error\"", "Consent Forms route");
includes(consentFormsPage, "class=\"govuk-button-group actions-bar\"", "Consent Forms route");

const participantConsentPage = read("public/pages/study/participant-consent/index.html");
includes(participantConsentPage, "href=\"/css/govuk/govuk-forms.css\"", "Participant Consent route");
includes(participantConsentPage, "id=\"participant-consent-form\"", "Participant Consent route");
includes(participantConsentPage, "id=\"consent-form-select\"", "Participant Consent route");
includes(participantConsentPage, "id=\"capture-method\"", "Participant Consent route");
includes(participantConsentPage, "id=\"recorded-by\"", "Participant Consent route");
includes(participantConsentPage, "id=\"withdrawal-reason\"", "Participant Consent route");
includes(participantConsentPage, "class=\"govuk-fieldset participant-consent-items\"", "Participant Consent route");
includes(participantConsentPage, "class=\"govuk-checkboxes__input\"", "Participant Consent route");

const participantsPage = read("public/pages/study/participants/index.html");
includes(participantsPage, "href=\"/css/govuk/govuk-forms.css\"", "Participants route");
includes(participantsPage, "id=\"addParticipantForm\"", "Participants route");
includes(participantsPage, "id=\"scheduleForm\"", "Participants route");

const sessionPage = read("public/pages/study/session/index.html");
includes(sessionPage, "href=\"/css/govuk/govuk-forms.css\"", "Study Session route");
includes(sessionPage, "class=\"picker__row govuk-form-group\"", "Study Session route");
includes(sessionPage, "<label for=\"framework\" class=\"govuk-label\">Note framework</label>", "Study Session route");
