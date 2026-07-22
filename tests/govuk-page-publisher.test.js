import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { publishGovukPages } from '../scripts/govuk/page-publisher/index.mjs';

function memoryOutput() {
	const writes = [];
	return {
		writes,
		async write(publications) {
			writes.push(publications);
		},
	};
}

test('publishes final HTML for every generated route with byte parity to committed output', async () => {
	const output = memoryOutput();
	const publications = await publishGovukPages({ output });

	assert.equal(publications.length, 64);
	assert.equal(output.writes.length, 1);
	assert.equal(
		new Set(publications.map((publication) => publication.route)).size,
		publications.length
	);
	assert.equal(
		new Set(publications.map((publication) => publication.output)).size,
		publications.length
	);

	for (const publication of publications) {
		assert.equal(publication.html, fs.readFileSync(publication.output, 'utf8'), publication.output);
	}
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
