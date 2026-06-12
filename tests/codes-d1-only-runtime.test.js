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
					const next = {
						record_id: args[0],
						project: args[1],
						name: args[2],
						description: args[3],
						parentcode: args[4],
						colour: args[5],
						createdat: args[6],
						local_project_id: args[7],
						local_code_id: args[8],
					};
					const existing = state.codes.findIndex(
						(code) => code.local_code_id === next.local_code_id
					);
					if (existing >= 0) {
						state.codes[existing] = { ...state.codes[existing], ...next };
					} else {
						state.codes.push(next);
					}
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

function createService(d1, env = {}) {
	return {
		env: {
			RESEARCHOPS_D1: d1,
			...env,
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

function mockAirtableFetch(handler) {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (resource, init = {}) => {
		const method = init.method || 'GET';
		const requestBody = init.body ? JSON.parse(String(init.body)) : null;
		const payload = handler({ resource: String(resource), method, requestBody });
		return new Response(JSON.stringify(payload), {
			status: 200,
			headers: { 'content-type': 'application/json; charset=utf-8' },
		});
	};
	return () => {
		globalThis.fetch = originalFetch;
	};
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

test('createCode dual-writes an Airtable-created code to D1 when both stores are configured', async () => {
	const d1 = createMockD1();
	const svc = createService(d1, {
		AIRTABLE_BASE_ID: 'appResearchOps123',
		AIRTABLE_API_KEY: 'pat-not-real',
	});
	const restoreFetch = mockAirtableFetch(({ method, requestBody }) => {
		if (method === 'POST') {
			const fields = requestBody.records[0].fields;
			return {
				records: [
					{
						id: 'recNewCode0000000',
						fields,
					},
				],
			};
		}
		return {
			records: [
				{
					id: 'recThemeCode00000',
					fields: {
						Project: ['recgdpwEI5hF07bUZ'],
						Name: 'Evidence readiness',
					},
				},
			],
		};
	});

	try {
		const response = await createCode(
			svc,
			new Request('https://local.test/api/codes', {
				method: 'POST',
				body: JSON.stringify({
					projectId: 'recgdpwEI5hF07bUZ',
					name: 'Assumption review',
					description: 'Assumptions are being reviewed against emerging field evidence.',
					parentId: 'recThemeCode00000',
					colour: '#00703c',
				}),
			}),
			''
		);
		const body = await json(response);

		assert.equal(response.status, 201);
		assert.equal(body.ok, true);
		assert.equal(body.record.id, 'recNewCode0000000');
		assert.equal(d1.state.codes.length, 1);
		assert.deepEqual(
			{
				record_id: d1.state.codes[0].record_id,
				local_code_id: d1.state.codes[0].local_code_id,
				project: d1.state.codes[0].project,
				name: d1.state.codes[0].name,
				description: d1.state.codes[0].description,
				parentcode: d1.state.codes[0].parentcode,
				colour: d1.state.codes[0].colour,
			},
			{
				record_id: 'recNewCode0000000',
				local_code_id: 'recNewCode0000000',
				project: 'recgdpwEI5hF07bUZ',
				name: 'Assumption review',
				description: 'Assumptions are being reviewed against emerging field evidence.',
				parentcode: 'recThemeCode00000',
				colour: '#00703cff',
			}
		);
	} finally {
		restoreFetch();
	}
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

test('updateCode keeps an Airtable-backed D1 code row in sync', async () => {
	const d1 = createMockD1();
	const svc = createService(d1, {
		AIRTABLE_BASE_ID: 'appResearchOps123',
		AIRTABLE_API_KEY: 'pat-not-real',
	});
	d1.state.codes.push(
		{
			record_id: 'recThemeCode00000',
			local_code_id: 'recThemeCode00000',
			name: 'Evidence readiness',
			parentcode: '',
			project: 'recgdpwEI5hF07bUZ',
			local_project_id: 'recgdpwEI5hF07bUZ',
		},
		{
			record_id: 'recExistingCode01',
			local_code_id: 'recExistingCode01',
			name: 'Old confidence label',
			description: 'Old description',
			parentcode: '',
			colour: '#1d70b8ff',
			project: 'recgdpwEI5hF07bUZ',
			local_project_id: 'recgdpwEI5hF07bUZ',
		}
	);
	const restoreFetch = mockAirtableFetch(({ method, requestBody }) => {
		if (method === 'PATCH') {
			const fields = requestBody.records[0].fields;
			return {
				records: [
					{
						id: 'recExistingCode01',
						fields: {
							Project: ['recgdpwEI5hF07bUZ'],
							...fields,
						},
					},
				],
			};
		}
		return { records: [] };
	});

	try {
		const response = await updateCode(
			svc,
			new Request('https://local.test/api/codes/recExistingCode01', {
				method: 'PATCH',
				body: JSON.stringify({
					name: 'Decision confidence threshold',
					description: 'Confidence threshold used before committing to a delivery decision.',
					parentId: 'recThemeCode00000',
					colour: '#4c2c92',
				}),
			}),
			'',
			'recExistingCode01'
		);
		const body = await json(response);
		const row = d1.state.codes.find((code) => code.record_id === 'recExistingCode01');

		assert.equal(response.status, 200);
		assert.equal(body.ok, true);
		assert.equal(row.name, 'Decision confidence threshold');
		assert.equal(
			row.description,
			'Confidence threshold used before committing to a delivery decision.'
		);
		assert.equal(row.parentcode, 'recThemeCode00000');
		assert.equal(row.colour, '#4c2c92ff');
	} finally {
		restoreFetch();
	}
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
