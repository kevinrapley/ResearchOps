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

function phraseMatches(taskText, phrase) {
	return normalise(taskText).includes(normalise(phrase));
}

function inferTaskFacets(taskText) {
	return [
		{
			id: "repository-affecting-task",
			matched: true,
		},
		{
			id: "government-product-assurance-default",
			matched: true,
		},
		{
			id: "ui-or-content-change",
			matched: [
				"accessibility",
				"component",
				"content",
				"css",
				"form",
				"gov.uk",
				"govuk",
				"html",
				"page",
			].some((phrase) => phraseMatches(taskText, phrase)),
		},
		{
			id: "runtime-or-deployment-change",
			matched: [
				"binding",
				"cloudflare",
				"deployment",
				"pages",
				"route",
				"worker",
				"workers",
				"wrangler",
			].some((phrase) => phraseMatches(taskText, phrase)),
		},
		{
			id: "external-api-or-data-change",
			matched: [
				"airtable",
				"attachment",
				"filterbyformula",
				"linked record",
				"record",
				"records",
			].some((phrase) => phraseMatches(taskText, phrase)),
		},
		{
			id: "external-api-or-collaboration-change",
			matched: [
				"mural",
				"mural board",
				"oauth",
				"room",
				"sticky note",
				"widget",
				"workspace",
			].some((phrase) => phraseMatches(taskText, phrase)),
		},
	].filter((facet) => facet.matched);
}

function allFacetsMatch(requiredFacets, facets) {
	const facetIds = new Set(facets.map((facet) => facet.id));

	return (requiredFacets || []).every((facet) => facetIds.has(facet));
}

function matchedPhrases(rule, taskText) {
	return (rule.anyOf || []).filter((phrase) => phraseMatches(taskText, phrase));
}

function evaluateRule(rule, taskText, facets) {
	if (rule.type === "always") {
		return {
			matched: true,
			matchedFacets: rule.evidenceRequired || [],
			matchedPhrases: [],
			ruleId: rule.id,
			selectionBasis: "always",
			traceLayer: rule.traceLayer || "operational",
		};
	}

	const phrases = matchedPhrases(rule, taskText);
	const matched = allFacetsMatch(rule.allOf, facets) && phrases.length > 0;

	return {
		matched,
		matchedFacets: rule.allOf || [],
		matchedPhrases: phrases,
		ruleId: rule.id,
		selectionBasis: "structured-rule",
		traceLayer: rule.traceLayer || "behavioural",
	};
}

function selectBundles(registry, selectionRules, taskText) {
	const facets = inferTaskFacets(taskText);
	const bundleById = new Map(registry.bundles.map((bundle) => [bundle.id, bundle]));
	const selected = [];
	const skipped = [];

	for (const rule of selectionRules.rules) {
		const bundle = bundleById.get(rule.bundleId);

		if (!bundle) {
			continue;
		}

		const result = evaluateRule(rule, taskText, facets);
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
		facets,
		selectedBundles: selected.sort((left, right) => right.precedence - left.precedence),
		skippedBundles: skipped.sort((left, right) => right.precedence - left.precedence),
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
	const selected = selectBundles(registry, selectionRules, taskText);

	return {
		bundlePackage: registry.bundlePackage,
		registryVersion: registry.version,
		selectedBundles: selected.selectedBundles.map((bundle) => ({
			id: bundle.id,
			load: bundle.load,
			name: bundle.name,
			precedence: bundle.precedence,
			role: bundle.role,
			selectionEvidence: bundle.selectionEvidence,
		})),
		skippedBundles: selected.skippedBundles.map((bundle) => ({
			id: bundle.id,
			load: bundle.load,
			name: bundle.name,
			selectionEvidence: bundle.selectionEvidence,
		})),
		taskFacets: selected.facets,
	};
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const taskText = process.argv.slice(2).join(" ");
	const model = loadOperatingModel({ taskText });

	console.log(JSON.stringify(model, null, 2));
}
