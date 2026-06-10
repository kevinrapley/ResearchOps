import assert from "node:assert/strict";
import fs from "node:fs";

const template = fs.readFileSync("src/govuk/templates/pages/journal-entry.njk", "utf8");
const page = fs.readFileSync("public/pages/journal/entry/index.html", "utf8");
const script = fs.readFileSync("public/js/journal-entry.js", "utf8");
const tabs = fs.readFileSync("public/js/journal-tabs.js", "utf8");
const router = fs.readFileSync("infra/cloudflare/src/core/router.js", "utf8");
const journals = fs.readFileSync("infra/cloudflare/src/service/journals.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

includes(tabs, "viewEntry: id => '/pages/journal/entry?id=' + encodeURIComponent(id)", "journal tabs link contract");
includes(page, "id=\"journal-entry-title\"", "rendered journal entry page");
includes(page, "src=\"/js/journal-entry.js\"", "rendered journal entry page");
includes(page, "id=\"back-to-journals\"", "rendered journal entry page");
includes(template, "id: 'breadcrumb-journals'", "journal entry template");
includes(template, "script type=\"module\" src=\"/js/journal-entry.js\"", "journal entry template");

includes(script, "new URLSearchParams(window.location.search).get(\"id\")", "journal entry script");
includes(script, "/api/journal-entries/${encodeURIComponent(id)}", "journal entry script");
includes(script, "renderEntry(entry)", "journal entry script");
includes(script, "journal-entry-error-summary", "journal entry script");
includes(script, "d1tp1_journal_004", "journal entry script route smoke fixture marker");

includes(router, "url.pathname.startsWith(\"/api/journal-entries/\")", "Worker router");
includes(router, "service.getJournalEntry(origin, entryId)", "Worker router");
includes(journals, "d1GetJournalEntryById(env, entryId)", "journal service");
