import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('production Worker declares required passwordless secrets', () => {
	const wrangler = fs.readFileSync('infra/cloudflare/wrangler.toml', 'utf8');
	const passwordless = fs.readFileSync('infra/cloudflare/src/core/auth/passwordless.js', 'utf8');
	const deployWorkflow = fs.readFileSync('.github/workflows/deploy-worker.yml', 'utf8');

	assert.match(wrangler, /\[secrets\]/);
	assert.match(wrangler, /required\s*=\s*\[/);
	assert.match(wrangler, /"RESEARCHOPS_AUTH_SECRET"/);
	assert.match(wrangler, /"RESEND_API_KEY"/);
	assert.match(wrangler, /"RESEARCHOPS_EMAIL_FROM"/);

	assert.match(passwordless, /env\.RESEARCHOPS_AUTH_SECRET \|\| env\.AUTH_SECRET/);
	assert.match(passwordless, /env\.RESEND_API_KEY && env\.RESEARCHOPS_EMAIL_FROM/);
	assert.match(passwordless, /Sign in is not configured yet\./);
	assert.match(passwordless, /Sign-in email delivery is not configured yet\./);

	assert.match(deployWorkflow, /WRANGLER_VERSION: "4\.90\.0"/);
	assert.match(
		deployWorkflow,
		/wrangler@\$\{WRANGLER_VERSION\} deploy --config infra\/cloudflare\/wrangler\.toml/
	);
});
