import assert from "node:assert/strict";
import fs from "node:fs";

const serviceSource = fs.readFileSync("infra/cloudflare/src/service/mural-journal-sync.js", "utf8");
const indexSource = fs.readFileSync("infra/cloudflare/src/service/index.js", "utf8");
const journalTabsSource = fs.readFileSync("public/js/journal-tabs.js", "utf8");
const compactSource = fs.readFileSync("public/js/journal-mural-sync-compact.js", "utf8");
const pageSource = fs.readFileSync("public/pages/projects/journals/index.html", "utf8");
const compactCss = fs.readFileSync("public/css/journal-mural-sync.css", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(serviceSource, "export async function muralJournalSync", "service");
includes(serviceSource, "mode === \"status\"", "service");
includes(serviceSource, "mode === \"hydrate\"", "service");
includes(serviceSource, "journal-entry:", "service");
includes(serviceSource, "widgetHasEntryTag", "service");
includes(serviceSource, "updated-template-sticky", "service");
includes(serviceSource, "created-sticky", "service");
includes(serviceSource, "createdOrUpdated", "service");

includes(indexSource, "MuralJournalSync", "service index");
includes(indexSource, "this.mural.muralJournalSync =", "service index");

includes(pageSource, "class=\"journal-entries-header\"", "page");
includes(pageSource, "class=\"mural-sync-status\"", "page");
includes(pageSource, "aria-live=\"polite\"", "page");
includes(pageSource, "id=\"mural-sync-pending-btn\" hidden disabled", "page");
includes(pageSource, "Add pending entries to Mural", "page");
includes(pageSource, "id=\"mural-sync-panel\" hidden aria-hidden=\"true\"", "page");
includes(pageSource, "journal-mural-sync-compact.js", "page");
includes(pageSource, "journal-mural-sync.css", "page");

includes(compactSource, "function loadMuralSyncStatus()", "compact script");
includes(compactSource, "function addPendingEntriesToMural()", "compact script");
includes(compactSource, "postJson('status')", "compact script");
includes(compactSource, "postJson('hydrate')", "compact script");
includes(compactSource, "not yet on Mural", "compact script");
includes(compactSource, "remain saved in ResearchOps", "compact script");
includes(compactSource, "MutationObserver", "compact script");

includes(journalTabsSource, "muralSyncPayload('entry'", "journal tabs");
includes(journalTabsSource, "entryId: created.id", "journal tabs");

includes(compactCss, ".mural-sync-status", "compact css");
includes(compactCss, "position: absolute;", "compact css");
includes(compactCss, "right: 0;", "compact css");
includes(compactCss, "box-shadow: none;", "compact css");

excludes(compactSource, "Sync ${pending}", "compact script");
excludes(compactSource, "Sync pending entries", "compact script");
