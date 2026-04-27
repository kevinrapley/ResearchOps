import assert from "node:assert/strict";
import fs from "node:fs";

const pageChromeCss = fs.readFileSync("public/css/govuk/govuk-page-chrome.css", "utf8");
const migrationDoc = fs.readFileSync(
  "docs/design-system/govuk-breadcrumb-back-link-migration.md",
  "utf8"
);

const breadcrumbPages = [
  {
    label: "Project Dashboard route",
    path: "public/pages/project-dashboard/index.html",
    requiredIds: ["breadcrumb-project"],
    currentText: "Dashboard"
  },
  {
    label: "Outcomes route",
    path: "public/pages/projects/outcomes/index.html",
    requiredIds: ["breadcrumb-project"],
    currentText: "Impact &amp; ROI"
  },
  {
    label: "Journals route",
    path: "public/pages/projects/journals/index.html",
    requiredIds: ["project-link"],
    currentText: "Journal and analysis"
  },
  {
    label: "Study route",
    path: "public/pages/study/index.html",
    requiredIds: ["breadcrumb-project"],
    currentText: "Study"
  },
  {
    label: "Guides route",
    path: "public/pages/study/guides/index.html",
    requiredIds: ["breadcrumb-project", "breadcrumb-study", "back-to-study"],
    currentText: "Guides"
  },
  {
    label: "Consent Forms route",
    path: "public/pages/study/consent-forms/index.html",
    requiredIds: ["breadcrumb-project", "breadcrumb-study", "back-to-study"],
    currentText: "Consent forms"
  },
  {
    label: "Participants route",
    path: "public/pages/study/participants/index.html",
    requiredIds: ["breadcrumb-project", "breadcrumb-study"],
    currentText: "Participants"
  }
];

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageChromeCss, ".govuk-breadcrumbs", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-breadcrumbs__list", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-breadcrumbs__list-item", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-breadcrumbs__link", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-back-link", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-back-link::before", "page chrome stylesheet");
excludes(pageChromeCss, ".breadcrumbs", "page chrome stylesheet");

includes(migrationDoc, "# GOV.UK breadcrumb and back-link migration", "breadcrumb migration doc");
includes(migrationDoc, "Breadcrumbs show hierarchy", "breadcrumb migration doc");
includes(migrationDoc, "Back links return to a parent or previous step", "breadcrumb migration doc");
includes(migrationDoc, "Visible arrow characters", "breadcrumb migration doc");
includes(migrationDoc, "tests/govuk-breadcrumb-back-link-route-state.test.js", "breadcrumb migration doc");

for (const page of breadcrumbPages) {
  const source = fs.readFileSync(page.path, "utf8");

  includes(source, "class=\"govuk-breadcrumbs\"", page.label);
  includes(source, "aria-label=\"Breadcrumb\"", page.label);
  includes(source, "class=\"govuk-breadcrumbs__list\"", page.label);
  includes(source, "class=\"govuk-breadcrumbs__list-item\"", page.label);
  includes(source, "class=\"govuk-breadcrumbs__link\"", page.label);
  includes(source, "aria-current=\"page\"", page.label);
  includes(source, page.currentText, page.label);

  for (const id of page.requiredIds) {
    includes(source, `id=\"${id}\"`, page.label);
  }

  excludes(source, "class=\"breadcrumbs\"", page.label);
  excludes(source, "&rarr;", page.label);
  excludes(source, "← Back", page.label);
  excludes(source, "Back ←", page.label);
}

const studyPage = fs.readFileSync("public/pages/study/index.html", "utf8");
includes(studyPage, "id=\"back-to-project\"", "Study route");
includes(studyPage, ">Back to Project</a>", "Study route");

const guidesPage = fs.readFileSync("public/pages/study/guides/index.html", "utf8");
includes(guidesPage, "id=\"back-to-study\"", "Guides route");
includes(guidesPage, ">Back to Study</a>", "Guides route");

const consentFormsPage = fs.readFileSync("public/pages/study/consent-forms/index.html", "utf8");
includes(consentFormsPage, "id=\"back-to-study\"", "Consent Forms route");
includes(consentFormsPage, ">Back to Study</a>", "Consent Forms route");
