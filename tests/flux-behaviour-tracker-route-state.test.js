import assert from 'node:assert/strict';
import fs from 'node:fs';

const head = fs.readFileSync('public/partials/html-head.html', 'utf8');
const renderedLayout = fs.readFileSync('src/govuk/templates/layouts/researchops.njk', 'utf8');
const worker = fs.readFileSync('public/_worker.js', 'utf8');
const headers = fs.readFileSync('public/_headers', 'utf8');
const hostedTracker = /src="https:\/\/flux-behaviour\.pages\.dev\/assets\/flux\/sdk\/flux-auto-capture\.mjs\?v=1\.3\.0"[^>]*data-flux-endpoint="https:\/\/flux-behaviour\.pages\.dev\/api\/collect"[^>]*data-flux-tenant="researchops"/;

assert.match(head, hostedTracker);
assert.match(renderedLayout, hostedTracker);
assert.equal(fs.existsSync('src/flux'), false, 'Flux product logic must not live in ResearchOps');
assert.equal(fs.existsSync('public/js/flux-researchops-tracker.1.2.0.js'), false);
assert.equal(fs.existsSync('public/assets/flux/uk-english-writing-runtime.mjs'), false);

const renderedPages = fs
  .readdirSync('public', { recursive: true })
  .filter((path) => path.endsWith('.html') && !path.startsWith('partials/') && path !== 'clear.html');

for (const relativePath of renderedPages) {
  const page = `public/${relativePath}`;
  assert.match(fs.readFileSync(page, 'utf8'), hostedTracker, `${page} should load the hosted Flux tracker`);
}

assert.match(worker, /script-src[^\n]+flux-behaviour\.pages\.dev/);
assert.match(worker, /connect-src[^\n]+flux-behaviour\.pages\.dev/);
assert.match(headers, /script-src[^\n]+flux-behaviour\.pages\.dev/);
assert.match(headers, /connect-src[^\n]+flux-behaviour\.pages\.dev/);
