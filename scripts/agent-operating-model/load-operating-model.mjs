/**
 * @file load-operating-model.mjs
 * @module LoadOperatingModel
 * @summary Loads the repository agent operating model and selects relevant bundles.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const BASE_OPERATING_MODEL_SAFEGUARDS = Object.freeze([
	"must-load-agents-md",
	"must-load-orchestration",
	"must-load-bundle-registry",
	"must-resolve-canonical-bundle-directories",
	"must-apply-bundle-precedence",
]);
const REASONING_TRACE_OUTPUTS = Object.freeze([
	"raw-jsonl-trace",
	"user-readable-trace",
	"bundle-application-record",
]);

function readJson(relativePath) {
	const fullPath = path.join(ROOT_DIR, relativePath);

	return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function normalise(value) {
	return String(value || "").toLowerCase();
}

function phraseMatches(taskText, phrase) {
	return normalise(taskText).includes(normalise(phrase));
}

function matchedSignalPhrases(signal, taskText) {
	return (signal.phrases || []).filter((phrase) => phraseMatches(taskText, phrase));
}

function inferTaskSignals(taskText, signalCatalog) {
	return signalCatalog.signals
		.map((signal) => {
			const matchedPhrases = matchedSignalPhrases(signal, taskText);
			const matched = signal.kind === "default" || matchedPhrases.length > 0;

			return {
				id: signal.id,
				kind: signal.kind,
				matched,
				matchedPhrases,
				traceLayer: signal.traceLayer,
			};
		})
		.filter((signal) => signal.matched);
}

function inferInstructionConflicts(taskText) {
	const text = normalise(taskText);

	if ((text.includes("skip") || text.includes("ignore")) && text.includes("bootstrap")) {
		return ["latest-prompt-conflicts-repository-bootstrap"];
	}

	return [];
}

function inferOperatingModelSafeguards(taskText) {
	const safeguards = [...BASE_OPERATING_MODEL_SAFEGUARDS];
	const conflicts = inferInstructionConflicts(taskText);

	if (conflicts.length) {
		safeguards.push("must-report-conflict");
	}

	if (taskText.includes("[reasoning]")) {
		safeguards.push("must-create-trace");
	}

	return {
		conflicts,
		safeguards,
	};
}

function traceOutputsFor(taskText) {
	return taskText.includes("[reasoning]") ? [...REASONING_TRACE_OUTPUTS] : [];
}

function allSignalsMatch(requiredSignals, signals) {
	const signalIds = new Set(signals.map((signal) => signal.id));

	return (requiredSignals || []).every((signal) => signalIds.has(signal));
}

function matchedSignals(requiredSignals, signals) {
	const required = new Set(requiredSignals || []);

	return signals.filter((signal) => required.has(signal.id));
}

function matchedRegistryKeywords(bundle, taskText) {
	return (bundle.keywords || []).filter((keyword) => phraseMatches(taskText, keyword));
}

function evaluateRule(rule, bundle, taskText, signals) {
	const requiredSignals = rule.requiredSignals || [];
	const selectedSignals = matchedSignals(requiredSignals, signals);
	const signalsMatched = allSignalsMatch(requiredSignals, signals);

	if (rule.type === "always") {
		return {
			matched: true,
			matchedPhrases: selectedSignals.flatMap((signal) => signal.matchedPhrases),
			matchedRegistryKeywords: [],
			matchedSignals: selectedSignals.map((signal) => signal.id),
			ruleId: rule.id,
			selectionBasis: "required-task-signal",
			traceLayer: rule.traceLayer || "operational",
		};
	}

	const registryKeywords = matchedRegistryKeywords(bundle, taskText);
	const fallbackMatched = !signalsMatched && registryKeywords.length > 0;
	const matched = signalsMatched || fallbackMatched;

	return {
		matched,
		matchedPhrases: selectedSignals.flatMap((signal) => signal.matchedPhrases),
		matchedRegistryKeywords: registryKeywords,
		matchedSignals: selectedSignals.map((signal) => signal.id),
		ruleId: rule.id,
		selectionBasis: signalsMatched ? "required-task-signal" : "registry-keyword-fallback",
		traceLayer: rule.traceLayer || "behavioural",
	};
}

function selectBundles(registry, selectionRules, taskText, signals) {
	const bundleById = new Map(registry.bundles.map((bundle) => [bundle.id, bundle]));
	const selected = [];
	const skipped = [];

	for (const rule of selectionRules.rules) {
		const bundle = bundleById.get(rule.bundleId);

		if (!bundle) {
			continue;
		}

		const result = evaluateRule(rule, bundle, taskText, signals);
		const record = {
			...bundle,
			selectionEvidence: result,
		};

		if (result.matched) {
			selected.push(record);
		} else {
			skipped.push(record);
		}
	}

	return {
		selectedBundles: selected.sort((left, right) => right.precedence - left.precedence),
		skippedBundles: skipped.sort((left, right) => right.precedence - left.precedence),
	};
}

function requireString(value, label) {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(`selected bundle ${label} must be a non-empty string`);
	}
}

function requireDirectory(relativePath, bundleId) {
	const fullPath = path.join(ROOT_DIR, relativePath);

	if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
		throw new Error(`selected bundle ${bundleId} missing canonical directory: ${relativePath}`);
	}
}

function requireFile(relativePath, bundleId) {
	const fullPath = path.join(ROOT_DIR, relativePath);

	if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
		throw new Error(`selected bundle ${bundleId} missing canonical file: ${relativePath}`);
	}
}

function normaliseDirectory(relativePath) {
	return relativePath.endsWith("/") ? relativePath : `${relativePath}/`;
}

function assertSelectedBundleFiles(bundle) {
	requireString(bundle.id, "id");
	requireString(bundle.canonicalPath, `${bundle.id}.canonicalPath`);
	requireString(bundle.promptSpec, `${bundle.id}.promptSpec`);
	requireString(bundle.promptBody, `${bundle.id}.promptBody`);

	const canonicalPath = normaliseDirectory(bundle.canonicalPath);

	requireDirectory(canonicalPath, bundle.id);
	requireFile(path.join(canonicalPath, bundle.promptSpec), bundle.id);
	requireFile(path.join(canonicalPath, bundle.promptBody), bundle.id);

	return {
		...bundle,
		canonicalPath,
	};
}

function bundleRecord(bundle) {
	return {
		canonicalPath: bundle.canonicalPath,
		id: bundle.id,
		load: bundle.load,
		name: bundle.name,
		precedence: bundle.precedence,
		promptBody: bundle.promptBody,
		promptSpec: bundle.promptSpec,
		role: bundle.role,
		selectionEvidence: bundle.selectionEvidence,
	};
}

/**
 * Load the repository operating model and select relevant bundles.
 * @param {object} [options] Load options.
 * @param {string} [options.taskText] User task text.
 * @returns {Record<string, unknown>} Operating-model selection.
 */
export function loadOperatingModel(options = {}) {
	const taskText = options.taskText || "";
	const registry = readJson(".agent-operating-model/bundle-registry.json");
	const selectionRules = readJson(".agent-operating-model/selection-rules.json");
	const signalCatalog = readJson(".agent-operating-model/task-signal-catalog.json");
	const taskSignals = inferTaskSignals(taskText, signalCatalog);
	const selected = selectBundles(registry, selectionRules, taskText, taskSignals);
	const selectedBundles = selected.selectedBundles.map(assertSelectedBundleFiles);
	const safeguards = inferOperatingModelSafeguards(taskText);

	return {
		canonicalRoot: registry.canonicalRoot,
		instructionConflicts: safeguards.conflicts,
		operatingModelSafeguards: safeguards.safeguards,
		registryVersion: registry.version,
		selectedBundles: selectedBundles.map(bundleRecord),
		skippedBundles: selected.skippedBundles.map(bundleRecord),
		taskFacets: taskSignals,
		taskSignals,
		traceOutputs: traceOutputsFor(taskText),
	};
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const taskText = process.argv.slice(2).join(" ");
	const model = loadOperatingModel({ taskText });

	console.log(JSON.stringify(model, null, 2));
}
