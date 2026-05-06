import test from 'node:test';
import assert from 'node:assert/strict';

import { applyReportingReviewEvidenceToManifest } from '../scripts/reporting-review-evidence.mjs';
import { renderReportingReviewHtml } from '../scripts/render-reporting-review-site.mjs';

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
		captures: [],
	};
}

function manifestFixture() {
	return {
		title: 'ResearchOps application visual walkthrough',
		description: 'Fixture manifest',
		startedAt: '2026-05-06T00:00:00.000Z',
		baseURL: 'https://researchops.pages.dev/',
		failureCount: 0,
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
					stateFixture('default', 'Default state', 'Feature: Start a new research project\nScenario: Navigate using the primary navigation'),
					stateFixture('step-2-filled-no-ai', 'Step 2 completed with researcher-authored context', 'Feature: Start a new research project\nScenario: Use AI description assistance'),
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
	const researcherAuthoredState = startPage.states.find((state) => state.id === 'step-2-filled-no-ai');

	assert.match(defaultState.acceptanceCriteria, /Feature: Start project default state/);
	assert.doesNotMatch(defaultState.acceptanceCriteria, /Navigate using the primary navigation/);
	assert.match(researcherAuthoredState.acceptanceCriteria, /Feature: Step 2 completed with researcher-authored context/);
	assert.doesNotMatch(researcherAuthoredState.acceptanceCriteria, /AI description assistance/);
	assert.doesNotMatch(researcherAuthoredState.acceptanceCriteria, /automated rewriting is required/);
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
