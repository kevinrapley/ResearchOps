import assert from "node:assert/strict";
import fs from "node:fs";

const formRoutes = [
  "public/pages/start/index.html",
  "public/pages/search/index.html",
  "public/pages/notes/index.html",
  "public/pages/consent/index.html",
  "public/pages/sessions/index.html",
  "public/pages/synthesize/index.html",
  "public/pages/project-dashboard/index.html",
  "public/pages/projects/outcomes/index.html",
  "public/pages/projects/journals/index.html",
  "public/pages/study/index.html",
  "public/pages/study/guides/index.html",
  "public/pages/study/consent-forms/index.html",
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
includes(startPage, "class=\"govuk-select\"", "Start route");
includes(startPage, "class=\"govuk-button-group cta\"", "Start route");
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

const synthesizePage = read("public/pages/synthesize/index.html");
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
includes(dashboardPage, "<select id=\"study-method\" class=\"govuk-select\"", "Project Dashboard route");
includes(dashboardPage, "aria-describedby=\"study-notes-hint\"", "Project Dashboard route");
includes(dashboardPage, "class=\"govuk-button-group actions-bar\"", "Project Dashboard route");

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

const guidesPage = read("public/pages/study/guides/index.html");
includes(guidesPage, "class=\"govuk-form-group editor__title-field\"", "Guides route");
includes(guidesPage, "<label class=\"govuk-label\" for=\"pattern-search\">Search patterns</label>", "Guides route");
includes(guidesPage, "class=\"govuk-button-group actions-row\"", "Guides route");

const consentFormsPage = read("public/pages/study/consent-forms/index.html");
includes(consentFormsPage, "href=\"/css/govuk/govuk-forms.css\"", "Consent Forms route");
includes(consentFormsPage, "aria-describedby=\"consent-variables-error\"", "Consent Forms route");
includes(consentFormsPage, "class=\"govuk-button-group actions-bar\"", "Consent Forms route");

const participantsPage = read("public/pages/study/participants/index.html");
includes(participantsPage, "href=\"/css/govuk/govuk-forms.css\"", "Participants route");
includes(participantsPage, "id=\"addParticipantForm\"", "Participants route");
includes(participantsPage, "id=\"scheduleForm\"", "Participants route");

const sessionPage = read("public/pages/study/session/index.html");
includes(sessionPage, "href=\"/css/govuk/govuk-forms.css\"", "Study Session route");
includes(sessionPage, "class=\"picker__row govuk-form-group\"", "Study Session route");
includes(sessionPage, "<label for=\"framework\" class=\"govuk-label\">Note framework</label>", "Study Session route");
