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

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(tabs, "viewEntry: id => '/pages/journal/entry?id=' + encodeURIComponent(id)", "journal tabs link contract");
includes(page, "id=\"journal-entry-title\"", "rendered journal entry page");
includes(page, "src=\"/js/journal-entry.js\"", "rendered journal entry page");
excludes(page, "id=\"back-to-journals\"", "rendered journal entry page");
excludes(template, "id=\"back-to-journals\"", "journal entry template");
includes(template, "id: 'breadcrumb-journals'", "journal entry template");
includes(template, "script type=\"module\" src=\"/js/journal-entry.js\"", "journal entry template");

includes(script, "new URLSearchParams(window.location.search).get(\"id\")", "journal entry script");
includes(script, "params.get(\"project\")", "journal entry script");
includes(script, "params.get(\"project_local_id\")", "journal entry script");
includes(script, "document.referrer", "journal entry script");
includes(script, "PROJECT_CONTEXT_STORAGE_KEY", "journal entry script");
includes(script, "loadProject(projectId)", "journal entry script");
includes(script, "breadcrumbProject.textContent = project.name", "journal entry script");
includes(script, "resolveProjectId(entry)", "journal entry script");
includes(script, "rememberProjectId(projectId)", "journal entry script");
includes(script, "/pages/projects/journals/?id=${encodeURIComponent(projectId)}", "journal entry script");
includes(script, "/api/journal-entries/${encodeURIComponent(id)}", "journal entry script");
includes(script, "renderEntry(entry)", "journal entry script");
includes(script, "journal-entry-error-summary", "journal entry script");

includes(router, "url.pathname.startsWith(\"/api/journal-entries/\")", "Worker router");
includes(router, "service.getJournalEntry(origin, entryId)", "Worker router");
includes(journals, "d1GetJournalEntryById(env, entryId)", "journal service");
