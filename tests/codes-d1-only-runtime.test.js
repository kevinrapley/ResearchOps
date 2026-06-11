import assert from 'node:assert/strict';
import test from 'node:test';

import { createCode, updateCode } from '../infra/cloudflare/src/service/reflection/codes.js';

function createMockD1() {
	const state = {
		codes: [],
	};

	function statement(sql, args = []) {
		return {
			bind(...nextArgs) {
				return statement(sql, nextArgs);
			},
			async first() {
				if (/FROM codes/i.test(sql)) {
					const id = args[0];
					return (
						state.codes.find((code) => code.record_id === id || code.local_code_id === id) || null
					);
				}
				return null;
			},
			async run() {
				if (/INSERT INTO codes/i.test(sql)) {
					state.codes.push({
						record_id: args[0],
						project: args[1],
						name: args[2],
						description: args[3],
						parentcode: args[4],
						colour: args[5],
						createdat: args[6],
						local_project_id: args[7],
						local_code_id: args[8],
					});
				}
				if (/UPDATE codes/i.test(sql)) {
					const codeId = args.at(-2);
					const row = state.codes.find(
						(code) => code.record_id === codeId || code.local_code_id === codeId
					);
					if (row) {
						const sets = sql.match(/SET\s+([\s\S]+?)\s+WHERE/i)?.[1] || '';
						const columns = sets.split(',').map((part) => part.trim().split(/\s+/)[0]);
						columns.forEach((column, index) => {
							row[column] = args[index];
						});
					}
				}
				return { success: true, meta: { changes: 1 } };
			},
		};
	}

	return {
		state,
		prepare(sql) {
			return statement(sql);
		},
	};
}

function createService(d1) {
	return {
		env: {
			RESEARCHOPS_D1: d1,
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

test('createCode writes a thematic aggregate code to D1 when Airtable is not configured', async () => {
	const d1 = createMockD1();
	const svc = createService(d1);
	const response = await createCode(
		svc,
		new Request('https://local.test/api/codes', {
			method: 'POST',
			body: JSON.stringify({
				projectId: 'recgdpwEI5hF07bUZ',
				name: 'Evidence readiness',
				description: 'Evidence is traceable and strong enough to support a decision.',
				colour: '#1d70b8',
			}),
		}),
		''
	);
	const body = await json(response);

	assert.equal(response.status, 201);
	assert.equal(body.ok, true);
	assert.equal(body.record.name, 'Evidence readiness');
	assert.equal(body.record.parentId, null);
	assert.equal(d1.state.codes.length, 1);
	assert.equal(d1.state.codes[0].project, 'recgdpwEI5hF07bUZ');
	assert.equal(d1.state.codes[0].colour, '#1d70b8ff');
});

test('updateCode assigns a D1 parent code and preserves the three-level hierarchy', async () => {
	const d1 = createMockD1();
	const svc = createService(d1);
	d1.state.codes.push(
		{
			record_id: 'theme',
			local_code_id: 'theme',
			name: 'Evidence readiness',
			parentcode: '',
			project: 'recgdpwEI5hF07bUZ',
			local_project_id: 'recgdpwEI5hF07bUZ',
		},
		{
			record_id: 'interpretive',
			local_code_id: 'interpretive',
			name: 'Decision confidence',
			parentcode: 'theme',
			project: 'recgdpwEI5hF07bUZ',
			local_project_id: 'recgdpwEI5hF07bUZ',
		},
		{
			record_id: 'descriptive',
			local_code_id: 'descriptive',
			name: 'Confidence threshold',
			parentcode: '',
			project: 'recgdpwEI5hF07bUZ',
			local_project_id: 'recgdpwEI5hF07bUZ',
		}
	);

	const response = await updateCode(
		svc,
		new Request('https://local.test/api/codes/descriptive', {
			method: 'PATCH',
			body: JSON.stringify({ name: 'Confidence threshold', parentId: 'interpretive' }),
		}),
		'',
		'descriptive'
	);
	const body = await json(response);

	assert.equal(response.status, 200);
	assert.equal(body.ok, true);
	assert.equal(
		d1.state.codes.find((code) => code.record_id === 'descriptive').parentcode,
		'interpretive'
	);
});

test('updateCode rejects a D1 parent that would create a fourth level', async () => {
	const d1 = createMockD1();
	const svc = createService(d1);
	d1.state.codes.push(
		{ record_id: 'theme', local_code_id: 'theme', parentcode: '' },
		{ record_id: 'interpretive', local_code_id: 'interpretive', parentcode: 'theme' },
		{ record_id: 'descriptive', local_code_id: 'descriptive', parentcode: 'interpretive' },
		{ record_id: 'too-deep', local_code_id: 'too-deep', parentcode: '' }
	);

	const response = await updateCode(
		svc,
		new Request('https://local.test/api/codes/too-deep', {
			method: 'PATCH',
			body: JSON.stringify({ parentId: 'descriptive' }),
		}),
		'',
		'too-deep'
	);
	const body = await json(response);

	assert.equal(response.status, 400);
	assert.equal(body.ok, false);
	assert.match(body.error, /limited to 3 levels/);
});
