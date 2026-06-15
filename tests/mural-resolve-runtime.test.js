import assert from 'node:assert/strict';
import test from 'node:test';

import { MuralServicePart } from '../infra/cloudflare/src/service/internals/mural.js';

function json(body, status = 200, headers = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', ...headers },
	});
}

function makeD1(rows = []) {
	return {
		prepare() {
			return {
				bind() {
					return this;
				},
				async all() {
					return { results: rows };
				},
				async first() {
					return null;
				},
				async run() {
					return { success: true };
				},
			};
		},
	};
}

function makeService({
	rows,
	tokens = { access_token: 'access-token' },
	companyId = 'homeofficegovuk',
} = {}) {
	const tokenStore = new Map([['mural:resolve-user:tokens', JSON.stringify(tokens)]]);
	const root = {
		env: {
			MURAL_COMPANY_ID: companyId,
			RESEARCHOPS_D1: makeD1(rows),
			SESSION_KV: {
				async get(key) {
					return tokenStore.get(key) || null;
				},
				async put(key, value) {
					tokenStore.set(key, value);
				},
			},
		},
		corsHeaders() {
			return {};
		},
		json,
		log: { warn() {}, info() {}, debug() {} },
	};
	return new MuralServicePart(root);
}

function resolveUrl(projectId) {
	return new URL(
		`https://worker.test/api/mural/resolve?projectId=${encodeURIComponent(
			projectId
		)}&uid=resolve-user`
	);
}

test('muralResolve returns not found when the saved Mural board was deleted', async () => {
	const originalFetch = globalThis.fetch;
	const calls = [];
	globalThis.fetch = async (resource) => {
		const href = String(resource);
		calls.push(href);
		if (href.endsWith('/users/me')) {
			return json({ value: { companyId: 'homeofficegovuk' } });
		}
		if (href.endsWith('/murals/stale-board')) {
			return json({ message: 'Not found' }, 404);
		}
		throw new Error(`Unexpected fetch: ${href}`);
	};

	try {
		const service = makeService({
			rows: [
				{
					mural_id: 'stale-board',
					project: 'recDeletedBoard1',
					purpose: 'reflexive_journal',
					board_url: 'https://app.mural.co/t/example/m/stale-board',
					workspace_id: 'workspace-fixture',
				},
			],
		});

		const response = await service.muralResolve('', resolveUrl('recDeletedBoard1'));
		const body = await response.json();

		assert.equal(response.status, 404);
		assert.equal(body.ok, false);
		assert.equal(body.error, 'stale_board_unavailable');
		assert.equal(body.muralId, 'stale-board');
		assert.equal(
			calls.some((href) => href.endsWith('/murals/stale-board')),
			true
		);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('muralResolve still returns a linked board when Mural confirms it exists', async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (resource) => {
		const href = String(resource);
		if (href.endsWith('/users/me')) {
			return json({ value: { companyId: 'homeofficegovuk' } });
		}
		if (href.endsWith('/murals/live-board')) {
			return json({ value: { id: 'live-board' } });
		}
		throw new Error(`Unexpected fetch: ${href}`);
	};

	try {
		const service = makeService({
			rows: [
				{
					mural_id: 'live-board',
					project: 'recLiveBoard01',
					purpose: 'reflexive_journal',
					board_url: 'https://app.mural.co/t/example/m/live-board',
					workspace_id: 'workspace-fixture',
				},
			],
		});

		const response = await service.muralResolve('', resolveUrl('recLiveBoard01'));
		const body = await response.json();

		assert.equal(response.status, 200);
		assert.equal(body.ok, true);
		assert.equal(body.muralId, 'live-board');
		assert.equal(body.boardUrl, 'https://app.mural.co/t/example/m/live-board');
	} finally {
		globalThis.fetch = originalFetch;
	}
});
