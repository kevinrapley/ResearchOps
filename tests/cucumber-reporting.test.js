import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { buildStateAcceptanceGherkin } from '../scripts/researchops-state-acceptance.mjs';
import { buildCucumberEvidence, mergeCucumberReport } from '../scripts/merge-cucumber-report.mjs';

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

test('buildStateAcceptanceGherkin writes ResearchOps home criteria from a user researcher perspective', () => {
	const gherkin = buildStateAcceptanceGherkin(
		{
			id: 'home',
			title: 'Home',
			path: '/',
			description: 'ResearchOps landing page.',
		},
		{
			id: 'default',
			title: 'Default state',
			description: 'Initial loaded page state.',
			status: 'captured',
		},
		{
			id: 'default',
			title: 'Default state',
			description: 'Initial loaded page state.',
		}
	);

	assert.match(gherkin, /Feature: Access the ResearchOps home page/);
	assert.match(gherkin, /As a user researcher/);
	assert.match(gherkin, /I want to access the ResearchOps home page/);
	assert.match(gherkin, /So that I can choose the right ResearchOps journey for my work/);
	assert.match(gherkin, /Scenario: View the ResearchOps service identity/);
	assert.match(gherkin, /ResearchOps demo suite/);
	assert.doesNotMatch(gherkin, /ResearchOps Demo Suite/);
	assert.match(gherkin, /Objective orientated applied user research done well\./);
	assert.match(gherkin, /Scenario: Navigate using the primary navigation/);
	assert.match(gherkin, /Start research project/);
	assert.match(gherkin, /Scenario: Access the home page using a keyboard/);
	assert.doesNotMatch(gherkin, /Given the route/);
	assert.doesNotMatch(gherkin, /captured evidence status/);
});

test('buildStateAcceptanceGherkin writes source-derived start-project criteria', () => {
	const gherkin = buildStateAcceptanceGherkin(
		{
			id: 'start',
			title: 'Start research project',
			path: '/pages/start/index.html',
			description: 'Start page for creating or beginning research project work.',
		},
		{
			id: 'step-4-check-answers',
			title: 'Step 4 check your answers before create project',
			description: 'The review step is shown before project creation is submitted.',
			status: 'captured',
		},
		{
			path: '/pages/start/index.html',
			actions: [
				{
					type: 'click',
					selector: '#next4',
				},
			],
		}
	);

	assert.match(gherkin, /Feature: Start a new research project/);
	assert.match(gherkin, /As a user researcher/);
	assert.match(
		gherkin,
		/I want to define a research project with clear context, objectives and ownership/
	);
	assert.match(gherkin, /When I visit the start research project service/);
	assert.match(gherkin, /Scenario: Understand the steps in the guided process/);
	assert.match(gherkin, /Step 1 of 4 \| Define the project/);
	assert.match(gherkin, /Scenario: Define the project with essential information only/);
	assert.match(gherkin, /service phase should be set to "Discovery" by default/);
	assert.match(
		gherkin,
		/project status should be set to "Goal setting & problem defining" by default/
	);
	assert.match(
		gherkin,
		/not be asked to choose a service phase or project status in Step 1/
	);
	assert.match(gherkin, /Step 4 of 4 \| Check your answers before creating the project/);
	assert.match(gherkin, /Scenario: Recover when required research framing fields are missing/);
	assert.match(gherkin, /Enter at least one research objective/);
	assert.match(gherkin, /Enter at least one user group/);
	assert.match(gherkin, /This sends the objectives you entered to an AI service/);
	assert.match(gherkin, /Scenario: Check answers before creating the project/);
	assert.match(gherkin, /GOV\.UK summary list/);
	assert.match(gherkin, /Set by default/);
	assert.match(gherkin, /Scenario: Complete the guided process using a keyboard/);
	assert.doesNotMatch(gherkin, /choose a service phase from/);
	assert.doesNotMatch(gherkin, /choose a project status from/);
	assert.doesNotMatch(gherkin, /Given the route/);
	assert.doesNotMatch(gherkin, /I am reviewing/);
	assert.doesNotMatch(gherkin, /captured evidence status/);
});

test('buildStateAcceptanceGherkin derives user-centred criteria from state actions for generic pages', () => {
	const gherkin = buildStateAcceptanceGherkin(
		{
			id: 'synthesize',
			title: 'Synthesize',
			path: '/pages/synthesize/index.html',
			description: 'Synthesis page.',
		},
		{
			id: 'theme-created',
			title: 'Theme created',
			description: 'A theme has been created from grouped evidence.',
			status: 'captured',
		},
		{
			path: '/pages/synthesize/index.html',
			actions: [
				{
					type: 'fill',
					selector: '#theme-label',
					value: 'Confidence and support needs',
				},
				{
					type: 'click',
					selector: '#create-theme',
				},
			],
		}
	);

	assert.match(gherkin, /Feature: Synthesize research evidence/);
	assert.match(gherkin, /When I enter "Confidence and support needs" into the "Theme label" field/);
	assert.match(gherkin, /And I select "Create theme"/);
	assert.match(gherkin, /Scenario: Use this part of the journey accessibly/);
	assert.doesNotMatch(gherkin, /Given the route/);
});

test('mergeCucumberReport creates a dedicated page and keeps existing state Gherkin panels', () => {
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
			'\t\t\t\t\t<details class="state-acceptance-criteria" data-state-acceptance-criteria>',
			'\t\t\t\t\t\t<summary>Gherkin acceptance criteria for this state</summary>',
			'\t\t\t\t\t\t<pre class="gherkin-criteria"><code>Feature: Review research projects</code></pre>',
			'\t\t\t\t\t</details>',
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
	assert.match(indexPage, /Feature: Review research projects/);
	assert.equal(fs.existsSync(path.join(siteDir, 'cucumber', 'cucumber-report.html')), true);
});
