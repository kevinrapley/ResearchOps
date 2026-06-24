import assert from 'node:assert/strict';
import test from 'node:test';

import {
	aiRewrite,
	createMockEnv,
	makeJsonRequest,
} from '../infra/cloudflare/src/core/ai-rewrite.js';

const LONG_DESCRIPTION = 'ResearchOps start page description. '.repeat(20);

const EXPECTED_ALLOWED_ORIGINS = [
	'https://feature-edit-project-objectives-markdown.researchops.pages.dev',
	'https://research-operations.com',
	'https://www.research-operations.com',
	'https://govuk.research-operations.com',
];

for (const origin of EXPECTED_ALLOWED_ORIGINS) {
	test(`AI rewrite accepts ${origin}`, async () => {
		const env = createMockEnv({
			ALLOWED_ORIGINS:
				'https://researchops.pages.dev,https://rops-api.digikev-kevin-rapley.workers.dev',
		});
		const request = makeJsonRequest(
			'/api/ai-rewrite?mode=description',
			{ text: LONG_DESCRIPTION },
			{ headers: { Origin: origin } }
		);

		const response = await aiRewrite(request, env, origin);
		const body = await response.json();

		assert.equal(response.status, 200);
		assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
		assert.equal(body.rewrite, 'example');
	});
}

test('AI rewrite rejects untrusted origins', async () => {
	const origin = 'https://evil.example';
	const env = createMockEnv({
		ALLOWED_ORIGINS:
			'https://researchops.pages.dev,https://rops-api.digikev-kevin-rapley.workers.dev',
	});
	const request = makeJsonRequest(
		'/api/ai-rewrite?mode=description',
		{ text: LONG_DESCRIPTION },
		{ headers: { Origin: origin } }
	);

	const response = await aiRewrite(request, env, origin);
	const body = await response.json();

	assert.equal(response.status, 403);
	assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
	assert.equal(body.error, 'Origin not allowed');
});
