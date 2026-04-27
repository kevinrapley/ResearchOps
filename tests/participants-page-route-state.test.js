import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/participants/index.html", "utf8");
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

includes(pageSource, "href=\"/css/screen.css\"", "participants page");
includes(pageSource, "href=\"/css/govuk/govuk-buttons.css\"", "participants page");
includes(pageSource, "href=\"/css/participants.css\"", "participants page");
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
includes(pageSource, "participants-rendered", "participants page");
includes(pageSource, "participants_rendered", "participants page");
excludes(pageSource, "class=\"btn", "participants page");
excludes(pageSource, "href=\"/css/participants.css\" media=\"print\"", "participants page");

includes(buttonCssSource, ".govuk-button", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--secondary", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--warning", "GOV.UK button stylesheet");

includes(stylesheetSource, ":root", "participants stylesheet");
includes(stylesheetSource, ".grid", "participants stylesheet");
includes(stylesheetSource, ".card", "participants stylesheet");
includes(stylesheetSource, ".table", "participants stylesheet");
includes(stylesheetSource, ".table__header", "participants stylesheet");
includes(stylesheetSource, ".table__row", "participants stylesheet");
includes(stylesheetSource, ".empty-state", "participants stylesheet");
includes(stylesheetSource, ".form", "participants stylesheet");
includes(stylesheetSource, ".form__actions", "participants stylesheet");
includes(stylesheetSource, ".badge", "participants stylesheet");
includes(stylesheetSource, ".pill", "participants stylesheet");
includes(stylesheetSource, "/* transparency begins in the cascade */", "participants stylesheet");

includes(participantsModuleSource, "participants-rendered", "participants module");
includes(participantsModuleSource, "participants_rendered", "participants module");
includes(participantsModuleSource, "class=\"govuk-button govuk-button--secondary\"", "participants module");
excludes(participantsModuleSource, "class=\"btn", "participants module");

includes(schedulerSource, "scheduleForm", "participants scheduler");
includes(schedulerSource, "sessionsTable", "participants scheduler");
includes(schedulerSource, "class=\"govuk-button govuk-button--secondary\"", "participants scheduler");
excludes(schedulerSource, "class=\"btn", "participants scheduler");
