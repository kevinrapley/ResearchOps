import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/participants/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/study-participants.njk", "utf8");
const rendererSource = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");
const stylesheetSource = fs.readFileSync("public/css/participants.css", "utf8");
const buttonCssSource = fs.readFileSync("public/css/govuk/govuk-buttons.css", "utf8");
const participantsModuleSource = fs.readFileSync("public/components/participants/participants-page.js", "utf8");
const schedulerSource = fs.readFileSync("public/pages/study/participants/scheduler.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

for (const macro of ["govukBreadcrumbs({", "govukButton({", "govukInput({", "govukSelect({", "govukTextarea({"]) {
	includes(templateSource, macro, "participants template");
}

includes(rendererSource, "template: 'pages/study-participants.njk'", "GOV.UK renderer");
includes(rendererSource, "output: 'public/pages/study/participants/index.html'", "GOV.UK renderer");

includes(pageSource, "href=\"/assets/govuk/govuk-frontend.css\"", "participants page");
includes(pageSource, "href=\"/css/participants.css\"", "participants page");
includes(pageSource, "data-study-subpage-template=\"participants\"", "participants page");
includes(pageSource, "id=\"study-participants-breadcrumbs\"", "participants page");
includes(pageSource, "typeof=\"schema:BreadcrumbList\"", "participants page");
includes(pageSource, "src=\"/components/participants/participants-page.js\" defer", "participants page");
includes(pageSource, "src=\"/pages/study/participants/scheduler.js\" defer", "participants page");
includes(pageSource, "class=\"govuk-button\"", "participants page");
includes(pageSource, "id=\"participants-tbody\"", "participants page");
includes(pageSource, "id=\"participantsEmpty\"", "participants page");
includes(pageSource, "id=\"participantsTableWrap\"", "participants page");
includes(pageSource, "id=\"addParticipantForm\"", "participants page");
includes(pageSource, "id=\"sessionsTable\"", "participants page");
includes(pageSource, "id=\"scheduleForm\"", "participants page");
includes(pageSource, "id=\"noParticipantsBanner\"", "participants page");
includes(pageSource, "id=\"scheduleBtn\"", "participants page");
excludes(pageSource, "class=\"btn", "participants page");
excludes(pageSource, "class=\"badge\"", "participants page");
excludes(pageSource, "Study:", "participants page");
excludes(pageSource, "class=\"empty card\"", "participants page");
excludes(pageSource, "class=\"card\"", "participants page");
excludes(pageSource, "href=\"/css/screen.css\"", "participants page");
excludes(pageSource, "href=\"/css/participants.css\" media=\"print\"", "participants page");

includes(buttonCssSource, ".govuk-button", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--secondary", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--warning", "GOV.UK button stylesheet");

includes(stylesheetSource, ".participants-section", "participants stylesheet");
includes(stylesheetSource, ".participants-section--form", "participants stylesheet");
includes(stylesheetSource, ".table-wrap", "participants stylesheet");
includes(stylesheetSource, ".form", "participants stylesheet");
includes(stylesheetSource, ".form__actions", "participants stylesheet");
excludes(stylesheetSource, ".card", "participants stylesheet");
excludes(stylesheetSource, ".badge", "participants stylesheet");
excludes(stylesheetSource, ".pill", "participants stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "participants stylesheet");

includes(participantsModuleSource, "participants-rendered", "participants module");
includes(participantsModuleSource, "participants_rendered", "participants module");
includes(participantsModuleSource, "class=\"govuk-button govuk-button--secondary\"", "participants module");
excludes(participantsModuleSource, "class=\"btn", "participants module");

includes(schedulerSource, "scheduleForm", "participants scheduler");
includes(schedulerSource, "sessionsTable", "participants scheduler");
includes(schedulerSource, "badge.textContent = title", "participants scheduler");
excludes(schedulerSource, "Study: ${title}", "participants scheduler");
includes(schedulerSource, "class=\"govuk-button govuk-button--secondary\"", "participants scheduler");
excludes(schedulerSource, "class=\"btn", "participants scheduler");
