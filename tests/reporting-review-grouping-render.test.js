import test from 'node:test';
import assert from 'node:assert/strict';

import {
	applyReportingReviewGrouping,
	GROUP_REVIEW_MODEL,
} from '../scripts/sync-report-acceptance-criteria.mjs';

function buildFixtureReport() {
	return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <title>Fixture report</title>
</head>
<body>
  <article>
    <h2>Start research project</h2>
    <section>
      <h3>Default state</h3>
      <p>Screenshot evidence Route-level Cucumber evidence State-level acceptance criteria Accessibility evidence Design-risk notes</p>
      <details open>
        <summary>What this screen state should support</summary>
        <pre>Feature: Start a new research project</pre>
      </details>
      <dl>
        <dt>Design risk</dt>
        <dd>The guided project setup could collect plausible project metadata without making privacy boundaries, required fields and AI-assistance disclosure clear enough.</dd>
      </dl>
    </section>
    <section>
      <h3>Step 2 AI rewrite shown</h3>
      <p>Screenshot evidence Route-level Cucumber evidence State-level acceptance criteria Accessibility evidence Design-risk notes</p>
      <details open>
        <summary>What this screen state should support</summary>
        <pre>Feature: Start a new research project</pre>
      </details>
      <dl>
        <dt>Design risk</dt>
        <dd>The guided project setup could collect plausible project metadata without making privacy boundaries, required fields and AI-assistance disclosure clear enough.</dd>
      </dl>
    </section>
  </article>
</body>
</html>`;
}

test('applyReportingReviewGrouping injects the runtime grouping assets once', () => {
	const html = applyReportingReviewGrouping(buildFixtureReport());
	const htmlAfterSecondPass = applyReportingReviewGrouping(html);

	assert.match(html, /reporting-review-grouping-styles/);
	assert.match(html, /reporting-review-grouping-script/);
	assert.match(html, /What this grouping should support/);
	assert.match(html, /What this state should support/);
	assert.match(html, /reporting-review__status/);
	assert.equal((htmlAfterSecondPass.match(/reporting-review-grouping-script/g) || []).length, 1);
});

test('group review model contains group and state evidence for required report groups', () => {
	for (const groupId of ['start', 'participant-consent', 'analysis']) {
		const group = GROUP_REVIEW_MODEL[groupId];

		assert.ok(group, `${groupId} group should exist`);
		assert.match(group.gherkin, /^Feature:/);
		assert.equal(group.acceptanceStatus, 'needs-review');
		assert.equal(group.designRiskStatus, 'needs-review');
		assert.ok(group.designRisk.risk.length > 0);
		assert.ok(Object.keys(group.states).length > 0);

		for (const state of Object.values(group.states)) {
			assert.equal(state.acceptanceStatus, 'needs-review');
			assert.equal(state.designRiskStatus, 'needs-review');
		}
	}
});

test('start research project group criteria uses the grouping-level journey contract only', () => {
	const group = GROUP_REVIEW_MODEL.start;

	assert.match(group.gherkin, /Feature: Start a new research project/);
	assert.match(group.gherkin, /Scenario: Complete the guided project setup safely/);
	assert.match(group.gherkin, /without entering participant personal data/);
	assert.doesNotMatch(group.gherkin, /Scenario: Use AI assistance deliberately/);
	assert.doesNotMatch(
		group.gherkin,
		/Scenario: Recover from missing or invalid project information/
	);
});

test('start research project default state criteria covers focused controls and continue action', () => {
	const defaultState = GROUP_REVIEW_MODEL.start.states['Default state'];

	assert.match(defaultState.gherkin, /Feature: Default state/);
	assert.match(defaultState.gherkin, /focus should be applied to the Project name text field/);
	assert.match(defaultState.gherkin, /yellow GOV\.UK focus style should be present/);
	assert.match(defaultState.gherkin, /\| Pre-Discovery \|/);
	assert.match(defaultState.gherkin, /\| Monitoring metrics \|/);
	assert.match(defaultState.gherkin, /Scenario: Continuing to the next step/);
	assert.match(defaultState.gherkin, /Continue button/);
});

test('AI assistance criteria is limited to the AI-specific start-project state', () => {
	const startStates = GROUP_REVIEW_MODEL.start.states;

	assert.match(
		startStates['Step 2 AI rewrite shown'].gherkin,
		/Scenario: Use AI assistance deliberately/
	);

	for (const [label, state] of Object.entries(startStates)) {
		if (label === 'Step 2 AI rewrite shown') continue;

		assert.doesNotMatch(
			state.gherkin,
			/Scenario: Use AI assistance deliberately/,
			`${label} must not include AI-specific acceptance criteria`
		);
	}
});

test('error recovery criteria is limited to error or blocker states', () => {
	assert.match(
		GROUP_REVIEW_MODEL['participant-consent'].states['Missing study context error state'].gherkin,
		/required consent context is missing or invalid/
	);
	assert.match(
		GROUP_REVIEW_MODEL.analysis.states['Missing study ID error state'].gherkin,
		/required study context is missing or invalid/
	);

	assert.doesNotMatch(
		GROUP_REVIEW_MODEL.start.states['Default state'].gherkin,
		/missing or invalid project information/
	);
});

test('state evidence remains shorter and scenario-specific compared with group evidence', () => {
	for (const group of Object.values(GROUP_REVIEW_MODEL)) {
		for (const state of Object.values(group.states)) {
			assert.notEqual(
				state.gherkin,
				group.gherkin,
				`${group.title} state criteria should not duplicate group criteria exactly`
			);
			assert.ok(
				state.risk.length < group.designRisk.risk.length,
				`${group.title} state risk should not duplicate group risk`
			);
		}
	}
});
