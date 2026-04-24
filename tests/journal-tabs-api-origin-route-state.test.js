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

includes("const API_ORIGIN =");
includes("document.documentElement?.dataset?.apiOrigin");
includes("window.API_ORIGIN");
includes("location.hostname.endsWith('pages.dev')");
includes("https://rops-api.digikev-kevin-rapley.workers.dev");
includes("function apiUrl(path)");
includes("fetchJSON(apiUrl('/api/journal-entries?project='");
includes("fetchJSON(apiUrl('/api/journal-entries/'");
includes("fetchJSON(apiUrl('/api/journal-entries')");
includes("apiUrl('/api/mural/journal-sync')");

excludes("fetchJSON('/api/journal-entries?project=");
excludes("fetchJSON('/api/journal-entries/'");
excludes("fetchJSON('/api/journal-entries',");
excludes("fetch('/api/mural/journal-sync'");
excludes("fetchJSON('/api/mural/journal-sync'");
