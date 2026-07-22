import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

import { pageCatalogue } from '../scripts/govuk/page-publisher/catalogue.mjs';
import { publishGovukPages } from '../scripts/govuk/page-publisher/index.mjs';
import { validatePageCatalogue } from '../scripts/govuk/page-publisher/validation.mjs';

function memoryOutput() {
	const writes = [];
	return {
		writes,
		async write(publications) {
			writes.push(publications);
		},
	};
}

test('publishes every generated route with byte parity to tracked output', async () => {
	const output = memoryOutput();
	const publications = await publishGovukPages({ output });
	const trackedOutputs = new Set(
		execFileSync('git', ['ls-files', '--', 'public/index.html', 'public/pages'], {
			encoding: 'utf8',
		})
			.split('\n')
			.filter(Boolean)
	);
	const trackedPublications = publications.filter((publication) =>
		trackedOutputs.has(publication.output)
	);

	assert.equal(publications.length, 64);
	assert.ok(trackedPublications.length > 0);
	assert.ok(trackedPublications.length < publications.length);
	assert.equal(output.writes.length, 1);
	assert.equal(
		new Set(publications.map((publication) => publication.route)).size,
		publications.length
	);
	assert.equal(
		new Set(publications.map((publication) => publication.output)).size,
		publications.length
	);

	for (const publication of trackedPublications) {
		assert.equal(publication.html, fs.readFileSync(publication.output, 'utf8'), publication.output);
	}
});

test('rejects page templates without a publisher catalogue registration', async () => {
	const catalogueWithoutSessions = pageCatalogue.filter(
		(page) => page.template !== 'pages/sessions.njk'
	);

	await assert.rejects(
		validatePageCatalogue(catalogueWithoutSessions),
		/No GOV\.UK publisher catalogue registration found for: pages\/sessions\.njk/
	);
});

test('does not invoke the output adapter when route selection fails', async () => {
	const output = memoryOutput();

	await assert.rejects(
		publishGovukPages({ routes: ['/pages/not-in-the-catalogue/'], output }),
		/Unknown GOV\.UK page route/
	);
	assert.equal(output.writes.length, 0);
});

test('requires an explicit output adapter', async () => {
	await assert.rejects(publishGovukPages(), /output adapter/);
});
