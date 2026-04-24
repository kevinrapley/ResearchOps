import assert from "node:assert/strict";
import fs from "node:fs";

const serviceSource = fs.readFileSync("infra/cloudflare/src/service/mural-journal-sync.js", "utf8");
const indexSource = fs.readFileSync("infra/cloudflare/src/service/index.js", "utf8");
const journalTabsSource = fs.readFileSync("public/js/journal-tabs.js", "utf8");

function includes(source, text, label) {
  assert.equal(
    source.includes(text),
    true,
    `Expected ${label} to include: ${text}`,
  );
}

function excludes(source, text, label) {
  assert.equal(
    source.includes(text),
    false,
    `Expected ${label} not to include: ${text}`,
  );
}

includes(serviceSource, "export async function muralJournalSync", "mural-journal-sync.js");
includes(serviceSource, "mode === \"status\"", "mural-journal-sync.js");
includes(serviceSource, "mode === \"hydrate\"", "mural-journal-sync.js");
includes(serviceSource, "function entrySyncTag(entryId)", "mural-journal-sync.js");
includes(serviceSource, "journal-entry:${id}", "mural-journal-sync.js");
includes(serviceSource, "widgetHasEntryTag", "mural-journal-sync.js");
includes(serviceSource, "action: \"already-synced\"", "mural-journal-sync.js");
includes(serviceSource, "action: \"updated-template-sticky\"", "mural-journal-sync.js");
includes(serviceSource, "action: \"created-sticky\"", "mural-journal-sync.js");
includes(serviceSource, "TEMPLATE_PLACEHOLDER_RE", "mural-journal-sync.js");
includes(serviceSource, "listEntriesForProject", "mural-journal-sync.js");
includes(serviceSource, "statusFromEntriesAndWidgets", "mural-journal-sync.js");
includes(serviceSource, "createdOrUpdated", "mural-journal-sync.js");

includes(indexSource, "import * as MuralJournalSync from \"./mural-journal-sync.js\";", "service/index.js");
includes(indexSource, "this.mural.muralJournalSync = (req, origin) => MuralJournalSync.muralJournalSync(this, req, origin);", "service/index.js");
includes(indexSource, "muralJournalSync = (req, origin) => MuralJournalSync.muralJournalSync(this, req, origin);", "service/index.js");

includes(journalTabsSource, "function ensureMuralSyncPanel()", "journal-tabs.js");
includes(journalTabsSource, "id=\"mural-sync-title\"", "journal-tabs.js");
includes(journalTabsSource, "id=\"mural-sync-message\" role=\"status\" aria-live=\"polite\"", "journal-tabs.js");
includes(journalTabsSource, "id=\"mural-sync-pending-btn\"", "journal-tabs.js");
includes(journalTabsSource, "function loadMuralSyncStatus()", "journal-tabs.js");
includes(journalTabsSource, "function syncPendingEntriesToMural()", "journal-tabs.js");
includes(journalTabsSource, "muralSyncPayload('status')", "journal-tabs.js");
includes(journalTabsSource, "muralSyncPayload('hydrate')", "journal-tabs.js");
includes(journalTabsSource, "muralSyncPayload('entry'", "journal-tabs.js");
includes(journalTabsSource, "entryId: created.id", "journal-tabs.js");
includes(journalTabsSource, "Use Sync pending entries.", "journal-tabs.js");

excludes(journalTabsSource, ">Sync to Mural<", "journal-tabs.js");
excludes(journalTabsSource, "data-act=\"sync-mural\"", "journal-tabs.js");
excludes(journalTabsSource, "data-act=\"mural-sync\"", "journal-tabs.js");
