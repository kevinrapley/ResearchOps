import assert from 'node:assert/strict';
import test from 'node:test';

import {
	getJournalEntry,
	listJournalEntries,
	updateJournalEntry,
} from '../infra/cloudflare/src/service/journals.js';

function createMockD1() {
	const state = {
		journalEntries: [],
		runs: [],
	};

	function statement(sql, args = []) {
		return {
			bind(...nextArgs) {
				return statement(sql, nextArgs);
			},
			async first() {
				if (/FROM journal_entries/i.test(sql) && /WHERE record_id = \?/i.test(sql)) {
					return state.journalEntries.find((row) => row.record_id === args[0]) || null;
				}
				return null;
			},
			async all() {
				if (/FROM journal_entries/i.test(sql)) {
					const project = args[0];
					return {
						results: state.journalEntries.filter(
							(row) => row.local_project_id === project || row.project === project
						),
					};
				}
				return { results: [] };
			},
			async run() {
				state.runs.push({ sql, args });
				if (/INSERT INTO journal_entries/i.test(sql)) {
					const next = {
						record_id: args[0],
						project: args[1],
						category: args[2],
						content: args[3],
						tags: args[4],
						createdat: args[5],
						local_project_id: args[6],
					};
					const existing = state.journalEntries.find((row) => row.record_id === next.record_id);
					if (existing) Object.assign(existing, next);
					else state.journalEntries.push(next);
				}
				if (/UPDATE journal_entries/i.test(sql)) {
					const recordId = args.at(-1);
					const row = state.journalEntries.find((item) => item.record_id === recordId);
					if (row) {
						if (/category = \?/.test(sql)) row.category = args[0];
						if (/content = \?/.test(sql)) row.content = args[/category = \?/.test(sql) ? 1 : 0];
						if (/tags = \?/.test(sql)) row.tags = args.at(-2);
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
		cfg: {
			MAX_BODY_BYTES: 1024 * 1024,
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

test('getJournalEntry serves and restores the seeded Test Project 1 entry when D1 is missing the row', async () => {
	const d1 = createMockD1();
	const svc = createService(d1);

	const response = await getJournalEntry(svc, '', 'd1tp1_journal_004');
	const body = await json(response);

	assert.equal(response.status, 200);
	assert.equal(body.ok, true);
	assert.equal(body.entry.id, 'd1tp1_journal_004');
	assert.equal(body.entry.project, 'recgdpwEI5hF07bUZ');
	assert.equal(body.entry.localProjectId, 'd04ab32e-6756-408e-a649-6859dd0079f2');
	assert.equal(body.entry.source, 'seed');
	assert.equal(d1.state.journalEntries.length, 1);
	assert.equal(d1.state.journalEntries[0].record_id, 'd1tp1_journal_004');
});

test('listJournalEntries serves seeded Test Project 1 entries for the legacy project id', async () => {
	const d1 = createMockD1();
	const svc = createService(d1);
	const url = new URL('https://local.test/api/journal-entries?project=recgdpwEI5hFO7bUZ');

	const response = await listJournalEntries(svc, '', url);
	const body = await json(response);

	assert.equal(response.status, 200);
	assert.equal(body.ok, true);
	assert.equal(body.source, 'seed');
	assert.equal(body.entries.length, 12);
	assert.equal(body.entries[0].id, 'd1tp1_journal_012');
	assert.equal(d1.state.journalEntries.length, 12);
});

test('updateJournalEntry restores the seeded row before applying edits', async () => {
	const d1 = createMockD1();
	const svc = createService(d1);
	const request = new Request('https://local.test/api/journal-entries/d1tp1_journal_004', {
		method: 'PATCH',
		body: JSON.stringify({
			category: 'decisions',
			content: 'Updated reflection text.',
			tags: ['updated', 'reflection'],
		}),
	});

	const response = await updateJournalEntry(svc, request, '', 'd1tp1_journal_004');
	const body = await json(response);
	const row = d1.state.journalEntries.find((item) => item.record_id === 'd1tp1_journal_004');

	assert.equal(response.status, 200);
	assert.equal(body.ok, true);
	assert.equal(row.category, 'decisions');
	assert.equal(row.content, 'Updated reflection text.');
	assert.equal(row.tags, JSON.stringify(['updated', 'reflection']));
});
