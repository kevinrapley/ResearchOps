import assert from "node:assert/strict";
import fs from "node:fs";

const serviceSource = fs.readFileSync("infra/cloudflare/src/service/mural-journal-sync.js", "utf8");
const indexSource = fs.readFileSync("infra/cloudflare/src/service/index.js", "utf8");
const journalTabsSource = fs.readFileSync("public/js/journal-tabs.js", "utf8");
const compactSyncSource = fs.readFileSync("public/js/journal-mural-sync-compact.js", "utf8");
const journalsPageSource = fs.readFileSync("public/pages/projects/journals/index.html", "utf8");
const compactSyncCss = fs.readFileSync("public/css/journal-mural-sync.css", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(serviceSource, "export async function muralJournalSync", "mural-journal-sync.js");
includes(serviceSource, "mode === \"status\"", "mural-journal-sync.js");
includes(serviceSource, "mode === \"hydrate\"", "mural-journal-sync.js");
includes(serviceSource, "function entrySyncTag(entryId)", "mural-journal-sync.js");
includes(serviceSource, "journal-entry:", "mural-journal-sync.js");
includes(serviceSource, "widgetHasEntryTag", "mural-journal-sync.js");
includes(serviceSource, "action: \"already-synced\"", "mural-journal-sync.js");
includes(serviceSource, "action: \"updated-template-sticky\"", "mural-journal-sync.js");
includes(serviceSource, "action: \"created-sticky\"", "mural-journal-sync.js");
includes(serviceSource, "TEMPLATE_PLACEHOLDER_RE", "mural-journal-sync.js");
includes(serviceSource, "createdOrUpdated", "mural-journal-sync.js");

includes(indexSource, "import * as MuralJournalSync from \"./mural-journal-sync.js\";", "service/index.js");
includes(indexSource, "this.mural.muralJournalSync =", "service/index.js");
includes(indexSource, "muralJournalSync =", "service/index.js");

includes(journalsPageSource, "class=\"journal-entries-header\"", "journals page");
includes(journalsPageSource, "class=\"mural-sync-status\"", "journals page");
includes(journalsPageSource, "id=\"mural-sync-message\" role=\"status\" aria-live=\"polite\"", "journals page");
includes(journalsPageSource, "id=\"mural-sync-pending-btn\" hidden disabled", "journals page");
includes(journalsPageSource, "Add pending entries to Mural", "journals page");
includes(journalsPageSource, "id=\"mural-sync-panel\" hidden aria-hidden=\"true\"", "journals page");
includes(journalsPageSource, "/js/journal-mural-sync-compact.js", "journals page");
includes(journalsPageSource, "/css/journal-mural-sync.css", "journals page");

includes(compactSyncSource, "function loadMuralSyncStatus()", "journal-mural-sync-compact.js");
includes(compactSyncSource, "function syncPendingEntriesToMural()", "journal-mural-sync-compact.js");
includes(compactSyncSource, "postJson('status')", "journal-mural-sync-compact.js");
includes(compactSyncSource, "postJson('hydrate')", "journal-mural-sync-compact.js");
includes(compactSyncSource, "apiUrl('/api/mural/journal-sync')", "journal-mural-sync-compact.js");
includes(compactSyncSource, "Add ${pending} pending", "journal-mural-sync-compact.js");

includes(journalTabsSource, "muralSyncPayload('entry'", "journal-tabs.js");
includes(journalTabsSource, "entryId: created.id", "journal-tabs.js");

includes(compactSyncCss, ".mural-sync-status", "journal-mural-sync.css");
includes(compactSyncCss, "position: absolute;", "journal-mural-sync.css");
includes(compactSyncCss, "right: 0;", "journal-mural-sync.css");
includes(compactSyncCss, "@media (max-width: 900px)", "journal-mural-sync.css");

excludes(journalsPageSource, ">Sync to Mural<", "journals page");
excludes(journalTabsSource, ">Sync to Mural<", "journal-tabs.js");
