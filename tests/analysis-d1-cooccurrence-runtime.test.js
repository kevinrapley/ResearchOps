import assert from 'node:assert/strict';
import test from 'node:test';

import { cooccurrence, retrieval } from '../infra/cloudflare/src/service/reflection/analysis.js';

function createMockD1() {
	const journalEntries = [
		{
			record_id: 'd1tp1_journal_001',
			project: 'recgdpwEI5hF07bUZ',
			category: 'perceptions',
			content: 'Evidence is trusted when provenance and confidence are visible.',
			tags: '[]',
			createdat: '2026-06-03T09:15:00.000Z',
			local_project_id: 'd04ab32e-6756-408e-a649-6859dd0079f2',
		},
		{
			record_id: 'd1tp1_journal_002',
			project: 'recgdpwEI5hF07bUZ',
			category: 'procedures',
			content: 'Intake routines expose recruitment constraints before work is accepted.',
			tags: '[]',
			createdat: '2026-06-03T14:40:00.000Z',
			local_project_id: 'd04ab32e-6756-408e-a649-6859dd0079f2',
		},
	];
	const codes = [
		{
			record_id: 'd1tp1_code_theme_evidence_readiness',
			local_code_id: 'd1tp1_code_theme_evidence_readiness',
			name: 'Evidence readiness',
			project: 'recgdpwEI5hF07bUZ',
			local_project_id: 'd04ab32e-6756-408e-a649-6859dd0079f2',
			createdat: '2026-06-03T10:00:00.000Z',
		},
		{
			record_id: 'd1tp1_code_decision_confidence',
			local_code_id: 'd1tp1_code_decision_confidence',
			name: 'Decision confidence',
			project: 'recgdpwEI5hF07bUZ',
			local_project_id: 'd04ab32e-6756-408e-a649-6859dd0079f2',
			createdat: '2026-06-03T10:05:00.000Z',
		},
		{
			record_id: 'd1tp1_code_recruitment_constraints',
			local_code_id: 'd1tp1_code_recruitment_constraints',
			name: 'Recruitment constraints',
			project: 'recgdpwEI5hF07bUZ',
			local_project_id: 'd04ab32e-6756-408e-a649-6859dd0079f2',
			createdat: '2026-06-03T10:50:00.000Z',
		},
	];
	const codeApplications = [
		{
			entry: 'd1tp1_journal_001',
			code: 'd1tp1_code_theme_evidence_readiness',
			project: 'recgdpwEI5hF07bUZ',
			local_project_id: 'd04ab32e-6756-408e-a649-6859dd0079f2',
		},
		{
			entry: 'd1tp1_journal_001',
			code: 'd1tp1_code_decision_confidence',
			project: 'recgdpwEI5hF07bUZ',
			local_project_id: 'd04ab32e-6756-408e-a649-6859dd0079f2',
		},
		{
			entry: 'd1tp1_journal_002',
			code: 'd1tp1_code_decision_confidence',
			project: 'recgdpwEI5hF07bUZ',
			local_project_id: 'd04ab32e-6756-408e-a649-6859dd0079f2',
		},
		{
			entry: 'd1tp1_journal_002',
			code: 'd1tp1_code_recruitment_constraints',
			project: 'recgdpwEI5hF07bUZ',
			local_project_id: 'd04ab32e-6756-408e-a649-6859dd0079f2',
		},
	];

	function matchesProject(row, args) {
		return args.includes(row.project) || args.includes(row.local_project_id);
	}

	function statement(sql, args = []) {
		return {
			bind(...nextArgs) {
				return statement(sql, nextArgs);
			},
			async all() {
				if (/FROM code_applications/i.test(sql)) {
					return { results: codeApplications.filter((row) => matchesProject(row, args)) };
				}
				if (/FROM journal_entries/i.test(sql)) {
					return { results: journalEntries.filter((row) => matchesProject(row, args)) };
				}
				if (/FROM codes/i.test(sql)) {
					return { results: codes.filter((row) => matchesProject(row, args)) };
				}
				return { results: [] };
			},
		};
	}

	return {
		prepare(sql) {
			return statement(sql);
		},
	};
}

function createService() {
	return {
		env: {
			RESEARCHOPS_D1: createMockD1(),
		},
		cfg: {
			TIMEOUT_MS: 1000,
		},
		corsHeaders() {
			return {};
		},
		json(body, status = 200, headers = {}) {
			return new Response(JSON.stringify(body), {
				status,
				headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
			});
		},
		log: {
			error() {},
			warn() {},
		},
	};
}

async function json(response) {
	return response.json();
}

test('cooccurrence returns D1-backed code links without Airtable configuration', async () => {
	const svc = createService();
	const response = await cooccurrence(
		svc,
		'',
		new URL('https://local.test/api/analysis/cooccurrence?project=recgdpwEI5hFO7bUZ')
	);
	const body = await json(response);

	assert.equal(response.status, 200);
	assert.equal(body.ok, true);
	assert.deepEqual(
		body.nodes.map((node) => node.label).sort(),
		['Decision confidence', 'Evidence readiness', 'Recruitment constraints'].sort()
	);
	assert.deepEqual(
		body.links.map((link) => `${link.source}|${link.target}:${link.weight}`).sort(),
		[
			'd1tp1_code_decision_confidence|d1tp1_code_recruitment_constraints:1',
			'd1tp1_code_decision_confidence|d1tp1_code_theme_evidence_readiness:1',
		].sort()
	);
});

test('retrieval returns D1-backed coded journal entries without Airtable configuration', async () => {
	const svc = createService();
	const response = await retrieval(
		svc,
		'',
		new URL('https://local.test/api/analysis/retrieval?project=recgdpwEI5hF07bUZ&q=confidence')
	);
	const body = await json(response);

	assert.equal(response.status, 200);
	assert.equal(body.ok, true);
	assert.equal(body.results.length, 2);
	assert.deepEqual(body.results.map((result) => result.entryId).sort(), [
		'd1tp1_journal_001',
		'd1tp1_journal_002',
	]);
	const firstEntry = body.results.find((result) => result.entryId === 'd1tp1_journal_001');
	assert.deepEqual(firstEntry.codes.map((code) => code.name).sort(), [
		'Decision confidence',
		'Evidence readiness',
	]);
});
