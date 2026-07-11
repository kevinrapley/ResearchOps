import assert from 'node:assert/strict';
import fs from 'node:fs';

const head = fs.readFileSync('public/partials/html-head.html', 'utf8');
const header = fs.readFileSync('public/partials/header.html', 'utf8');
const tracker = fs.readFileSync('public/js/flux-researchops-tracker.1.1.0.js', 'utf8');
const versionedTracker = fs.readFileSync('public/js/flux-researchops-tracker.1.1.1.js', 'utf8');
const renderedLayout = fs.readFileSync('src/govuk/templates/layouts/researchops.njk', 'utf8');
const worker = fs.readFileSync('public/_worker.js', 'utf8');
const headers = fs.readFileSync('public/_headers', 'utf8');

assert.match(head, /src="\/js\/flux-researchops-tracker\.1\.1\.1\.js"/);
assert.match(renderedLayout, /src="\/js\/flux-researchops-tracker\.1\.1\.1\.js"/);
const renderedPages = fs
	.readdirSync('public', { recursive: true })
	.filter((path) => path.endsWith('.html') && !path.startsWith('partials/') && path !== 'clear.html');

for (const relativePath of renderedPages) {
	const page = `public/${relativePath}`;
	assert.match(fs.readFileSync(page, 'utf8'), /src="\/js\/flux-researchops-tracker\.1\.1\.1\.js"/, `${page} should load the Flux tracker`);
}
assert.doesNotMatch(header, /flux-behaviour\.pages\.dev\/assets\/flux/);
assert.match(tracker, /researchops\.pages\.dev/);
assert.match(tracker, /research-operations\.com/);
assert.match(tracker, /flux-behaviour\.pages\.dev\/api\/collect/);
assert.match(tracker, /researchops/);
assert.match(tracker, /fluxKey/);
assert.match(tracker, /key_press_count/);
assert.match(tracker, /backspace_count/);
assert.match(tracker, /duration_ms/);
assert.match(tracker, /control\.tab/);
assert.match(tracker, /auto\.\$\{kind\}/);
assert.match(tracker, /\['password', 'email', 'tel'\]/);
assert.match(tracker, /\['one-time-code', 'current-password', 'new-password'\]/);
assert.match(tracker, /removeEventListener\('input', state\.onInput\)/);
assert.match(versionedTracker, /flux-researchops-tracker\.1\.1\.0\.js/);
assert.doesNotMatch(tracker, /target\.(ariaLabel|textContent|innerText)/);
assert.match(worker, /connect-src[^\n]+flux-behaviour\.pages\.dev/);
assert.match(headers, /connect-src[^\n]+flux-behaviour\.pages\.dev/);
