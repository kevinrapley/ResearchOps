import assert from "node:assert/strict";
import fs from "node:fs";

const serviceSource = fs.readFileSync("infra/cloudflare/src/service/mural-journal-sync.js", "utf8");
const baseConstantsSource = fs.readFileSync("infra/cloudflare/src/service/mural-journal-sync/constants.js", "utf8");
const baseContextSource = fs.readFileSync("infra/cloudflare/src/service/mural-journal-sync/context.js", "utf8");
const baseMuralApiSource = fs.readFileSync("infra/cloudflare/src/service/mural-journal-sync/mural-api.js", "utf8");
const basePayloadsSource = fs.readFileSync("infra/cloudflare/src/service/mural-journal-sync/sticky-payloads.js", "utf8");
const baseRequestSource = fs.readFileSync("infra/cloudflare/src/service/mural-journal-sync/request.js", "utf8");
const baseSyncEntrySource = fs.readFileSync("infra/cloudflare/src/service/mural-journal-sync/sync-entry.js", "utf8");
const baseTextSource = fs.readFileSync("infra/cloudflare/src/service/mural-journal-sync/text.js", "utf8");
const baseWidgetsSource = fs.readFileSync("infra/cloudflare/src/service/mural-journal-sync/widgets.js", "utf8");
const muralLibSource = fs.readFileSync("infra/cloudflare/src/lib/mural.js", "utf8");
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

function hasElementAttributes(source, elementName, expectedAttributes) {
	const elementPattern = new RegExp(`<${elementName}\\b[^>]*>`, "g");
	const elements = source.match(elementPattern) || [];

	return elements.some((element) => expectedAttributes.every((attribute) => element.includes(attribute)));
}

function includesElementAttributes(source, elementName, expectedAttributes, label) {
	assert.equal(
		hasElementAttributes(source, elementName, expectedAttributes),
		true,
		`Expected ${label} to include <${elementName}> with attributes: ${expectedAttributes.join(", ")}`,
	);
}

includes(serviceSource, "export async function muralJournalSync", "service");
includes(serviceSource, "mode === \"status\"", "service");
includes(serviceSource, "mode === \"hydrate\"", "service");
includes(serviceSource, "updated-template-widget", "service");
includes(serviceSource, "created-template-sticky", "service");
includes(serviceSource, "createdOrUpdated", "service");
includes(serviceSource, "alreadySynced", "service");
includes(serviceSource, "function hydrateReason", "service");
includes(serviceSource, "errors: err?.errors", "service");
includes(serviceSource, "reason: hydrateReason", "service");
includes(serviceSource, "./mural-journal-sync/context.js", "service");
includes(serviceSource, "./mural-journal-sync/request.js", "service");
includes(serviceSource, "./mural-journal-sync/sync-entry.js", "service");
includes(serviceSource, "./mural-journal-sync/text.js", "service");

includes(baseConstantsSource, "export const CATEGORY_KEYS", "base constants");
includes(baseConstantsSource, "PURPOSE_REFLEXIVE", "base constants");
includes(baseTextSource, "export function normalizeCategoryKey", "base text helpers");
includes(baseTextSource, "export function normalizeTags", "base text helpers");
includes(baseWidgetsSource, "journal-entry:", "base widget helpers");
includes(baseWidgetsSource, "export function widgetHasEntryTag", "base widget helpers");
includes(baseWidgetsSource, "export function categoryTemplateWidget", "base widget helpers");
includes(baseWidgetsSource, "export function candidateTemplateWidgets", "base widget helpers");
includes(baseWidgetsSource, "export function latestCanonicalCategoryWidget", "base widget helpers");
includes(baseWidgetsSource, "export function widgetMatchesTemplateGeometry", "base widget helpers");
includes(baseWidgetsSource, "export function widgetMetadataText", "base widget helpers");
includes(basePayloadsSource, "export function tagsForEntry", "base sticky payload helpers");
includes(basePayloadsSource, "export function stickyStyleFromTemplate", "base sticky payload helpers");
includes(basePayloadsSource, "export function stickyPayloadFromTemplate", "base sticky payload helpers");
includes(basePayloadsSource, "title: syncTitle", "base sticky payload helpers");
includes(basePayloadsSource, "#FFFFFFFF", "base sticky payload helpers");
includes(baseMuralApiSource, "export async function createStickyFromTemplate", "base Mural API helpers");
includes(baseMuralApiSource, "widgets/sticky-note", "base Mural API helpers");
includes(baseMuralApiSource, "template-sticky-minimal-array", "base Mural API helpers");
includes(baseMuralApiSource, "tags: patch.tags", "base Mural API helpers");
includes(muralLibSource, "js?.next", "Mural lib");
includes(muralLibSource, "url.searchParams.set(\"limit\", \"100\")", "Mural lib");
includes(muralLibSource, "url.searchParams.set(\"next\", next)", "Mural lib");
includes(muralLibSource, "js?.pagination?.next", "Mural lib");
includes(muralLibSource, "export async function getWidget", "Mural lib");
includes(muralLibSource, "/widgets/${encodeURIComponent(id)}", "Mural lib");
includes(muralLibSource, "options.includeDetails", "Mural lib");
includes(baseRequestSource, "export function parseEntryPayload", "base request helpers");
includes(baseContextSource, "export async function buildContext", "base context helpers");
includes(baseContextSource, "export function statusFromEntriesAndWidgets", "base context helpers");
includes(baseSyncEntrySource, "export function canonicalExistingWidget", "base entry sync helpers");
includes(baseSyncEntrySource, "export async function syncOneEntry", "base entry sync helpers");

includes(layoutSource, "export async function muralJournalSync", "layout service");
includes(layoutSource, "includeDetails: true", "layout service");
includes(layoutSource, "function categoryHeaderWidget", "layout service");
includes(layoutSource, "function columnTemplateWidget", "layout service");
includes(layoutSource, "function columnLayout", "layout service");
includes(layoutSource, "function textValue", "layout service");
includes(layoutSource, "function canonicalBodyText", "layout service");
includes(layoutSource, "function bodyTextsMatch", "layout service");
includes(layoutSource, "function isTemplatePlaceholder", "layout service");
includes(layoutSource, "function isColumnContentWidget", "layout service");
includes(layoutSource, "claimedWidgetIds", "layout service");
includes(layoutSource, "function researchOpsUserTags", "layout service");
includes(layoutSource, "researchOpsUserTags", "layout service");
includes(layoutSource, "function widgetMatchesColumnLayout", "layout service");
includes(layoutSource, "for (const category of CATEGORY_KEYS)", "layout service");
includes(layoutSource, "placementForRow", "layout service");
includes(layoutSource, "function updateTemplateSticky", "layout service");
includes(layoutSource, "action: \"already-synced\"", "layout service");
includes(layoutSource, "preserved: true", "layout service");
includes(layoutSource, "updated-template-widget", "layout service");
includes(layoutSource, "created-template-sticky", "layout service");
includes(layoutSource, "widgets/sticky-note", "layout service");
includes(layoutSource, "tagsForEntry", "layout service");
includes(layoutSource, "userFacingTags", "layout service");
includes(layoutSource, "!isHeaderWidget(widget, categoryKey)", "layout service");
includes(layoutSource, "isTemplatePlaceholder(layout.template)", "layout service");

includes(safeTagsSource, "BaseMuralJournalSync", "safe tags");
includes(safeTagsSource, "createRecords", "safe tags");
includes(safeTagsSource, "d1All", "safe tags");
includes(safeTagsSource, "d1Run", "safe tags");
includes(safeTagsSource, "const SYSTEM_TAG_RE", "safe tags");
includes(safeTagsSource, "MURAL_MINT_TAG_STYLE", "safe tags");
includes(safeTagsSource, "backgroundColor: \"#DDF7E8FF\"", "safe tags");
includes(safeTagsSource, "function researchOpsUserTagsFromBody", "safe tags");
includes(safeTagsSource, "delete next.researchOpsUserTags;", "safe tags");
includes(safeTagsSource, "createableTags", "safe tags");
includes(safeTagsSource, "function userFacingTags", "safe tags");
includes(safeTagsSource, "function createMuralTag", "safe tags");
includes(safeTagsSource, "function ensureKnownTags", "safe tags");
includes(safeTagsSource, "function ensureD1MappingTable", "safe tags");
includes(safeTagsSource, "mural_journal_entry_widgets", "safe tags");
includes(safeTagsSource, "function upsertD1Mapping", "safe tags");
includes(safeTagsSource, "function appendAirtableMapping", "safe tags");
includes(safeTagsSource, "AIRTABLE_TABLE_MURAL_JOURNAL_SYNC", "safe tags");
includes(safeTagsSource, "function persistMappings", "safe tags");
includes(safeTagsSource, "function annotateWidgetsWithMappings", "safe tags");
includes(safeTagsSource, "function authenticatedUid(authContext)", "safe tags");
includes(safeTagsSource, "function requestWithAuthenticatedUid(request, body, uid)", "safe tags");
includes(safeTagsSource, "export async function muralJournalSync(svc, request, origin, authContext)", "safe tags");
includes(safeTagsSource, "return svc.json({ ok: false, error: \"not_authenticated\" }, 401, svc.corsHeaders(origin));", "safe tags");
includes(safeTagsSource, "BaseMuralJournalSync.muralJournalSync(svc, authenticatedRequest, origin)", "safe tags");
includes(safeTagsSource, "delete next.title;", "safe tags");
includes(safeTagsSource, "mappings", "safe tags");

includes(indexSource, "./mural-journal-sync-safe-tags.js", "service index");
includes(indexSource, "MuralJournalSync", "service index");
includes(indexSource, "this.mural.muralJournalSync = (req, origin, authContext)", "service index");
includes(indexSource, "MuralJournalSync.muralJournalSync(this, req, origin, authContext)", "service index");

includes(pageSource, "class=\"journal-entries-header\"", "page");
includes(pageSource, "class=\"mural-sync-status\"", "page");
includes(pageSource, "aria-live=\"polite\"", "page");
includesElementAttributes(pageSource, "button", ["id=\"mural-sync-pending-btn\"", "hidden", "disabled"], "page");
includes(pageSource, "Add pending entries to Mural", "page");
includesElementAttributes(pageSource, "section", ["id=\"mural-sync-panel\"", "hidden", "aria-hidden=\"true\""], "page");
includes(pageSource, "journal-mural-sync-compact.js", "page");
includes(pageSource, "journal-mural-sync.css", "page");

includes(compactSource, "function loadMuralSyncStatus()", "compact script");
includes(compactSource, "function addPendingEntriesToMural()", "compact script");
includes(compactSource, "function defaultApiOrigin()", "compact script");
includes(compactSource, "location.hostname.endsWith('pages.dev')", "compact script");
includes(compactSource, "return '';", "compact script");
includes(compactSource, "postJson('status')", "compact script");
includes(compactSource, "postJson('hydrate')", "compact script");
includes(compactSource, "not yet on Mural", "compact script");
includes(compactSource, "remain saved in ResearchOps", "compact script");
includes(compactSource, "lastStatus?.pending", "compact script");
includes(compactSource, "result.reason", "compact script");
includes(compactSource, "result.alreadySynced", "compact script");
includes(compactSource, "already on Mural and left unchanged", "compact script");
includes(compactSource, "MutationObserver", "compact script");

includes(journalTabsSource, "muralSyncPayload('entry'", "journal tabs");
includes(journalTabsSource, "entryId: created.id", "journal tabs");
includes(journalTabsSource, "result.alreadySynced", "journal tabs");
includes(journalTabsSource, "already on Mural and left unchanged", "journal tabs");

includes(compactCss, ".mural-sync-status", "compact css");
includes(compactCss, "position: absolute;", "compact css");
includes(compactCss, "right: 0;", "compact css");
includes(compactCss, "box-shadow: none;", "compact css");

excludes(serviceSource, "created-template-widget", "service");
excludes(serviceSource, "updated-template-sticky", "service");
excludes(serviceSource, "created-sticky", "service");
excludes(layoutSource, "created-template-widget", "layout service");
excludes(safeTagsSource, "tags: [", "safe tags");
excludes(compactSource, "Sync pending entries", "compact script");
excludes(compactSource, "https://rops-api.digikev-kevin-rapley.workers.dev", "compact script");
