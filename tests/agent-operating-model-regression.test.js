import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadOperatingModel } from "../scripts/agent-operating-model/load-operating-model.mjs";

function selectedIds(taskText) {
	return loadOperatingModel({ taskText }).selectedBundles.map((bundle) => bundle.id);
}

test("repository operating model selects always-load bundles", () => {
	const ids = selectedIds("Update documentation for the ResearchOps platform.");

	assert.deepEqual(ids.slice(0, 3), [
		"github-diamond",
		"researchops-developer",
		"gold-standard-gov-product",
	]);
});

test("repository operating model selects conditional bundles by task text", () => {
	const ids = selectedIds(
		"Fix a Cloudflare Worker route that writes Airtable records and syncs Mural widgets.",
	);

	assert.ok(ids.includes("cloudflare-core-developer"));
	assert.ok(ids.includes("airtable-public-api"));
	assert.ok(ids.includes("mural-public-api"));
});

test("repository operating model sources are referenced from AGENTS.md", () => {
	const agents = fs.readFileSync("AGENTS.md", "utf8");

	for (const reference of [
		".agent-operating-model/orchestration.xml",
		".agent-operating-model/bundle-registry.json",
		".agent-operating-model/bootstrap-checklist.md",
		".agent-operating-model/precedence-policy.md",
		".agent-operating-model/trace-policy.md",
		"docs/devops/ResearchOps-Bundle-Setup.zip",
	]) {
		assert.match(agents, new RegExp(reference.replace(/[.]/g, "\\.")));
	}
});
