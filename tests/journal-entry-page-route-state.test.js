import assert from "node:assert/strict";
import fs from "node:fs";

const template = fs.readFileSync("src/govuk/templates/pages/journal-entry.njk", "utf8");
const editTemplate = fs.readFileSync("src/govuk/templates/pages/journal-edit.njk", "utf8");
const page = fs.readFileSync("public/pages/journal/entry/index.html", "utf8");
const editPage = fs.readFileSync("public/pages/journal/edit/index.html", "utf8");
const script = fs.readFileSync("public/js/journal-entry.js", "utf8");
const editScript = fs.readFileSync("public/js/journal-entry-edit.js", "utf8");
const tabs = fs.readFileSync("public/js/journal-tabs.js", "utf8");
const renderer = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");
const router = fs.readFileSync("infra/cloudflare/src/core/router.js", "utf8");
const journals = fs.readFileSync("infra/cloudflare/src/service/journals.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(tabs, "viewEntry: id => '/pages/journal/entry/?id=' + encodeURIComponent(id)", "journal tabs link contract");
includes(tabs, "editEntry: id => '/pages/journal/edit/?id=' + encodeURIComponent(id)", "journal tabs link contract");
excludes(tabs, "viewEntry: id => '/pages/journal/entry?id=' + encodeURIComponent(id)", "journal tabs link contract");
excludes(tabs, "editEntry: id => '/pages/journal/edit?id=' + encodeURIComponent(id)", "journal tabs link contract");
includes(page, "id=\"journal-entry-title\"", "rendered journal entry page");
includes(page, "id=\"journal-entry-actions\"", "rendered journal entry page");
includes(page, "id=\"journal-entry-edit-link\"", "rendered journal entry page");
includes(page, "id=\"journal-entry-delete-btn\"", "rendered journal entry page");
includes(page, "src=\"/js/journal-entry.js\"", "rendered journal entry page");
includes(editPage, "id=\"journal-entry-edit-form\"", "rendered journal edit page");
includes(editPage, "src=\"/js/journal-entry-edit.js\"", "rendered journal edit page");
includes(editTemplate, "id=\"journal-entry-edit-form\"", "journal edit template");
includes(editTemplate, "script type=\"module\" src=\"/js/journal-entry-edit.js\"", "journal edit template");
includes(renderer, "template: 'pages/journal-edit.njk'", "GOV.UK page renderer");
includes(renderer, "output: 'public/pages/journal/edit/index.html'", "GOV.UK page renderer");
excludes(page, "id=\"back-to-journals\"", "rendered journal entry page");
excludes(template, "id=\"back-to-journals\"", "journal entry template");
includes(template, "id: 'breadcrumb-journals'", "journal entry template");
includes(template, "id=\"journal-entry-actions\"", "journal entry template");
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
includes(script, "/pages/journal/edit/?id=${encodeURIComponent(entry.id)}${projectId ? `&project=${encodeURIComponent(projectId)}` : \"\"}", "journal entry script");
excludes(script, "/pages/journal/edit?id=${encodeURIComponent(entry.id)}", "journal entry script");
includes(script, "/api/journal-entries/${encodeURIComponent(id)}", "journal entry script");
includes(script, "renderEntry(entry)", "journal entry script");
includes(script, "journal-entry-error-summary", "journal entry script");
includes(script, "journal-entry-delete-confirmation", "journal entry script");
excludes(script, "confirm(\"Delete this entry?", "journal entry script");

includes(editScript, "function projectIdFromRoute()", "journal edit script");
includes(editScript, "function projectContextParam()", "journal edit script");
includes(editScript, "projectId = text(projectIdFromRoute() || entry.localProjectId", "journal edit script");
includes(editScript, "`/pages/journal/entry/?id=${encodeURIComponent(entryId)}${projectContextParam()}`", "journal edit script");
includes(editScript, "`/pages/journal/entry/?id=${encodeURIComponent(currentEntryId)}${currentProjectId ? `&project=${encodeURIComponent(currentProjectId)}` : \"\"}`", "journal edit script");
excludes(editScript, "`/pages/journal/entry?id=${encodeURIComponent(entryId)}${projectContextParam()}`", "journal edit script");
includes(editScript, "journal-entry-delete-confirmation", "journal edit script");
excludes(editScript, "confirm(\"Delete this entry?", "journal edit script");

includes(router, "url.pathname.startsWith(\"/api/journal-entries/\")", "Worker router");
includes(router, "service.getJournalEntry(origin, entryId)", "Worker router");
includes(journals, "d1GetJournalEntryById(env, entryId)", "journal service");
