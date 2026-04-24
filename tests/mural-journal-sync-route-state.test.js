import assert from "node:assert/strict";
import fs from "node:fs";

const serviceSource = fs.readFileSync("infra/cloudflare/src/service/mural-journal-sync.js", "utf8");
const layoutSource = fs.readFileSync("infra/cloudflare/src/service/mural-journal-sync-layout.js", "utf8");
const safeTagsSource = fs.readFileSync("infra/cloudflare/src/service/mural-journal-sync-safe-tags.js", "utf8");
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
includes(serviceSource, "canonicalExistingWidget", "service");
includes(serviceSource, "categoryTemplateWidget", "service");
includes(serviceSource, "candidateTemplateWidgets", "service");
includes(serviceSource, "latestCanonicalCategoryWidget", "service");
includes(serviceSource, "widgetMatchesTemplateGeometry", "service");
includes(serviceSource, "tagsForEntry", "service");
includes(serviceSource, "stickyStyleFromTemplate", "service");
includes(serviceSource, "stickyPayloadFromTemplate", "service");
includes(serviceSource, "createStickyFromTemplate", "service");
includes(serviceSource, "widgets/sticky-note", "service");
includes(serviceSource, "updated-template-widget", "service");
includes(serviceSource, "created-template-sticky", "service");
includes(serviceSource, "createdOrUpdated", "service");
includes(serviceSource, "function hydrateReason", "service");
includes(serviceSource, "template-sticky-minimal-array", "service");
includes(serviceSource, "widgetMetadataText", "service");
includes(serviceSource, "title: syncTitle", "service");
includes(serviceSource, "#FFFFFFFF", "service");
includes(serviceSource, "tags: patch.tags", "service");
includes(serviceSource, "errors: err?.errors", "service");
includes(serviceSource, "reason: hydrateReason", "service");

includes(layoutSource, "export async function muralJournalSync", "layout service");
includes(layoutSource, "function categoryHeaderWidget", "layout service");
includes(layoutSource, "function columnTemplateWidget", "layout service");
includes(layoutSource, "function columnLayout", "layout service");
includes(layoutSource, "function widgetMatchesColumnLayout", "layout service");
includes(layoutSource, "for (const category of CATEGORY_KEYS)", "layout service");
includes(layoutSource, "placementBelow", "layout service");
includes(layoutSource, "updated-template-widget", "layout service");
includes(layoutSource, "created-template-sticky", "layout service");
includes(layoutSource, "widgets/sticky-note", "layout service");
includes(layoutSource, "tagsForEntry", "layout service");
includes(layoutSource, "userFacingTags", "layout service");

includes(safeTagsSource, "import * as BaseMuralJournalSync from \"./mural-journal-sync-layout.js\";", "safe tags");
includes(safeTagsSource, "import { createRecords } from \"./internals/airtable.js\";", "safe tags");
includes(safeTagsSource, "import { d1All, d1Run } from \"./internals/researchops-d1.js\";", "safe tags");
includes(safeTagsSource, "const SYSTEM_TAG_RE = /^journal-entry:/i;", "safe tags");
includes(safeTagsSource, "function userFacingTags", "safe tags");
includes(safeTagsSource, "function createMuralTag", "safe tags");
includes(safeTagsSource, "function ensureKnownTags", "safe tags");
includes(safeTagsSource, "function ensureD1MappingTable", "safe tags");
includes(safeTagsSource, "CREATE TABLE IF NOT EXISTS mural_journal_entry_widgets", "safe tags");
includes(safeTagsSource, "function upsertD1Mapping", "safe tags");
includes(safeTagsSource, "function appendAirtableMapping", "safe tags");
includes(safeTagsSource, "AIRTABLE_TABLE_MURAL_JOURNAL_SYNC", "safe tags");
includes(safeTagsSource, "function persistMappings", "safe tags");
includes(safeTagsSource, "function annotateWidgetsWithMappings", "safe tags");
includes(safeTagsSource, "delete next.title;", "safe tags");
includes(safeTagsSource, "mappings", "safe tags");

includes(indexSource, "./mural-journal-sync-safe-tags.js", "service index");
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
includes(compactSource, "lastStatus?.pending", "compact script");
includes(compactSource, "result.reason", "compact script");
includes(compactSource, "MutationObserver", "compact script");

includes(journalTabsSource, "muralSyncPayload('entry'", "journal tabs");
includes(journalTabsSource, "entryId: created.id", "journal tabs");

includes(compactCss, ".mural-sync-status", "compact css");
includes(compactCss, "position: absolute;", "compact css");
includes(compactCss, "right: 0;", "compact css");
includes(compactCss, "box-shadow: none;", "compact css");

excludes(serviceSource, "https://app.mural.co/api/public/v1/murals/${muralId}/widgets`", "service");
excludes(serviceSource, "created-template-widget", "service");
excludes(serviceSource, "updated-template-sticky", "service");
excludes(serviceSource, "created-sticky", "service");
excludes(layoutSource, "created-template-widget", "layout service");
excludes(safeTagsSource, "tags: [...", "safe tags");
excludes(compactSource, "Sync ${pending}", "compact script");
excludes(compactSource, "Sync pending entries", "compact script");
