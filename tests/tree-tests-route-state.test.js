import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const includes = (source, text, label) => assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);

const service = read("infra/cloudflare/src/service/tree-tests.js");
const serviceIndex = read("infra/cloudflare/src/service/index.js");
const router = read("infra/cloudflare/src/core/router.js");
const worker = read("infra/cloudflare/src/worker.js");
const migration = read("infra/cloudflare/migrations/0028_tree_tests.sql");
const setupPage = read("public/pages/study/tree-test/index.html");
const setupController = read("public/js/study-tree-test-page.js");
const sessionPage = read("public/pages/study/session/index.html");
const sessionController = read("public/components/session-tree-test-controller.js");
const studyPage = read("public/pages/study/index.html");
const studyController = read("public/js/study-page.js");

includes(service, "rops_tree_test_configs", "Tree Test service");
includes(service, "rops_tree_test_results", "Tree Test service");
includes(service, "getTreeTestConfig", "Tree Test service");
includes(service, "saveTreeTestConfig", "Tree Test service");
includes(service, "createTreeTestResult", "Tree Test service");
includes(serviceIndex, 'import * as TreeTests from "./tree-tests.js"', "service index");
includes(router, '"/api/tree-tests/config"', "router");
includes(router, '"/api/tree-tests/results"', "router");
includes(worker, "route_api_tree_tests_config_get", "Worker permission register");
includes(worker, 'requestForRoutePermission(request, "/api/tree-tests/results/:id")', "Worker route permission");
includes(migration, "CREATE TABLE IF NOT EXISTS rops_tree_test_configs", "D1 migration");
includes(migration, "CREATE TABLE IF NOT EXISTS rops_tree_test_results", "D1 migration");

includes(setupPage, "Prepare the tree test", "Tree Test setup page");
includes(setupPage, 'id="tree-test-tree"', "Tree Test setup page");
includes(setupPage, 'id="tree-test-task-list"', "Tree Test setup page");
includes(setupController, "/api/tree-tests/config", "Tree Test setup controller");
includes(setupController, "parseTree", "Tree Test setup controller");

includes(sessionPage, 'id="tree-test-section"', "session page");
includes(sessionPage, 'id="tree-test-tree-nav"', "session page");
includes(sessionPage, "/components/session-tree-test-controller.js", "session page");
includes(sessionController, "/api/tree-tests/config", "session controller");
includes(sessionController, "/api/tree-tests/results", "session controller");
includes(sessionController, "Choose this location", "session controller");
includes(sessionController, "correct", "session controller");
includes(sessionController, "elapsed_ms", "session controller");
includes(sessionController, "tree-test-node__children", "session controller nested tree view");
includes(sessionController, 'aria-expanded', "session controller expandable tree controls");
assert.equal(sessionController.includes('result.correct ? "Correct" : "Incorrect"'), false, "session controller must not disclose task correctness to participants");
assert.equal(sessionController.includes('home.textContent = "Home"'), false, "session controller must not render a Home breadcrumb button");

includes(studyPage, 'id="link-tree-test"', "study page");
includes(studyController, "renderTreeTestTask", "study controller");
includes(studyController, "/pages/study/tree-test/", "study controller");
