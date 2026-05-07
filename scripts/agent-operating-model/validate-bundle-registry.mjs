/**
 * @file validate-bundle-registry.mjs
 * @module ValidateBundleRegistry
 * @summary Validates the ResearchOps agent bundle registry.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const REGISTRY_PATH = ".agent-operating-model/bundle-registry.json";
const SCHEMA_PATH = ".agent-operating-model/bundle-registry.schema.json";

function fail(message) {
	console.error(`agent:bundles:validate: ${message}`);
	process.exit(1);
}

function readJson(relativePath) {
	const fullPath = path.join(ROOT_DIR, relativePath);

	if (!fs.existsSync(fullPath)) {
		fail(`missing file: ${relativePath}`);
	}

	return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function requireString(value, label) {
	if (typeof value !== "string" || !value.trim()) {
		fail(`${label} must be a non-empty string`);
	}
}

function requireInteger(value, label) {
	if (!Number.isInteger(value) || value < 0) {
		fail(`${label} must be a non-negative integer`);
	}
}

function requireBoolean(value, label) {
	if (typeof value !== "boolean") {
		fail(`${label} must be a boolean`);
	}
}

function requireArray(value, label) {
	if (!Array.isArray(value) || !value.length) {
		fail(`${label} must be a non-empty array`);
	}
}

function validateZip(relativePath) {
	const fullPath = path.join(ROOT_DIR, relativePath);

	if (!fs.existsSync(fullPath)) {
		fail(`missing bundle package: ${relativePath}`);
	}

	const stat = fs.statSync(fullPath);

	if (!stat.isFile() || stat.size < 4) {
		fail(`bundle package must be a non-empty file: ${relativePath}`);
	}

	const signature = fs.readFileSync(fullPath).subarray(0, 4).toString("hex");

	if (signature !== "504b0304" && signature !== "504b0506") {
		fail(`bundle package is not a ZIP file: ${relativePath}`);
	}
}

function validateBundle(bundle, ids) {
	requireString(bundle.id, "bundle.id");
	requireString(bundle.name, `${bundle.id}.name`);
	requireString(bundle.role, `${bundle.id}.role`);
	requireInteger(bundle.precedence, `${bundle.id}.precedence`);
	requireBoolean(bundle.mustRecordInTrace, `${bundle.id}.mustRecordInTrace`);
	requireArray(bundle.keywords, `${bundle.id}.keywords`);

	if (!/^[a-z0-9-]+$/.test(bundle.id)) {
		fail(`bundle id must be kebab-case: ${bundle.id}`);
	}

	if (ids.has(bundle.id)) {
		fail(`duplicate bundle id: ${bundle.id}`);
	}

	ids.add(bundle.id);

	if (!["always", "conditional"].includes(bundle.load)) {
		fail(`${bundle.id}.load must be always or conditional`);
	}

	for (const keyword of bundle.keywords) {
		requireString(keyword, `${bundle.id}.keywords[]`);
	}
}

const registry = readJson(REGISTRY_PATH);
readJson(SCHEMA_PATH);

requireString(registry.version, "version");
requireString(registry.updated, "updated");
requireString(registry.bundlePackage, "bundlePackage");
requireArray(registry.defaultLoadOrder, "defaultLoadOrder");
requireArray(registry.bundles, "bundles");
validateZip(registry.bundlePackage);

const ids = new Set();

for (const bundle of registry.bundles) {
	validateBundle(bundle, ids);
}

for (const bundleId of registry.defaultLoadOrder) {
	if (!ids.has(bundleId)) {
		fail(`defaultLoadOrder references unknown bundle: ${bundleId}`);
	}
}

console.log(`agent:bundles:validate: validated ${registry.bundles.length} bundle(s)`);
