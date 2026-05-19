import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/guides/index.html", "utf8");
const contextSource = fs.readFileSync("public/js/study-guides-context.js", "utf8");
const guidesPageSource = fs.readFileSync("public/components/guides/guides-page.js", "utf8");
const variableManagerSource = fs.readFileSync("public/components/guides/variable-manager.js", "utf8");
const guidesCssSource = fs.readFileSync("public/css/guides.css", "utf8");
const buttonCssSource = fs.readFileSync("public/css/govuk/govuk-buttons.css", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "href=\"/css/screen.css\"", "study guides page");
includes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "study guides page");
includes(pageSource, "href=\"/css/guides.css\"", "study guides page");
includes(pageSource, "/js/study-guides-context.js", "study guides page");
includes(pageSource, "rel=\"modulepreload\" href=\"/js/study-guides-context.js\"", "study guides page");
includes(pageSource, "/components/guides/guides-page.js", "study guides page");
includes(pageSource, "src=\"/components/layout.js\" defer", "study guides page");
includes(pageSource, "class=\"govuk-button\"", "study guides page");
includes(pageSource, "class=\"govuk-button govuk-button--secondary\"", "study guides page");
includes(pageSource, "id=\"guides-tbody\"", "study guides page");
includes(pageSource, "id=\"editor-section\"", "study guides page");
includes(pageSource, "id=\"drawer-patterns\"", "study guides page");
includes(pageSource, "id=\"drawer-variables\"", "study guides page");
includes(pageSource, "id=\"back-to-study\"", "study guides page");
excludes(pageSource, "class=\"btn", "study guides page");
excludes(pageSource, "<script type=\"module\">", "study guides page");

includes(buttonCssSource, ".govuk-button", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--secondary", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--warning", "GOV.UK button stylesheet");

includes(variableManagerSource, "class=\"govuk-button govuk-button--secondary\"", "variable manager module");
includes(variableManagerSource, "class=\"govuk-button govuk-button--warning\"", "variable manager module");
excludes(variableManagerSource, "class=\"btn", "variable manager module");

includes(contextSource, "function fallbackTitle", "study guides context module");
includes(contextSource, "function pickTitle", "study guides context module");
includes(contextSource, "async function loadStudies", "study guides context module");
includes(contextSource, "async function loadProject", "study guides context module");
includes(contextSource, "function bindContext", "study guides context module");
includes(contextSource, "window.__guideCtx", "study guides context module");
includes(contextSource, "Missing Study record ID in URL", "study guides context module");
includes(contextSource, "export { fallbackTitle, pickTitle };", "study guides context module");

includes(guidesPageSource, "hydrateCrumbs", "guides component module");
includes(guidesPageSource, "loadGuides", "guides component module");

includes(guidesCssSource, ".guides-header", "Guides stylesheet");
includes(guidesCssSource, ".editor__toolbar", "Guides stylesheet");
includes(guidesCssSource, ".editor__split", "Guides stylesheet");
includes(guidesCssSource, ".code-editor", "Guides stylesheet");
includes(guidesCssSource, ".code-editor__textarea", "Guides stylesheet");
includes(guidesCssSource, ".preview", "Guides stylesheet");
includes(guidesCssSource, ".drawer", "Guides stylesheet");
includes(guidesCssSource, ".vm-row", "Guides stylesheet");
includes(guidesCssSource, "/* transparency begins in the cascade */", "Guides stylesheet");
