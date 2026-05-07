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

function selectedIds(model) {
	return model.selectedBundles.map((bundle) => bundle.id);
}

function selectedBundle(model, bundleId) {
	return model.selectedBundles.find((bundle) => bundle.id === bundleId);
}

function selectionEvidenceValues(model, key) {
	return model.selectedBundles.flatMap((bundle) => bundle.selectionEvidence?.[key] || []);
}

function validateExpectedBundles(evaluation, model) {
	const ids = selectedIds(model);
	const missingBundles = (evaluation.expectedBundles || []).filter(
		(bundleId) => !ids.includes(bundleId),
	);

	if (missingBundles.length) {
		fail(`${evaluation.id} did not select bundles: ${missingBundles.join(", ")}`);
	}

	if (!hasAll(ids, evaluation.expectedBundles || [])) {
		fail(`${evaluation.id} selected bundle set is incomplete`);
	}
}

function validateTraceRequirement(evaluation, model) {
	if (!evaluation.prompt.includes("[reasoning]")) {
		return;
	}

	const expectedTraceOutputs = evaluation.expectedTraceOutputs || [];

	for (const output of expectedTraceOutputs) {
		if (!model.traceOutputs.includes(output)) {
			fail(`${evaluation.id} did not produce expected trace output: ${output}`);
		}
	}
}

function validateSelectionEvidence(evaluation, model) {
	for (const bundle of model.selectedBundles) {
		if (!bundle.selectionEvidence?.ruleId) {
			fail(`${evaluation.id} selected ${bundle.id} without selection evidence`);
		}
	}

	const expectedEvidence = evaluation.expectedEvidence || [];
	const evidenceChecks = {
		"matched-condition": () => selectionEvidenceValues(model, "matchedFacets").length > 0,
		"matched-rule": () => model.selectedBundles.every((bundle) => bundle.selectionEvidence?.ruleId),
		"selected-bundle": () => model.selectedBundles.length > 0,
	};

	for (const expected of expectedEvidence) {
		const check = evidenceChecks[expected];

		if (!check) {
			fail(`${evaluation.id} declares unsupported expected evidence: ${expected}`);
		}

		if (!check()) {
			fail(`${evaluation.id} missing expected evidence: ${expected}`);
		}
	}
}

function validateExpectedSafeguards(evaluation, model) {
	for (const expected of evaluation.expectedSafeguards || []) {
		if (!model.operatingModelSafeguards.includes(expected)) {
			fail(`${evaluation.id} missing expected safeguard: ${expected}`);
		}
	}
}

function validateForbiddenFailureModes(evaluation, model) {
	const modeChecks = {
		context: () => model.selectedBundles.length === 0,
		explanation: () =>
			evaluation.prompt.includes("[reasoning]") && model.traceOutputs.length === 0,
		instruction: () => !selectedIds(model).includes("github-diamond"),
		priority: () =>
			model.instructionConflicts.length > 0 &&
			!model.operatingModelSafeguards.includes("must-report-conflict"),
		"superficial-keyword-only": () =>
			model.selectedBundles.some(
				(bundle) => !bundle.selectionEvidence?.ruleId || !bundle.selectionEvidence?.selectionBasis,
			),
		tool: () => !model.operatingModelSafeguards.includes("must-load-agents-md"),
	};

	for (const mode of evaluation.forbiddenFailureModes || []) {
		const check = modeChecks[mode];

		if (!check) {
			fail(`${evaluation.id} declares unsupported forbidden failure mode: ${mode}`);
		}

		if (check()) {
			fail(`${evaluation.id} exhibits forbidden failure mode: ${mode}`);
		}
	}
}

function validateLatestPromptConflict(evaluation, model) {
	if (evaluation.id !== "behaviour-latest-prompt-vs-repo-rule") {
		return;
	}

	if (!model.instructionConflicts.includes("latest-prompt-conflicts-repository-bootstrap")) {
		fail(`${evaluation.id} did not record the latest prompt versus repository rule conflict`);
	}
}

function validateRegistryFallback(evaluation, model) {
	if (evaluation.id !== "behaviour-govuk-page-design") {
		return;
	}

	const bundle = selectedBundle(model, "govuk-design-system");

	if (!bundle) {
		fail(`${evaluation.id} did not select govuk-design-system`);
	}

	if (bundle.selectionEvidence.selectionBasis === "registry-keyword-fallback") {
		if (!bundle.selectionEvidence.matchedRegistryKeywords.length) {
			fail(`${evaluation.id} fallback did not record matched registry keywords`);
		}
	}
}

function runEval(evaluation) {
	const model = loadOperatingModel({ taskText: evaluation.prompt });

	validateExpectedBundles(evaluation, model);
	validateTraceRequirement(evaluation, model);
	validateSelectionEvidence(evaluation, model);
	validateExpectedSafeguards(evaluation, model);
	validateForbiddenFailureModes(evaluation, model);
	validateLatestPromptConflict(evaluation, model);
	validateRegistryFallback(evaluation, model);

	return {
		id: evaluation.id,
		selectedBundles: selectedIds(model),
		status: "passed",
	};
}

const evalConfig = readJson(EVALS_PATH);

if (evalConfig.traceLayer !== "behavioural") {
	fail("behavioural-evals.json must declare traceLayer behavioural");
}

const results = evalConfig.evals.map((evaluation) => runEval(evaluation));

console.log(JSON.stringify({ results, status: "passed" }, null, 2));
