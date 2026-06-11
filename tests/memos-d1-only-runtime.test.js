import assert from 'node:assert/strict';
import test from 'node:test';

import { deleteMemo, updateMemo } from '../infra/cloudflare/src/service/memos.js';

function createService() {
	const calls = [];
	const env = {
		RESEARCHOPS_D1: {
			prepare(sql) {
				return {
					bind(...params) {
						return {
							run() {
								calls.push({ params, sql });
								return Promise.resolve({ success: true });
							},
						};
					},
				};
			},
		},
	};

	return {
		calls,
		env,
		corsHeaders() {
			return {};
		},
		json(body, status, headers) {
			return new Response(JSON.stringify(body), { headers, status });
		},
		log: {
			warn() {},
			error() {},
		},
	};
}

async function responseJson(response) {
	return response.json();
}

test('updateMemo returns success after D1 update when Airtable is not configured', async () => {
	const svc = createService();
	const request = new Request('https://local.test/api/memos/rec019veC30YqSx8J', {
		body: JSON.stringify({ content: 'Updated memo', memo_type: 'analytical' }),
		method: 'PATCH',
	});

	const response = await updateMemo(svc, request, 'https://local.test', 'rec019veC30YqSx8J');
	const body = await responseJson(response);

	assert.equal(response.status, 200);
	assert.equal(body.ok, true);
	assert.equal(body.id, 'rec019veC30YqSx8J');
	assert.equal(svc.calls.length, 1);
	assert.deepEqual(svc.calls[0].params, [
		'analytical',
		'Updated memo',
		'rec019veC30YqSx8J',
		'rec019veC30YqSx8J',
	]);
});

test('deleteMemo returns success after D1 delete when Airtable is not configured', async () => {
	const svc = createService();

	const response = await deleteMemo(svc, 'https://local.test', 'rec019veC30YqSx8J');
	const body = await responseJson(response);

	assert.equal(response.status, 200);
	assert.equal(body.ok, true);
	assert.equal(body.id, 'rec019veC30YqSx8J');
	assert.equal(svc.calls.length, 1);
	assert.deepEqual(svc.calls[0].params, ['rec019veC30YqSx8J', 'rec019veC30YqSx8J']);
});
