/**
 * @file validate-runtime-and-route-state.mjs
 * @summary Restores runtime import and route-state validation checks used by the repository validation contract.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const SKIP_DIRS = new Set([".git", "node_modules", "playwright-report", "test-results"]);

function fail(message) {
	console.error(`validate: ${message}`);
	process.exit(1);
}

function info(message) {
	console.log(`validate: ${message}`);
}

function walkFiles(directory, predicate, results = []) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (SKIP_DIRS.has(entry.name)) {
			continue;
		}

		const fullPath = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			walkFiles(fullPath, predicate, results);
			continue;
		}

		if (entry.isFile() && predicate(fullPath)) {
			results.push(fullPath);
		}
	}

	return results;
}

function relativePath(filePath) {
	return path.relative(ROOT_DIR, filePath).replaceAll(path.sep, "/");
}

function run(command, args, label) {
	try {
		execFileSync(command, args, { stdio: "inherit" });
	} catch {
		fail(label);
	}
}

info("checking JSON files");
for (const file of walkFiles(ROOT_DIR, (filePath) => filePath.endsWith(".json"))) {
	try {
		JSON.parse(fs.readFileSync(file, "utf8"));
	} catch {
		fail(`invalid JSON: ${relativePath(file)}`);
	}
}

info("checking JavaScript syntax");
for (const file of walkFiles(
	ROOT_DIR,
	(filePath) => filePath.endsWith(".js") || filePath.endsWith(".mjs"),
)) {
	run("node", ["--check", file], `invalid JavaScript syntax: ${relativePath(file)}`);
}

info("checking performance audit command");
run("bash", ["-n", "./scripts/performance-audit.sh"], "invalid shell syntax: scripts/performance-audit.sh");
run("bash", ["./scripts/performance-audit.sh", "--json"], "performance audit command failed");

info("checking Worker module import");
const worker = await import("../infra/cloudflare/src/worker.js");

if (!worker.default || typeof worker.default.fetch !== "function") {
	fail("Worker default export must expose fetch(request, env, ctx)");
}

info("checking router module import");
const router = await import("../infra/cloudflare/src/core/router.js");

if (typeof router.handleRequest !== "function") {
	fail("router module must export handleRequest(request, env, ctx)");
}

info("checking service module import");
const service = await import("../infra/cloudflare/src/service/index.js");

if (typeof service.ResearchOpsService !== "function") {
	fail("service module must export ResearchOpsService");
}

const routeStateTests = [
	"tests/govuk-design-system-baseline-route-state.test.js",
	"tests/govuk-forms-application-route-state.test.js",
	"tests/govuk-tables-summary-lists-application-route-state.test.js",
	"tests/govuk-page-chrome-navigation-route-state.test.js",
	"tests/govuk-breadcrumb-back-link-route-state.test.js",
	"tests/auth-foundation-route-state.test.js",
	"tests/auth-route-permissions.test.js",
	"tests/auth-runtime-bootstrap-route-state.test.js",
	"tests/auth-role-assignment-api-route-state.test.js",
	"tests/auth-role-assignment-ui-route-state.test.js",
	"tests/auth-sign-in-route-state.test.js",
	"tests/auth-account-dashboard-route-state.test.js",
	"tests/projects-route-contract.test.js",
	"tests/projects-page-route-state.test.js",
	"tests/project-dashboard-route-state.test.js",
	"tests/outcomes-page-route-state.test.js",
	"tests/mural-ui-route-state.test.js",
	"tests/journals-project-route-contract.test.js",
	"tests/journals-route-state.test.js",
	"tests/journal-tabs-api-origin-route-state.test.js",
	"tests/journal-tabs-filter-state-route-state.test.js",
	"tests/journal-tabs-resilience-route-state.test.js",
	"tests/journal-secondary-actions-route-state.test.js",
	"tests/mural-journal-sync-route-state.test.js",
	"tests/study-page-route-state.test.js",
	"tests/study-guides-route-state.test.js",
	"tests/study-session-route-state.test.js",
	"tests/search-page-route-state.test.js",
	"tests/notes-page-route-state.test.js",
	"tests/synthesize-page-route-state.test.js",
	"tests/start-page-route-state.test.js",
	"tests/participants-page-route-state.test.js",
	"tests/consent-forms-route-state.test.js",
	"tests/participant-consent-route-state.test.js",
];

for (const testFile of routeStateTests) {
	info(`checking ${testFile}`);
	run("node", [testFile], `route-state validation failed: ${testFile}`);
}
