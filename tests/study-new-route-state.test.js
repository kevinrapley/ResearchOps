import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/new/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/study-new.njk", "utf8");
const controllerSource = fs.readFileSync("public/pages/study/new/study-new.js", "utf8");
const dashboardControllerSource = fs.readFileSync("public/js/project-dashboard.js", "utf8");
const renderGovukPagesSource = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(renderGovukPagesSource, "template: 'pages/study-new.njk'", "GOV.UK page renderer");
includes(renderGovukPagesSource, "output: 'public/pages/study/new/index.html'", "GOV.UK page renderer");

includes(templateSource, "{% from \"govuk/components/breadcrumbs/macro.njk\" import govukBreadcrumbs %}", "study new template");
includes(templateSource, "{% from \"govuk/components/button/macro.njk\" import govukButton %}", "study new template");
includes(templateSource, "{% from \"govuk/components/error-summary/macro.njk\" import govukErrorSummary %}", "study new template");
includes(templateSource, "{% from \"govuk/components/input/macro.njk\" import govukInput %}", "study new template");
includes(templateSource, "{% from \"govuk/components/select/macro.njk\" import govukSelect %}", "study new template");
includes(templateSource, "{% from \"govuk/components/textarea/macro.njk\" import govukTextarea %}", "study new template");
includes(templateSource, "govuk-!-width-two-thirds", "study new template");
includes(templateSource, "govuk-!-margin-top-6", "study new template");
includes(templateSource, "href: \"/pages/project-dashboard/?id=\"", "study new template");
excludes(templateSource, "Back to project dashboard", "study new template");
excludes(templateSource, "id=\"back-to-project\"", "study new template");
excludes(templateSource, "?pid=", "study new template");

includes(pageSource, "class=\"govuk-template\"", "study new page");
includes(pageSource, "href=\"/assets/govuk/govuk-frontend.css\"", "study new page");
includes(pageSource, "<x-include src=\"/partials/header.html\"", "study new page");
includes(pageSource, "<x-include src=\"/partials/footer.html\"></x-include>", "study new page");
includes(pageSource, "id=\"study-breadcrumbs\"", "study new page");
includes(pageSource, "id=\"study-error-summary\"", "study new page");
includes(pageSource, "name=\"project_airtable_id\"", "study new page");
includes(pageSource, "id=\"study-title-input\"", "study new page");
includes(pageSource, "id=\"study-method\"", "study new page");
includes(pageSource, "id=\"study-notes\"", "study new page");
includes(pageSource, "id=\"study-submit\"", "study new page");
includes(pageSource, "id=\"cancel-study\"", "study new page");
excludes(pageSource, "href=\"/css/screen.css\"", "study new page");
excludes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "study new page");
excludes(pageSource, "Back to project dashboard", "study new page");
excludes(pageSource, "id=\"back-to-project\"", "study new page");
excludes(pageSource, "?pid=", "study new page");

includes(controllerSource, "function projectIdFromUrl()", "study new controller");
includes(controllerSource, "return new URLSearchParams(location.search).get(\"id\") || \"\";", "study new controller");
includes(controllerSource, "location.assign(`/pages/study/?id=${encodeURIComponent(studyId)}`);", "study new controller");
includes(controllerSource, "project_airtable_id: projectId", "study new controller");
includes(controllerSource, "credentials: \"include\"", "study new controller");
excludes(controllerSource, "get(\"pid\")", "study new controller");
excludes(controllerSource, "/pages/study/?pid=", "study new controller");
excludes(controllerSource, "sid=", "study new controller");
excludes(controllerSource, "back-to-project", "study new controller");
excludes(controllerSource, "rops-api.digikev-kevin-rapley.workers.dev", "study new controller");

includes(dashboardControllerSource, "setLinkHref(\"add-study-link\", `/pages/study/new/?id=${encodeURIComponent(projectId)}`);", "project dashboard controller");
excludes(dashboardControllerSource, "setLinkHref(\"add-study-link\", `/pages/study/new/?pid=${encodeURIComponent(projectId)}`);", "project dashboard controller");
