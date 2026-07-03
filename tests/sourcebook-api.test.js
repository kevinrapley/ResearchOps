import assert from 'node:assert/strict';
import test from 'node:test';

import {
	listSourcebookClauses,
	listSourcebookPillars,
	readSourcebook,
	readSourcebookClause,
} from '../infra/cloudflare/src/service/sourcebook.js';

function testService() {
	return {
		corsHeaders() {
			return {};
		},
		json(body, status = 200, headers = {}) {
			return new Response(JSON.stringify(body), {
				status,
				headers: {
					'content-type': 'application/json; charset=utf-8',
					...headers,
				},
			});
		},
	};
}

async function json(response) {
	return response.json();
}

test('Sourcebook API returns sourcebook metadata and counts', async () => {
	const response = await readSourcebook(testService(), '');
	assert.equal(response.status, 200);

	const body = await json(response);
	assert.equal(body.ok, true);
	assert.equal(body.sourcebook.title, 'Research Operations Sourcebook');
	assert.equal(body.counts.pillars, 8);
	assert.equal(body.counts.clauses > 0, true);
});

test('Sourcebook API lists pillar summaries with section metadata', async () => {
	const response = await listSourcebookPillars(
		testService(),
		'',
		new URL('https://worker.test/api/sourcebook/pillars?include=sections')
	);
	assert.equal(response.status, 200);

	const body = await json(response);
	assert.equal(body.ok, true);
	assert.equal(body.pillars.length, 8);

	const recruitment = body.pillars.find((pillar) => pillar.code === 'REC-ADMN');
	assert.equal(recruitment.title, 'Recruitment and administration');
	assert.equal(recruitment.sections.length >= 6, true);
	assert.equal(recruitment.clauseTypes.includes('rule'), true);
});

test('Sourcebook API looks up a clause by stable identifier', async () => {
	const response = await readSourcebookClause(testService(), '', 'REC-ADMN%203.1.1');
	assert.equal(response.status, 200);

	const body = await json(response);
	assert.equal(body.ok, true);
	assert.equal(body.clause.id, 'REC-ADMN 3.1.1');
	assert.equal(body.clause.type, 'rule');
	assert.equal(body.clause.pillar.code, 'REC-ADMN');
	assert.equal(body.clause.evidence.includes('consent-form'), true);
	assert.equal(body.clause.triggers.includes('before-session-start'), true);
	assert.equal(body.clause.triggers.includes('consent-review'), true);
});

test('Sourcebook API returns 404 for unknown clauses', async () => {
	const response = await readSourcebookClause(testService(), '', 'UNKNOWN%201.1.1');
	assert.equal(response.status, 404);

	const body = await json(response);
	assert.equal(body.ok, false);
	assert.equal(body.error, 'sourcebook_clause_not_found');
});

test('Sourcebook API queries clauses by related route', async () => {
	const response = await listSourcebookClauses(
		testService(),
		'',
		new URL('https://worker.test/api/sourcebook/clauses?route=/pages/consent/')
	);
	assert.equal(response.status, 200);

	const body = await json(response);
	assert.equal(body.ok, true);
	assert.equal(
		body.clauses.some((clause) => clause.id === 'REC-ADMN 3.1.1'),
		true
	);
	assert.equal(body.filters.route[0], '/pages/consent/');
});

test('Sourcebook API queries clauses by evidence type, trigger and pillar', async () => {
	const response = await listSourcebookClauses(
		testService(),
		'',
		new URL(
			'https://worker.test/api/sourcebook/clauses?pillar=DATA-STO-ACC&evidence=repository-entry&trigger=repository-readiness'
		)
	);
	assert.equal(response.status, 200);

	const body = await json(response);
	assert.equal(body.ok, true);
	assert.equal(body.clauses.length > 0, true);
	assert.equal(
		body.clauses.every((clause) => clause.pillar.code === 'DATA-STO-ACC'),
		true
	);
	assert.equal(
		body.clauses.every((clause) => clause.evidence.includes('repository-entry')),
		true
	);
	assert.equal(
		body.clauses.every((clause) => clause.triggers.includes('repository-readiness')),
		true
	);
});
