import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const BUNDLE_DIR = ".agent-operating-model/bundles/airtable-public-api";

function readBundleFile(relativePath) {
	return fs.readFileSync(`${BUNDLE_DIR}/${relativePath}`, "utf8");
}

function countCases(text) {
	return Array.from(text.matchAll(/^- id: /gm)).length;
}

test("Airtable bundle uses JSON schemas as the authoritative schema contracts", () => {
	assert.ok(fs.existsSync(`${BUNDLE_DIR}/grade.schema.json`));
	assert.ok(fs.existsSync(`${BUNDLE_DIR}/output.schema.json`));
	assert.equal(fs.existsSync(`${BUNDLE_DIR}/grade.schema.js`), false);
	assert.equal(fs.existsSync(`${BUNDLE_DIR}/output.schema.js`), false);

	const promptBody = readBundleFile("prompt.body.xml");
	const promptSpec = readBundleFile("prompt.spec.yaml");
	const manifest = readBundleFile("registry-manifest.yaml");

	for (const fileText of [promptBody, promptSpec, manifest]) {
		assert.doesNotMatch(fileText, /grade\.schema\.js/);
		assert.doesNotMatch(fileText, /output\.schema\.js/);
	}
});

test("Airtable eval orchestration declares pipelines and minimum coverage", () => {
	const evals = readBundleFile("evals.yaml");

	for (const expected of [
		"evaluation_system:",
		"endpoint-contract-response-pipeline",
		"operational-safety-pipeline",
		"schema-and-webhook-pipeline",
		"coverage_expectations:",
		"minimum_regression_cases: 18",
		"minimum_redteam_cases: 12",
		"schema_policy:",
	]) {
		assert.match(evals, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
	}
});

test("Airtable regression and red-team suites meet declared coverage minimums", () => {
	const evals = readBundleFile("evals.yaml");
	const regressionCases = countCases(readBundleFile("tests.regression.yaml"));
	const redteamCases = countCases(readBundleFile("tests.redteam.yaml"));

	assert.match(evals, /minimum_regression_cases: 18/);
	assert.match(evals, /minimum_redteam_cases: 12/);
	assert.ok(regressionCases >= 18, `expected at least 18 regression cases, got ${regressionCases}`);
	assert.ok(redteamCases >= 12, `expected at least 12 red-team cases, got ${redteamCases}`);
});

test("Airtable bundle records the operating-model hardening queue", () => {
	const queue = fs.readFileSync(".agent-operating-model/pr-queue.md", "utf8");

	for (const expected of [
		"Airtable bundle eval hardening and schema consolidation",
		"Bundle validation report standard",
		"Trace promotion tool",
		"Mural bundle incident backfill",
		"Multi-functional-team red-team expansion",
	]) {
		assert.match(queue, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
	}
});
