/**
 * @file load-operating-model.mjs
 * @module LoadOperatingModel
 * @summary Loads the repository agent operating model and selects relevant bundles.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

function readJson(relativePath) {
	const fullPath = path.join(ROOT_DIR, relativePath);

	return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function normalise(value) {
	return String(value || "").toLowerCase();
}

function keywordMatches(bundle, taskText) {
	const text = normalise(taskText);

	return (bundle.keywords || []).some((keyword) => text.includes(normalise(keyword)));
}

function selectBundles(registry, taskText) {
	return registry.bundles
		.filter((bundle) => bundle.load === "always" || keywordMatches(bundle, taskText))
		.sort((left, right) => right.precedence - left.precedence);
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
	const selectedBundles = selectBundles(registry, taskText);
	const skippedBundles = registry.bundles.filter(
		(bundle) => !selectedBundles.some((selected) => selected.id === bundle.id),
	);

	return {
		bundlePackage: registry.bundlePackage,
		registryVersion: registry.version,
		selectedBundles: selectedBundles.map((bundle) => ({
			id: bundle.id,
			load: bundle.load,
			name: bundle.name,
			precedence: bundle.precedence,
			role: bundle.role,
		})),
		skippedBundles: skippedBundles.map((bundle) => ({
			id: bundle.id,
			load: bundle.load,
			name: bundle.name,
		})),
	};
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const taskText = process.argv.slice(2).join(" ");
	const model = loadOperatingModel({ taskText });

	console.log(JSON.stringify(model, null, 2));
}
