import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { buildHomeAcceptanceCriteriaFromSource } from '../scripts/researchops-home-acceptance.mjs';
import { buildProjectsAcceptanceCriteriaFromSource } from '../scripts/researchops-projects-acceptance.mjs';
import { syncReportAcceptanceCriteria } from '../scripts/sync-report-acceptance-criteria.mjs';

test('home criteria are generated from the current home page source', () => {
	const gherkin = buildHomeAcceptanceCriteriaFromSource();

	assert.match(gherkin, /Start by creating a research project/);
	assert.match(gherkin, /What you can do after creating a project/);
	assert.match(gherkin, /Turn research evidence into recommendations/);
	assert.match(gherkin, /Available after sessions/);
	assert.doesNotMatch(gherkin, /Choose a journey to explore/);
	assert.doesNotMatch(gherkin, /Go to objective definition service/);
});

test('projects criteria are generated from the current Projects page source', () => {
	const gherkin = buildProjectsAcceptanceCriteriaFromSource();

	assert.match(gherkin, /Feature: Review research projects/);
	assert.match(gherkin, /Review research projects created in ResearchOps/);
	assert.match(gherkin, /Open a project dashboard to manage studies, participants, sessions, notes, evidence, insights and recommendations/);
	assert.match(gherkin, /Scenario: Start a new project from the Projects page/);
	assert.match(gherkin, /Scenario: Understand the project list/);
	assert.match(gherkin, /Projects are shown with the newest created project first/);
	assert.match(gherkin, /Scenario: Review loaded project records/);
	assert.match(gherkin, /Project title/);
	assert.match(gherkin, /Stakeholders and objectives/);
	assert.match(gherkin, /Scenario: Recover when there are no projects yet/);
	assert.match(gherkin, /No projects yet/);
	assert.match(gherkin, /Scenario: Recover when project records cannot load/);
	assert.match(gherkin, /Could not load projects/);
	assert.match(gherkin, /Scenario: Use the page without JavaScript/);
	assert.match(gherkin, /Project records need JavaScript to load/);
	assert.doesNotMatch(gherkin, /Given the route/);
	assert.doesNotMatch(gherkin, /captured evidence status/);
});

test('syncReportAcceptanceCriteria refreshes stale home criteria in the reporting site', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'researchops-report-sync-'));
	const siteDir = path.join(dir, 'reports-site');
	const staleCriteria = [
		'Feature: Stale home criteria',
		'',
		'  Scenario: Old journey language',
		'    Then I should see "Choose a journey to explore"',
	].join('\n');

	fs.mkdirSync(siteDir, { recursive: true });
	fs.writeFileSync(
		path.join(siteDir, 'manifest.json'),
		`${JSON.stringify(
			{
				pages: [
					{
						id: 'home',
						states: [
							{
								id: 'default',
								acceptanceCriteria: staleCriteria,
							},
						],
					},
				],
			},
			null,
			2
		)}\n`,
		'utf8'
	);
	fs.writeFileSync(
		path.join(siteDir, 'index.html'),
		[
			'<!doctype html>',
			'<article class="page-card" id="home">',
			'<details data-state-acceptance-criteria>',
			'<pre class="gherkin-criteria"><code>Feature: Stale home criteria\n\n  Scenario: Old journey language\n    Then I should see &quot;Choose a journey to explore&quot;</code></pre>',
			'</details>',
			'</article>',
		].join('\n'),
		'utf8'
	);

	const result = syncReportAcceptanceCriteria({ siteDir, pages: ['home'] });
	const manifest = JSON.parse(fs.readFileSync(path.join(siteDir, 'manifest.json'), 'utf8'));
	const indexHtml = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
	const homeState = manifest.pages[0].states[0];

	assert.equal(result.changed, true);
	assert.match(homeState.acceptanceCriteria, /What you can do after creating a project/);
	assert.match(homeState.acceptanceCriteria, /Turn research evidence into recommendations/);
	assert.equal(homeState.criteriaSource.path, 'public/index.html');
	assert.equal(homeState.criteriaSource.generator, 'scripts/researchops-home-acceptance.mjs');
	assert.match(indexHtml, /What you can do after creating a project/);
	assert.doesNotMatch(indexHtml, /Choose a journey to explore/);
});

test('syncReportAcceptanceCriteria refreshes stale Projects criteria in the reporting site', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'researchops-report-sync-'));
	const siteDir = path.join(dir, 'reports-site');
	const staleCriteria = [
		'Feature: Stale projects criteria',
		'',
		'  Scenario: Old generic projects language',
		'    Then I should see "Review research projects"',
	].join('\n');

	fs.mkdirSync(siteDir, { recursive: true });
	fs.writeFileSync(
		path.join(siteDir, 'manifest.json'),
		`${JSON.stringify(
			{
				pages: [
					{
						id: 'projects',
						states: [
							{
								id: 'default',
								acceptanceCriteria: staleCriteria,
							},
						],
					},
				],
			},
			null,
			2
		)}\n`,
		'utf8'
	);
	fs.writeFileSync(
		path.join(siteDir, 'index.html'),
		[
			'<!doctype html>',
			'<article class="page-card" id="projects">',
			'<details data-state-acceptance-criteria>',
			'<pre class="gherkin-criteria"><code>Feature: Stale projects criteria\n\n  Scenario: Old generic projects language\n    Then I should see &quot;Review research projects&quot;</code></pre>',
			'</details>',
			'</article>',
		].join('\n'),
		'utf8'
	);

	const result = syncReportAcceptanceCriteria({ siteDir, pages: ['projects'] });
	const manifest = JSON.parse(fs.readFileSync(path.join(siteDir, 'manifest.json'), 'utf8'));
	const indexHtml = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
	const projectsState = manifest.pages[0].states[0];

	assert.equal(result.changed, true);
	assert.match(projectsState.acceptanceCriteria, /Feature: Review research projects/);
	assert.match(projectsState.acceptanceCriteria, /Scenario: Understand the project list/);
	assert.match(projectsState.acceptanceCriteria, /No projects yet/);
	assert.match(projectsState.acceptanceCriteria, /Project records need JavaScript to load/);
	assert.equal(projectsState.criteriaSource.path, 'public/pages/projects/index.html');
	assert.equal(projectsState.criteriaSource.generator, 'scripts/researchops-projects-acceptance.mjs');
	assert.match(indexHtml, /Project records need JavaScript to load/);
	assert.doesNotMatch(indexHtml, /Stale projects criteria/);
});
