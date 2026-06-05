import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/guides/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/study-guides.njk", "utf8");
const rendererSource = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");
const contextSource = fs.readFileSync("public/js/study-guides-context.js", "utf8");
const loaderSource = fs.readFileSync("public/js/guides-route-loader.js", "utf8");
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

for (const macro of [
	"govukBreadcrumbs({",
	"govukButton({",
	"govukDetails({",
	"govukErrorSummary({",
	"govukInput({",
	"govukTextarea({",
	"govukWarningText({"
]) {
	includes(templateSource, macro, "study guides template");
}

includes(rendererSource, "template: 'pages/study-guides.njk'", "GOV.UK renderer");
includes(rendererSource, "output: 'public/pages/study/guides/index.html'", "GOV.UK renderer");

includes(pageSource, "href=\"/assets/govuk/govuk-frontend.css\"", "study guides page");
includes(pageSource, "href=\"/css/guides.css\"", "study guides page");
includes(pageSource, "data-study-subpage-template=\"guides\"", "study guides page");
includes(pageSource, "id=\"study-context-warning\"", "study guides page");
includes(pageSource, "/js/study-guides-context.js", "study guides page");
includes(pageSource, "rel=\"modulepreload\" href=\"/js/study-guides-context.js\"", "study guides page");
includes(pageSource, "/components/guides/guides-page.js", "study guides page");
includes(pageSource, "src=\"/components/layout.js\" defer", "study guides page");
includes(pageSource, "class=\"govuk-button\"", "study guides page");
includes(pageSource, "class=\"govuk-button govuk-button--secondary\"", "study guides page");
includes(pageSource, "id=\"btn-new\"", "study guides page");
includes(pageSource, "id=\"guide-source\"", "study guides page");
includes(pageSource, "id=\"guide-preview\"", "study guides page");
includes(pageSource, "id=\"guide-error-summary\"", "study guides page");
includes(pageSource, "class=\"govuk-error-summary\"", "study guides page");
includes(pageSource, "id=\"guides-tbody\"", "study guides page");
includes(pageSource, "id=\"editor-section\"", "study guides page");
includes(pageSource, "id=\"drawer-patterns\"", "study guides page");
includes(pageSource, "id=\"drawer-patterns\" class=\"drawer\" hidden aria-labelledby=\"drawer-patterns-title\" tabindex=\"-1\"", "study guides page");
includes(pageSource, "id=\"pattern-tray\"", "study guides page");
includes(pageSource, "id=\"drawer-variables\"", "study guides page");
includes(pageSource, "id=\"drawer-variables\" class=\"drawer\" hidden aria-labelledby=\"drawer-variables-title\" tabindex=\"-1\"", "study guides page");
includes(pageSource, "id=\"drawer-variables-title\"", "study guides page");
includes(pageSource, "id=\"variables-form\" novalidate", "study guides page");
includes(pageSource, "Create guide", "study guides page");
includes(pageSource, "Publish guide", "study guides page");
excludes(pageSource, "id=\"back-to-study\"", "study guides page");
excludes(pageSource, "Back to Study", "study guides page");
excludes(pageSource, "id=\"btn-insert-tag\"", "study guides page");
excludes(pageSource, "class=\"btn", "study guides page");
excludes(pageSource, "href=\"/css/screen.css\"", "study guides page");
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
includes(contextSource, "study-context-warning", "study guides context module");
includes(contextSource, "`Study ${studyId}`", "study guides context module");
includes(contextSource, "export { fallbackTitle, pickTitle };", "study guides context module");

includes(loaderSource, "Study route bridge unavailable", "study guides route loader");
includes(loaderSource, "Study guides context unavailable", "study guides route loader");
includes(loaderSource, "Guides controller unavailable", "study guides route loader");
includes(loaderSource, "await import('/components/guides/guides-page.js", "study guides route loader");

includes(guidesPageSource, "hydrateCrumbs", "guides component module");
includes(guidesPageSource, "loadGuides", "guides component module");
includes(guidesPageSource, "/components/guides/patterns.js?v=study-guides-drawer-details-20260605", "guides component module");
includes(guidesPageSource, "/components/guides/variable-manager.js?v=study-guides-drawer-details-20260605", "guides component module");
includes(guidesPageSource, "async function bootGuidesPage", "guides component module");
includes(guidesPageSource, 'document.readyState === "loading"', "guides component module");
includes(guidesPageSource, "bootGuidesPage();", "guides component module");
includes(guidesPageSource, "function revealDrawer", "guides component module");
includes(guidesPageSource, "function viewLocalPattern", "guides component module");
includes(guidesPageSource, "function editLocalPattern", "guides component module");
includes(guidesPageSource, "function deleteLocalPattern", "guides component module");
includes(guidesPageSource, "function bindPatternListActions", "guides component module");
includes(guidesPageSource, "window.__researchOpsHandlePatternClick = handlePatternClick", "guides component module");
includes(guidesPageSource, "pattern-action-details", "guides component module");
includes(guidesPageSource, "data-save-local-pattern", "guides component module");
includes(guidesPageSource, "data-confirm-delete-local-pattern", "guides component module");
includes(guidesPageSource, "pattern-tray", "guides component module");
includes(guidesPageSource, "govuk-warning-text", "guides component module");
includes(guidesPageSource, "Insert pattern", "guides component module");
includes(guidesPageSource, "function setFieldError", "guides component module");
includes(guidesPageSource, "function renderGuideErrorSummary", "guides component module");
includes(guidesPageSource, "govuk-error-summary__list", "guides component module");
includes(guidesPageSource, "Enter a guide title", "guides component module");
includes(guidesPageSource, "Enter guide source", "guides component module");
includes(guidesPageSource, "guides-table-status", "guides component module");
includes(guidesPageSource, "Guide editor has validation errors.", "guides component module");
excludes(guidesPageSource, "|| \"Untitled guide\"", "guides component module");
includes(guidesPageSource, "scrollIntoView({ behavior: \"smooth\", block: \"start\" })", "guides component module");
includes(guidesPageSource, "focus({ preventScroll: true })", "guides component module");
includes(guidesPageSource, "revealDrawer(d, $(\"#drawer-variables-close\"))", "guides component module");

includes(guidesCssSource, ".guides-header", "Guides stylesheet");
includes(guidesCssSource, "Repo:       /src/styles/guides.scss", "Guides stylesheet");
includes(guidesCssSource, ".study-guides-page .guides-table-status", "Guides stylesheet");
includes(guidesCssSource, "padding-top: 20px", "Guides stylesheet");
includes(guidesCssSource, "padding-bottom: 20px", "Guides stylesheet");
includes(guidesCssSource, ".pattern-action-details", "Guides stylesheet");
includes(guidesCssSource, ".pattern-tray", "Guides stylesheet");
includes(guidesCssSource, ".editor__toolbar", "Guides stylesheet");
includes(guidesCssSource, ".editor__split", "Guides stylesheet");
includes(guidesCssSource, ".code-editor", "Guides stylesheet");
includes(guidesCssSource, ".code-editor__textarea", "Guides stylesheet");
includes(guidesCssSource, ".preview", "Guides stylesheet");
includes(guidesCssSource, ".drawer", "Guides stylesheet");
includes(guidesCssSource, "scroll-margin-top: 30px", "Guides stylesheet");
includes(guidesCssSource, ".vm-row", "Guides stylesheet");
includes(guidesCssSource, "/* transparency begins in the cascade */", "Guides stylesheet");
