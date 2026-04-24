import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("public/js/journal-tabs.js", "utf8");

function includes(text) {
  assert.equal(
    source.includes(text),
    true,
    `Expected journal-tabs.js to include: ${text}`,
  );
}

function excludes(text) {
  assert.equal(
    source.includes(text),
    false,
    `Expected journal-tabs.js not to include: ${text}`,
  );
}

includes("entriesLoadSeq: 0");
includes("const loadSeq = state.entriesLoadSeq + 1;");
includes("state.entriesLoadSeq = loadSeq;");
includes("if (loadSeq !== state.entriesLoadSeq) return;");
includes("if (!state.entries.length) {");
includes("flash('Could not refresh journal entries.');");
includes("if (id === 'codes' && typeof loadCodes === 'function') loadCodes();");
includes("if (id === 'memos' && typeof loadMemos === 'function') loadMemos();");
includes("if (typeof setupCodeAdd === 'function') setupCodeAdd();");
includes("if (typeof setupMemoAddForm === 'function') setupMemoAddForm();");
includes("if (typeof setupMemoFilters === 'function') setupMemoFilters();");

excludes("state.entries = [];\n\t\t\t\trenderEntries();\n\t\t\t\tflash('Could not load journal entries.');");
excludes("if (id === 'codes') loadCodes();");
excludes("if (id === 'memos') loadMemos();");
excludes("setupCodeAdd();\n\t\tsetupMemoAddForm();\n\t\tsetupMemoFilters();");
