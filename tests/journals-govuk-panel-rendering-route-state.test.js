import assert from "node:assert/strict";
import fs from "node:fs";

const journalTabs = fs.readFileSync("public/js/journal-tabs.js", "utf8");
const template = fs.readFileSync("src/govuk/templates/pages/projects-journals.njk", "utf8");
const page = fs.readFileSync("public/pages/projects/journals/index.html", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(template, "govukTabs", "journals page template");
includes(page, "class=\"govuk-tabs\"", "rendered journals page");
includes(journalTabs, "function projectContextParam()", "journal tabs script");
includes(journalTabs, "viewEntry: id => '/pages/journal/entry?id=' + encodeURIComponent(id) + projectContextParam()", "journal tabs script");
includes(journalTabs, "editEntry: id => '/pages/journal/edit?id=' + encodeURIComponent(id) + projectContextParam()", "journal tabs script");
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
excludes(journalTabs, "entry-card", "journal tabs script");
excludes(journalTabs, "entry-actions", "journal tabs script");
excludes(journalTabs, "summary-card__title", "journal tabs script");
