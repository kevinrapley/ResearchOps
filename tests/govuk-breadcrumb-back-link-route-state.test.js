import assert from "node:assert/strict";
import fs from "node:fs";
import { publishedGovukPage } from './helpers/published-govuk-pages.mjs';

const pageChromeCss = fs.readFileSync("public/css/govuk/govuk-page-chrome.css", "utf8");
const projectContextSource = fs.readFileSync("public/js/project-context.js", "utf8");
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
		requiredIds: [],
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
		requiredIds: ["breadcrumb-project", "breadcrumb-study"],
		currentText: "Guides"
	},
	{
		label: "Consent Forms route",
		path: "public/pages/study/consent-forms/index.html",
		requiredIds: ["breadcrumb-project", "breadcrumb-study", "back-to-study"],
		currentText: "Consent forms"
	},
	{
		label: "Participant Consent route",
		path: "public/pages/study/participant-consent/index.html",
		requiredIds: ["breadcrumb-project", "breadcrumb-study"],
		currentText: "Participant consent"
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

function includesNormalised(source, text, label) {
	const normalisedSource = source.replace(/\s+/g, " ");
	const normalisedText = text.replace(/\s+/g, " ");
	assert.equal(
		normalisedSource.includes(normalisedText),
		true,
		`Expected ${label} to include normalised text: ${text}`
	);
}

includes(pageChromeCss, ".govuk-breadcrumbs", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-breadcrumbs__list", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-breadcrumbs__list-item", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-breadcrumbs__link", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-back-link", "page chrome stylesheet");
includes(pageChromeCss, ".govuk-back-link::before", "page chrome stylesheet");
includes(pageChromeCss, "#back-to-project.govuk-back-link", "page chrome stylesheet");
includes(pageChromeCss, "width: fit-content;", "page chrome stylesheet");
includes(pageChromeCss, "margin: 0 24px 24px auto;", "page chrome stylesheet");
includes(pageChromeCss, "#back-to-project.govuk-back-link::before", "page chrome stylesheet");
includes(pageChromeCss, "content: none;", "page chrome stylesheet");
excludes(pageChromeCss, ".breadcrumbs", "page chrome stylesheet");

includes(projectContextSource, "function hydrateProjectRouteContext", "project context hydrator");
includes(projectContextSource, "function findProjectBreadcrumb", "project context hydrator");
includes(projectContextSource, "document.getElementById(\"breadcrumb-project\")", "project context hydrator");
includes(projectContextSource, ".govuk-breadcrumbs__link[href=\"/pages/project-dashboard/\"]", "project context hydrator");
includes(projectContextSource, "document.getElementById(\"project-link\")", "project context hydrator");
includes(projectContextSource, "anchor.textContent = project.name || \"Project Dashboard\"", "project context hydrator");
includes(projectContextSource, "anchor.href = dashboardHref(projectId)", "project context hydrator");
includes(projectContextSource, "function ensureProjectActionBar", "project context hydrator");
includes(projectContextSource, "function setProjectParentLink", "project context hydrator");
includes(projectContextSource, "document.getElementById(\"back-to-project\")", "project context hydrator");
includes(projectContextSource, "Back to Project", "project context hydrator");

includes(migrationDoc, "# GOV.UK breadcrumb and back-link migration", "breadcrumb migration doc");
includes(migrationDoc, "Breadcrumbs show hierarchy", "breadcrumb migration doc");
includes(migrationDoc, "Back links return to a parent or previous step", "breadcrumb migration doc");
includes(migrationDoc, "Visible arrow characters", "breadcrumb migration doc");
includes(migrationDoc, "tests/govuk-breadcrumb-back-link-route-state.test.js", "breadcrumb migration doc");

for (const page of breadcrumbPages) {
	const source = await publishedGovukPage(page.path);

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

const studyPage = await publishedGovukPage("public/pages/study/index.html");
excludes(studyPage, "id=\"back-to-project\"", "Study route");
excludes(studyPage, "Back to Project", "Study route");

const outcomesPage = await publishedGovukPage("public/pages/projects/outcomes/index.html");
includes(outcomesPage, "rel=\"modulepreload\" href=\"/js/project-context.js?v=20260603-form-interactions\"", "Outcomes route");
includes(outcomesPage, "src=\"/js/project-context.js?v=20260603-form-interactions\"", "Outcomes route");
includes(outcomesPage, "id=\"breadcrumb-project\"", "Outcomes route");
excludes(outcomesPage, "id=\"back-to-project\"", "Outcomes route");
excludes(outcomesPage, ">Back to Project</a>", "Outcomes route");

const journalsPage = await publishedGovukPage("public/pages/projects/journals/index.html");
includes(journalsPage, "rel=\"modulepreload\" href=\"/js/project-context.js\"", "Journals route");
includes(journalsPage, "src=\"/js/project-context.js\"", "Journals route");
includes(journalsPage, "href=\"/pages/project-dashboard/\"", "Journals route");
includes(journalsPage, "Project Dashboard", "Journals route");
excludes(journalsPage, "id=\"back-to-project\"", "Journals route");
excludes(journalsPage, ">Back to Project</a>", "Journals route");

const guidesPage = await publishedGovukPage("public/pages/study/guides/index.html");
excludes(guidesPage, "id=\"back-to-study\"", "Guides route");
excludes(guidesPage, "Back to Study", "Guides route");

const consentFormsPage = await publishedGovukPage("public/pages/study/consent-forms/index.html");
includes(consentFormsPage, "id=\"back-to-study\"", "Consent Forms route");
includesNormalised(consentFormsPage, "Back to Study", "Consent Forms route");

const participantConsentPage = await publishedGovukPage("public/pages/study/participant-consent/index.html");
excludes(participantConsentPage, "id=\"back-to-study\"", "Participant Consent route");
excludes(participantConsentPage, "Back to Study", "Participant Consent route");
