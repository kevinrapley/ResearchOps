import assert from "node:assert/strict";
import fs from "node:fs";
import { publishedGovukPage } from './helpers/published-govuk-pages.mjs';

const pageSource = await publishedGovukPage("public/pages/study/participants/index.html");
const templateSource = fs.readFileSync("src/govuk/templates/pages/study-participants.njk", "utf8");
const stylesheetSource = fs.readFileSync("public/css/participants.css", "utf8");
const stylesheetScssSource = fs.readFileSync("src/styles/participants.scss", "utf8");
const generatedCssTargetsSource = fs.readFileSync("scripts/styles/generated-css-targets.mjs", "utf8");
const buttonCssSource = fs.readFileSync("public/css/govuk/govuk-buttons.css", "utf8");
const participantsModuleSource = fs.readFileSync("public/components/participants/participants-page.js", "utf8");
const schedulerSource = fs.readFileSync("public/pages/study/participants/scheduler.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

for (const macro of [
	"govukBreadcrumbs({",
	"govukButton({",
	"govukCheckboxes({",
	"govukDateInput({",
	"govukDetails({",
	"govukInput({",
	"govukInsetText({",
	"govukSelect({",
	"govukTextarea({",
]) {
	includes(templateSource, macro, "participants template");
}

includes(generatedCssTargetsSource, "source: 'src/styles/participants.scss'", "generated CSS targets");
includes(generatedCssTargetsSource, "output: 'public/css/participants.css'", "generated CSS targets");

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
includes(pageSource, "id=\"p_first_name\"", "participants page");
includes(pageSource, "id=\"p_family_name\"", "participants page");
includes(pageSource, "id=\"p_participant_ref\"", "participants page");
includes(pageSource, "Participant reference (optional)", "participants page");
includes(pageSource, "class=\"govuk-checkboxes\"", "participants page");
includes(pageSource, "id=\"p_channel\"", "participants page");
includes(pageSource, "name=\"channel_pref\"", "participants page");
includes(pageSource, "value=\"email\"", "participants page");
includes(pageSource, "value=\"sms\"", "participants page");
includes(pageSource, "value=\"phone\"", "participants page");
includes(pageSource, "id=\"sessionsTable\"", "participants page");
includes(pageSource, "id=\"scheduleForm\"", "participants page");
includes(pageSource, "id=\"noParticipantsBanner\"", "participants page");
includes(pageSource, "id=\"scheduleBtn\"", "participants page");
includes(pageSource, "class=\"govuk-date-input\"", "participants page");
includes(pageSource, "id=\"s_date-day\"", "participants page");
includes(pageSource, "id=\"s_date-month\"", "participants page");
includes(pageSource, "id=\"s_date-year\"", "participants page");
includes(pageSource, "id=\"s_time-hour\"", "participants page");
includes(pageSource, "id=\"s_time-minute\"", "participants page");
includes(pageSource, "govuk-grid-column-two-thirds", "participants page");
excludes(pageSource, "class=\"btn", "participants page");
excludes(pageSource, "class=\"badge\"", "participants page");
excludes(pageSource, "Study:", "participants page");
excludes(pageSource, "class=\"empty card\"", "participants page");
excludes(pageSource, "class=\"card\"", "participants page");
excludes(pageSource, "id=\"p_display\"", "participants page");
excludes(pageSource, "id=\"p_channel\" name=\"channel_pref\"><option", "participants page");
excludes(pageSource, "type=\"datetime-local\"", "participants page");
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
includes(stylesheetSource, "Repo:       /src/styles/participants.scss", "participants stylesheet");
includes(stylesheetSource, ".study-participants-page .govuk-input--width-2", "participants stylesheet");
includes(stylesheetSource, ".study-participants-page .govuk-input--width-4", "participants stylesheet");
excludes(stylesheetSource, ".card", "participants stylesheet");
excludes(stylesheetSource, ".badge", "participants stylesheet");
excludes(stylesheetSource, ".pill", "participants stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "participants stylesheet");

for (const text of [
	"Repo:       /src/styles/participants.scss",
	"Output:     /public/css/participants.css",
	".study-participants-page .govuk-input--width-2",
	".study-participants-page .govuk-input--width-4",
	".participants-section--form .govuk-grid-column-one-third",
	"/* transparency begins in the cascade */",
]) {
	includes(stylesheetScssSource, text, "participants SCSS source");
}

includes(participantsModuleSource, "participants-rendered", "participants module");
includes(participantsModuleSource, "participants_rendered", "participants module");
includes(participantsModuleSource, "class=\"govuk-button govuk-button--secondary\"", "participants module");
excludes(participantsModuleSource, "class=\"btn", "participants module");

includes(schedulerSource, "scheduleForm", "participants scheduler");
includes(schedulerSource, "sessionsTable", "participants scheduler");
includes(schedulerSource, "badge.textContent = title", "participants scheduler");
includes(schedulerSource, "function selectedChannelPreferences()", "participants scheduler");
includes(schedulerSource, "function sessionStartIsoFromFields()", "participants scheduler");
includes(schedulerSource, "const hourValue = fieldValue(\"#s_time-hour\")", "participants scheduler");
includes(schedulerSource, "const minuteValue = fieldValue(\"#s_time-minute\")", "participants scheduler");
includes(schedulerSource, "if (!dayValue || !monthValue || !yearValue || !hourValue || !minuteValue)", "participants scheduler");
includes(schedulerSource, "first_name: firstName", "participants scheduler");
includes(schedulerSource, "family_name: familyName", "participants scheduler");
includes(schedulerSource, "participant_ref: participantRef", "participants scheduler");
includes(schedulerSource, "channel_pref: channel", "participants scheduler");
includes(schedulerSource, "$(\"#s_date-day\")?.focus()", "participants scheduler");
excludes(schedulerSource, "Study: ${title}", "participants scheduler");
includes(schedulerSource, "class=\"govuk-button govuk-button--secondary\"", "participants scheduler");
excludes(schedulerSource, "class=\"btn", "participants scheduler");
excludes(schedulerSource, "#p_display", "participants scheduler");
excludes(schedulerSource, "#p_channel\")?.value", "participants scheduler");
excludes(schedulerSource, "#s_datetime", "participants scheduler");
