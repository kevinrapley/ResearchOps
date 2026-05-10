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

function assertCanonicalBundle(bundle) {
	assert.ok(bundle.canonicalPath, `${bundle.id} should expose canonicalPath`);
	assert.ok(bundle.promptSpec, `${bundle.id} should expose promptSpec`);
	assert.ok(bundle.promptBody, `${bundle.id} should expose promptBody`);
	assert.ok(fs.existsSync(bundle.canonicalPath), `${bundle.id} canonicalPath should exist`);
	assert.ok(fs.existsSync(`${bundle.canonicalPath}${bundle.promptSpec}`));
	assert.ok(fs.existsSync(`${bundle.canonicalPath}${bundle.promptBody}`));
}

function cloudflarePath(relativePath) {
	return `.agent-operating-model/bundles/cloudflare/${relativePath}`;
}

function cloudflareFile(relativePath) {
	return fs.readFileSync(cloudflarePath(relativePath), "utf8");
}

function extractUrls(text) {
	return Array.from(text.matchAll(/https:\/\/[^\s"'<>]+/g)).map((match) => match[0]);
}

test("repository operating model selects always-load bundles", () => {
	const bundles = selectedBundles("Update documentation for the ResearchOps platform.");
	const ids = bundles.map((bundle) => bundle.id);

	assert.deepEqual(ids.slice(0, 3), [
		"github-diamond",
		"researchops-developer-control",
		"multi-functional-team",
	]);

	for (const bundle of bundles.slice(0, 3)) {
		assertCanonicalBundle(bundle);
	}
});

test("repository operating model selects Cloudflare for runtime and deployment work", () => {
	const task = "Fix a Cloudflare Worker route and review the Wrangler binding configuration.";
	const bundle = bundleById(task, "cloudflare");

	assert.ok(bundle);
	assert.equal(bundle.selectionEvidence.selectionBasis, "required-task-signal");
	assert.equal(bundle.selectionEvidence.traceLayer, "behavioural");
	assert.ok(bundle.selectionEvidence.ruleId);
	assert.ok(bundle.selectionEvidence.matchedSignals.includes("runtime-or-deployment-change"));
	assert.ok(bundle.selectionEvidence.matchedPhrases.length > 0);
	assertCanonicalBundle(bundle);
});

test("repository operating model does not match short Cloudflare tokens inside hashes", () => {
	const task = "Please review b1f84bb6781b7ed18a85acba4dc4c7d444e1bba4";
	const ids = selectedIds(task);

	assert.equal(ids.includes("cloudflare"), false);
});

test("repository operating model does not select Cloudflare for generic pages routes or queues", () => {
	for (const task of [
		"Update documentation pages",
		"Fix the Airtable import queue",
		"Review the service route for participant records",
	]) {
		const ids = selectedIds(task);

		assert.equal(ids.includes("cloudflare"), false, `${task} should not select cloudflare`);
	}
});

test("repository operating model still matches standalone short Cloudflare product tokens", () => {
	const task = "Review D1 prepared statements and R2 object storage usage.";
	const bundle = bundleById(task, "cloudflare");

	assert.ok(bundle);
	assert.ok(bundle.selectionEvidence.matchedPhrases.includes("d1"));
	assert.ok(bundle.selectionEvidence.matchedPhrases.includes("r2"));
	assertCanonicalBundle(bundle);
});

test("repository operating model selects conditional API bundles from typed task signals", () => {
	const task = "Fix a route that writes Airtable records and syncs Mural widgets.";
	const ids = selectedIds(task);

	assert.equal(ids.includes("cloudflare"), false);
	assert.ok(ids.includes("airtable-public-api"));
	assert.ok(ids.includes("mural-public-api"));

	for (const bundleId of ["airtable-public-api", "mural-public-api"]) {
		const bundle = bundleById(task, bundleId);

		assert.equal(bundle.selectionEvidence.selectionBasis, "required-task-signal");
		assert.equal(bundle.selectionEvidence.traceLayer, "behavioural");
		assert.ok(bundle.selectionEvidence.ruleId);
		assert.ok(bundle.selectionEvidence.matchedSignals.length > 0);
		assert.ok(bundle.selectionEvidence.matchedPhrases.length > 0);
		assertCanonicalBundle(bundle);
	}
});

test("repository operating model selects Cloudflare with qualified runtime language", () => {
	const task = "Fix a Worker route that writes Airtable records and syncs Mural widgets.";
	const ids = selectedIds(task);

	assert.ok(ids.includes("cloudflare"));
	assert.ok(ids.includes("airtable-public-api"));
	assert.ok(ids.includes("mural-public-api"));
});

test("repository operating model preserves explicit registry keyword fallback", () => {
	const task = "Improve the service page";
	const bundle = bundleById(task, "govuk-design-system");

	assert.ok(bundle);
	assert.equal(bundle.selectionEvidence.selectionBasis, "registry-keyword-fallback");
	assert.deepEqual(bundle.selectionEvidence.matchedPhrases, []);
	assert.deepEqual(bundle.selectionEvidence.matchedSignals, []);
	assert.ok(bundle.selectionEvidence.matchedRegistryKeywords.includes("page"));
	assertCanonicalBundle(bundle);
});

test("repository operating model exposes typed task signals for trace reports", () => {
	const taskText = "Improve GOV.UK form accessibility and page content.";
	const model = loadOperatingModel({ taskText });
	const signalIds = model.taskSignals.map((signal) => signal.id);
	const ids = model.selectedBundles.map((bundle) => bundle.id);

	assert.ok(signalIds.includes("repository-affecting-task"));
	assert.ok(signalIds.includes("ui-or-content-change"));
	assert.ok(ids.includes("govuk-design-system"));
	assert.equal(model.canonicalRoot, ".agent-operating-model/bundles/");
	assert.equal(Object.hasOwn(model, "bundlePackage"), false);
});

test("Cloudflare bundle manifest assets exist", () => {
	const manifest = cloudflareFile("registry-manifest.yaml");
	const assetPaths = Array.from(manifest.matchAll(/^- path: (.+)$/gm)).map((match) => match[1]);

	assert.ok(assetPaths.length > 30);

	for (const assetPath of assetPaths) {
		assert.ok(fs.existsSync(cloudflarePath(assetPath)), `${assetPath} should exist`);
	}
});

test("Cloudflare bundle source catalogue covers XML reference URLs", () => {
	const catalogue = cloudflareFile("references/source-catalog.yaml");
	const sourceUrls = extractUrls(catalogue);

	assert.ok(sourceUrls.length > 25);

	for (const sourceUrl of sourceUrls) {
		assert.ok(
			sourceUrl.startsWith("https://developers.cloudflare.com/"),
			`${sourceUrl} should use developers.cloudflare.com`,
		);
	}

	const referenceFiles = fs
		.readdirSync(cloudflarePath("references"))
		.filter((file) => file.endsWith(".xml"));

	for (const referenceFile of referenceFiles) {
		for (const sourceUrl of extractUrls(cloudflareFile(`references/${referenceFile}`))) {
			assert.ok(
				sourceUrl.startsWith("https://developers.cloudflare.com/"),
				`${sourceUrl} should use developers.cloudflare.com`,
			);
			assert.ok(
				catalogue.includes(sourceUrl),
				`${sourceUrl} from ${referenceFile} should be listed in source-catalog.yaml`,
			);
		}
	}
});

test("Cloudflare bundle entrypoints include expanded operational modules", () => {
	const promptSpec = cloudflareFile("prompt.spec.yaml");
	const promptBody = cloudflareFile("prompt.body.xml");

	for (const expected of [
		"references/deployment-versions-and-triggers.xml",
		"references/testing-and-observability.xml",
		"references/compatibility-and-limits.xml",
		"references/service-bindings-and-edge-connectivity.xml",
		"modes/cloudflare-build.xml",
		"modes/cloudflare-review.xml",
		"modes/cloudflare-release.xml",
		"contracts/wrangler-configuration-review.schema.json",
		"contracts/cloudflare-validation-evidence.schema.json",
		"contracts/cloudflare-gap-register.schema.json",
	]) {
		assert.ok(promptSpec.includes(expected), `${expected} should be in prompt.spec.yaml`);
		assert.ok(promptBody.includes(expected), `${expected} should be in prompt.body.xml`);
	}
});

test("repository operating model sources are referenced from AGENTS.md", () => {
	const agents = fs.readFileSync("AGENTS.md", "utf8");

	for (const reference of [
		".agent-operating-model/orchestration.xml",
		".agent-operating-model/bundle-registry.json",
		".agent-operating-model/selection-rules.json",
		".agent-operating-model/task-signal-catalog.json",
		".agent-operating-model/bootstrap-checklist.md",
		".agent-operating-model/precedence-policy.md",
		".agent-operating-model/trace-policy.md",
		".agent-operating-model/trace-layers.md",
		".agent-operating-model/behavioural-evals.json",
		".agent-operating-model/bundles/",
		".agent-operating-model/bundles/cloudflare/",
	]) {
		assert.match(agents, new RegExp(reference.replace(/[.]/g, "\\.")));
	}

	assert.doesNotMatch(agents, /ResearchOps-Bundle-Setup\.zip/);
});
