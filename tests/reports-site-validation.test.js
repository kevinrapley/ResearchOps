import assert from 'node:assert/strict';
import test from 'node:test';
import { validateReportsSite } from '../scripts/validate-reports-site.mjs';

test('committed reporting site manifest and screenshots are coherent', () => {
	const result = validateReportsSite();

	assert.equal(result.pages, 22);
	assert.equal(result.states, 39);
	assert.equal(result.captures, 78);
	assert.deepEqual(result.profiles.sort(), ['desktop', 'mobile']);
	assert.equal(result.screenshots, 78);
});
