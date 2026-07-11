import assert from 'node:assert/strict';
import fs from 'node:fs';

const head = fs.readFileSync('public/partials/html-head.html', 'utf8');
const header = fs.readFileSync('public/partials/header.html', 'utf8');
const tracker = fs.readFileSync('public/js/flux-researchops-tracker.js', 'utf8');
const worker = fs.readFileSync('public/_worker.js', 'utf8');
const headers = fs.readFileSync('public/_headers', 'utf8');

assert.match(head, /src="\/js\/flux-researchops-tracker\.js"/);
assert.doesNotMatch(header, /flux-behaviour\.pages\.dev\/assets\/flux/);
assert.match(tracker, /researchops\.pages\.dev/);
assert.match(tracker, /research-operations\.com/);
assert.match(tracker, /flux-behaviour\.pages\.dev\/api\/collect/);
assert.match(tracker, /researchops/);
assert.match(tracker, /data-flux-key/);
assert.match(worker, /connect-src[^\n]+flux-behaviour\.pages\.dev/);
assert.match(headers, /connect-src[^\n]+flux-behaviour\.pages\.dev/);
