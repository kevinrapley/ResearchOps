import assert from 'node:assert/strict';
import fs from 'node:fs';

import worker from '../infra/cloudflare/src/worker.js';

const wrangler = fs.readFileSync('infra/cloudflare/wrangler.toml', 'utf8');

const researchOpsCustomOrigins = [
	'https://research-operations.com',
	'https://www.research-operations.com',
	'https://govuk.research-operations.com',
];

async function preflight(origin, env = {}) {
	return worker.fetch(
		new Request('https://rops-api.digikev-kevin-rapley.workers.dev/api/auth/email/start', {
			method: 'OPTIONS',
			headers: {
				Origin: origin,
				'Access-Control-Request-Method': 'POST',
			},
		}),
		{
			ALLOWED_ORIGINS: '',
			RESEARCHOPS_ALLOW_PAGES_PREVIEW_ORIGINS: 'false',
			...env,
		},
		{ waitUntil() {} }
	);
}

function assertProductionConfigAllowsCustomDomains() {
	for (const origin of researchOpsCustomOrigins) {
		assert.match(wrangler, new RegExp(origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
	}
}

async function assertWorkerAllowsCustomDomainsWithoutConfigDrift() {
	for (const origin of researchOpsCustomOrigins) {
		const response = await preflight(origin);
		assert.equal(response.status, 204);
		assert.equal(response.headers.get('access-control-allow-origin'), origin);
		assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
	}
}

async function assertWorkerRejectsUnknownBrowserOrigins() {
	const response = await preflight('https://example.com');
	assert.equal(response.status, 204);
	assert.equal(response.headers.get('access-control-allow-origin'), 'null');
}

assertProductionConfigAllowsCustomDomains();
await assertWorkerAllowsCustomDomainsWithoutConfigDrift();
await assertWorkerRejectsUnknownBrowserOrigins();
