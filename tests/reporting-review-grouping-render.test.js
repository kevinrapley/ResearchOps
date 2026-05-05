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
	assert.equal((htmlAfterSecondPass.match(/reporting-review-grouping-script/g) || []).length, 1);
});

test('group review model contains group and state evidence for required report groups', () => {
	for (const groupId of ['start', 'participant-consent', 'analysis']) {
		const group = GROUP_REVIEW_MODEL[groupId];

		assert.ok(group, `${groupId} group should exist`);
		assert.match(group.gherkin, /^Feature:/);
		assert.ok(group.designRisk.risk.length > 0);
		assert.ok(Object.keys(group.states).length > 0);
	}
});

test('state evidence remains shorter and scenario-specific compared with group evidence', () => {
	for (const group of Object.values(GROUP_REVIEW_MODEL)) {
		for (const state of Object.values(group.states)) {
			assert.ok(
				state.gherkin.length < group.gherkin.length,
				`${group.title} state criteria should not duplicate group criteria`
			);
			assert.ok(
				state.risk.length < group.designRisk.risk.length,
				`${group.title} state risk should not duplicate group risk`
			);
		}
	}
});
