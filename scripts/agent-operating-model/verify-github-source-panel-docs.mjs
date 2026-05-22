#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DOCS_ROOT = 'docs/agent-operating-model/bundles/github';
const SOURCE_ROOT = path.join(DOCS_ROOT, 'source');
const REQUIRED_FAMILY_PAGES = [
	['modes', 'mode', ['How the agent uses this file', 'What to look for', 'Completion evidence']],
	['roles', 'role', ['How the agent uses this role', 'What judgement it applies', 'Escalation signals']],
	['references', 'reference', ['How the agent uses this file', 'What to look for']],
	['contracts', 'contract', ['What this schema controls', 'What evidence it validates', 'What breaks the contract']],
	['graders', 'grader', ['What this grader scores', 'What causes a fail', 'What evidence it expects']],
	['templates', 'template', ['When this template is used', 'What must be customised', 'What must not be changed blindly']],
	['scripts', 'script', ['What this script verifies', 'When it should be run', 'What failure means']],
	['examples', 'example', ['How the agent uses this file', 'What to look for']],
];
const REQUIRED_EXAMPLE_PATHS = [
	'examples/scenarios/repo-discovery-node-api.yaml',
	'examples/scenarios/repo-fix-failing-ci.yaml',
	'examples/expected-outputs/repo-release-readiness.md',
	'examples/payloads/http-json-success.json',
	'examples/performance-inputs/k6-summary.json',
	'examples/performance-results/python-results.yaml',
];

async function fileExists(filePath) {
	return Boolean((await stat(filePath).catch(() => null))?.isFile());
}

async function directoryExists(filePath) {
	return Boolean((await stat(filePath).catch(() => null))?.isDirectory());
}

async function readRequired(filePath) {
	if (!(await fileExists(filePath))) {
		throw new Error(`Missing required generated file: ${filePath}`);
	}

	return readFile(filePath, 'utf8');
}

function assertContains(value, expected, filePath) {
	if (!value.includes(expected)) {
		throw new Error(`${filePath} must contain: ${expected}`);
	}
}

function assertNotContains(value, forbidden, filePath) {
	if (value.includes(forbidden)) {
		throw new Error(`${filePath} must not contain: ${forbidden}`);
	}
}

function sourcePanels(html) {
	return [...html.matchAll(/<article class="source-panel[\s\S]*?<\/article>/g)].map((match) => match[0]);
}

function panelId(panelHtml) {
	return panelHtml.match(/id="([^"]+)"/)?.[1] || 'unknown-panel';
}

async function main() {
	const overviewPath = path.join(DOCS_ROOT, 'index.html');
	const sourceHubPath = path.join(SOURCE_ROOT, 'index.html');
	const overview = await readRequired(overviewPath);
	const sourceHub = await readRequired(sourceHubPath);

	assertContains(overview, 'How the GitHub bundle works', overviewPath);
	assertContains(overview, 'Purpose', overviewPath);
	assertContains(overview, 'How to read the bundle', overviewPath);
	assertContains(overview, 'Prompt spec', overviewPath);
	assertContains(overview, 'Mutation policy', overviewPath);
	assertContains(overview, 'Source panels', overviewPath);
	assertContains(overview, 'Worked flow', overviewPath);
	assertContains(overview, 'Coverage note', overviewPath);
	assertContains(overview, '<strong>Version</strong>2.9.3', overviewPath);

	for (const forbidden of [
		'Source browser',
		'Generated full source extraction pages',
		'generated-warning',
		'This navigation moves between source categories',
	]) {
		assertNotContains(overview, forbidden, overviewPath);
		assertNotContains(sourceHub, forbidden, sourceHubPath);
	}

	if (await directoryExists(path.join(SOURCE_ROOT, 'bundle-root'))) {
		throw new Error('Generated docs must not contain source/bundle-root/. Root files belong in /bundles/github/index.html.');
	}

	for (const [family, pill, headings] of REQUIRED_FAMILY_PAGES) {
		const pagePath = path.join(SOURCE_ROOT, family, 'index.html');
		const html = await readRequired(pagePath);

		assertContains(html, `<span class="pill">${pill}</span>`, pagePath);

		const panels = sourcePanels(html);
		if (!panels.length) throw new Error(`${pagePath} must contain at least one source panel.`);

		for (const panel of panels) {
			const id = panelId(panel);
			for (const heading of headings) {
				if (!panel.includes(heading)) {
					throw new Error(`${pagePath} panel ${id} must contain: ${heading}`);
				}
			}
		}

		for (const forbidden of [
			'Canonical source',
			'File details',
			'Layout rule',
			'<span class="pill">xml</span>',
			'<span class="pill">json</span>',
			'<span class="pill">yaml</span>',
			'<span class="pill">python</span>',
			'<span class="pill">markdown</span>',
		]) {
			assertNotContains(html, forbidden, pagePath);
		}
	}

	const examplesPath = path.join(SOURCE_ROOT, 'examples', 'index.html');
	const examples = await readRequired(examplesPath);
	for (const examplePath of REQUIRED_EXAMPLE_PATHS) {
		assertContains(examples, examplePath, examplesPath);
	}
	assertContains(examples, '<span class="pill">example</span>', examplesPath);

	console.log('GitHub source panel docs verified.');
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
