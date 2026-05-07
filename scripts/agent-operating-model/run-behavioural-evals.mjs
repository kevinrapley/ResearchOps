/**
 * @file run-behavioural-evals.mjs
 * @module RunBehaviouralEvals
 * @summary Runs behavioural trace evals against the repository operating model loader.
 */

import fs from "node:fs";
import path from "node:path";
import { loadOperatingModel } from "./load-operating-model.mjs";

const ROOT_DIR = process.cwd();
const EVALS_PATH = ".agent-operating-model/behavioural-evals.json";

function fail(message) {
	console.error(`agent:evals: ${message}`);
	process.exit(1);
}

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8"));
}

function hasAll(actualValues, expectedValues) {
	return expectedValues.every((value) => actualValues.includes(value));
}

function validateTraceRequirement(evaluation) {
	if (!evaluation.prompt.includes("[reasoning]")) {
		return;
	}

	const expectedTraceOutputs = evaluation.expectedTraceOutputs || [];

	for (const output of ["raw-jsonl-trace", "user-readable-trace", "bundle-application-record"]) {
		if (!expectedTraceOutputs.includes(output)) {
			fail(`${evaluation.id} is missing expected trace output: ${output}`);
		}
	}
}

function runEval(evaluation) {
	const model = loadOperatingModel({ taskText: evaluation.prompt });
	const selectedIds = model.selectedBundles.map((bundle) => bundle.id);
	const missingBundles = (evaluation.expectedBundles || []).filter(
		(bundleId) => !selectedIds.includes(bundleId),
	);

	if (missingBundles.length) {
		fail(`${evaluation.id} did not select bundles: ${missingBundles.join(", ")}`);
	}

	if (!hasAll(selectedIds, evaluation.expectedBundles || [])) {
		fail(`${evaluation.id} selected bundle set is incomplete`);
	}

	for (const bundle of model.selectedBundles) {
		if (!bundle.selectionEvidence?.ruleId) {
			fail(`${evaluation.id} selected ${bundle.id} without selection evidence`);
		}
	}

	validateTraceRequirement(evaluation);

	return {
		id: evaluation.id,
		selectedBundles: selectedIds,
		status: "passed",
	};
}

const evalConfig = readJson(EVALS_PATH);

if (evalConfig.traceLayer !== "behavioural") {
	fail("behavioural-evals.json must declare traceLayer behavioural");
}

const results = evalConfig.evals.map((evaluation) => runEval(evaluation));

console.log(JSON.stringify({ results, status: "passed" }, null, 2));
