import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layoutSource = readFileSync('public/components/layout.js', 'utf8');

test('footer include defaults are applied before connected render is queued', () => {
	assert.match(layoutSource, /this\._hasConnected = true;/);
	assert.match(layoutSource, /this\._maybeApplyFooterDefaults\(\);\n\t\tthis\._queueRender\(\);/);
});

test('attribute changes do not render includes before the element connects', () => {
	assert.match(
		layoutSource,
		/attributeChangedCallback\(\) \{\n\t\tif \(!this\._hasConnected\) return;/
	);
});

test('stale include fetches cannot overwrite newer rendered footer content', () => {
	assert.match(layoutSource, /const renderId = this\._renderId \+ 1;/);
	assert.match(layoutSource, /if \(renderId !== this\._renderId\) return;/);
	assert.match(layoutSource, /if \(this\._abort\) this\._abort\.abort\(\);/);
});
