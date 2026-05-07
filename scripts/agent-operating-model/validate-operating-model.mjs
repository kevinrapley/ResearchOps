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
	"docs/devops/ResearchOps-Bundle-Setup.zip",
	"scripts/agent-operating-model/load-operating-model.mjs",
	"scripts/agent-operating-model/validate-bundle-registry.mjs",
	"scripts/agent-operating-model/validate-operating-model.mjs",
];

const REQUIRED_AGENT_REFERENCES = [
	".agent-operating-model/orchestration.xml",
	".agent-operating-model/bundle-registry.json",
	".agent-operating-model/bootstrap-checklist.md",
	".agent-operating-model/precedence-policy.md",
	".agent-operating-model/trace-policy.md",
	"docs/devops/ResearchOps-Bundle-Setup.zip",
];

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

function readText(relativePath) {
	return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

for (const file of REQUIRED_FILES) {
	requireFile(file);
}

const agents = readText("AGENTS.md");

for (const reference of REQUIRED_AGENT_REFERENCES) {
	if (!agents.includes(reference)) {
		fail(`AGENTS.md must reference ${reference}`);
	}
}

const orchestration = readText(".agent-operating-model/orchestration.xml");

for (const expected of [
	"bundleOrchestration",
	"github-diamond",
	"researchops-developer",
	"gold-standard-gov-product",
	"govuk-design-system",
	"cloudflare-core-developer",
	"airtable-public-api",
	"mural-public-api",
	"[reasoning]",
]) {
	if (!orchestration.includes(expected)) {
		fail(`orchestration.xml must contain ${expected}`);
	}
}

const pkg = JSON.parse(readText("package.json"));
const scripts = pkg.scripts || {};

for (const scriptName of [
	"agent:model",
	"agent:model:validate",
	"agent:bundles:validate",
]) {
	if (!scripts[scriptName]) {
		fail(`package.json is missing ${scriptName}`);
	}
}

execFileSync("node", ["scripts/agent-operating-model/validate-bundle-registry.mjs"], {
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
	"researchops-developer",
	"gold-standard-gov-product",
	"cloudflare-core-developer",
	"airtable-public-api",
	"mural-public-api",
]) {
	if (!selectedIds.includes(expectedId)) {
		fail(`loader did not select expected bundle: ${expectedId}`);
	}
}

console.log("agent:model:validate: operating model validation passed");
