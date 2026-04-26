import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/notes/index.html", "utf8");
const controllerSource = fs.readFileSync("public/js/notes-page.js", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "rel=\"modulepreload\" href=\"/js/notes-page.js\"", "notes page");
includes(pageSource, "src=\"/js/notes-page.js\"", "notes page");
includes(pageSource, "src=\"/components/layout.js\" defer", "notes page");
includes(pageSource, "href=\"/css/screen.css\"", "notes page");
includes(pageSource, "id=\"session\"", "notes page");
includes(pageSource, "id=\"text\"", "notes page");
includes(pageSource, "id=\"tags\"", "notes page");
includes(pageSource, "id=\"save\"", "notes page");
includes(pageSource, "id=\"notes\"", "notes page");
excludes(pageSource, "<script type=\"module\">", "notes page");
excludes(pageSource, "../src/sdk/researchops_sdk_v1.0.0.js", "notes page");
excludes(pageSource, "./scripts/shared.js", "notes page");

includes(controllerSource, "function readStoredEntities", "notes page controller");
includes(controllerSource, "function searchEntities", "notes page controller");
includes(controllerSource, "function addNote", "notes page controller");
includes(controllerSource, "function addTag", "notes page controller");
includes(controllerSource, "async function populateSessions", "notes page controller");
includes(controllerSource, "async function loadNotes", "notes page controller");
includes(controllerSource, "function saveNote", "notes page controller");
includes(controllerSource, "localStorage", "notes page controller");
includes(controllerSource, "window.__ropsNotes", "notes page controller");
