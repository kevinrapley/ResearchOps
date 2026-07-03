import assert from 'node:assert/strict';
import test from 'node:test';

import {
	evaluateSourcebookGovernance,
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
		new URL('https://worker.test/api/sourcebook/clauses?route=/pages/consent/&includeText=summary')
	);
	assert.equal(response.status, 200);

	const body = await json(response);
	assert.equal(body.ok, true);
	assert.equal(
		body.clauses.some((clause) => clause.id === 'REC-ADMN 3.1.1'),
		true
	);
	assert.equal(body.filters.route[0], '/pages/consent/');
	assert.equal(body.filters.includeText, 'summary');
	assert.deepEqual(
		body.clauses.find((clause) => clause.id === 'REC-ADMN 3.1.1').routeMappings[0].conditionIds,
		['consent-review']
	);
	assert.equal(
		body.clauses.find((clause) => clause.id === 'REC-ADMN 3.1.1').text,
		'Participants must receive clear study information and give recorded informed consent before taking part, including consent choices for recording, quotation and future contact.'
	);
});

test('Sourcebook API narrows route mappings by condition', async () => {
	const response = await listSourcebookClauses(
		testService(),
		'',
		new URL(
			'https://worker.test/api/sourcebook/clauses?route=/pages/account/team-access/&condition=access-change'
		)
	);
	assert.equal(response.status, 200);

	const body = await json(response);
	assert.equal(body.ok, true);
	assert.deepEqual(body.filters.condition, ['access-change']);
	assert.equal(body.clauses.length, 1);

	const clause = body.clauses[0];
	assert.equal(clause.id, 'INFRA-PROV 3.1.1');
	assert.equal(clause.routeMappings.length >= 2, true);
	assert.equal(
		clause.routeMappings.some(
			(mapping) =>
				mapping.route === '/pages/account/team-access/' &&
				mapping.conditionIds.includes('access-change') &&
				mapping.strength === 'required'
		),
		true
	);
});

test('Sourcebook API excludes conditional route mappings when the condition does not apply', async () => {
	const response = await listSourcebookClauses(
		testService(),
		'',
		new URL(
			'https://worker.test/api/sourcebook/clauses?route=/pages/account/team-access/&condition=permission-model-change'
		)
	);
	assert.equal(response.status, 200);

	const body = await json(response);
	assert.equal(body.ok, true);
	assert.deepEqual(body.filters.condition, ['permission-model-change']);
	assert.equal(body.clauses.length, 0);
});

test('Sourcebook API can return clause title text only', async () => {
	const response = await listSourcebookClauses(
		testService(),
		'',
		new URL('https://worker.test/api/sourcebook/clauses?q=ENVIRO%201.1.2&includeText=title')
	);
	assert.equal(response.status, 200);

	const body = await json(response);
	const clause = body.clauses.find((item) => item.id === 'ENVIRO 1.1.2');
	assert.equal(body.filters.includeText, 'title');
	assert.equal(clause.textMode, 'title');
	assert.equal(clause.text, 'Assess the setting before research starts');
});

test('Sourcebook API can return full formatted clause text', async () => {
	const response = await listSourcebookClauses(
		testService(),
		'',
		new URL('https://worker.test/api/sourcebook/clauses?q=ENVIRO%201.1.2&includeText=full')
	);
	assert.equal(response.status, 200);

	const body = await json(response);
	const clause = body.clauses.find((item) => item.id === 'ENVIRO 1.1.2');
	assert.equal(body.filters.includeText, 'full');
	assert.equal(clause.textMode, 'full');
	assert.equal(
		clause.text,
		'ENVIRO 1.1.2: Assess the setting before research starts\n\nEvery study must assess whether the physical, remote or field setting supports the method, participant needs, confidentiality, safeguarding and researcher safety before sessions begin.'
	);
});

test('Sourcebook API verbose text includes the full clause and metadata block', async () => {
	const response = await listSourcebookClauses(
		testService(),
		'',
		new URL('https://worker.test/api/sourcebook/clauses?q=ENVIRO%201.1.2&includeText=verbose')
	);
	assert.equal(response.status, 200);

	const body = await json(response);
	const clause = body.clauses.find((item) => item.id === 'ENVIRO 1.1.2');
	assert.equal(body.filters.includeText, 'verbose');
	assert.equal(clause.textMode, 'verbose');
	assert.equal(
		clause.text,
		'ENVIRO 1.1.2: Assess the setting before research starts\n\nEvery study must assess whether the physical, remote or field setting supports the method, participant needs, confidentiality, safeguarding and researcher safety before sessions begin.'
	);
	assert.equal(clause.metadata.id, 'ENVIRO 1.1.2');
	assert.equal(clause.metadata.pillar.code, 'ENVIRO');
	assert.equal(clause.metadata.section.id, 'ENVIRO 1.0.0');
	assert.equal(clause.metadata.evidence.includes('environment-risk-assessment'), true);
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

test('Sourcebook governance evaluator returns the five North Star layers', async () => {
	const response = await evaluateSourcebookGovernance(
		testService(),
		'',
		new URL(
			'https://worker.test/api/sourcebook/evaluate?route=/pages/consent/&condition=consent-review&providedEvidence=consent-form,consent-log'
		)
	);
	assert.equal(response.status, 200);

	const body = await json(response);
	assert.equal(body.ok, true);
	assert.equal(body.evaluation.engine.id, 'sourcebook-governance-engine');
	assert.equal(body.evaluation.engine.layerCount, 5);
	assert.equal(body.evaluation.engine.northStarRule.id, 'researchops-north-star');
	assert.equal(body.evaluation.layers.length, 5);
	assert.deepEqual(
		body.evaluation.layers.map((layer) => layer.id),
		[
			'north-star',
			'operating-context',
			'sourcebook-clauses',
			'evidence-readiness',
			'governance-action',
		]
	);
	assert.equal(body.evaluation.outcome.status, 'ready-with-required-controls');
	assert.equal(body.evaluation.outcome.decision, 'proceed-with-controls');
	assert.equal(body.evaluation.layers[2].clauses[0].id, 'REC-ADMN 3.1.1');
	assert.equal(body.evaluation.layers[3].status, 'ready');
	assert.deepEqual(body.evaluation.layers[3].missingEvidence, []);
});

test('Sourcebook governance evaluator pauses decisions when required evidence is missing', async () => {
	const response = await evaluateSourcebookGovernance(
		testService(),
		'',
		new URL(
			'https://worker.test/api/sourcebook/evaluate?route=/pages/account/team-access/&condition=access-change'
		)
	);
	assert.equal(response.status, 200);

	const body = await json(response);
	assert.equal(body.ok, true);
	assert.equal(body.evaluation.outcome.status, 'needs-evidence');
	assert.equal(body.evaluation.outcome.decision, 'pause-for-evidence');
	assert.equal(body.evaluation.outcome.severity, 'high');
	assert.equal(body.evaluation.layers[2].clauses[0].id, 'INFRA-PROV 3.1.1');
	assert.deepEqual(body.evaluation.layers[3].missingEvidence, [
		'access-request',
		'role-permission-model',
	]);
});
