import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/index.html", "utf8");
const templateSource = fs.readFileSync("src/govuk/templates/pages/study.njk", "utf8");
const controllerSource = fs.readFileSync("public/js/study-page.js", "utf8");
const descControllerSource = fs.readFileSync("public/pages/study/study-desc-controller.js", "utf8");
const studyCssSource = fs.readFileSync("public/css/study-page.css", "utf8");
const studyScssSource = fs.readFileSync("src/styles/study-page.scss", "utf8");
const buttonCssSource = fs.readFileSync("public/css/govuk/govuk-buttons.css", "utf8");
const rendererSource = fs.readFileSync("scripts/govuk/render-govuk-pages.mjs", "utf8");
const generatedCssTargetsSource = fs.readFileSync("scripts/styles/generated-css-targets.mjs", "utf8");
const formatWorkflowSource = fs.readFileSync(".github/workflows/format-pr.yml", "utf8");
const prettierIgnoreSource = fs.readFileSync(".prettierignore", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(templateSource, "govukBreadcrumbs({", "study template");
includes(templateSource, "govukButton({", "study template");
includes(templateSource, "govukDetails({", "study template");
includes(templateSource, "govukNotificationBanner({", "study template");
includes(templateSource, "govukSummaryList({", "study template");
includes(templateSource, "govukTaskList({", "study template");
includes(templateSource, "govukTextarea({", "study template");
includes(templateSource, "data-study-template=\"govuk-task-list\"", "study template");
includes(templateSource, "value: \"\"", "study template");
includes(templateSource, "id: \"back-to-project\"", "study template");
includes(templateSource, "id: \"edit-study\"", "study template");
includes(templateSource, "id: \"breadcrumb-project\"", "study template");
includes(templateSource, "id=\"description\"", "study template");
includes(templateSource, "id: \"desc-input\"", "study template");
includes(templateSource, "id: \"desc-cancel\"", "study template");
includes(templateSource, "id=\"kv-method\"", "study template");
includes(templateSource, "id=\"kv-status\"", "study template");
includes(templateSource, "id=\"kv-studyid\"", "study template");
includes(templateSource, "id=\"study-readiness-description-status\"", "study template");
includes(templateSource, "id=\"study-readiness-participant-consent-hint\"", "study template");
includes(templateSource, "id=\"link-session\"", "study template");
includes(templateSource, "id=\"link-consent-forms\"", "study template");
includes(templateSource, "id=\"link-participant-consent\"", "study template");
includes(templateSource, "id=\"link-participants\"", "study template");
includes(templateSource, "id=\"link-guides\"", "study template");
includes(templateSource, "id=\"link-synthesis\"", "study template");
excludes(templateSource, "study-task-card", "study template");
excludes(templateSource, "study-readiness-list", "study template");
excludes(templateSource, "readiness-item", "study template");
excludes(templateSource, "dashboard-hero", "study template");
excludes(templateSource, "actions-bar", "study template");

includes(rendererSource, "template: 'pages/study.njk'", "GOV.UK renderer");
includes(rendererSource, "output: 'public/pages/study/index.html'", "GOV.UK renderer");

includes(pageSource, "<html class=\"govuk-template\" lang=\"en\">", "study page");
includes(pageSource, "/assets/govuk/govuk-frontend.css", "study page");
includes(pageSource, "/js/study-page.js?v=study-record-id-routing-20260518", "study page");
includes(pageSource, "/css/study-page.css", "study page");
includes(pageSource, "class=\"govuk-button\"", "study page");
includes(pageSource, "class=\"govuk-button govuk-button--secondary\"", "study page");
includes(pageSource, "class=\"govuk-breadcrumbs\"", "study page");
includes(pageSource, "class=\"govuk-summary-list", "study page");
includes(pageSource, "class=\"govuk-task-list", "study page");
includes(pageSource, "class=\"govuk-details", "study page");
includes(pageSource, "class=\"govuk-textarea", "study page");
includes(pageSource, "id=\"study-error\"", "study page");
includes(pageSource, "role=\"alert\"", "study page");
includes(pageSource, "Study readiness", "study page");
includes(pageSource, "Study setup tasks", "study page");
includes(pageSource, "Study analysis tasks", "study page");
includes(pageSource, "Synthesize study evidence", "study page");
includes(pageSource, "Group evidence notes into working cluster groupings and create traceable study-level themes.", "study page");
includes(pageSource, "id=\"study-readiness-description-status\"", "study page");
includes(pageSource, "id=\"study-readiness-session-hint\"", "study page");
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
excludes(pageSource, "class=\"dashboard-hero", "study page");
excludes(pageSource, "class=\"actions-bar", "study page");
excludes(pageSource, "study-task-card", "study page");
excludes(pageSource, "study-readiness-list", "study page");
excludes(pageSource, "readiness-item", "study page");
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
includes(controllerSource, "function readinessTagClass", "study page controller");
includes(controllerSource, "study-readiness-${key}-status", "study page controller");
includes(controllerSource, "study-readiness-${key}-hint", "study page controller");
includes(controllerSource, "govuk-tag ${readinessTagClass(state)} study-readiness-status", "study page controller");
includes(controllerSource, "loadStudyCollection(\"/api/participant-consent\"", "study page controller");
includes(controllerSource, "participantConsentRecords", "study page controller");
includes(controllerSource, "consentMaterials", "study page controller");
includes(controllerSource, "participantConsent", "study page controller");
includes(controllerSource, "const studyParams = { id: studyId }", "study page controller");
includes(controllerSource, "const legacySessionParams = { pid: projectId, sid: studyId }", "study page controller");
includes(controllerSource, "route(\"/pages/study/guides/\", studyParams)", "study page controller");
includes(controllerSource, "route(\"/pages/study/participants/\", studyParams)", "study page controller");
includes(controllerSource, "route(\"/pages/study/participant-consent/\", studyParams)", "study page controller");
includes(controllerSource, "route(\"/pages/study/session/\", legacySessionParams)", "study page controller");
includes(controllerSource, "route(\"/pages/study/synthesis/\", studyParams)", "study page controller");
excludes(controllerSource, "querySelector(\".readiness-item__status\")", "study page controller");
excludes(controllerSource, "querySelector(\".readiness-item__body\")", "study page controller");
excludes(controllerSource, "route(\"/pages/synthesize/\", params)", "study page controller");
includes(controllerSource, "pid", "study page controller");
includes(controllerSource, "sid", "study page controller");
includes(controllerSource, "study:desc:save", "study page controller");
excludes(controllerSource, "alert(", "study page controller");

includes(studyScssSource, ".study-page", "study SCSS source");
includes(studyScssSource, ".study-action-bar", "study SCSS source");
includes(studyScssSource, ".study-readiness-task-list", "study SCSS source");
includes(studyScssSource, ".study-session-button", "study SCSS source");
includes(studyScssSource, ".govuk-task-list__item .govuk-tag", "study SCSS source");
includes(studyScssSource, "/* transparency begins in the cascade */", "study SCSS source");
excludes(studyScssSource, ".study-task-card", "study SCSS source");
excludes(studyScssSource, ".study-readiness-list", "study SCSS source");
excludes(studyScssSource, ".readiness-item", "study SCSS source");

includes(studyCssSource, ".study-page", "study css");
includes(studyCssSource, ".study-action-bar", "study css");
includes(studyCssSource, ".study-readiness-task-list", "study css");
includes(studyCssSource, ".govuk-task-list__item .govuk-tag", "study css");
includes(studyCssSource, "@media (max-width: 699px)", "study css");
includes(studyCssSource, "font-size: 32px;", "study css");
includes(studyCssSource, "overflow-wrap: anywhere;", "study css");
includes(studyCssSource, "width: 100%;", "study css");
includes(studyCssSource, "/* transparency begins in the cascade */", "study css");
excludes(studyCssSource, ".study-task-card", "study css");
excludes(studyCssSource, ".study-readiness-list", "study css");
excludes(studyCssSource, ".readiness-item", "study css");

includes(generatedCssTargetsSource, "name: 'Study page stylesheet'", "generated CSS targets");
includes(generatedCssTargetsSource, "source: 'src/styles/study-page.scss'", "generated CSS targets");
includes(generatedCssTargetsSource, "output: 'public/css/study-page.css'", "generated CSS targets");
includes(formatWorkflowSource, "public/css/study-page.css", "format workflow generated CSS paths");
includes(prettierIgnoreSource, "public/css/study-page.css", "prettierignore generated CSS list");
