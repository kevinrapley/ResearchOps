import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadOperatingModel } from "../scripts/agent-operating-model/load-operating-model.mjs";

function selectedBundles(taskText) {
	return loadOperatingModel({ taskText }).selectedBundles;
}

function selectedIds(taskText) {
	return selectedBundles(taskText).map((bundle) => bundle.id);
}

function bundleById(taskText, bundleId) {
	return selectedBundles(taskText).find((bundle) => bundle.id === bundleId);
}

test("repository operating model selects always-load bundles", () => {
	const ids = selectedIds("Update documentation for the ResearchOps platform.");

	assert.deepEqual(ids.slice(0, 3), [
		"github-diamond",
		"researchops-developer",
		"gov-product-assistant-gold-standard",
	]);
});

test("repository operating model selects conditional bundles by structured rule evidence", () => {
	const task =
		"Fix a Cloudflare Worker route that writes Airtable records and syncs Mural widgets.";
	const ids = selectedIds(task);

	assert.ok(ids.includes("cloudflare-core-developer"));
	assert.ok(ids.includes("airtable-public-api-developer"));
	assert.ok(ids.includes("mural-public-api-developer"));

	for (const bundleId of [
		"cloudflare-core-developer",
		"airtable-public-api-developer",
		"mural-public-api-developer",
	]) {
		const bundle = bundleById(task, bundleId);

		assert.equal(bundle.selectionEvidence.selectionBasis, "structured-rule");
		assert.equal(bundle.selectionEvidence.traceLayer, "behavioural");
		assert.ok(bundle.selectionEvidence.ruleId);
		assert.ok(bundle.selectionEvidence.matchedPhrases.length > 0);
	}
});

test("repository operating model exposes task facets for trace reports", () => {
	const taskText = "Improve GOV.UK form accessibility and page content.";
	const model = loadOperatingModel({ taskText });
	const facetIds = model.taskFacets.map((facet) => facet.id);
	const ids = model.selectedBundles.map((bundle) => bundle.id);

	assert.ok(facetIds.includes("repository-affecting-task"));
	assert.ok(facetIds.includes("ui-or-content-change"));
	assert.ok(ids.includes("govuk-design-system"));
});

test("repository operating model sources are referenced from AGENTS.md", () => {
	const agents = fs.readFileSync("AGENTS.md", "utf8");

	for (const reference of [
		".agent-operating-model/orchestration.xml",
		".agent-operating-model/bundle-registry.json",
		".agent-operating-model/selection-rules.json",
		".agent-operating-model/bootstrap-checklist.md",
		".agent-operating-model/precedence-policy.md",
		".agent-operating-model/trace-policy.md",
		".agent-operating-model/trace-layers.md",
		".agent-operating-model/behavioural-evals.json",
		"docs/devops/ResearchOps-Bundle-Setup.zip",
	]) {
		assert.match(agents, new RegExp(reference.replace(/[.]/g, "\\.")));
	}
});
