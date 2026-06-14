import assert from 'node:assert/strict';
import { muralJournalSync } from '../infra/cloudflare/src/service/mural-journal-sync-layout.js';

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

function widget(overrides) {
	return {
		...overrides,
		id: overrides.id,
		type: overrides.type || 'sticky-note',
		text: overrides.text || '',
		tags: overrides.tags || [],
		x: overrides.x,
		y: overrides.y,
		width: overrides.width,
		height: overrides.height,
		style: overrides.style || { backgroundColor: '#FFFFFFFF', fontSize: 23, textAlign: 'left' },
	};
}

function service(entries) {
	return {
		env: { MURAL_COMPANY_ID: 'homeofficegovuk' },
		corsHeaders() {
			return {};
		},
		json(body, status) {
			return jsonResponse(body, status);
		},
		mural: {
			async loadTokens() {
				return { access_token: 'token' };
			},
			async saveTokens() {},
			async resolveBoard() {
				return { muralId: 'workspace.123', source: 'test' };
			},
		},
		async listJournalEntries() {
			return jsonResponse({ entries });
		},
	};
}

async function postHydrate(svc) {
	return muralJournalSync(
		svc,
		new Request('https://researchops.test/api/mural/journal-sync', {
			method: 'POST',
			body: JSON.stringify({
				mode: 'hydrate',
				projectId: 'project-1',
				projectName: 'Test Project 1',
			}),
		}),
		'https://researchops.test'
	);
}

async function postStatus(svc) {
	return muralJournalSync(
		svc,
		new Request('https://researchops.test/api/mural/journal-sync', {
			method: 'POST',
			body: JSON.stringify({
				mode: 'status',
				projectId: 'project-1',
				projectName: 'Test Project 1',
			}),
		}),
		'https://researchops.test'
	);
}

const originalFetch = globalThis.fetch;

try {
	const entries = [
		{
			id: 'entry-001',
			category: 'Perceptions',
			content: 'The team is beginning to see research evidence as an operating model.',
			tags: ['evidence', 'operating-model'],
			createdAt: '2026-01-01T09:00:00.000Z',
		},
		{
			id: 'entry-002',
			category: 'Perceptions',
			content: 'The team is beginning to see research evidence as an operating model.',
			tags: ['tool-switching'],
			createdAt: '2026-01-02T09:00:00.000Z',
		},
	];

	const writes = [];
	globalThis.fetch = async (url, init = {}) => {
		const href = String(url);
		if (href.endsWith('/users/me'))
			return jsonResponse({ value: { companyId: 'homeofficegovuk' } });
		if (
			href.endsWith('/murals/workspace.123/widgets/sticky-note') &&
			String(init.method || 'GET').toUpperCase() === 'POST'
		) {
			const body = JSON.parse(init.body);
			writes.push({ method: 'POST', href, body });
			return jsonResponse({ value: { id: 'created-entry-002', ...body } }, 201);
		}
		if (new URL(href).pathname.endsWith('/murals/workspace.123/widgets')) {
			return jsonResponse({
				value: [
					widget({
						id: 'title-perceptions',
						text: 'The team is beginning to see research evidence as',
						tags: ['perceptions', 'Test Project 1'],
						x: 0,
						y: -72,
						width: 260,
						height: 64,
						style: { backgroundColor: '#9120A8FF' },
					}),
					widget({
						id: 'header-perceptions',
						type: 'shape',
						text: '',
						tags: ['perceptions'],
						x: 0,
						y: 0,
						width: 400,
						height: 80,
						style: { backgroundColor: '#9120A8FF' },
					}),
					widget({
						id: 'template-perceptions',
						text: '',
						tags: ['perceptions', 'Test Project 1'],
						x: 0,
						y: 120,
						width: 400,
						height: 220,
					}),
					widget({
						id: 'header-procedures',
						type: 'shape',
						text: 'Procedures',
						tags: ['procedures'],
						x: 500,
						y: 0,
						width: 400,
						height: 80,
					}),
				],
			});
		}
		if (href.endsWith('/widgets/sticky-note/template-perceptions')) {
			const body = JSON.parse(init.body);
			writes.push({ method: String(init.method || 'GET').toUpperCase(), href, body });
			return jsonResponse({ value: { id: 'template-perceptions', ...body } });
		}
		throw new Error(`Unexpected fetch: ${href}`);
	};

	const response = await postHydrate(service(entries));
	const data = await response.json();
	assert.equal(response.status, 200);
	assert.equal(data.createdOrUpdated, 2);
	assert.equal(data.pending, 0);
	assert.deepEqual(
		writes.map((write) => write.method),
		['PATCH', 'POST']
	);
	assert.equal(writes[0].href.endsWith('/widgets/sticky-note/template-perceptions'), true);
	assert.equal(writes[0].body.text, entries[0].content);
	assert.deepEqual(writes[0].body.researchOpsUserTags, ['evidence', 'operating-model']);
	assert.equal(writes[1].body.text, entries[1].content);
	assert.deepEqual(writes[1].body.researchOpsUserTags, ['tool-switching']);
	assert.equal(writes[1].body.y, 372);

	const existingEntries = [entries[0]];
	const existingWrites = [];
	globalThis.fetch = async (url, init = {}) => {
		const href = String(url);
		if (href.endsWith('/users/me'))
			return jsonResponse({ value: { companyId: 'homeofficegovuk' } });
		if (new URL(href).pathname.endsWith('/murals/workspace.123/widgets')) {
			if (String(init.method || 'GET').toUpperCase() !== 'GET') {
				existingWrites.push({ method: init.method, href, body: JSON.parse(init.body) });
			}
			return jsonResponse({
				value: [
					widget({
						id: 'header-perceptions',
						type: 'shape',
						text: { plainText: 'Perceptions' },
						tags: ['perceptions'],
						x: 0,
						y: 0,
						width: 400,
						height: 80,
					}),
					widget({
						id: 'existing-entry-001',
						text: entries[0].content,
						tags: ['perceptions', 'Test Project 1'],
						x: 0,
						y: 120,
						width: 400,
						height: 220,
					}),
				],
			});
		}
		throw new Error(`Unexpected fetch: ${href}`);
	};

	const existingResponse = await postHydrate(service(existingEntries));
	const existingData = await existingResponse.json();
	assert.equal(existingResponse.status, 200);
	assert.equal(existingData.createdOrUpdated, 0);
	assert.equal(existingData.alreadySynced, 1);
	assert.equal(existingData.pending, 0);
	assert.equal(existingData.outcomes[0].action, 'already-synced');
	assert.equal(existingData.outcomes[0].preserved, true);
	assert.equal(existingWrites.length, 0);

	const manualEntries = [
		{
			id: 'd1tp1_journal_001',
			category: 'Perceptions',
			content:
				'The team is beginning to see research evidence as an operating model rather than a set of documents. People trust findings more when they can see where an observation came from, what is still uncertain and which decision it was meant to support.',
			tags: ['evidence-readiness', 'confidence', 'decision-support'],
			createdAt: '2026-06-03T09:15:00.000Z',
		},
		{
			id: 'd1tp1_journal_006',
			category: 'Perceptions',
			content:
				'Several researchers described losing the thread when they moved between the project dashboard, notes, spreadsheets and mural boards. The issue is not only tool count; it is the mental effort of rebuilding context every time.',
			tags: ['context-rebuilding', 'tool-switching', 'researcher-workload'],
			createdAt: '2026-06-05T13:10:00.000Z',
		},
		{
			id: 'd1tp1_journal_010',
			category: 'Perceptions',
			content:
				'The dashboard is useful when it shows what changed since the last visit. Researchers do not need another place to duplicate updates; they need a way to re-enter the project without reading every artefact again.',
			tags: ['duplicate-updates', 'context-rebuilding', 'dashboard'],
			createdAt: '2026-06-07T14:55:00.000Z',
		},
	];
	const manualWrites = [];
	let manualWidgetPageLoads = 0;
	globalThis.fetch = async (url, init = {}) => {
		const href = String(url);
		const method = String(init.method || 'GET').toUpperCase();
		const parsed = new URL(href);
		if (href.endsWith('/users/me'))
			return jsonResponse({ value: { companyId: 'homeofficegovuk' } });
		if (parsed.pathname.endsWith('/murals/workspace.123/widgets')) {
			if (method !== 'GET') manualWrites.push({ method, href, body: JSON.parse(init.body) });
			manualWidgetPageLoads += 1;
			if (!parsed.searchParams.get('next')) {
				return jsonResponse({
					value: [
						widget({
							id: 'header-perceptions',
							type: 'shape',
							text: 'Perceptions',
							tags: ['perceptions'],
							x: 0,
							y: 0,
							width: 400,
							height: 80,
							style: { backgroundColor: '#9120A8FF' },
						}),
					],
					next: 'manual-page-2',
				});
			}
			return jsonResponse({
				value: [
					widget({
						id: 'manual-entry-001',
						text: { plainText: manualEntries[0].content.replace(/\. People/, '.\nPeople') },
						tags: ['perceptions', 'Test Project 1'],
						x: 0,
						y: 120,
						width: 400,
						height: 220,
					}),
					widget({
						id: 'manual-entry-006',
						htmlText: `<p>${manualEntries[1].content}</p>`,
						tags: ['perceptions', 'Test Project 1'],
						x: 0,
						y: 372,
						width: 400,
						height: 220,
					}),
					widget({
						id: 'manual-entry-010',
						content: manualEntries[2].content,
						tags: ['perceptions', 'Test Project 1'],
						x: 0,
						y: 624,
						width: 400,
						height: 220,
					}),
				],
			});
		}
		throw new Error(`Unexpected fetch: ${method} ${href}`);
	};

	const manualStatusResponse = await postStatus(service(manualEntries));
	const manualStatusData = await manualStatusResponse.json();
	assert.equal(manualStatusResponse.status, 200);
	assert.equal(manualStatusData.synced, 3);
	assert.equal(manualStatusData.pending, 0);
	assert.deepEqual(manualStatusData.byCategory.perceptions, { total: 3, synced: 3, pending: 0 });
	assert.equal(manualWidgetPageLoads, 2);

	const manualHydrateResponse = await postHydrate(service(manualEntries));
	const manualHydrateData = await manualHydrateResponse.json();
	assert.equal(manualHydrateResponse.status, 200);
	assert.equal(manualHydrateData.createdOrUpdated, 0);
	assert.equal(manualHydrateData.alreadySynced, 3);
	assert.equal(manualHydrateData.pending, 0);
	assert.deepEqual(
		manualHydrateData.outcomes.map((outcome) => outcome.action),
		['already-synced', 'already-synced', 'already-synced']
	);
	assert.equal(manualWidgetPageLoads, 4);
	assert.equal(manualWrites.length, 0);

	const repairWrites = [];
	globalThis.fetch = async (url, init = {}) => {
		const href = String(url);
		const method = String(init.method || 'GET').toUpperCase();
		if (href.endsWith('/users/me'))
			return jsonResponse({ value: { companyId: 'homeofficegovuk' } });
		if (new URL(href).pathname.endsWith('/murals/workspace.123/widgets') && method === 'GET') {
			return jsonResponse({
				value: [
					widget({
						id: 'bad-title-entry-001',
						text: entries[0].content,
						tags: ['perceptions', 'Test Project 1', 'journal-entry:entry-001'],
						x: 0,
						y: -72,
						width: 260,
						height: 160,
					}),
					widget({
						id: 'template-perceptions',
						text: '',
						tags: ['perceptions', 'Test Project 1'],
						x: 0,
						y: 120,
						width: 260,
						height: 160,
					}),
				],
			});
		}
		if (href.endsWith('/widgets/sticky-note/template-perceptions') && method === 'PATCH') {
			const body = JSON.parse(init.body);
			repairWrites.push({ method, href, body });
			return jsonResponse({ value: { id: 'template-perceptions', ...body } });
		}
		if (href.endsWith('/murals/workspace.123/widgets/bad-title-entry-001') && method === 'DELETE') {
			repairWrites.push({ method, href, body: null });
			return new Response(null, { status: 204 });
		}
		throw new Error(`Unexpected fetch: ${method} ${href}`);
	};

	const repairResponse = await postHydrate(service([entries[0]]));
	const repairData = await repairResponse.json();
	assert.equal(repairResponse.status, 200);
	assert.equal(repairData.createdOrUpdated, 1);
	assert.equal(repairData.pending, 0);
	assert.equal(repairData.outcomes[0].action, 'updated-template-widget');
	assert.equal(repairWrites[0].href.endsWith('/widgets/sticky-note/template-perceptions'), true);
	assert.deepEqual(
		repairWrites.map((write) => write.method),
		['PATCH', 'DELETE']
	);
	assert.deepEqual(repairData.outcomes[0].deletedStaleWidgetIds, ['bad-title-entry-001']);

	// When route hydration fails in the browser the client can only echo the
	// project id, so the project name (and the Snowberry project tag carried
	// onto new cards) must resolve from the D1 project record instead.
	const d1NameWrites = [];
	globalThis.fetch = async (url, init = {}) => {
		const href = String(url);
		const method = String(init.method || 'GET').toUpperCase();
		if (href.endsWith('/users/me'))
			return jsonResponse({ value: { companyId: 'homeofficegovuk' } });
		if (new URL(href).pathname.endsWith('/murals/workspace.123/widgets') && method === 'GET') {
			return jsonResponse({
				value: [
					widget({
						id: 'header-perceptions',
						type: 'shape',
						text: 'Perceptions',
						tags: ['perceptions'],
						x: 0,
						y: 0,
						width: 400,
						height: 80,
						style: { backgroundColor: '#9120A8FF' },
					}),
					widget({
						id: 'existing-entry-001',
						text: entries[0].content,
						tags: ['perceptions', 'Test Project 1', 'evidence', 'journal-entry:entry-001'],
						x: 0,
						y: 120,
						width: 400,
						height: 220,
					}),
				],
			});
		}
		if (href.endsWith('/murals/workspace.123/widgets/sticky-note') && method === 'POST') {
			const body = JSON.parse(init.body);
			d1NameWrites.push({ method, href, body });
			return jsonResponse({ value: { id: 'created-entry-002', ...body } }, 201);
		}
		throw new Error(`Unexpected fetch: ${method} ${href}`);
	};

	const d1NameService = service(entries);
	d1NameService.env.RESEARCHOPS_D1 = {
		prepare() {
			return {
				bind() {
					return this;
				},
				async first() {
					return { name: 'Test Project 1' };
				},
				async all() {
					return { results: [] };
				},
				async run() {
					return {};
				},
			};
		},
	};
	const d1NameResponse = await muralJournalSync(
		d1NameService,
		new Request('https://researchops.test/api/mural/journal-sync', {
			method: 'POST',
			body: JSON.stringify({
				mode: 'hydrate',
				projectId: 'recgdpwEI5hFO7bUZ',
				projectName: 'recgdpwEI5hFO7bUZ',
			}),
		}),
		'https://researchops.test'
	);
	const d1NameData = await d1NameResponse.json();
	assert.equal(d1NameResponse.status, 200);
	assert.equal(d1NameData.createdOrUpdated, 1);
	assert.equal(d1NameData.alreadySynced, 1);
	assert.equal(d1NameWrites.length, 1);
	assert.equal(d1NameWrites[0].body.text, entries[1].content);
	// The Snowberry project tag carries over; the other card's user tags do not.
	assert.deepEqual(d1NameWrites[0].body.tags, ['perceptions', 'Test Project 1', 'tool-switching']);

	// A blank column template carrying a stale journal-entry marker must NOT be
	// counted as a synced entry. Status should report the entry as pending so
	// the board's empty cards are not mistaken for landed content.
	globalThis.fetch = async (url, init = {}) => {
		const href = String(url);
		const method = String(init.method || 'GET').toUpperCase();
		if (href.endsWith('/users/me'))
			return jsonResponse({ value: { companyId: 'homeofficegovuk' } });
		if (new URL(href).pathname.endsWith('/murals/workspace.123/widgets') && method === 'GET') {
			return jsonResponse({
				value: [
					widget({
						id: 'header-perceptions',
						type: 'shape',
						text: 'Perceptions',
						tags: ['perceptions'],
						x: 0,
						y: 0,
						width: 400,
						height: 80,
						style: { backgroundColor: '#9120A8FF' },
					}),
					widget({
						id: 'template-perceptions',
						text: '',
						// Status annotation injects the journal-entry marker into
						// the title and tags of a card mapped in D1; the card body
						// stays empty. This must still be treated as a blank template.
						title: 'journal-entry:entry-001',
						tags: ['perceptions', 'Test Project 1', 'journal-entry:entry-001'],
						x: 0,
						y: 120,
						width: 400,
						height: 220,
					}),
				],
			});
		}
		throw new Error(`Unexpected fetch: ${method} ${href}`);
	};

	const blankStatusResponse = await postStatus(service([entries[0]]));
	const blankStatusData = await blankStatusResponse.json();
	assert.equal(blankStatusResponse.status, 200);
	assert.equal(blankStatusData.synced, 0);
	assert.equal(blankStatusData.pending, 1);
	assert.deepEqual(blankStatusData.byCategory.perceptions, { total: 1, synced: 0, pending: 1 });
} finally {
	globalThis.fetch = originalFetch;
}
