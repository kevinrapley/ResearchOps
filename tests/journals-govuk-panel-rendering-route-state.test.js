import assert from "node:assert/strict";
import fs from "node:fs";

const journalTabs = fs.readFileSync("public/js/journal-tabs.js", "utf8");
const journalExcerpts = fs.readFileSync("public/components/journal-excerpts.js", "utf8");
const analysisService = fs.readFileSync("infra/cloudflare/src/service/reflection/analysis.js", "utf8");
const caqdas = fs.readFileSync("public/js/caqdas-interface.js", "utf8");
const timelineMacro = fs.readFileSync("src/govuk/templates/macros/home-office-timeline.njk", "utf8");
const timelineCss = fs.readFileSync("public/css/home-office-timeline.css", "utf8");
const template = fs.readFileSync("src/govuk/templates/pages/projects-journals.njk", "utf8");
const page = fs.readFileSync("public/pages/projects/journals/index.html", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(template, "govukTabs", "journals page template");
includes(template, "macros/home-office-timeline.njk", "journals page template");
includes(template, "homeOfficeTimeline({", "journals page template");
includes(template, "id: 'analysis-timeline'", "journals page template");
includes(page, "govuk-tabs", "rendered journals page");
includes(journalTabs, "function projectContextParam()", "journal tabs script");
includes(journalTabs, "projectContextParam()", "journal tabs script");
includes(journalTabs, "govuk-summary-card", "journal tabs script");
includes(journalTabs, "govuk-summary-card__actions", "journal tabs script");
includes(journalTabs, "View entry", "journal tabs script");
includes(journalTabs, "Edit entry", "journal tabs script");
includes(journalTabs, "Delete entry", "journal tabs script");
includes(journalTabs, "govuk-summary-list", "journal tabs script");
includes(journalTabs, "govuk-tag govuk-tag--grey", "journal tabs script");
includes(journalTabs, "app-code-list", "journal tabs script");
includes(journalTabs, "app-memo-list", "journal tabs script");
includes(journalTabs, "govuk-inset-text", "journal tabs script");
excludes(journalTabs, "class=\"entry-card\"", "journal tabs script");
excludes(journalTabs, "class=\"entry-actions\"", "journal tabs script");
excludes(journalTabs, "class=\"summary-card__title\"", "journal tabs script");
includes(journalExcerpts, "journal:excerpts:retired", "journal excerpts compatibility module");
includes(journalExcerpts, "Journal entry rendering is owned by /js/journal-tabs.js", "journal excerpts compatibility module");
excludes(journalExcerpts, "entry-card", "journal excerpts compatibility module");
excludes(journalExcerpts, "entry-actions", "journal excerpts compatibility module");
excludes(journalExcerpts, "renderEntries", "journal excerpts compatibility module");
includes(analysisService, "import { d1All } from \"../internals/researchops-d1.js\"", "analysis service");
includes(analysisService, "async function fetchD1JournalsByProject", "analysis service");
includes(analysisService, "FROM journal_entries", "analysis service");
includes(analysisService, "OR local_project_id IN", "analysis service");
includes(analysisService, "fetchD1JournalsByProject(svc, projectId)", "analysis service");
includes(analysisService, "source: \"d1\"", "analysis service");
includes(caqdas, "timelineFromJournalEntries(projectId)", "CAQDAS analysis module");
includes(caqdas, "/api/journal-entries?project=", "CAQDAS analysis module");
includes(caqdas, "hods-timeline__item", "CAQDAS analysis module");
includes(caqdas, "hods-timeline__title", "CAQDAS analysis module");
includes(caqdas, "hods-date-time", "CAQDAS analysis module");
includes(timelineMacro, "macro homeOfficeTimeline", "Home Office timeline macro");
includes(timelineMacro, "hods-timeline__item", "Home Office timeline macro");
includes(timelineMacro, "hods-timeline__title", "Home Office timeline macro");
includes(timelineMacro, "hods-date-time", "Home Office timeline macro");
includes(timelineCss, "border-left: 5px solid #1d70b8;", "Home Office timeline CSS");
includes(timelineCss, "height: 5px;", "Home Office timeline CSS");
includes(timelineCss, "width: 15px;", "Home Office timeline CSS");
excludes(timelineCss, "border-radius", "Home Office timeline CSS");
excludes(timelineCss, "border: 4px solid #ffffff", "Home Office timeline CSS");
