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

		if (href.endsWith('/murals/workspace.123/widgets') && method === 'GET') {
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

		if (href.endsWith('/widgets/sticky-note/template-perceptions') && method === 'PATCH') {
			const body = JSON.parse(init.body);
			stickyWrites.push({ method, href, body });
			return jsonResponse({ value: { id: 'template-perceptions', ...body } });
		}

		if (href.endsWith('/murals/workspace.123/widgets/sticky-note') && method === 'POST') {
			const body = JSON.parse(init.body);
			stickyWrites.push({ method, href, body });
			return jsonResponse({ value: { id: 'created-entry-002', ...body } }, 201);
		}

		if (
			/\/murals\/workspace\.123\/widgets\/(?:template-perceptions|created-entry-002)$/.test(href) &&
			method === 'PATCH'
		) {
			const body = JSON.parse(init.body);
			tagApplications.push({ href, body });
			return jsonResponse({ value: { id: href.split('/').at(-1), ...body } });
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
} finally {
	globalThis.fetch = originalFetch;
}
