import assert from 'node:assert/strict';
import test from 'node:test';

import {
	aiRewrite,
	createMockEnv,
	makeJsonRequest,
} from '../infra/cloudflare/src/core/ai-rewrite.js';

const LONG_DESCRIPTION = 'ResearchOps start page description. '.repeat(20);

test('AI rewrite accepts ResearchOps Pages preview origins', async () => {
	const origin = 'https://feature-edit-project-objectives-markdown.researchops.pages.dev';
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
