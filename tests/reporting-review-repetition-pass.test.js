import test from 'node:test';
import assert from 'node:assert/strict';

import {
	applyReportingReviewRepetitionPassToHtml,
	GROUP_REVIEW_MODEL,
} from '../scripts/apply-reporting-review-repetition-pass.mjs';
import {
	finaliseReportingReviewRepetitionHtml,
	GROUP_HEADER_PANEL_INSERTION,
	ORIGINAL_GROUP_PANEL_INSERTION,
} from '../scripts/finalise-reporting-review-repetition-pass.mjs';

function buildFixtureReport() {
	return `<!doctype html>
<html lang="en-GB">
<head>
	<meta charset="utf-8">
	<title>Fixture report</title>
</head>
<body>
	<article class="page-card" id="start">
		<div class="page-card__header">
			<h3>Start research project</h3>
			<p>Start a new research project.</p>
		</div>
		<div class="states">
			<section class="state">
				<h3>Default state</h3>
				<p>Screenshot evidence State-level acceptance criteria Accessibility evidence Design-risk notes</p>
				<details open>
					<summary>State-level acceptance criteria</summary>
					<pre>Scenario: View the guided process identity</pre>
				</details>
			</section>
			<section class="state">
				<h3>Step 2 completed with researcher-authored context</h3>
				<p>Screenshot evidence State-level acceptance criteria Accessibility evidence Design-risk notes</p>
			</section>
			<section class="state">
				<h3>Step 2 AI rewrite shown</h3>
				<p>Screenshot evidence State-level acceptance criteria Accessibility evidence Design-risk notes</p>
			</section>
		</div>
	</article>
</body>
</html>`;
}

test('finalised reporting review pass renders grouping and state details contracts', () => {
	const html = finaliseReportingReviewRepetitionHtml(
		applyReportingReviewRepetitionPassToHtml(buildFixtureReport())
	);

	assert.match(html, /What this grouping should support/);
	assert.match(html, /What this state should support/);
	assert.match(html, /reporting-review__status/);
	assert.match(html, /Feature: Start a new research project/);
	assert.match(html, /Scenario: Understand the steps in the guided process/);
});

test('finalised reporting review pass moves group panels to the page-card header', () => {
	const html = finaliseReportingReviewRepetitionHtml(
		applyReportingReviewRepetitionPassToHtml(buildFixtureReport())
	);

	assert.match(html, /const statesContainer = firstCard\.closest\('\.states'\)/);
	assert.match(html, /const headerPanel = pageCard \? pageCard\.querySelector\('\.page-card__header'\) : null/);
	assert.match(html, /groupPanel\.dataset\.reportingReviewPlacement = headerPanel \? 'group-header' : 'before-states'/);
	assert.match(html, /headerPanel\.append\(groupPanel\)/);
	assert.doesNotMatch(html, new RegExp(ORIGINAL_GROUP_PANEL_INSERTION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
	assert.equal(GROUP_HEADER_PANEL_INSERTION.includes('firstCard.insertAdjacentElement(\'beforebegin\', groupPanel)'), true);
});

test('finalised reporting review pass removes non-AI state AI wording', () => {
	const html = finaliseReportingReviewRepetitionHtml(
		applyReportingReviewRepetitionPassToHtml(buildFixtureReport())
	);

	assert.doesNotMatch(html, /Step 2 completed without AI rewrite invoked/);
	assert.match(html, /Step 2 completed with researcher-authored context/);
	assert.match(html, /Step 2 AI rewrite shown/);
});

test('general chrome criteria are kept out of curated state-level criteria', () => {
	const forbiddenChromeScenarios =
		/View the guided process identity|Understand that the service is a prototype|Navigate using the primary navigation/;

	for (const group of Object.values(GROUP_REVIEW_MODEL)) {
		for (const state of Object.values(group.states)) {
			assert.doesNotMatch(
				state.gherkin,
				forbiddenChromeScenarios,
				`${group.title} / ${state.title} should not repeat general chrome criteria`
			);
		}
	}
});

test('AI-specific criteria is limited to the AI-specific state evidence', () => {
	const aiSpecificState = GROUP_REVIEW_MODEL.start.states['Step 2 AI rewrite shown'];

	assert.match(aiSpecificState.gherkin, /Scenario: Use AI assistance deliberately/);

	for (const [stateLabel, state] of Object.entries(GROUP_REVIEW_MODEL.start.states)) {
		if (stateLabel === 'Step 2 AI rewrite shown') continue;

		assert.doesNotMatch(
			`${state.title}\n${state.gherkin}\n${state.risk}`,
			/\bAI\b|AI-/,
			`${state.title} should not mention AI outside the AI-specific state`
		);
	}
});

test('guided-process step details are kept at start group level only', () => {
	assert.match(
		GROUP_REVIEW_MODEL.start.gherkin,
		/Scenario: Understand the steps in the guided process/
	);

	for (const state of Object.values(GROUP_REVIEW_MODEL.start.states)) {
		assert.doesNotMatch(
			state.gherkin,
			/Scenario: Understand the steps in the guided process/,
			`${state.title} should not repeat the group-level guided-steps scenario`
		);
	}
});
