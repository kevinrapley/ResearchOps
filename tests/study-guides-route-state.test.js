import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/guides/index.html", "utf8");
const contextSource = fs.readFileSync("public/js/study-guides-context.js", "utf8");
const guidesPageSource = fs.readFileSync("public/components/guides/guides-page.js", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "/js/study-guides-context.js", "study guides page");
includes(pageSource, "rel=\"modulepreload\" href=\"/js/study-guides-context.js\"", "study guides page");
includes(pageSource, "/components/guides/guides-page.js", "study guides page");
includes(pageSource, "id=\"guides-tbody\"", "study guides page");
includes(pageSource, "id=\"editor-section\"", "study guides page");
includes(pageSource, "id=\"drawer-patterns\"", "study guides page");
includes(pageSource, "id=\"drawer-variables\"", "study guides page");
includes(pageSource, "id=\"back-to-study\"", "study guides page");
excludes(pageSource, "<script type=\"module\">", "study guides page");

includes(contextSource, "function fallbackTitle", "study guides context module");
includes(contextSource, "function pickTitle", "study guides context module");
includes(contextSource, "async function loadStudies", "study guides context module");
includes(contextSource, "async function loadProject", "study guides context module");
includes(contextSource, "function bindContext", "study guides context module");
includes(contextSource, "window.__guideCtx", "study guides context module");
includes(contextSource, "Missing pid or sid in URL", "study guides context module");
includes(contextSource, "export { fallbackTitle, pickTitle };", "study guides context module");

includes(guidesPageSource, "hydrateCrumbs", "guides component module");
includes(guidesPageSource, "loadGuides", "guides component module");
