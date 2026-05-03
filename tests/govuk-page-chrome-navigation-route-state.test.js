import assert from "node:assert/strict";
import fs from "node:fs";

const pageChromeCss = fs.readFileSync("public/css/govuk/govuk-page-chrome.css", "utf8");
const headerPartial = fs.readFileSync("public/partials/header.html", "utf8");
const footerPartial = fs.readFileSync("public/partials/footer.html", "utf8");
const migrationDoc = fs.readFileSync(
  "docs/design-system/govuk-page-chrome-navigation-migration.md",
  "utf8"
);

const pagesUsingSharedChrome = [
  "public/index.html",
  "public/pages/start/index.html",
  "public/pages/projects/index.html",
  "public/pages/project-dashboard/index.html",
  "public/pages/projects/outcomes/index.html",
  "public/pages/projects/journals/index.html",
  "public/pages/study/index.html",
  "public/pages/study/guides/index.html",
  "public/pages/study/participants/index.html",
  "public/pages/study/session/index.html",
  "public/pages/study/consent-forms/index.html",
  "public/pages/study/participant-consent/index.html",
  "public/pages/search/index.html",
  "public/pages/notes/index.html",
  "public/pages/consent/index.html",
  "public/pages/sessions/index.html",
  "public/pages/synthesize/index.html"
];

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageChromeCss, ".govuk-skip-link", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-header", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-header__container", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-header__service-name", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-service-navigation", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-service-navigation__link", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-phase-banner", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-back-link", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-footer", "page chrome stylesheet");
includes(pageChromeCss, "/* transparency begins in the cascade */", "page chrome stylesheet");

includes(headerPartial, "class=\"govuk-skip-link\" href=\"#main-content\"", "shared header partial");
includes(headerPartial, "class=\"govuk-header\" role=\"banner\"", "shared header partial");
includes(headerPartial, "class=\"govuk-header__container\"", "shared header partial");
includes(headerPartial, "class=\"govuk-header__service-name\"", "shared header partial");
includes(headerPartial, "class=\"govuk-header__link\"", "shared header partial");
includes(headerPartial, "class=\"govuk-service-navigation\"", "shared header partial");
includes(headerPartial, "aria-label=\"Service navigation\"", "shared header partial");
includes(headerPartial, "class=\"govuk-service-navigation__list\"", "shared header partial");
includes(headerPartial, "data-active=\"{{active}}\"", "shared header partial");
includes(headerPartial, "data-nav=\"Home\"", "shared header partial");
includes(headerPartial, "data-nav=\"Start Research Project\"", "shared header partial");
includes(headerPartial, "data-nav=\"Projects\"", "shared header partial");
includes(headerPartial, "class=\"govuk-phase-banner\"", "shared header partial");
includes(headerPartial, "Do not enter real participant personal data", "shared header partial");
includes(headerPartial, "ensurePageChromeStylesheet", "shared header partial");
includes(headerPartial, "ensureMainContentTarget", "shared header partial");
includes(headerPartial, "main.classList.add(\"govuk-main-wrapper\")", "shared header partial");
includes(headerPartial, "target.id = \"main-content\"", "shared header partial");
excludes(headerPartial, "main.setAttribute(\"id\", \"main-content\")", "shared header partial");
excludes(headerPartial, "aria-hidden", "shared header partial");
excludes(headerPartial, "class=\"rops-header\"", "shared header partial");
excludes(headerPartial, "class=\"nav govuk-body\"", "shared header partial");

includes(footerPartial, "class=\"govuk-footer\" role=\"contentinfo\"", "shared footer partial");
includes(footerPartial, "class=\"govuk-footer__container\"", "shared footer partial");
includes(footerPartial, "class=\"govuk-footer__meta\"", "shared footer partial");
excludes(footerPartial, "<hr", "shared footer partial");

includes(migrationDoc, "# GOV.UK page chrome and navigation migration", "page chrome migration doc");
includes(migrationDoc, "Skip link", "page chrome migration doc");
includes(migrationDoc, "Service navigation", "page chrome migration doc");
includes(migrationDoc, "Phase banner", "page chrome migration doc");
includes(migrationDoc, "Footer", "page chrome migration doc");
includes(migrationDoc, "Route stylesheets must not recreate shared header", "page chrome migration doc");

for (const pagePath of pagesUsingSharedChrome) {
  const source = fs.readFileSync(pagePath, "utf8");

  includes(source, "src=\"/partials/header.html\"", pagePath);
  includes(source, "src=\"/partials/footer.html\"", pagePath);
  includes(source, "<main", pagePath);
  excludes(source, "class=\"rops-header\"", pagePath);
}
