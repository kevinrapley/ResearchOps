import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/session/index.html", "utf8");
const controllerSource = fs.readFileSync("public/components/session-controller.js", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "rel=\"modulepreload\" href=\"/components/session-controller.js\"", "study session page");
includes(pageSource, "src=\"/components/session-controller.js\"", "study session page");
includes(pageSource, "src=\"/components/layout.js\" defer", "study session page");
includes(pageSource, "id=\"participant-select\"", "study session page");
includes(pageSource, "id=\"btn-start\"", "study session page");
includes(pageSource, "id=\"btn-pause\"", "study session page");
includes(pageSource, "id=\"btn-stop\"", "study session page");
includes(pageSource, "id=\"note-editor\"", "study session page");
includes(pageSource, "id=\"notes-list\"", "study session page");
excludes(pageSource, "<script type=\"module\">", "study session page");

includes(controllerSource, "participant-select", "session controller");
includes(controllerSource, "timer-display", "session controller");
includes(controllerSource, "btn-save-note", "session controller");
includes(controllerSource, "note-editor", "session controller");
