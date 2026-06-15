import assert from 'node:assert/strict';
import test from 'node:test';

import { createBoard, listBoards } from '../infra/cloudflare/src/service/internals/airtable.js';
import { resolveBoardForService } from '../infra/cloudflare/src/service/internals/mural-board-registry.js';

const env = {
	AIRTABLE_BASE_ID: 'appFixture',
	AIRTABLE_TABLE_MURAL_BOARDS: 'Mural Boards',
};

function makeD1({ rows = [], onRun = () => {} } = {}) {
	return {
		prepare(sql) {
			return {
				params: [],
				bind(...params) {
					this.params = params;
					return this;
				},
				async all() {
					return { results: rows };
				},
				async first() {
					return null;
				},
				async run() {
					onRun(sql, this.params);
					return { success: true };
				},
			};
		},
	};
}

function mappingInsert(writes, muralId) {
	return writes.find((write) => write.params[0] === muralId) || null;
}

test('listBoards returns D1 board mappings when Airtable is not configured', async () => {
	let fetched = false;
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => {
		fetched = true;
		throw new Error('fallback should not be called');
	};

	try {
		const rows = await listBoards(
			{
				...env,
				RESEARCHOPS_D1: makeD1({
					rows: [
						{
							mural_id: 'board-from-d1',
							project: 'recgdpwEI5hFO7bUZ',
							purpose: 'reflexive_journal',
							board_url: 'https://example.test/mural/d1',
							workspace_id: 'workspace-fixture',
						},
					],
				}),
			},
			{
				projectId: 'recgdpwEI5hFO7bUZ',
				uid: 'anon',
				purpose: 'reflexive_journal',
			}
		);

		assert.equal(rows.length, 1);
		assert.equal(rows[0]._source, 'd1');
		assert.equal(rows[0].fields['Mural ID'], 'board-from-d1');
		assert.equal(fetched, false);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('listBoards prefers Airtable board mappings over stale D1 rows when Airtable is configured', async () => {
	let fetched = false;
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => {
		fetched = true;
		return new Response(
			JSON.stringify({
				records: [
					{
						id: 'recBoardLive',
						fields: {
							'Project ID': 'recgdpwEI5hFO7bUZ',
							UID: 'anon',
							Purpose: 'reflexive_journal',
							Active: true,
							'Mural ID': 'live-airtable-board',
							'Board URL': 'https://example.test/mural/live-airtable',
							'Workspace ID': 'workspace-fixture',
							'Primary?': true,
						},
					},
				],
			}),
			{ status: 200, headers: { 'content-type': 'application/json' } }
		);
	};

	try {
		const rows = await listBoards(
			{
				...env,
				AIRTABLE_API_KEY: 'fixture-token',
				RESEARCHOPS_D1: makeD1({
					rows: [
						{
							mural_id: 'stale-d1-board',
							project: 'recgdpwEI5hFO7bUZ',
							purpose: 'reflexive_journal',
							board_url: 'https://example.test/mural/stale',
							workspace_id: 'workspace-fixture',
						},
					],
				}),
			},
			{
				projectId: 'recgdpwEI5hFO7bUZ',
				uid: 'anon',
				purpose: 'reflexive_journal',
			}
		);

		assert.equal(fetched, true);
		assert.equal(rows.length, 1);
		assert.equal(rows[0].fields['Mural ID'], 'live-airtable-board');
		assert.equal(rows[0].fields['Board URL'], 'https://example.test/mural/live-airtable');
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('resolveBoardForService resolves legacy Test Project 1 id to canonical D1 board mapping', async () => {
	const result = await resolveBoardForService(
		{
			root: {
				env: {
					RESEARCHOPS_D1: makeD1({
						rows: [
							{
								mural_id: 'canonical-d1-board',
								project: 'recgdpwEI5hF07bUZ',
								purpose: 'reflexive_journal',
								board_url: 'https://example.test/mural/canonical',
								workspace_id: 'workspace-fixture',
							},
						],
					}),
					MURAL_REFLEXIVE_MURAL_ID: 'wrong-fallback-board',
				},
				log: { warn() {}, info() {} },
			},
		},
		{
			projectId: 'recgdpwEI5hFO7bUZ',
			uid: 'anon',
			purpose: 'reflexive_journal',
		}
	);

	assert.equal(result.source, 'd1');
	assert.equal(result.muralId, 'canonical-d1-board');
	assert.equal(result.boardUrl, 'https://example.test/mural/canonical');
});

test('resolveBoardForService resolves legacy Test Project 1 id to canonical Airtable board mapping', async () => {
	const formulas = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (resource) => {
		const url = new URL(String(resource));
		const formula = url.searchParams.get('filterByFormula') || '';
		formulas.push(formula);
		if (formula.includes('{Project ID} = "recgdpwEI5hF07bUZ"')) {
			return new Response(
				JSON.stringify({
					records: [
						{
							id: 'recBoardCanonical',
							fields: {
								'Project ID': 'recgdpwEI5hF07bUZ',
								UID: 'airtable-fixture',
								Purpose: 'reflexive_journal',
								Active: true,
								'Mural ID': 'canonical-airtable-board',
								'Board URL': 'https://example.test/mural/airtable-canonical',
								'Workspace ID': 'workspace-fixture',
								'Primary?': true,
							},
						},
					],
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			);
		}
		return new Response(JSON.stringify({ records: [] }), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		});
	};

	try {
		const result = await resolveBoardForService(
			{
				root: {
					env: {
						...env,
						AIRTABLE_API_KEY: 'fixture-token',
						RESEARCHOPS_D1: makeD1({ rows: [] }),
						MURAL_REFLEXIVE_MURAL_ID: 'wrong-fallback-board',
					},
					log: { warn() {}, info() {}, debug() {} },
				},
			},
			{
				projectId: 'recgdpwEI5hFO7bUZ',
				uid: 'airtable-fixture',
				purpose: 'reflexive_journal',
			}
		);

		assert.equal(result.source, 'airtable');
		assert.equal(result.muralId, 'canonical-airtable-board');
		assert.equal(result.projectRecordId, 'recgdpwEI5hF07bUZ');
		assert.ok(formulas.some((formula) => formula.includes('{Project ID} = "recgdpwEI5hF07bUZ"')));
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('listBoards uses exact Project ID Airtable fallback before broad scan', async () => {
	const formulas = [];
	const d1Writes = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (resource) => {
		const url = new URL(String(resource));
		const formula = url.searchParams.get('filterByFormula') || '';
		formulas.push(formula);
		return new Response(
			JSON.stringify({
				records: [
					{
						id: 'recBoardExact',
						fields: {
							'Project ID': 'recgdpwEI5hFO7bUZ',
							UID: 'anon',
							Purpose: 'reflexive_journal',
							Active: true,
							'Mural ID': 'exact-board',
							'Workspace ID': 'workspace-fixture',
						},
					},
				],
			}),
			{ status: 200, headers: { 'content-type': 'application/json' } }
		);
	};

	try {
		const rows = await listBoards(
			{
				...env,
				AIRTABLE_API_KEY: 'fixture-token',
				RESEARCHOPS_D1: makeD1({
					onRun(sql, params) {
						d1Writes.push({ sql, params });
					},
				}),
			},
			{
				projectId: 'recgdpwEI5hFO7bUZ',
				uid: 'anon',
				purpose: 'reflexive_journal',
			}
		);

		const insert = mappingInsert(d1Writes, 'exact-board');
		assert.equal(rows.length, 1);
		assert.equal(rows[0].fields['Mural ID'], 'exact-board');
		assert.match(formulas[0], /\{Project ID\} = "recgdpwEI5hFO7bUZ"/);
		assert.equal(formulas.length, 1);
		assert.ok(insert);
		assert.equal(insert.params[1], 'recgdpwEI5hFO7bUZ');
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('listBoards preserves legacy fallback rows without Project ID text', async () => {
	const formulas = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (resource) => {
		const url = new URL(String(resource));
		const formula = url.searchParams.get('filterByFormula') || '';
		formulas.push(formula);
		if (formula.includes('{Project ID}')) {
			return new Response(JSON.stringify({ records: [] }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			});
		}
		return new Response(
			JSON.stringify({
				records: [
					{
						id: 'recBoard1',
						fields: {
							Project: ['recgdpwEI5hFO7bUZ'],
							UID: 'anon',
							Purpose: 'reflexive_journal',
							Active: true,
							'Mural ID': 'legacy-board',
						},
					},
				],
			}),
			{ status: 200, headers: { 'content-type': 'application/json' } }
		);
	};

	try {
		const rows = await listBoards(
			{
				...env,
				AIRTABLE_API_KEY: 'fixture-token',
				RESEARCHOPS_D1: makeD1({ rows: [] }),
			},
			{
				projectId: 'recgdpwEI5hFO7bUZ',
				uid: 'anon',
				purpose: 'reflexive_journal',
			}
		);

		assert.equal(rows.length, 1);
		assert.equal(rows[0].fields['Mural ID'], 'legacy-board');
		assert.match(formulas[0], /\{Project ID\}/);
		assert.doesNotMatch(formulas[1], /\{Project ID\}/);
		assert.doesNotMatch(formulas[1], /\{UID\}/);
		assert.match(formulas[1], /\{Purpose\} = "reflexive_journal"/);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('createBoard mirrors board mappings to D1 before external registration', async () => {
	const d1Writes = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () =>
		new Response(
			JSON.stringify({
				errors: [{ error: 'PUBLIC_API_BILLING_LIMIT_EXCEEDED' }],
			}),
			{ status: 429, headers: { 'content-type': 'application/json' } }
		);

	try {
		const result = await createBoard(
			{
				...env,
				RESEARCHOPS_D1: makeD1({
					onRun(sql, params) {
						d1Writes.push({ sql, params });
					},
				}),
			},
			{
				projectIdText: 'recgdpwEI5hFO7bUZ',
				uid: 'anon',
				purpose: 'reflexive_journal',
				muralId: 'new-board',
				boardUrl: 'https://example.test/mural/new',
				primary: true,
				active: true,
			}
		);

		const insert = mappingInsert(d1Writes, 'new-board');
		assert.equal(result.deferred, true);
		assert.equal(result.d1Write.ok, true);
		assert.ok(insert);
		assert.equal(insert.params[1], 'recgdpwEI5hFO7bUZ');
	} finally {
		globalThis.fetch = originalFetch;
	}
});
