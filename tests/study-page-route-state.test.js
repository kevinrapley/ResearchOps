import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/index.html", "utf8");
const controllerSource = fs.readFileSync("public/js/study-page.js", "utf8");
const descControllerSource = fs.readFileSync("public/pages/study/study-desc-controller.js", "utf8");
const studyCssSource = fs.readFileSync("public/css/study-page.css", "utf8");
const buttonCssSource = fs.readFileSync("public/css/govuk/govuk-buttons.css", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "<html lang=\"en-GB\">", "study page");
includes(pageSource, "/js/study-page.js", "study page");
includes(pageSource, "/css/govuk/govuk-buttons.css", "study page");
includes(pageSource, "/css/study-page.css", "study page");
includes(pageSource, "class=\"govuk-button\"", "study page");
includes(pageSource, "class=\"govuk-button govuk-button--secondary\"", "study page");
includes(pageSource, "id=\"study-error\"", "study page");
includes(pageSource, "role=\"alert\"", "study page");
includes(pageSource, "Study readiness", "study page");
includes(pageSource, "Study setup tasks", "study page");
includes(pageSource, "Study analysis tasks", "study page");
includes(pageSource, "Synthesize study evidence", "study page");
includes(pageSource, "Group evidence notes into working cluster groupings and create traceable study-level themes.", "study page");
includes(pageSource, "class=\"study-readiness-list\"", "study page");
includes(pageSource, "class=\"readiness-item\"", "study page");
includes(pageSource, "data-readiness-item=\"consent-materials\"", "study page");
includes(pageSource, "data-readiness-item=\"participant-consent\"", "study page");
includes(pageSource, "Consent materials", "study page");
includes(pageSource, "Participant consent", "study page");
includes(pageSource, "class=\"study-task-list\"", "study page");
includes(pageSource, "class=\"study-task-card", "study page");
includes(pageSource, "id=\"link-session\"", "study page");
includes(pageSource, "id=\"link-guides\"", "study page");
includes(pageSource, "id=\"link-participants\"", "study page");
includes(pageSource, "id=\"link-participant-consent\"", "study page");
includes(pageSource, "id=\"link-synthesis\"", "study page");
includes(pageSource, "id=\"desc-cancel\"", "study page");
includes(pageSource, "aria-disabled=\"true\"", "study page");
includes(pageSource, "data-disabled-link=\"true\"", "study page");
includes(pageSource, "Not available yet", "study page");
excludes(pageSource, "class=\"btn", "study page");
excludes(pageSource, "class=\"board\"", "study page");
excludes(pageSource, "board__item study-action", "study page");
excludes(pageSource, "Requires study context", "study page");
excludes(pageSource, "<script type=\"module\">", "study page");

includes(buttonCssSource, ".govuk-button", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--secondary", "GOV.UK button stylesheet");
includes(buttonCssSource, ".govuk-button--warning", "GOV.UK button stylesheet");

includes(descControllerSource, "cancelBtnSel: '#desc-cancel'", "description controller");

includes(controllerSource, "const API_ORIGIN", "study page controller");
includes(controllerSource, "function apiUrl", "study page controller");
includes(controllerSource, "apiUrl(\"/api/projects\")", "study page controller");
includes(controllerSource, "apiUrl(\"/api/studies\")", "study page controller");
includes(controllerSource, "showError", "study page controller");
includes(controllerSource, "renderReadiness", "study page controller");
includes(controllerSource, "async function loadReadinessContext", "study page controller");
includes(controllerSource, "function evaluateReadiness", "study page controller");
includes(controllerSource, "function renderSessionGate", "study page controller");
includes(controllerSource, "function disableLink", "study page controller");
includes(controllerSource, "loadStudyCollection(\"/api/participant-consent\"", "study page controller");
includes(controllerSource, "participantConsentRecords", "study page controller");
includes(controllerSource, "consentMaterials", "study page controller");
includes(controllerSource, "participantConsent", "study page controller");
includes(controllerSource, "route(\"/pages/study/guides/\", params)", "study page controller");
includes(controllerSource, "route(\"/pages/study/participants/\", params)", "study page controller");
includes(controllerSource, "route(\"/pages/study/participant-consent/\", params)", "study page controller");
includes(controllerSource, "route(\"/pages/study/session/\", params)", "study page controller");
includes(controllerSource, "route(\"/pages/synthesize/\", params)", "study page controller");
includes(controllerSource, "pid", "study page controller");
includes(controllerSource, "sid", "study page controller");
includes(controllerSource, "study:desc:save", "study page controller");
excludes(controllerSource, "alert(", "study page controller");

includes(studyCssSource, ".study-task-list", "study css");
includes(studyCssSource, ".study-task-card", "study css");
includes(studyCssSource, ".study-readiness-list", "study css");
includes(studyCssSource, ".readiness-item__status", "study css");
includes(studyCssSource, "/* transparency begins in the cascade */", "study css");
