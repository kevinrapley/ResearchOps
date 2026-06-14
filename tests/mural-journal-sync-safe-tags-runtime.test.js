import assert from 'node:assert/strict';
import { muralJournalSync } from '../infra/cloudflare/src/service/mural-journal-sync-safe-tags.js';

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
			content: 'Several researchers described losing the thread when they moved between tools.',
			tags: ['tool-switching'],
			createdAt: '2026-01-02T09:00:00.000Z',
		},
	];

	const stickyWrites = [];
	const tagCreates = [];
	const tagApplications = [];

	globalThis.fetch = async (url, init = {}) => {
		const href = String(url);
		const method = String(init.method || 'GET').toUpperCase();

		if (href.endsWith('/users/me')) {
			return jsonResponse({ value: { companyId: 'homeofficegovuk' } });
		}

		if (new URL(href).pathname.endsWith('/murals/workspace.123/widgets') && method === 'GET') {
			return jsonResponse({
				value: [
					widget({
						id: 'header-perceptions',
						type: 'sticky-note',
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
						tags: ['perceptions', 'Test Project 1'],
						x: 0,
						y: 120,
						width: 400,
						height: 220,
					}),
				],
			});
		}

		if (href.endsWith('/murals/workspace.123/tags') && method === 'GET') {
			return jsonResponse({
				value: [
					{ id: 'tag-perceptions', text: 'perceptions', backgroundColor: '#F7D7F3FF' },
					{ id: 'tag-project', text: 'Test Project 1', backgroundColor: '#F3F2F1FF' },
				],
			});
		}

		if (href.endsWith('/murals/workspace.123/tags') && method === 'POST') {
			const body = JSON.parse(init.body);
			tagCreates.push(body);
			return jsonResponse(
				{
					value: {
						id: `tag-${body.text}`,
						text: body.text,
						backgroundColor: body.backgroundColor,
						borderColor: body.borderColor,
						color: body.color,
					},
				},
				201
			);
		}

		if (
			/\/murals\/workspace\.123\/widgets\/sticky-note\/(?:template-perceptions|created-entry-002)$/.test(
				href
			) &&
			method === 'PATCH'
		) {
			const body = JSON.parse(init.body);
			const widgetId = href.split('/').at(-1);
			if (Array.isArray(body.tags) && body.text === undefined) {
				tagApplications.push({ href, body });
				return jsonResponse({ value: { id: widgetId, ...body } });
			}
			stickyWrites.push({ method, href, body });
			return jsonResponse({ value: { id: widgetId, ...body } });
		}

		if (href.endsWith('/murals/workspace.123/widgets/sticky-note') && method === 'POST') {
			const body = JSON.parse(init.body);
			stickyWrites.push({ method, href, body });
			return jsonResponse({ value: { id: 'created-entry-002', ...body } }, 201);
		}

		throw new Error(`Unexpected fetch: ${method} ${href}`);
	};

	const response = await postHydrate(service(entries));
	const data = await response.json();

	assert.equal(response.status, 200);
	assert.equal(data.createdOrUpdated, 2);
	assert.equal(stickyWrites[0].href.endsWith('/widgets/sticky-note/template-perceptions'), true);
	assert.equal(stickyWrites[0].body.text, entries[0].content);
	assert.equal(stickyWrites[0].body.tags, undefined);
	assert.equal(stickyWrites[0].body.researchOpsUserTags, undefined);
	assert.equal(stickyWrites[1].body.y, 372);

	assert.deepEqual(tagCreates.map((tag) => tag.text).sort(), [
		'evidence',
		'operating-model',
		'tool-switching',
	]);
	assert.equal(
		tagCreates.every((tag) => tag.backgroundColor === '#DDF7E8FF'),
		true
	);
	assert.equal(
		tagCreates.some((tag) => tag.text === 'perceptions'),
		false
	);
	assert.equal(
		tagCreates.some((tag) => tag.text === 'Test Project 1'),
		false
	);

	assert.deepEqual(tagApplications[0].body.tags, [
		'tag-perceptions',
		'tag-project',
		'tag-evidence',
		'tag-operating-model',
	]);
	assert.deepEqual(tagApplications[1].body.tags, [
		'tag-perceptions',
		'tag-project',
		'tag-tool-switching',
	]);
	assert.equal(
		tagApplications.every((application) => application.href.includes('/widgets/sticky-note/')),
		true
	);

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
	const widgetReadUrls = [];

	globalThis.fetch = async (url, init = {}) => {
		const href = String(url);
		const method = String(init.method || 'GET').toUpperCase();
		const parsed = new URL(href);

		if (href.endsWith('/users/me')) {
			return jsonResponse({ value: { companyId: 'homeofficegovuk' } });
		}

		if (parsed.pathname.endsWith('/murals/workspace.123/widgets')) {
			if (method !== 'GET') manualWrites.push({ method, href, body: JSON.parse(init.body) });
			widgetReadUrls.push(parsed);
			if (!parsed.searchParams.get('next')) {
				return jsonResponse({
					value: [
						widget({
							id: 'header-perceptions',
							type: 'shape',
							text: { plainText: 'Perceptions' },
							tags: [{ text: 'perceptions' }],
							x: 0,
							y: 0,
							width: 400,
							height: 80,
							style: { backgroundColor: '#9120A8FF' },
						}),
					],
					pagination: { next: 'manual-page-2' },
				});
			}
			return jsonResponse({
				value: [
					{
						id: 'manual-entry-001',
						type: 'sticky_note',
						tags: [{ text: 'perceptions' }, { text: 'Test Project 1' }],
						x: 0,
						y: 120,
						width: 400,
						height: 220,
					},
					{
						id: 'manual-entry-006',
						type: 'sticky_note',
						tags: [{ label: 'perceptions' }, { label: 'Test Project 1' }],
						x: 0,
						y: 372,
						width: 400,
						height: 220,
					},
					{
						id: 'manual-entry-010',
						type: 'sticky_note',
						tags: ['perceptions', 'Test Project 1'],
						x: 0,
						y: 624,
						width: 400,
						height: 220,
					},
				],
			});
		}

		if (
			parsed.pathname.endsWith('/murals/workspace.123/widgets/manual-entry-001') &&
			method === 'GET'
		) {
			return jsonResponse({
				value: {
					id: 'manual-entry-001',
					properties: { plainText: manualEntries[0].content.replace(/\. People/, '.\nPeople') },
				},
			});
		}

		if (
			parsed.pathname.endsWith('/murals/workspace.123/widgets/manual-entry-006') &&
			method === 'GET'
		) {
			return jsonResponse({
				value: {
					id: 'manual-entry-006',
					data: { htmlText: `<p>${manualEntries[1].content}</p>` },
				},
			});
		}

		if (
			parsed.pathname.endsWith('/murals/workspace.123/widgets/manual-entry-010') &&
			method === 'GET'
		) {
			return jsonResponse({
				value: {
					id: 'manual-entry-010',
					content: manualEntries[2].content,
				},
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
	assert.equal(widgetReadUrls[0].searchParams.get('limit'), '100');
	assert.equal(widgetReadUrls[1].searchParams.get('next'), 'manual-page-2');
	assert.equal(manualWrites.length, 0);

	// Strict-contract Mural: the live API rejects sticky-note bodies that carry
	// undocumented properties (style, shape, width, height, stackingOrder).
	// The sync must degrade to the documented payloads so entries still land.
	const strictEntries = [
		{
			id: 'strict-entry-001',
			category: 'Perceptions',
			content: 'The team is beginning to see research evidence as an operating model.',
			tags: ['evidence-readiness', 'confidence'],
			createdAt: '2026-06-03T09:15:00.000Z',
		},
		{
			id: 'strict-entry-002',
			category: 'Perceptions',
			content: 'Several researchers described losing the thread when they moved between tools.',
			tags: ['tool-switching'],
			createdAt: '2026-06-05T13:10:00.000Z',
		},
	];

	const DOCUMENTED_STICKY_FIELDS = new Set(['text', 'x', 'y', 'backgroundColor']);
	const strictStickyWrites = [];
	const strictRejectedWrites = [];
	const strictTagApplications = [];
	const strictTagCreates = [];
	let strictTagListReads = 0;
	let strictCreatedCount = 0;

	function strictInvalidFields(body) {
		return Object.keys(body).filter((key) => !DOCUMENTED_STICKY_FIELDS.has(key));
	}

	globalThis.fetch = async (url, init = {}) => {
		const href = String(url);
		const method = String(init.method || 'GET').toUpperCase();

		if (href.endsWith('/users/me')) {
			return jsonResponse({ value: { companyId: 'homeofficegovuk' } });
		}

		if (new URL(href).pathname.endsWith('/murals/workspace.123/widgets') && method === 'GET') {
			return jsonResponse({
				value: [
					widget({
						id: 'header-perceptions',
						type: 'sticky-note',
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
						tags: ['perceptions', 'Test Project 1'],
						x: 0,
						y: 120,
						width: 400,
						height: 220,
					}),
				],
			});
		}

		if (href.endsWith('/murals/workspace.123/tags') && method === 'GET') {
			strictTagListReads += 1;
			return jsonResponse({
				value: [
					{ id: 'tag-perceptions', text: 'perceptions', backgroundColor: '#F7D7F3FF' },
					{ id: 'tag-project', text: 'Test Project 1', backgroundColor: '#F3F2F1FF' },
				],
			});
		}

		if (href.endsWith('/murals/workspace.123/tags') && method === 'POST') {
			const body = JSON.parse(init.body);
			strictTagCreates.push(body);
			return jsonResponse({ value: { id: `tag-${body.text}`, text: body.text } }, 201);
		}

		if (/\/murals\/workspace\.123\/widgets\/sticky-note\/[^/]+$/.test(href) && method === 'PATCH') {
			const body = JSON.parse(init.body);
			const widgetId = href.split('/').at(-1);
			if (Array.isArray(body.tags) && body.text === undefined) {
				strictTagApplications.push({ href, body });
				return jsonResponse({ value: { id: widgetId, ...body } });
			}
			const invalid = strictInvalidFields(body);
			if (invalid.length) {
				strictRejectedWrites.push({ method, href, invalid });
				return jsonResponse(
					{ code: 'INVALID_BODY', message: `Invalid properties: ${invalid.join(', ')}` },
					400
				);
			}
			strictStickyWrites.push({ method, href, body });
			return jsonResponse({ value: { id: widgetId, ...body } });
		}

		if (href.endsWith('/murals/workspace.123/widgets/sticky-note') && method === 'POST') {
			const body = JSON.parse(init.body);
			const invalid = strictInvalidFields(body);
			if (invalid.length) {
				strictRejectedWrites.push({ method, href, invalid });
				return jsonResponse(
					{ code: 'INVALID_BODY', message: `Invalid properties: ${invalid.join(', ')}` },
					400
				);
			}
			strictCreatedCount += 1;
			strictStickyWrites.push({ method, href, body });
			return jsonResponse({ value: { id: `strict-created-${strictCreatedCount}`, ...body } }, 201);
		}

		throw new Error(`Unexpected fetch: ${method} ${href}`);
	};

	const strictResponse = await postHydrate(service(strictEntries));
	const strictData = await strictResponse.json();

	assert.equal(strictResponse.status, 200);
	assert.equal(strictData.failed, 0);
	assert.equal(strictData.createdOrUpdated, 2);

	const strictPatch = strictStickyWrites.find((write) => write.method === 'PATCH');
	assert.equal(strictPatch.href.endsWith('/widgets/sticky-note/template-perceptions'), true);
	assert.equal(strictPatch.body.text, strictEntries[0].content);

	const strictCreate = strictStickyWrites.find((write) => write.method === 'POST');
	assert.equal(strictCreate.body.text, strictEntries[1].content);
	assert.equal(
		Object.keys(strictCreate.body).every((key) => DOCUMENTED_STICKY_FIELDS.has(key)),
		true
	);

	assert.equal(strictTagListReads, 1);
	assert.deepEqual(strictTagCreates.map((tag) => tag.text).sort(), [
		'confidence',
		'evidence-readiness',
		'tool-switching',
	]);
	assert.deepEqual(strictTagApplications[0].body.tags, [
		'tag-perceptions',
		'tag-project',
		'tag-evidence-readiness',
		'tag-confidence',
	]);
	assert.deepEqual(strictTagApplications[1].body.tags, [
		'tag-perceptions',
		'tag-project',
		'tag-tool-switching',
	]);
	assert.equal(
		strictTagApplications.every((application) =>
			application.href.includes('/widgets/sticky-note/')
		),
		true
	);

	// Live widget-list shape: widgets carry tag IDS (not texts) and empty-string
	// text fields. Tag texts only resolve via GET /murals/{id}/tags, and card
	// body text is only available from per-widget detail GETs.
	const liveShapeWrites = [];
	let liveShapeDetailReads = 0;

	function liveShapeListWidget(id, y, tagIds, extra = {}) {
		return {
			id,
			type: 'sticky note',
			htmlText: '',
			tags: tagIds,
			x: 0,
			y,
			width: 400,
			height: 220,
			...extra,
		};
	}

	globalThis.fetch = async (url, init = {}) => {
		const href = String(url);
		const method = String(init.method || 'GET').toUpperCase();
		const parsed = new URL(href);

		if (href.endsWith('/users/me')) {
			return jsonResponse({ value: { companyId: 'homeofficegovuk' } });
		}

		if (parsed.pathname.endsWith('/murals/workspace.123/widgets') && method === 'GET') {
			return jsonResponse({
				value: [
					liveShapeListWidget('live-header-perceptions', 0, [], {
						htmlText: '<p>Perceptions</p>',
						height: 80,
						style: { backgroundColor: '#9120A8FF' },
					}),
					liveShapeListWidget('live-card-001', 120, ['tagid-perceptions', 'tagid-project']),
					liveShapeListWidget('live-card-006', 372, ['tagid-perceptions', 'tagid-project']),
					liveShapeListWidget('live-card-010', 624, ['tagid-perceptions', 'tagid-project']),
				],
			});
		}

		if (href.endsWith('/murals/workspace.123/tags') && method === 'GET') {
			return jsonResponse({
				value: [
					{ id: 'tagid-perceptions', text: 'perceptions' },
					{ id: 'tagid-project', text: 'Test Project 1' },
				],
			});
		}

		const detailMatch = parsed.pathname.match(
			/\/murals\/workspace\.123\/widgets\/(live-card-\d+)$/
		);
		if (detailMatch && method === 'GET') {
			liveShapeDetailReads += 1;
			const detailText = {
				'live-card-001': manualEntries[0].content,
				'live-card-006': manualEntries[1].content,
				'live-card-010': manualEntries[2].content,
			}[detailMatch[1]];
			return jsonResponse({
				value: { id: detailMatch[1], htmlText: `<p>${detailText}</p>` },
			});
		}

		if (method !== 'GET') {
			liveShapeWrites.push({ method, href });
			return jsonResponse({ value: {} });
		}

		throw new Error(`Unexpected fetch: ${method} ${href}`);
	};

	const liveShapeResponse = await postStatus(service(manualEntries));
	const liveShapeData = await liveShapeResponse.json();

	assert.equal(liveShapeResponse.status, 200);
	assert.equal(liveShapeData.synced, 3);
	assert.equal(liveShapeData.pending, 0);
	assert.deepEqual(liveShapeData.byCategory.perceptions, { total: 3, synced: 3, pending: 0 });
	assert.equal(liveShapeDetailReads, 3);
	assert.equal(liveShapeWrites.length, 0);
	// Header plus the three manual cards all expose readable text.
	assert.equal(liveShapeData.diagnostics.widgetsWithBodyText, 4);
	assert.equal(liveShapeData.diagnostics.layouts.perceptions !== null, true);

	// User tags created by earlier syncs without the Mint style must be
	// restyled, and applying tags to an existing widget must keep the tags
	// already on it (the Snowberry project tag survives even when the client
	// could not send the project name and D1 cannot resolve it).
	const preserveEntries = [
		{
			id: 'preserve-entry-001',
			category: 'Perceptions',
			content: 'The team is beginning to see research evidence as an operating model.',
			tags: ['evidence'],
			createdAt: '2026-01-01T09:00:00.000Z',
		},
	];
	const preserveTagRestyles = [];
	const preserveTagCreates = [];
	const preserveTagApplications = [];
	const preserveStickyWrites = [];

	globalThis.fetch = async (url, init = {}) => {
		const href = String(url);
		const method = String(init.method || 'GET').toUpperCase();

		if (href.endsWith('/users/me')) {
			return jsonResponse({ value: { companyId: 'homeofficegovuk' } });
		}

		if (new URL(href).pathname.endsWith('/murals/workspace.123/widgets') && method === 'GET') {
			return jsonResponse({
				value: [
					widget({
						id: 'header-perceptions',
						type: 'sticky-note',
						text: 'Perceptions',
						tags: [{ id: 'tag-perceptions', text: 'perceptions' }],
						x: 0,
						y: 0,
						width: 400,
						height: 80,
						style: { backgroundColor: '#9120A8FF' },
					}),
					widget({
						id: 'template-perceptions',
						text: '',
						tags: [
							{ id: 'tag-perceptions', text: 'perceptions' },
							{ id: 'tag-project', text: 'Test Project 1' },
						],
						x: 0,
						y: 120,
						width: 400,
						height: 220,
					}),
				],
			});
		}

		// The board tag list is missing the project tag, and the pre-existing
		// user tag carries a default (non-Mint) style.
		if (href.endsWith('/murals/workspace.123/tags') && method === 'GET') {
			return jsonResponse({
				value: [
					{ id: 'tag-perceptions', text: 'perceptions', backgroundColor: '#F7D7F3FF' },
					{
						id: 'tag-evidence',
						text: 'evidence',
						backgroundColor: '#FFFFFFFF',
						borderColor: '#CCCCCCFF',
					},
				],
			});
		}

		if (href.endsWith('/murals/workspace.123/tags/tag-evidence') && method === 'PATCH') {
			preserveTagRestyles.push(JSON.parse(init.body));
			return jsonResponse({ value: { id: 'tag-evidence', text: 'evidence' } });
		}

		if (href.endsWith('/murals/workspace.123/tags') && method === 'POST') {
			preserveTagCreates.push(JSON.parse(init.body));
			return jsonResponse({ value: { id: 'tag-created', text: 'created' } }, 201);
		}

		if (href.endsWith('/widgets/sticky-note/template-perceptions') && method === 'PATCH') {
			const body = JSON.parse(init.body);
			if (Array.isArray(body.tags) && body.text === undefined) {
				preserveTagApplications.push({ href, body });
				return jsonResponse({ value: { id: 'template-perceptions', ...body } });
			}
			preserveStickyWrites.push({ method, href, body });
			return jsonResponse({ value: { id: 'template-perceptions', ...body } });
		}

		throw new Error(`Unexpected fetch: ${method} ${href}`);
	};

	const preserveResponse = await muralJournalSync(
		service(preserveEntries),
		new Request('https://researchops.test/api/mural/journal-sync', {
			method: 'POST',
			body: JSON.stringify({
				mode: 'hydrate',
				projectId: 'project-1',
				projectName: 'project-1',
			}),
		}),
		'https://researchops.test'
	);
	const preserveData = await preserveResponse.json();

	assert.equal(preserveResponse.status, 200);
	assert.equal(preserveData.createdOrUpdated, 1);
	assert.equal(preserveStickyWrites.length, 1);
	assert.equal(preserveStickyWrites[0].body.text, preserveEntries[0].content);
	// The pre-existing user tag was restyled to Mint, not recreated.
	assert.deepEqual(preserveTagRestyles, [
		{ backgroundColor: '#DDF7E8FF', borderColor: '#98DDB8FF', color: '#0B0C0CFF' },
	]);
	assert.deepEqual(preserveTagCreates, []);
	// The project tag missing from the tag list is still preserved on the widget.
	assert.equal(preserveTagApplications.length, 1);
	assert.deepEqual(preserveTagApplications[0].body.tags, [
		'tag-perceptions',
		'tag-evidence',
		'tag-project',
	]);
} finally {
	globalThis.fetch = originalFetch;
}
