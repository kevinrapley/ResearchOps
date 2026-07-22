import assert from "node:assert/strict";
import fs from "node:fs";

const studyNewTemplateSource = fs.readFileSync("src/govuk/templates/pages/study-new.njk", "utf8");
const participantTemplateSource = fs.readFileSync("src/govuk/templates/pages/project-dashboard-participants.njk", "utf8");
const participantImportTemplateSource = fs.readFileSync("src/govuk/templates/pages/project-dashboard-participants-import.njk", "utf8");
const projectDashboardTemplateSource = fs.readFileSync("src/govuk/templates/pages/project-dashboard.njk", "utf8");
const studyNewControllerSource = fs.readFileSync("public/pages/study/new/study-new.js", "utf8");
const participantControllerSource = fs.readFileSync("public/pages/project-dashboard/participants/participants-project.js", "utf8");
const participantImportControllerSource = fs.readFileSync("public/pages/project-dashboard/participants/import/import-participants.js", "utf8");
const dashboardContextSource = fs.readFileSync("public/js/project-dashboard-context.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}


includes(studyNewTemplateSource, "{% from \"govuk/components/breadcrumbs/macro.njk\" import govukBreadcrumbs %}", "study new template");
includes(studyNewTemplateSource, "{% from \"govuk/components/button/macro.njk\" import govukButton %}", "study new template");
includes(studyNewTemplateSource, "{% from \"govuk/components/error-summary/macro.njk\" import govukErrorSummary %}", "study new template");
includes(studyNewTemplateSource, "{% from \"govuk/components/input/macro.njk\" import govukInput %}", "study new template");
includes(studyNewTemplateSource, "{% from \"govuk/components/select/macro.njk\" import govukSelect %}", "study new template");
includes(studyNewTemplateSource, "{% from \"govuk/components/textarea/macro.njk\" import govukTextarea %}", "study new template");
includes(studyNewTemplateSource, "id: \"study-breadcrumbs\"", "study new template");
includes(studyNewTemplateSource, "value: \"\"", "study new template");
includes(studyNewTemplateSource, "href: \"/pages/project-dashboard/?id=\"", "study new template");
excludes(studyNewTemplateSource, "Back to project dashboard", "study new template");
excludes(studyNewTemplateSource, "id=\"back-to-project\"", "study new template");
excludes(studyNewTemplateSource, "?pid=", "study new template");

includes(participantTemplateSource, "{% from \"govuk/components/breadcrumbs/macro.njk\" import govukBreadcrumbs %}", "participant template");
includes(participantTemplateSource, "{% from \"govuk/components/button/macro.njk\" import govukButton %}", "participant template");
includes(participantTemplateSource, "{% from \"govuk/components/input/macro.njk\" import govukInput %}", "participant template");
includes(participantTemplateSource, "{% from \"govuk/components/select/macro.njk\" import govukSelect %}", "participant template");
includes(participantTemplateSource, "{% from \"govuk/components/textarea/macro.njk\" import govukTextarea %}", "participant template");
includes(participantTemplateSource, "id: \"participant-breadcrumbs\"", "participant template");
includes(participantTemplateSource, "href=\"/pages/study/new/?id=\"", "participant template");
excludes(participantTemplateSource, "?pid=", "participant template");

includes(participantImportTemplateSource, "{% from \"govuk/components/breadcrumbs/macro.njk\" import govukBreadcrumbs %}", "participant import template");
includes(participantImportTemplateSource, "{% from \"govuk/components/button/macro.njk\" import govukButton %}", "participant import template");
includes(participantImportTemplateSource, "{% from \"govuk/components/error-summary/macro.njk\" import govukErrorSummary %}", "participant import template");
includes(participantImportTemplateSource, "{% from \"govuk/components/file-upload/macro.njk\" import govukFileUpload %}", "participant import template");
includes(participantImportTemplateSource, "{% from \"govuk/components/select/macro.njk\" import govukSelect %}", "participant import template");
includes(participantImportTemplateSource, "id: \"participant-import-breadcrumbs\"", "participant import template");
includes(participantImportTemplateSource, "href=\"/pages/study/new/?id=\"", "participant import template");
excludes(participantImportTemplateSource, "href=\"/css/screen.css\"", "participant import template");
excludes(participantImportTemplateSource, "?pid=", "participant import template");

includes(projectDashboardTemplateSource, "href: \"/pages/project-dashboard/participants/?id=\"", "project dashboard template");
includes(projectDashboardTemplateSource, "href: \"/pages/project-dashboard/participants/import/?id=\"", "project dashboard template");
includes(projectDashboardTemplateSource, "href: \"/pages/study/new/?id=\"", "project dashboard template");
excludes(projectDashboardTemplateSource, "href: \"/pages/project-dashboard/participants/?pid=\"", "project dashboard template");
excludes(projectDashboardTemplateSource, "href: \"/pages/project-dashboard/participants/import/?pid=\"", "project dashboard template");
excludes(projectDashboardTemplateSource, "href: \"/pages/study/new/?pid=\"", "project dashboard template");

includes(studyNewControllerSource, "function projectIdFromUrl()", "study new controller");
includes(studyNewControllerSource, "return new URLSearchParams(location.search).get(\"id\") || \"\";", "study new controller");
includes(studyNewControllerSource, "location.assign(`/pages/study/?id=${encodeURIComponent(studyId)}`);", "study new controller");
includes(studyNewControllerSource, "project_airtable_id: projectId", "study new controller");
includes(studyNewControllerSource, "credentials: \"include\"", "study new controller");
excludes(studyNewControllerSource, "get(\"pid\")", "study new controller");
excludes(studyNewControllerSource, "/pages/study/?pid=", "study new controller");
excludes(studyNewControllerSource, "sid=", "study new controller");
excludes(studyNewControllerSource, "back-to-project", "study new controller");
excludes(studyNewControllerSource, "rops-api.digikev-kevin-rapley.workers.dev", "study new controller");

includes(participantControllerSource, "createStudy.href = `/pages/study/new/?id=${encodeURIComponent(projectId)}`;", "participant controller");
includes(participantControllerSource, "location.assign(`/pages/study/participants/?id=${encodeURIComponent(studyId)}${suffix}`);", "participant controller");
excludes(participantControllerSource, "/pages/study/new/?pid=", "participant controller");
excludes(participantControllerSource, "/pages/study/participants/?pid=", "participant controller");

includes(participantImportControllerSource, "createStudy.href = `/pages/study/new/?id=${encodeURIComponent(projectId)}`;", "participant import controller");
includes(participantImportControllerSource, "location.assign(`/pages/study/participants/?id=${encodeURIComponent(studyId)}`);", "participant import controller");
excludes(participantImportControllerSource, "/pages/study/new/?pid=", "participant import controller");
excludes(participantImportControllerSource, "/pages/study/participants/?pid=", "participant import controller");

includes(dashboardContextSource, "[\"add-participant-link\", \"/pages/project-dashboard/participants/\", \"id\"]", "project dashboard context");
includes(dashboardContextSource, "[\"import-participants-link\", \"/pages/project-dashboard/participants/import/\", \"id\"]", "project dashboard context");
includes(dashboardContextSource, "[\"add-study-link\", \"/pages/study/new/\", \"id\"]", "project dashboard context");
excludes(dashboardContextSource, "[\"add-study-link\", \"/pages/study/new/\", \"pid\"]", "project dashboard context");
