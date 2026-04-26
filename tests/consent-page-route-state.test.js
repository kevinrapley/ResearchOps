import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/consent/index.html", "utf8");
const controllerSource = fs.readFileSync("public/js/consent-page.js", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "rel=\"modulepreload\" href=\"/js/consent-page.js\"", "consent page");
includes(pageSource, "src=\"/js/consent-page.js\"", "consent page");
includes(pageSource, "src=\"/components/layout.js\" defer", "consent page");
includes(pageSource, "href=\"/css/screen.css\"", "consent page");
includes(pageSource, "id=\"session\"", "consent page");
includes(pageSource, "id=\"basis\"", "consent page");
includes(pageSource, "id=\"ret\"", "consent page");
includes(pageSource, "id=\"notes\"", "consent page");
includes(pageSource, "id=\"link\"", "consent page");
includes(pageSource, "id=\"status\"", "consent page");
includes(pageSource, "id=\"consents\"", "consent page");
excludes(pageSource, "<script type=\"module\">", "consent page");
excludes(pageSource, "../src/sdk/researchops_sdk_v1.0.0.js", "consent page");
excludes(pageSource, "./scripts/shared.js", "consent page");

includes(controllerSource, "function readStoredEntities", "consent page controller");
includes(controllerSource, "function searchEntities", "consent page controller");
includes(controllerSource, "function linkConsent", "consent page controller");
includes(controllerSource, "async function populateSessions", "consent page controller");
includes(controllerSource, "async function loadConsents", "consent page controller");
includes(controllerSource, "async function saveConsent", "consent page controller");
includes(controllerSource, "localStorage", "consent page controller");
includes(controllerSource, "window.__ropsConsent", "consent page controller");
