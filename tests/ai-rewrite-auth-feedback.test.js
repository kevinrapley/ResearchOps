import assert from 'node:assert/strict';
import test from 'node:test';

import { aiRewriteErrorMessage } from '../public/js/ai-rewrite-status.js';

test('AI rewrite explains that authentication is required for a 401 response', () => {
	assert.equal(aiRewriteErrorMessage(401), 'Sign in to use AI rewrite.');
});

test('AI rewrite explains that access is required for a 403 response', () => {
	assert.equal(aiRewriteErrorMessage(403), 'You do not have access to use AI rewrite.');
});
