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

function expectedConditionalBundles(evaluation, model) {
	return (evaluation.expectedBundles || [])
		.map((bundleId) => selectedBundle(model, bundleId))
		.filter((bundle) => bundle?.load === "conditional");
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

function hasAuditableSelectionEvidence(bundle) {
	const evidence = bundle.selectionEvidence || {};
	const hasSignalEvidence = (evidence.matchedSignals || []).length > 0;
	const hasFallbackEvidence =
		evidence.selectionBasis === "registry-keyword-fallback" &&
		(evidence.matchedRegistryKeywords || []).length > 0;

	return Boolean(evidence.ruleId && (hasSignalEvidence || hasFallbackEvidence));
}

function hasMatchedSignalEvidence(bundle) {
	const evidence = bundle.selectionEvidence || {};

	return Boolean(
		evidence.ruleId &&
		(evidence.matchedSignals || []).length > 0 &&
		evidence.selectionBasis === "required-task-signal",
	);
}

function hasCanonicalDirectory(bundle) {
	if (!bundle.canonicalPath || !bundle.promptSpec || !bundle.promptBody) {
		return false;
	}

	const bundleDirectory = path.join(ROOT_DIR, bundle.canonicalPath);
	const specPath = path.join(bundleDirectory, bundle.promptSpec);
	const bodyPath = path.join(bundleDirectory, bundle.promptBody);

	return (
		fs.existsSync(bundleDirectory) &&
		fs.statSync(bundleDirectory).isDirectory() &&
		fs.existsSync(specPath) &&
		fs.statSync(specPath).isFile() &&
		fs.existsSync(bodyPath) &&
		fs.statSync(bodyPath).isFile()
	);
}

function validateExpectedConditionalSignalEvidence(evaluation, model) {
	const conditionalBundles = expectedConditionalBundles(evaluation, model);

	for (const bundle of conditionalBundles) {
		if (!hasMatchedSignalEvidence(bundle)) {
			fail(
				`${evaluation.id} expected conditional bundle ${bundle.id} without matched signal evidence`,
			);
		}
	}
}

function validateSelectionEvidence(evaluation, model) {
	for (const bundle of model.selectedBundles) {
		if (!hasAuditableSelectionEvidence(bundle)) {
			fail(`${evaluation.id} selected ${bundle.id} without auditable selection evidence`);
		}

		if (!hasCanonicalDirectory(bundle)) {
			fail(`${evaluation.id} selected ${bundle.id} without a resolvable canonical directory`);
		}
	}

	const expectedEvidence = evaluation.expectedEvidence || [];
	const evidenceChecks = {
		"canonical-directory": () => model.selectedBundles.every((bundle) => hasCanonicalDirectory(bundle)),
		"matched-condition": () => {
			validateExpectedConditionalSignalEvidence(evaluation, model);

			return true;
		},
		"matched-rule": () => model.selectedBundles.every((bundle) => bundle.selectionEvidence?.ruleId),
		"matched-signal": () => {
			validateExpectedConditionalSignalEvidence(evaluation, model);

			return true;
		},
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
		"missing-canonical-directory": () =>
			model.selectedBundles.some((bundle) => !hasCanonicalDirectory(bundle)),
		priority: () =>
			model.instructionConflicts.length > 0 &&
			!model.operatingModelSafeguards.includes("must-report-conflict"),
		"superficial-keyword-only": () =>
			model.selectedBundles.some((bundle) => !hasAuditableSelectionEvidence(bundle)),
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
