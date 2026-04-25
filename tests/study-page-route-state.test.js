import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("public/pages/study/index.html", "utf8");
const controllerSource = fs.readFileSync("public/js/study-page.js", "utf8");
const descControllerSource = fs.readFileSync("public/pages/study/study-desc-controller.js", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pageSource, "/js/study-page.js", "study page");
includes(pageSource, "id=\"study-error\"", "study page");
includes(pageSource, "role=\"alert\"", "study page");
includes(pageSource, "Study readiness", "study page");
includes(pageSource, "Study setup tasks", "study page");
includes(pageSource, "id=\"link-session\"", "study page");
includes(pageSource, "id=\"link-guides\"", "study page");
includes(pageSource, "id=\"link-participants\"", "study page");
includes(pageSource, "id=\"desc-cancel\"", "study page");
excludes(pageSource, "alert(\"Could not load study.\")", "study page");
excludes(pageSource, "<script type=\"module\">", "study page");

includes(descControllerSource, "cancelBtnSel: '#desc-cancel'", "description controller");

includes(controllerSource, "const API_ORIGIN", "study page controller");
includes(controllerSource, "function apiUrl", "study page controller");
includes(controllerSource, "apiUrl(\"/api/projects\")", "study page controller");
includes(controllerSource, "apiUrl(\"/api/studies\")", "study page controller");
includes(controllerSource, "showError", "study page controller");
includes(controllerSource, "renderReadiness", "study page controller");
includes(controllerSource, "route(\"/pages/study/guides/\", params)", "study page controller");
includes(controllerSource, "route(\"/pages/study/participants/\", params)", "study page controller");
includes(controllerSource, "route(\"/pages/study/session/\", params)", "study page controller");
includes(controllerSource, "pid", "study page controller");
includes(controllerSource, "sid", "study page controller");
includes(controllerSource, "study:desc:save", "study page controller");
includes(controllerSource, "/api/studies/${encodeURIComponent(studyId)}", "study page controller");
excludes(controllerSource, "alert(", "study page controller");
