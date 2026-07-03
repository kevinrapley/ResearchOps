import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workerSource = fs.readFileSync("infra/cloudflare/src/worker.js", "utf8");
const serviceIndexSource = fs.readFileSync("infra/cloudflare/src/service/index.js", "utf8");
const sourcebookServiceSource = fs.readFileSync("infra/cloudflare/src/service/sourcebook.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

test("Sourcebook API service is composed into ResearchOpsService", () => {
	includes(serviceIndexSource, "import * as Sourcebook from \"./sourcebook.js\"", "service index");
	includes(serviceIndexSource, "readSourcebook = (origin)", "service index");
	includes(serviceIndexSource, "listSourcebookPillars = (origin, url)", "service index");
	includes(serviceIndexSource, "listSourcebookClauses = (origin, url)", "service index");
	includes(serviceIndexSource, "readSourcebookClause = (origin, clauseId)", "service index");
});

test("Sourcebook API Worker routes are declared and authenticated", () => {
	for (const text of [
		"[\"sourcebook.view\", \"View sourcebook\"",
		"[\"role_researcher\", \"sourcebook.view\"]",
		"[\"role_research_lead\", \"sourcebook.view\"]",
		"[\"role_team_admin\", \"sourcebook.view\"]",
		"[\"route_api_sourcebook_get\", \"GET\", \"/api/sourcebook\", \"[\\\"sourcebook.view\\\"]\", 1]",
		"[\"route_api_sourcebook_pillars_get\", \"GET\", \"/api/sourcebook/pillars\", \"[\\\"sourcebook.view\\\"]\", 1]",
		"[\"route_api_sourcebook_clauses_get\", \"GET\", \"/api/sourcebook/clauses\", \"[\\\"sourcebook.view\\\"]\", 1]",
		"[\"route_api_sourcebook_clause_get\", \"GET\", \"/api/sourcebook/clauses/:id\", \"[\\\"sourcebook.view\\\"]\", 1]",
		"requestForRoutePermission(request, \"/api/sourcebook/clauses/:id\")",
		"async function handleSourcebook",
		"await assertResearchDataRoutePermission(request, env, apiPath)",
		"service.readSourcebook(origin)",
		"service.listSourcebookPillars(origin, url)",
		"service.listSourcebookClauses(origin, url)",
		"service.readSourcebookClause(origin, decodeURIComponent(match[1]))",
		"apiPath === \"/api/sourcebook\" || apiPath.startsWith(\"/api/sourcebook/\")"
	]) {
		includes(workerSource, text, "Worker sourcebook routes");
	}
});

test("Sourcebook API service supports clause query dimensions", () => {
	for (const text of [
		"listSourcebookPillars",
		"listSourcebookClauses",
		"readSourcebookClause",
		"queryValues(url, \"pillar\")",
		"queryValues(url, \"route\", normaliseRoute)",
		"queryValues(url, \"evidence\", normaliseEvidence)",
		"queryValues(url, \"trigger\", normaliseEvidence)",
		"function parseTextMode",
		"const TEXT_MODES = new Set([\"summary\", \"title\", \"full\", \"verbose\"])",
		"function deriveTriggers",
		"sourcebook-index.json"
	]) {
		includes(sourcebookServiceSource, text, "Sourcebook service");
	}
});
