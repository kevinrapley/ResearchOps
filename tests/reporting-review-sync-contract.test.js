import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
	applyReportingReviewGrouping,
	syncReportAcceptanceCriteria,
} from '../scripts/sync-report-acceptance-criteria.mjs';

function makeTempReportSite() {
	const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'researchops-report-sync-'));

	const manifest = {
		pages: [
			{
				id: 'home',
				states: [
					{
						id: 'default',
						acceptanceCriteria: 'Stale home criteria',
					},
				],
			},
			{
				id: 'projects',
				states: [
					{
						id: 'default',
						acceptanceCriteria: 'Stale projects criteria',
					},
				],
			},
		],
	};

	const html = `<!doctype html>
<html lang="en-GB">
<head>
	<meta charset="utf-8">
	<title>Fixture report</title>
</head>
<body>
	<article id="home">
		<pre class="gherkin-criteria"><code>Stale home criteria</code></pre>
	</article>
	<article id="projects">
		<pre class="gherkin-criteria"><code>Stale projects criteria</code></pre>
	</article>
</body>
</html>`;

	fs.writeFileSync(path.join(siteDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
	fs.writeFileSync(path.join(siteDir, 'index.html'), html, 'utf8');

	return siteDir;
}

test('applyReportingReviewGrouping emits a valid whitespace normalisation regex', () => {
	const html = applyReportingReviewGrouping('<!doctype html><html><head></head><body></body></html>');

	assert.match(html, /replace\(\/\\s\+\/g, ' '\)/);
	assert.doesNotMatch(html, /replace\(\/s\+\/g, ' '\)/);
});

test('syncReportAcceptanceCriteria preserves source-derived manifest traceability', () => {
	const siteDir = makeTempReportSite();

	const result = syncReportAcceptanceCriteria({ siteDir });
	const manifest = JSON.parse(fs.readFileSync(path.join(siteDir, 'manifest.json'), 'utf8'));
	const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
	const homeState = manifest.pages.find((page) => page.id === 'home').states[0];
	const projectsState = manifest.pages.find((page) => page.id === 'projects').states[0];

	assert.equal(result.groupingScriptApplied, true);
	assert.equal(homeState.criteriaSource.type, 'source-derived');
	assert.equal(homeState.criteriaSource.path, 'public/index.html');
	assert.equal(homeState.criteriaSource.generator, 'scripts/researchops-home-acceptance.mjs');
	assert.equal(projectsState.criteriaSource.type, 'source-derived');
	assert.equal(projectsState.criteriaSource.path, 'public/pages/projects/index.html');
	assert.equal(projectsState.criteriaSource.generator, 'scripts/researchops-projects-acceptance.mjs');
	assert.match(html, /reporting-review-grouping-script/);
	assert.match(html, /replace\(\/\\s\+\/g, ' '\)/);
});
