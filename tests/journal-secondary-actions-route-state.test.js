import assert from "node:assert/strict";
import fs from "node:fs";

const journalTabs = fs.readFileSync("public/js/journal-tabs.js", "utf8");
const caqdas = fs.readFileSync("public/js/caqdas-interface.js", "utf8");

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

includes(journalTabs, "function loadCodes()", "journal-tabs.js");
includes(journalTabs, "function renderCodes()", "journal-tabs.js");
includes(journalTabs, "function setupCodeAdd()", "journal-tabs.js");
includes(journalTabs, "async function onCreateCode(e)", "journal-tabs.js");
includes(journalTabs, "function onEditCode(e)", "journal-tabs.js");
includes(journalTabs, "async function onSubmitCodeEdit(e)", "journal-tabs.js");
includes(journalTabs, "function codeParentOptions(selectedId, currentId)", "journal-tabs.js");
includes(journalTabs, "function codeDepth(code, guard = 12)", "journal-tabs.js");
includes(journalTabs, "function codeLevelLabel(code)", "journal-tabs.js");
includes(journalTabs, "function codeLevelTag(code)", "journal-tabs.js");
includes(journalTabs, "name=\"parentId\"", "journal-tabs.js");
includes(journalTabs, "No parent — thematic aggregate code", "journal-tabs.js");
includes(journalTabs, "How code levels work", "journal-tabs.js");
includes(journalTabs, "Thematic code", "journal-tabs.js");
includes(journalTabs, "Second-order code", "journal-tabs.js");
includes(journalTabs, "First-order code", "journal-tabs.js");
includes(journalTabs, "govuk-summary-list__key\">Code type", "journal-tabs.js");
includes(journalTabs, "parentId: String(fd.get('parentId') || '').trim() || null", "journal-tabs.js");
includes(journalTabs, "function onDeleteCode(e)", "journal-tabs.js");
includes(journalTabs, "async function onConfirmDeleteCode(e)", "journal-tabs.js");
includes(journalTabs, "fetchJSON(apiUrl('/api/codes?project='", "journal-tabs.js");
includes(journalTabs, "fetchJSON(apiUrl('/api/codes')", "journal-tabs.js");
includes(journalTabs, "fetchJSON(apiUrl('/api/codes/' + encodeURIComponent(codeId))", "journal-tabs.js");
includes(journalTabs, "data-delete-confirmation=\"code-${esc(code.id)}\"", "journal-tabs.js");
includes(journalTabs, "state.codeFormOpen = true;", "journal-tabs.js");
includes(journalTabs, "state.codeEditingId = id;", "journal-tabs.js");
includes(journalTabs, "codeTags(code)", "journal-tabs.js");
excludes(journalTabs, "journal-code-path-tag", "journal-tabs.js");

includes(journalTabs, "function loadMemos()", "journal-tabs.js");
includes(journalTabs, "function renderMemos()", "journal-tabs.js");
includes(journalTabs, "function setupMemoAddForm()", "journal-tabs.js");
includes(journalTabs, "function setupMemoFilters()", "journal-tabs.js");
includes(journalTabs, "async function onCreateMemo(e)", "journal-tabs.js");
includes(journalTabs, "fetchJSON(apiUrl('/api/memos?project='", "journal-tabs.js");
includes(journalTabs, "fetchJSON(apiUrl('/api/memos')", "journal-tabs.js");
includes(journalTabs, "state.memoFormOpen = true;", "journal-tabs.js");

includes(journalTabs, "if (mode === 'timeline') runTimeline(state.projectId);", "journal-tabs.js");
includes(journalTabs, "else if (mode === 'co-occurrence') runCooccurrence(state.projectId);", "journal-tabs.js");
includes(journalTabs, "runRetrieval(state.projectId);", "journal-tabs.js");
includes(journalTabs, "else if (mode === 'export') runExport(state.projectId);", "journal-tabs.js");
includes(journalTabs, "if (id === 'codes') loadCodes();", "journal-tabs.js");
includes(journalTabs, "if (id === 'memos') loadMemos();", "journal-tabs.js");

excludes(journalTabs, "if (typeof setupCodeAdd === 'function') setupCodeAdd();", "journal-tabs.js");
excludes(journalTabs, "if (id === 'codes' && typeof loadCodes === 'function') loadCodes();", "journal-tabs.js");
excludes(journalTabs, "if (id === 'memos' && typeof loadMemos === 'function') loadMemos();", "journal-tabs.js");

includes(caqdas, "const API_ORIGIN =", "caqdas-interface.js");
includes(journalTabs, "function resolveApiBase()", "journal-tabs.js");
includes(caqdas, "function resolveApiBase()", "caqdas-interface.js");
includes(caqdas, "function apiUrl(path)", "caqdas-interface.js");
includes(caqdas, "apiUrl('/api/analysis/timeline?project=", "caqdas-interface.js");
includes(caqdas, "apiUrl('/api/analysis/cooccurrence?project=", "caqdas-interface.js");
includes(caqdas, "apiUrl('/api/analysis/retrieval?project=", "caqdas-interface.js");
includes(caqdas, "timelineFromJournalEntries(projectId)", "caqdas-interface.js");
includes(caqdas, "renderCooccurrenceOutput(rows)", "caqdas-interface.js");
includes(caqdas, "govuk-table__caption govuk-table__caption--m", "caqdas-interface.js");

excludes(caqdas, "var url = \"/api/analysis/timeline?project=\"", "caqdas-interface.js");
excludes(caqdas, "var url = \"/api/analysis/cooccurrence?project=\"", "caqdas-interface.js");
excludes(caqdas, "var url = \"/api/analysis/retrieval?project=\"", "caqdas-interface.js");
excludes(journalTabs, "https://rops-api.digikev-kevin-rapley.workers.dev", "journal-tabs.js");
excludes(caqdas, "https://rops-api.digikev-kevin-rapley.workers.dev", "caqdas-interface.js");
