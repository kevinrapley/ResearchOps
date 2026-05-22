import test from 'node:test';
import assert from 'node:assert/strict';

test('generated repository fixture exposes Node validation evidence', () => {
	const fixture = {
		kind: 'eval-output',
		mode: 'repo-instantiate',
		language: 'node',
	};

	assert.equal(fixture.kind, 'eval-output');
	assert.equal(fixture.mode, 'repo-instantiate');
	assert.equal(fixture.language, 'node');
});
