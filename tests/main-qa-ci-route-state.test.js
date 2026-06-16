import assert from 'node:assert/strict';
import fs from 'node:fs';

const smokeFeature = fs.readFileSync('features/smoke.feature', 'utf8');
const e2eSmoke = fs.readFileSync('tests/e2e/smoke.spec.js', 'utf8');
const e2eWorkflow = fs.readFileSync('.github/workflows/qa-e2e.yml', 'utf8');
const bddWorkflow = fs.readFileSync('.github/workflows/qa-bdd.yml', 'utf8');

assert.match(smokeFeature, /Scenario: Sign-in page loads/);
assert.match(smokeFeature, /\/pages\/account\/sign-in\/index\.html/);
assert.doesNotMatch(smokeFeature, /Scenario: Projects page loads/);

assert.match(e2eSmoke, /\/pages\/account\/sign-in\/index\.html/);
assert.match(e2eSmoke, /toHaveTitle\(\/sign in\/i\)/);
assert.doesNotMatch(e2eSmoke, /\/pages\/projects\/index\.html/);

assert.match(e2eWorkflow, /run: npx playwright install --with-deps chromium/);
assert.match(e2eWorkflow, /run: npm run test:e2e/);
assert.doesNotMatch(e2eWorkflow, /playwright@1\.56\.1/);

assert.match(bddWorkflow, /pages deploy reports-site/);
assert.match(bddWorkflow, /github\.event_name != 'workflow_dispatch'/);
assert.match(bddWorkflow, /inputs\.publish_reporting_site == true/);
assert.doesNotMatch(
	bddWorkflow,
	/Deploy visual walkthrough to Cloudflare Pages reporting site[\s\S]*github\.event_name == 'workflow_dispatch' &&[\s\S]*inputs\.publish_reporting_site == true/,
);
