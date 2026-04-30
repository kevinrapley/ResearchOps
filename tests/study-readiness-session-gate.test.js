import assert from "node:assert/strict";
import fs from "node:fs";

const studyPageSource = fs.readFileSync("public/pages/study/index.html", "utf8");
const studyControllerSource = fs.readFileSync("public/js/study-page.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(studyPageSource, "data-readiness-item=\"session\"", "study page");
includes(studyPageSource, "Not available yet", "study page");
includes(studyPageSource, "Complete study readiness tasks before beginning a session.", "study page");
includes(studyPageSource, "id=\"link-session\"", "study page");
includes(studyPageSource, "aria-disabled=\"true\"", "study page");
includes(studyPageSource, "data-disabled-link=\"true\"", "study page");
excludes(studyPageSource, "<span class=\"readiness-item__status\">Available</span>", "study page");

includes(studyControllerSource, "async function loadReadinessContext", "study page controller");
includes(studyControllerSource, "function evaluateReadiness", "study page controller");
includes(studyControllerSource, "function renderSessionGate", "study page controller");
includes(studyControllerSource, "function isStudyReady", "study page controller");
includes(studyControllerSource, "loadStudyCollection(\"/api/participants\", studyId, \"participants\")", "study page controller");
includes(studyControllerSource, "loadStudyCollection(\"/api/guides\", studyId, \"guides\")", "study page controller");
includes(studyControllerSource, "loadStudyCollection(\"/api/consent-forms\", studyId, \"consentForms\")", "study page controller");
includes(studyControllerSource, "disableLink(\"#link-session\"", "study page controller");
includes(studyControllerSource, "enableLink(\"#link-session\"", "study page controller");
includes(studyControllerSource, "event.target.closest(\"a[data-disabled-link='true']\")", "study page controller");
