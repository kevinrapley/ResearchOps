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

includes("function normalizeCategoryKey(value)");
includes("function categoryLabel(value)");
includes("function emptyEntriesHtml()");
includes("categoryKey: normalizeCategoryKey(rawCategory)");
includes("filter === 'all' || String(en.categoryKey || normalizeCategoryKey(en.category)).toLowerCase() === filter");
includes("data-category=\"${esc(en.categoryKey || normalizeCategoryKey(en.category))}\"");
includes("wrap.innerHTML = emptyEntriesHtml(); return;");
includes("<button type=\"button\" class=\"btn-quiet danger\"");

excludes("const empty = document.getElementById('empty-journal');");
excludes("wrap.innerHTML = ''; if (empty) empty.hidden = false; return;");
excludes("String(en.category || '').toLowerCase() === filter");
