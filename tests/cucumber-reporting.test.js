import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
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
	assert.match(evidence.scenarios[0].gherkin, /Then the page should have a <title> containing "Projects"/);
});

test('mergeCucumberReport creates a dedicated page and injects route details with Gherkin', () => {
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
						path: '/pages/projects/index.html',
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
			'\t\t\t<div class="states"></div>',
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
	assert.equal(fs.existsSync(path.join(siteDir, 'cucumber', 'cucumber-report.html')), true);
});
