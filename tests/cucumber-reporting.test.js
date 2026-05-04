import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
	buildCucumberEvidence,
	buildStateAcceptanceGherkin,
	mergeCucumberReport,
} from '../scripts/merge-cucumber-report.mjs';

const cucumberJson = [
	{
		uri: 'features/smoke.feature',
		name: 'Smoke',
		elements: [
			{
				keyword: 'Scenario',
				name: 'Projects page loads',
				steps: [
					{
						keyword: 'Given ',
						name: 'the site base URL',
						result: {
							status: 'passed',
							duration: 900000,
						},
					},
					{
						keyword: 'When ',
						name: 'I visit "/pages/projects/index.html"',
						result: {
							status: 'passed',
							duration: 1200000,
						},
					},
					{
						keyword: 'Then ',
						name: 'the page should have a <title> containing "Projects"',
						result: {
							status: 'passed',
							duration: 1100000,
						},
					},
				],
			},
		],
	},
];

test('buildCucumberEvidence maps scenarios to visited routes and keeps Gherkin criteria', () => {
	const evidence = buildCucumberEvidence(cucumberJson);

	assert.equal(evidence.scenarios.length, 1);
	assert.equal(evidence.passed, 1);
	assert.equal(evidence.routes.get('/pages/projects/index.html')?.length, 1);
	assert.equal(evidence.routes.get('/pages/projects/')?.length, 1);
	assert.match(evidence.scenarios[0].gherkin, /Feature: Smoke/);
	assert.match(evidence.scenarios[0].gherkin, /Scenario: Projects page loads/);
	assert.match(evidence.scenarios[0].gherkin, /Given the site base URL/);
	assert.match(evidence.scenarios[0].gherkin, /When I visit "\/pages\/projects\/index.html"/);
	assert.match(
		evidence.scenarios[0].gherkin,
		/Then the page should have a <title> containing "Projects"/
	);
});

test('buildStateAcceptanceGherkin derives route-state criteria from state actions', () => {
	const gherkin = buildStateAcceptanceGherkin(
		{
			id: 'start',
			title: 'Start research project',
			path: '/pages/start/index.html',
		},
		{
			id: 'step-2-ai-rewrite-shown',
			title: 'Step 2 AI rewrite shown',
			description: 'The AI rewrite panel is shown after eligible objectives are entered.',
			status: 'captured',
		},
		{
			path: '/pages/start/index.html',
			actions: [
				{
					type: 'click',
					selector: '#btn-obj-ai-rewrite',
				},
				{
					type: 'waitForText',
					text: 'Concise rewrite (optional):',
				},
			],
		}
	);

	assert.match(gherkin, /Feature: Start research project visual walkthrough/);
	assert.match(gherkin, /Scenario: Step 2 AI rewrite shown/);
	assert.match(gherkin, /Given the route "\/pages\/start\/index\.html" is available/);
	assert.match(gherkin, /When I choose the control "#btn-obj-ai-rewrite"/);
	assert.match(gherkin, /Then I should see "Concise rewrite \(optional\):"/);
	assert.match(gherkin, /And the captured evidence status should be "captured"/);
});

test('mergeCucumberReport creates a dedicated page and injects route and state Gherkin', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'researchops-cucumber-'));
	const siteDir = path.join(dir, 'reports-site');
	const cucumberDir = path.join(dir, '__cuke');

	fs.mkdirSync(siteDir, { recursive: true });
	fs.mkdirSync(cucumberDir, { recursive: true });

	fs.writeFileSync(
		path.join(siteDir, 'manifest.json'),
		`${JSON.stringify(
			{
				pages: [
					{
						id: 'projects',
						title: 'Projects',
						path: '/pages/projects/index.html',
						states: [
							{
								id: 'default',
								title: 'Default state',
								description: 'Initial loaded page state.',
								status: 'captured',
								url: 'https://researchops.pages.dev/pages/projects/index.html',
							},
						],
					},
				],
			},
			null,
			2
		)}\n`
	);
	fs.writeFileSync(
		path.join(siteDir, 'index.html'),
		[
			'<!doctype html>',
			'<html lang="en-GB">',
			'<head>',
			'<style>',
			'\t\tbody { color: #111; }',
			'\t</style>',
			'</head>',
			'<body>',
			'\t<header><h1>Report</h1></header>',
			'\t\t<article class="page-card" id="projects">',
			'\t\t\t<div class="page-card__header"><h3>Projects</h3></div>',
			'\t\t\t<div class="states">',
			'\t\t\t\t<section class="state captured">',
			'\t\t\t\t\t<div class="state__header">',
			'\t\t\t\t\t\t<h4>Default state</h4>',
			'\t\t\t\t\t\t<p class="meta">captured · https://researchops.pages.dev/pages/projects/index.html</p>',
			'\t\t\t\t\t\t<p>Initial loaded page state.</p>',
			'\t\t\t\t\t</div>',
			'\t\t\t\t\t<section class="capture" data-profile="desktop"></section>',
			'\t\t\t\t</section>',
			'\t\t\t</div>',
			'\t\t</article>',
			'</body>',
			'</html>',
		].join('\n')
	);
	fs.writeFileSync(path.join(cucumberDir, 'cucumber-report.html'), '<!doctype html><p>Raw</p>');
	fs.writeFileSync(
		path.join(cucumberDir, 'cucumber-report.json'),
		`${JSON.stringify(cucumberJson, null, 2)}\n`
	);

	mergeCucumberReport({ siteDir, cucumberDir });

	const cucumberPage = fs.readFileSync(path.join(siteDir, 'cucumber.html'), 'utf8');
	const indexPage = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');

	assert.match(cucumberPage, /Projects page loads/);
	assert.match(cucumberPage, /Gherkin success criteria/);
	assert.match(cucumberPage, /Feature: Smoke/);
	assert.match(cucumberPage, /Given the site base URL/);
	assert.match(indexPage, /Cucumber evidence for this route/);
	assert.match(indexPage, /Gherkin success criteria/);
	assert.match(indexPage, /Feature: Smoke/);
	assert.match(indexPage, /When I visit &quot;\/pages\/projects\/index\.html&quot;/);
	assert.match(indexPage, /cucumber\.html#smoke-projects-page-loads/);
	assert.match(indexPage, /Gherkin acceptance criteria for this state/);
	assert.match(indexPage, /Feature: Projects visual walkthrough/);
	assert.match(indexPage, /Scenario: Default state/);
	assert.match(
		indexPage,
		/Given the route &quot;\/pages\/projects\/index\.html&quot; is available/
	);
	assert.equal(fs.existsSync(path.join(siteDir, 'cucumber', 'cucumber-report.html')), true);
});
