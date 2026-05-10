/**
 * @file validate-operating-model.mjs
 * @module ValidateOperatingModel
 * @summary Validates the repository agent operating model contract.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const REQUIRED_FILES = [
	"AGENTS.md",
	".agent-operating-model/README.md",
	".agent-operating-model/orchestration.xml",
	".agent-operating-model/bundle-registry.json",
	".agent-operating-model/bundle-registry.schema.json",
	".agent-operating-model/bootstrap-checklist.md",
	".agent-operating-model/precedence-policy.md",
	".agent-operating-model/trace-policy.md",
	".agent-operating-model/trace-layers.md",
	".agent-operating-model/task-signal-catalog.json",
	".agent-operating-model/selection-rules.json",
	".agent-operating-model/behavioural-evals.json",
	"scripts/agent-operating-model/load-operating-model.mjs",
	"scripts/agent-operating-model/run-behavioural-evals.mjs",
	"scripts/agent-operating-model/validate-bundle-registry.mjs",
	"scripts/agent-operating-model/validate-operating-model.mjs",
];

const REQUIRED_AGENT_REFERENCES = [
	".agent-operating-model/orchestration.xml",
	".agent-operating-model/bundle-registry.json",
	".agent-operating-model/task-signal-catalog.json",
	".agent-operating-model/selection-rules.json",
	".agent-operating-model/bootstrap-checklist.md",
	".agent-operating-model/precedence-policy.md",
	".agent-operating-model/trace-policy.md",
	".agent-operating-model/bundles/",
];

const MANIFEST_BUNDLE_IDS = [
	"github-diamond",
	"researchops-developer-control",
	"multi-functional-team",
	"govuk-design-system",
	"cloudflare",
	"airtable-public-api",
	"mural-public-api",
];

const TRACE_LAYERS = ["operational", "behavioural", "mechanistic", "training"];

function fail(message) {
	console.error(`agent:model:validate: ${message}`);
	process.exit(1);
}

function requireFile(relativePath) {
	const fullPath = path.join(ROOT_DIR, relativePath);

	if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
		fail(`missing required file: ${relativePath}`);
	}
}

function requireDirectory(relativePath) {
	const fullPath = path.join(ROOT_DIR, relativePath);

	if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
		fail(`missing required directory: ${relativePath}`);
	}
}

function readText(relativePath) {
	return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

function readJson(relativePath) {
	return JSON.parse(readText(relativePath));
}

function requireTraceLayers(text, label) {
	for (const layer of TRACE_LAYERS) {
		if (!text.includes(layer)) {
			fail(`${label} must reference trace layer: ${layer}`);
		}
	}
}

function assertBundleHasCanonicalFiles(bundle) {
	if (!bundle.canonicalPath) {
		fail(`selected bundle missing canonicalPath: ${bundle.id}`);
	}

	requireDirectory(bundle.canonicalPath);
	requireFile(path.join(bundle.canonicalPath, bundle.promptSpec || "prompt.spec.yaml"));
	requireFile(path.join(bundle.canonicalPath, bundle.promptBody || "prompt.body.xml"));
}

for (const file of REQUIRED_FILES) {
	requireFile(file);
}

requireDirectory(".agent-operating-model/bundles/");

const agents = readText("AGENTS.md");

for (const reference of REQUIRED_AGENT_REFERENCES) {
	if (!agents.includes(reference)) {
		fail(`AGENTS.md must reference ${reference}`);
	}
}

const orchestration = readText(".agent-operating-model/orchestration.xml");

for (const expected of ["bundleOrchestration", "canonicalSources", "[reasoning]", ...MANIFEST_BUNDLE_IDS]) {
	if (!orchestration.includes(expected)) {
		fail(`orchestration.xml must contain ${expected}`);
	}
}

const traceLayers = readText(".agent-operating-model/trace-layers.md");
requireTraceLayers(traceLayers, "trace-layers.md");

const behaviouralEvals = readJson(".agent-operating-model/behavioural-evals.json");

if (behaviouralEvals.traceLayer !== "behavioural") {
	fail("behavioural-evals.json must declare traceLayer behavioural");
}

if (!Array.isArray(behaviouralEvals.evals) || behaviouralEvals.evals.length < 5) {
	fail("behavioural-evals.json must contain at least five evals");
}

const signalCatalog = readJson(".agent-operating-model/task-signal-catalog.json");
const signalIds = new Set(signalCatalog.signals.map((signal) => signal.id));

for (const requiredSignal of [
	"repository-affecting-task",
	"government-product-assurance-default",
	"ui-or-content-change",
	"runtime-or-deployment-change",
	"external-api-or-data-change",
	"external-api-or-collaboration-change",
]) {
	if (!signalIds.has(requiredSignal)) {
		fail(`task-signal-catalog.json is missing signal: ${requiredSignal}`);
	}
}

const selectionRules = readJson(".agent-operating-model/selection-rules.json");
const ruleBundleIds = new Set(selectionRules.rules.map((rule) => rule.bundleId));

for (const bundleId of MANIFEST_BUNDLE_IDS) {
	if (!ruleBundleIds.has(bundleId)) {
		fail(`selection-rules.json is missing bundle rule: ${bundleId}`);
	}
}

for (const rule of selectionRules.rules) {
	for (const signalId of rule.requiredSignals || []) {
		if (!signalIds.has(signalId)) {
			fail(`selection rule ${rule.id} references unknown signal: ${signalId}`);
		}
	}
}

const pkg = JSON.parse(readText("package.json"));
const scripts = pkg.scripts || {};

for (const scriptName of [
	"agent:model",
	"agent:model:validate",
	"agent:bundles:validate",
	"agent:evals",
]) {
	if (!scripts[scriptName]) {
		fail(`package.json is missing ${scriptName}`);
	}
}

execFileSync("node", ["scripts/agent-operating-model/validate-bundle-registry.mjs"], {
	stdio: "inherit",
});

execFileSync("node", ["scripts/agent-operating-model/run-behavioural-evals.mjs"], {
	stdio: "inherit",
});

const modelOutput = execFileSync(
	"node",
	[
		"scripts/agent-operating-model/load-operating-model.mjs",
		"Cloudflare Worker route with Airtable and Mural widgets",
	],
	{ encoding: "utf8" },
);
const model = JSON.parse(modelOutput);
const selectedIds = model.selectedBundles.map((bundle) => bundle.id);

for (const expectedId of [
	"github-diamond",
	"researchops-developer-control",
	"multi-functional-team",
	"cloudflare",
	"airtable-public-api",
	"mural-public-api",
]) {
	if (!selectedIds.includes(expectedId)) {
		fail(`loader did not select expected bundle: ${expectedId}`);
	}
}

for (const bundle of model.selectedBundles) {
	assertBundleHasCanonicalFiles(bundle);

	if (!bundle.selectionEvidence?.ruleId) {
		fail(`loader did not return selection evidence for ${bundle.id}`);
	}

	const hasSignalEvidence = bundle.selectionEvidence.matchedSignals?.length > 0;
	const hasFallbackEvidence =
		bundle.selectionEvidence.selectionBasis === "registry-keyword-fallback" &&
		bundle.selectionEvidence.matchedRegistryKeywords?.length > 0;

	if (!hasSignalEvidence && !hasFallbackEvidence) {
		fail(`loader did not return signal or fallback evidence for ${bundle.id}`);
	}
}

if (Object.hasOwn(model, "bundlePackage")) {
	fail("loader must not expose bundlePackage; canonical directories are authoritative");
}

console.log("agent:model:validate: operating model validation passed");
