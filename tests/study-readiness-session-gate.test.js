import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("public/pages/study/index.html", "utf8");
const controller = fs.readFileSync("public/js/study-page.js", "utf8");

function has(source, text, label) {
	assert.ok(source.includes(text), `${label} missing: ${text}`);
}

function lacks(source, text, label) {
	assert.ok(!source.includes(text), `${label} should not include: ${text}`);
}

const requiredPageText = [
	'data-readiness-item="session"',
	"Not available yet",
	"Complete study readiness tasks before beginning a session.",
	'id="link-session"',
	'aria-disabled="true"',
	'data-disabled-link="true"',
];

const requiredControllerText = [
	"async function loadReadinessContext",
	"function evaluateReadiness",
	"function renderSessionGate",
	"function isStudyReady",
	'loadStudyCollection("/api/participants", studyId, "participants")',
	'loadStudyCollection("/api/guides", studyId, "guides")',
	'loadStudyCollection("/api/consent-forms", studyId, "consentForms")',
	'disableLink("#link-session"',
	'enableLink("#link-session"',
	"event.target.closest(\"a[data-disabled-link='true']\")",
];

for (const text of requiredPageText) {
	has(page, text, "study page");
}

for (const text of requiredControllerText) {
	has(controller, text, "study page controller");
}

lacks(page, '<span class="readiness-item__status">Available</span>', "study page");
