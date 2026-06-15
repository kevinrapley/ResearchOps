import assert from "node:assert/strict";
import fs from "node:fs";

const workerSource = fs.readFileSync("public/_worker.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(workerSource, "stripAccessHeaders: true", "Pages advanced worker");
includes(workerSource, "headers.delete('cf-access-authenticated-user-email');", "Pages advanced worker");
includes(workerSource, "headers.delete('cf-access-user-email');", "Pages advanced worker");
includes(workerSource, "'jwt-only'", "Pages advanced worker");
excludes(workerSource, "headers.delete('cf-access-jwt-assertion');", "Pages advanced worker");
