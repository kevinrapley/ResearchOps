import assert from 'node:assert/strict';
import test from 'node:test';

import {
	aiRewrite,
	createMockEnv,
	makeJsonRequest,
} from '../infra/cloudflare/src/core/ai-rewrite.js';

const ORIGIN = 'https://research-operations.com';
const LONG_DESCRIPTION = [
	'The research will help service teams understand why people struggle to create a project.',
	'It should review the start page, description guidance and what happens after a project is created.',
	'Primary users are researchers, research operations leads, service designers and delivery managers.',
	'It should consider mobile and desktop use, screen reader support, plain English and teams working under time pressure.',
	'Success means teams can explain the project purpose, choose appropriate objectives and avoid participant personal data.',
	'Contact the project lead at research@example.com only outside this description.',
].join(' ');

test('AI rewrite returns rule-based output when the Workers AI binding is missing', async () => {
	const env = createMockEnv({ AI: undefined });
	const request = makeJsonRequest(
		'/api/ai-rewrite?mode=description',
		{ text: LONG_DESCRIPTION },
		{ headers: { Origin: ORIGIN } }
	);

	const response = await aiRewrite(request, env, ORIGIN);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(response.headers.get('Access-Control-Allow-Origin'), ORIGIN);
	assert.equal(body.flags.ai_unavailable, true);
	assert.equal(body.flags.possible_personal_data, true);
	assert.ok(body.suggestions.length > 0);
	assert.match(body.rewrite, /Research focus:/);
	assert.doesNotMatch(body.rewrite, /research@example\.com/);
});

test('AI rewrite returns rule-based output when the Workers AI call fails', async () => {
	const env = createMockEnv({
		AI: {
			run: async () => {
				throw new Error('Workers AI unavailable');
			},
		},
	});
	const request = makeJsonRequest(
		'/api/ai-rewrite?mode=description',
		{ text: LONG_DESCRIPTION },
		{ headers: { Origin: ORIGIN } }
	);

	const response = await aiRewrite(request, env, ORIGIN);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.flags.ai_unavailable, true);
	assert.ok(body.rewrite.length > 0);
	assert.ok(body.suggestions.every((item) => ['high', 'medium', 'low'].includes(item.severity)));
});

test('AI rewrite returns rule-based output when model output is invalid', async () => {
	const env = createMockEnv({
		AI: { run: async () => 'not json' },
	});
	const request = makeJsonRequest(
		'/api/ai-rewrite?mode=objectives',
		{
			text: 'Understand where teams struggle with the project setup flow. Validate whether guidance helps them avoid personal data.',
		},
		{ headers: { Origin: ORIGIN } }
	);

	const response = await aiRewrite(request, env, ORIGIN);
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.flags.ai_unavailable, true);
	assert.match(body.rewrite, /^1\)/);
});
