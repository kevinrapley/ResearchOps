import assert from "node:assert/strict";
import fs from "node:fs";

const tableCssSource = fs.readFileSync("public/css/govuk/govuk-tables.css", "utf8");
const dashboardPageSource = fs.readFileSync("public/pages/project-dashboard/index.html", "utf8");
const studyPageSource = fs.readFileSync("public/pages/study/index.html", "utf8");
const guidesPageSource = fs.readFileSync("public/pages/study/guides/index.html", "utf8");
const participantsPageSource = fs.readFileSync("public/pages/study/participants/index.html", "utf8");
const participantConsentPageSource = fs.readFileSync("public/pages/study/participant-consent/index.html", "utf8");
const participantsModuleSource = fs.readFileSync("public/components/participants/participants-page.js", "utf8");
const participantsSchedulerSource = fs.readFileSync("public/pages/study/participants/scheduler.js", "utf8");
const outcomesPageSource = fs.readFileSync("public/pages/projects/outcomes/index.html", "utf8");
const impactTrackerSource = fs.readFileSync("public/components/impact-tracker.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(tableCssSource, ".govuk-table", "GOV.UK table stylesheet");
includes(tableCssSource, ".govuk-table__caption", "GOV.UK table stylesheet");
includes(tableCssSource, ".govuk-table__head", "GOV.UK table stylesheet");
includes(tableCssSource, ".govuk-table__row", "GOV.UK table stylesheet");
includes(tableCssSource, ".govuk-table__header", "GOV.UK table stylesheet");
includes(tableCssSource, ".govuk-table__cell", "GOV.UK table stylesheet");
includes(tableCssSource, ".govuk-summary-list", "GOV.UK table stylesheet");
includes(tableCssSource, ".govuk-summary-list__row", "GOV.UK table stylesheet");
includes(tableCssSource, ".govuk-summary-list__key", "GOV.UK table stylesheet");
includes(tableCssSource, ".govuk-summary-list__value", "GOV.UK table stylesheet");

includes(dashboardPageSource, "href=\"/assets/govuk/govuk-frontend.css\"", "project dashboard page");
includes(dashboardPageSource, "<dl class=\"govuk-summary-list\">", "project dashboard page");
includes(dashboardPageSource, "class=\"govuk-summary-list__key\"", "project dashboard page");
includes(dashboardPageSource, "class=\"govuk-summary-list__value\" id=\"kv-service-stage\"", "project dashboard page");
includes(dashboardPageSource, "id=\"kv-lead-email\"", "project dashboard page");
excludes(dashboardPageSource, "href=\"/css/govuk/govuk-tables.css\"", "project dashboard page");
excludes(dashboardPageSource, "class=\"kv__list\"", "project dashboard page");
excludes(dashboardPageSource, "class=\"kv__term\"", "project dashboard page");
excludes(dashboardPageSource, "class=\"kv__desc\"", "project dashboard page");

includes(studyPageSource, "href=\"/css/govuk/govuk-tables.css\"", "study page");
includes(studyPageSource, "<dl class=\"govuk-summary-list\">", "study page");
includes(studyPageSource, "class=\"govuk-summary-list__value\" id=\"kv-method\"", "study page");
includes(studyPageSource, "class=\"govuk-summary-list__value\" id=\"kv-status\"", "study page");
includes(studyPageSource, "class=\"govuk-summary-list__value\" id=\"kv-studyid\"", "study page");
excludes(studyPageSource, "class=\"kv__list\"", "study page");
excludes(studyPageSource, "class=\"kv__term\"", "study page");
excludes(studyPageSource, "class=\"kv__desc\"", "study page");

includes(guidesPageSource, "href=\"/css/govuk/govuk-tables.css\"", "study guides page");
includes(guidesPageSource, "<table class=\"govuk-table\">", "study guides page");
includes(guidesPageSource, "<thead class=\"govuk-table__head\">", "study guides page");
includes(guidesPageSource, "<tbody id=\"guides-tbody\" class=\"govuk-table__body\">", "study guides page");
excludes(guidesPageSource, "<table class=\"table\" role=\"table\">", "study guides page");

includes(participantsPageSource, "href=\"/css/govuk/govuk-tables.css\"", "participants page");
includes(participantsPageSource, "<table id=\"participantsTable\" class=\"govuk-table\"", "participants page");
includes(participantsPageSource, "<tbody id=\"participants-tbody\" class=\"govuk-table__body\">", "participants page");
includes(participantsPageSource, "<table id=\"sessionsTable\" class=\"govuk-table\"", "participants page");
includes(participantsPageSource, "<tbody id=\"sessions-tbody\" class=\"govuk-table__body\"></tbody>", "participants page");
excludes(participantsPageSource, "role=\"table\"", "participants page");
excludes(participantsPageSource, "role=\"columnheader\"", "participants page");

includes(participantConsentPageSource, "href=\"/css/govuk/govuk-tables.css\"", "participant consent page");
includes(participantConsentPageSource, "class=\"govuk-table participant-consent-table\"", "participant consent page");
includes(participantConsentPageSource, "<tbody id=\"participant-consent-tbody\" class=\"govuk-table__body\">", "participant consent page");
includes(participantConsentPageSource, "class=\"participant-consent-summary govuk-summary-list\"", "participant consent page");
includes(participantConsentPageSource, "class=\"participant-consent-summary__key\"", "participant consent page");
includes(participantConsentPageSource, "class=\"participant-consent-summary__value\"", "participant consent page");

includes(participantsModuleSource, "document.createElement(\"tr\")", "participants module");
includes(participantsModuleSource, "govuk-table__row", "participants module");
includes(participantsModuleSource, "govuk-table__cell", "participants module");
includes(participantsModuleSource, "#participants-tbody", "participants module");
excludes(participantsModuleSource, "setAttribute(\"role\", \"row\")", "participants module");

includes(participantsSchedulerSource, "#sessions-tbody", "participants scheduler");
includes(participantsSchedulerSource, "document.createElement(\"tr\")", "participants scheduler");
includes(participantsSchedulerSource, "govuk-table__row", "participants scheduler");
includes(participantsSchedulerSource, "govuk-table__cell", "participants scheduler");
excludes(participantsSchedulerSource, "role=\"cell\"", "participants scheduler");

includes(outcomesPageSource, "href=\"/css/govuk/govuk-tables.css\"", "outcomes page");
includes(outcomesPageSource, "id=\"impact-table\" class=\"govuk-table govuk-!-margin-top-6 outcomes-table\"", "outcomes page");
includes(outcomesPageSource, "class=\"govuk-table__caption govuk-table__caption--m\"", "outcomes page");
includes(outcomesPageSource, "<tbody class=\"govuk-table__body\">", "outcomes page");

includes(impactTrackerSource, "govuk-table__row", "impact tracker component");
includes(impactTrackerSource, "govuk-table__cell", "impact tracker component");
includes(impactTrackerSource, "govuk-table__cell--numeric", "impact tracker component");
includes(impactTrackerSource, "cell.colSpan = 7;", "impact tracker component");
