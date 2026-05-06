import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import { applyReportingReviewEvidenceToManifest } from '../scripts/reporting-review-evidence.mjs';
import { renderReportingReviewHtml } from '../scripts/render-reporting-review-site.mjs';

function captureFixture(profile, title) {
	return {
		profile,
		profileTitle: title,
		status: 'captured',
		url: `https://researchops.pages.dev/${profile}`,
		screenshot: `screenshots/${profile}/fixture.png`,
	};
}

function stateFixture(id, title, acceptanceCriteria = 'Generated full-page criteria') {
	return {
		id,
		title,
		description: `${title} description`,
		status: 'captured',
		url: `https://researchops.pages.dev/${id}`,
		acceptanceCriteria,
		criteriaMaturity: {
			label: 'Needs review',
			slug: 'needs-review',
			description: 'Generated criteria.',
		},
		designRisk: {
			risk: 'Generated risk',
			impact: 'Generated impact',
			recommendedChange: 'Generated recommendation',
			owner: 'UCD team',
			status: 'Needs review',
		},
		evidenceTypes: ['Screenshot evidence', 'State-level acceptance criteria'],
		captures: [captureFixture('desktop', 'Desktop'), captureFixture('mobile', 'Mobile')],
	};
}

function manifestFixture() {
	return {
		title: 'ResearchOps application visual walkthrough',
		description: 'Fixture manifest',
		startedAt: '2026-05-06T00:00:00.000Z',
		baseURL: 'https://researchops.pages.dev/',
		failureCount: 0,
		profiles: [
			{
				id: 'desktop',
				title: 'Desktop',
				description: 'Desktop Chromium viewport.',
			},
			{
				id: 'mobile',
				title: 'Mobile',
				description: 'Mobile Chromium viewport.',
			},
		],
		pages: [
			{
				id: 'home',
				title: 'Home',
				group: 'Core',
				path: '/',
				description: 'Home page',
				states: [stateFixture('default', 'Default state')],
			},
			{
				id: 'start',
				title: 'Start research project',
				group: 'Core',
				path: '/pages/start/index.html',
				description: 'Start page',
				states: [
					stateFixture(
						'default',
						'Default state',
						'Feature: Start a new research project\nScenario: Navigate using the primary navigation'
					),
					stateFixture(
						'step-2-filled-no-ai',
						'Step 2 completed with researcher-authored context',
						'Feature: Start a new research project\nScenario: Use AI description assistance'
					),
				],
			},
			{
				id: 'study-participant-consent',
				title: 'Participant consent',
				group: 'Study',
				path: '/pages/study/participant-consent/index.html',
				description: 'Consent page',
				states: [stateFixture('default', 'Consent workspace loaded')],
			},
			{
				id: 'synthesize',
				title: 'Study synthesis',
				group: 'Analysis',
				path: '/pages/synthesize/index.html',
				description: 'Synthesis page',
				states: [stateFixture('missing-sid-error', 'Missing study ID error state')],
			},
		],
	};
}

test('reporting review evidence is applied by page and state id rather than text matching', () => {
	const manifest = applyReportingReviewEvidenceToManifest(manifestFixture());
	const homePage = manifest.pages.find((page) => page.id === 'home');
	const startPage = manifest.pages.find((page) => page.id === 'start');
	const consentPage = manifest.pages.find((page) => page.id === 'study-participant-consent');
	const analysisPage = manifest.pages.find((page) => page.id === 'synthesize');

	assert.equal(homePage.reviewGroupId, undefined);
	assert.equal(startPage.reviewGroupId, 'start');
	assert.equal(consentPage.reviewGroupId, 'participant-consent');
	assert.equal(analysisPage.reviewGroupId, 'analysis');
	assert.equal(startPage.states[0].acceptanceCriteriaSource, 'repo-curated');
	assert.equal(startPage.states[0].suppressGeneratedStateCriteria, true);
	assert.equal(consentPage.states[0].suppressGeneratedStateCriteria, true);
	assert.equal(analysisPage.states[0].suppressGeneratedStateCriteria, true);
});

test('curated start states replace old full-page generated criteria', () => {
	const manifest = applyReportingReviewEvidenceToManifest(manifestFixture());
	const startPage = manifest.pages.find((page) => page.id === 'start');
	const defaultState = startPage.states.find((state) => state.id === 'default');
	const researcherAuthoredState = startPage.states.find(
		(state) => state.id === 'step-2-filled-no-ai'
	);

	assert.match(defaultState.acceptanceCriteria, /Feature: Start project default state/);
	assert.match(defaultState.acceptanceCriteria, /not be asked to select the service phase or project status in Step 1/);
	assert.match(defaultState.acceptanceCriteria, /Discovery/);
	assert.match(defaultState.acceptanceCriteria, /Goal setting & problem defining/);
	assert.doesNotMatch(defaultState.acceptanceCriteria, /Navigate using the primary navigation/);
	assert.doesNotMatch(defaultState.acceptanceCriteria, /Service phase option group/);
	assert.doesNotMatch(defaultState.acceptanceCriteria, /Project status option group/);
	assert.match(
		researcherAuthoredState.acceptanceCriteria,
		/Feature: Step 2 completed with researcher-authored context/
	);
	assert.doesNotMatch(researcherAuthoredState.acceptanceCriteria, /AI description assistance/);
	assert.match(
		researcherAuthoredState.acceptanceCriteria,
		/should not imply that automated rewriting is required/
	);
});

test('rendered report emits group evidence above states without runtime grouping script', () => {
	const html = renderReportingReviewHtml(manifestFixture());
	const startPageHeaderIndex = html.indexOf('Start research project — group-level review evidence');
	const startStatesIndex = html.indexOf('<div class="states">', startPageHeaderIndex);

	assert.ok(startPageHeaderIndex > -1);
	assert.ok(startStatesIndex > startPageHeaderIndex);
	assert.match(html, /data-review-group-id="start"/);
	assert.match(html, /data-review-evidence-level="group"/);
	assert.match(html, /data-suppress-generated-state-criteria="true"/);
	assert.match(html, /What this grouping should support/);
	assert.match(html, /What this state should support/);
	assert.match(html, /Step 1 should ask only for the essential project name and description/);
	assert.match(html, /Goal setting &amp; problem defining/);
	assert.doesNotMatch(html, /reporting-review-grouping-script/);
	assert.doesNotMatch(html, /insertAdjacentElement/);
});

test('non-curated pages keep generated screen-state criteria', () => {
	const html = renderReportingReviewHtml(manifestFixture());
	const homeIndex = html.indexOf('Home page');
	const startIndex = html.indexOf('Start research project — group-level review evidence');
	const homeFragment = html.slice(homeIndex, startIndex);

	assert.match(homeFragment, /What this screen state should support/);
	assert.match(homeFragment, /Generated full-page criteria/);
});

test('walkthrough workflow restores source-derived criteria sync before rendering', () => {
	const workflow = fs.readFileSync('.github/workflows/qa-bdd.yml', 'utf8');
	const walkthroughIndex = workflow.indexOf('npm run qa:visual-walkthrough');
	const syncIndex = workflow.indexOf(
		'node scripts/sync-report-acceptance-criteria.mjs reports-site'
	);
	const renderIndex = workflow.indexOf(
		'node scripts/render-reporting-review-site.mjs reports-site'
	);

	assert.ok(walkthroughIndex > -1);
	assert.ok(syncIndex > walkthroughIndex);
	assert.ok(renderIndex > syncIndex);
});

test('rendered report preserves profile filtering controls and capture targets', () => {
	const html = renderReportingReviewHtml(manifestFixture());

	assert.match(html, /class="profile-switcher"/);
	assert.match(html, /aria-label="Screenshot profile"/);
	assert.match(html, /data-profile-filter="desktop" aria-pressed="true"/);
	assert.match(html, /data-profile-filter="mobile" aria-pressed="false"/);
	assert.match(html, /data-profile-filter="compare" aria-pressed="false"/);
	assert.match(html, /class="capture" data-profile="desktop"/);
	assert.match(html, /class="capture" data-profile="mobile"/);
	assert.match(html, /document\.documentElement\.dataset\.profileFilter = activeProfile/);
	assert.match(html, /capture\.hidden = !showAll && capture\.dataset\.profile !== activeProfile/);
});
