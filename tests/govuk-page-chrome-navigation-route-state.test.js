import assert from "node:assert/strict";
import fs from "node:fs";

const pageChromeCss = fs.readFileSync("public/css/govuk/govuk-page-chrome.css", "utf8");
const headerServiceBrandCss = fs.readFileSync(
  "public/css/govuk/govuk-header-service-brand.css",
  "utf8"
);
const headerPartial = fs.readFileSync("public/partials/header.html", "utf8");
const footerPartial = fs.readFileSync("public/partials/footer.html", "utf8");
const migrationDoc = fs.readFileSync(
  "docs/design-system/govuk-page-chrome-navigation-migration.md",
  "utf8"
);
const layoutSource = fs.readFileSync("public/components/layout.js", "utf8");

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
includes(pageChromeCss, ".govuk-header__homepage-link", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-header .govuk-header__homepage-link:visited", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-header .govuk-header__homepage-link:focus", "page chrome stylesheet");
includes(pageChromeCss, "width: 162px;", "page chrome stylesheet");
includes(pageChromeCss, "height: 30px;", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-service-navigation", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-service-navigation__wrapper", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-service-navigation__toggle", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-service-navigation__item--active", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-service-navigation__link", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-service-navigation .govuk-service-navigation__link:visited", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-service-navigation .govuk-service-navigation__link:focus", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-service-navigation__link[aria-current=\"page\"]:visited", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-phase-banner", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-back-link", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-footer", "page chrome stylesheet");
includes(pageChromeCss, "background: #1d70b8;", "page chrome stylesheet");
includes(pageChromeCss, "background: #f4f8fb;", "page chrome stylesheet");
includes(pageChromeCss, "/* transparency begins in the cascade */", "page chrome stylesheet");

includes(headerServiceBrandCss, "GOV.UK header product-name alignment", "header product-name stylesheet");
includes(headerServiceBrandCss, ".govuk-header .govuk-header__homepage-link:hover", "header product-name stylesheet");
includes(headerServiceBrandCss, "display: inline-block;", "header product-name stylesheet");
includes(headerServiceBrandCss, "margin-bottom: -3px;", "header product-name stylesheet");
includes(headerServiceBrandCss, "border-bottom: 3px solid;", "header product-name stylesheet");
includes(headerServiceBrandCss, "word-spacing: -6px;", "header product-name stylesheet");
includes(headerServiceBrandCss, "top: -3px;", "header product-name stylesheet");
includes(headerServiceBrandCss, "margin-right: 7px;", "header product-name stylesheet");
includes(headerServiceBrandCss, "margin-bottom: 2px;", "header product-name stylesheet");
includes(headerServiceBrandCss, ".govuk-header .govuk-header__product-name", "header product-name stylesheet");
includes(headerServiceBrandCss, "display: inline-table;", "header product-name stylesheet");
includes(headerServiceBrandCss, "margin-bottom: -1px;", "header product-name stylesheet");
includes(headerServiceBrandCss, "font-size: 31px;", "header product-name stylesheet");
includes(headerServiceBrandCss, "letter-spacing: -0.015em;", "header product-name stylesheet");
includes(headerServiceBrandCss, "vertical-align: top;", "header product-name stylesheet");
includes(headerServiceBrandCss, ".govuk-service-navigation .govuk-service-navigation__link:visited", "header product-name stylesheet");
includes(headerServiceBrandCss, ".govuk-service-navigation__link[aria-current=\"page\"]:visited", "header product-name stylesheet");
includes(headerServiceBrandCss, "/* transparency begins in the cascade */", "header product-name stylesheet");
excludes(headerServiceBrandCss, "box-shadow: 0 3px 0 #ffffff;", "header product-name stylesheet");

includes(headerPartial, "class=\"govuk-skip-link\" href=\"#main-content\"", "shared header partial");
includes(headerPartial, "href=\"/css/govuk/govuk-header-service-brand.css\"", "shared header partial");
includes(headerPartial, "class=\"govuk-header\" role=\"banner\" data-module=\"govuk-header\"", "shared header partial");
includes(headerPartial, "class=\"govuk-header__container govuk-width-container\"", "shared header partial");
includes(headerPartial, "class=\"govuk-header__homepage-link\"", "shared header partial");
includes(headerPartial, "<svg", "shared header partial");
includes(headerPartial, "role=\"img\"", "shared header partial");
includes(headerPartial, "viewBox=\"0 0 324 60\"", "shared header partial");
includes(headerPartial, "height=\"30\"", "shared header partial");
includes(headerPartial, "width=\"162\"", "shared header partial");
includes(headerPartial, "fill=\"currentcolor\"", "shared header partial");
includes(headerPartial, "class=\"govuk-header__logotype\"", "shared header partial");
includes(headerPartial, "aria-label=\"GOV.UK\"", "shared header partial");
includes(headerPartial, "<title>GOV.UK</title>", "shared header partial");
includes(headerPartial, "class=\"govuk-logo-dot\"", "shared header partial");
includes(headerPartial, "class=\"govuk-header__product-name\"", "shared header partial");
includes(headerPartial, "ResearchOps Demo Suite", "shared header partial");
excludes(headerPartial, "<span class=\"govuk-header__logotype\"", "shared header partial");
excludes(headerPartial, "class=\"govuk-header__service-name\"", "shared header partial");
includes(headerPartial, "class=\"govuk-service-navigation\"", "shared header partial");
includes(headerPartial, "data-module=\"govuk-service-navigation\"", "shared header partial");
includes(headerPartial, "aria-label=\"Service information\"", "shared header partial");
excludes(headerPartial, "class=\"govuk-service-navigation__service-name\"", "shared header partial");
excludes(headerPartial, "{{#title}}{{title}}{{/title}}{{^title}}ResearchOps Demo Suite{{/title}}", "shared header partial");
includes(headerPartial, "class=\"govuk-service-navigation__wrapper\"", "shared header partial");
includes(headerPartial, "class=\"govuk-service-navigation__toggle govuk-js-service-navigation-toggle\"", "shared header partial");
includes(headerPartial, "class=\"govuk-service-navigation__list\"", "shared header partial");
includes(headerPartial, "data-active=\"{{active}}\"", "shared header partial");
includes(headerPartial, "data-nav=\"Home\"", "shared header partial");
includes(headerPartial, "data-nav=\"Start Research Project\"", "shared header partial");
includes(headerPartial, "data-nav=\"Projects\"", "shared header partial");
includes(headerPartial, "class=\"govuk-phase-banner govuk-width-container\"", "shared header partial");
includes(headerPartial, "Do not enter real participant personal data", "shared header partial");
includes(headerPartial, "ensurePageChromeStylesheet", "shared header partial");
includes(headerPartial, "ensureMainContentTarget", "shared header partial");
includes(headerPartial, "initServiceNavigation", "shared header partial");
includes(headerPartial, "main.classList.add(\"govuk-main-wrapper\")", "shared header partial");
includes(headerPartial, "target.id = \"main-content\"", "shared header partial");
excludes(headerPartial, "main.setAttribute(\"id\", \"main-content\")", "shared header partial");
excludes(headerPartial, "class=\"rops-header\"", "shared header partial");
excludes(headerPartial, "class=\"nav govuk-body\"", "shared header partial");

includes(layoutSource, "govuk-service-navigation__item--active", "layout helper");
includes(layoutSource, "aria-current", "layout helper");
includes(layoutSource, "\"true\"", "layout helper");

includes(footerPartial, "class=\"govuk-footer\" role=\"contentinfo\"", "shared footer partial");
includes(footerPartial, "class=\"govuk-footer__container\"", "shared footer partial");
includes(footerPartial, "class=\"govuk-footer__meta\"", "shared footer partial");
excludes(footerPartial, "<hr", "shared footer partial");

for (const pagePath of pagesUsingSharedChrome) {
  const source = fs.readFileSync(pagePath, "utf8");

  includes(source, "src=\"/partials/header.html\"", pagePath);
  includes(source, "src=\"/partials/footer.html\"", pagePath);
  includes(source, "<main", pagePath);
  excludes(source, "class=\"rops-header\"", pagePath);
}
