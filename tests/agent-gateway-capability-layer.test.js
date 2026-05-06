import assert from 'node:assert/strict';
import fs from 'node:fs';

const gatewayRoot = 'infra/cloudflare/agent-gateway';

const files = {
	index: fs.readFileSync(`${gatewayRoot}/src/index.ts`, 'utf8'),
	allowlist: fs.readFileSync(`${gatewayRoot}/src/policies/allowlist.ts`, 'utf8'),
	audit: fs.readFileSync(`${gatewayRoot}/src/audit/log.ts`, 'utf8'),
	schemas: fs.readFileSync(`${gatewayRoot}/src/schemas/tools.ts`, 'utf8'),
	d1: fs.readFileSync(`${gatewayRoot}/src/cloudflare/d1.ts`, 'utf8'),
	kv: fs.readFileSync(`${gatewayRoot}/src/cloudflare/kv.ts`, 'utf8'),
	durableObjects: fs.readFileSync(
		`${gatewayRoot}/src/cloudflare/durable-objects.ts`,
		'utf8'
	),
	workers: fs.readFileSync(`${gatewayRoot}/src/cloudflare/workers.ts`, 'utf8'),
	client: fs.readFileSync(`${gatewayRoot}/src/cloudflare/client.ts`, 'utf8'),
	wrangler: fs.readFileSync(`${gatewayRoot}/wrangler.toml`, 'utf8'),
	readme: fs.readFileSync(`${gatewayRoot}/README.md`, 'utf8'),
	workerCi: fs.readFileSync('.github/workflows/worker-ci.yml', 'utf8'),
	deployGateway: fs.readFileSync(
		'.github/workflows/deploy-agent-gateway.yml',
		'utf8'
	),
	deploymentToolchain: fs.readFileSync('deployment-toolchain.yaml', 'utf8'),
	wranglerToolchain: fs.readFileSync(
		'docs/deployment/wrangler-toolchain.md',
		'utf8'
	),
};

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

const expectedTools = [
	'cloudflare.d1.inspectSchema',
	'cloudflare.d1.runReadOnlyQuery',
	'cloudflare.d1.seedApprovedFixture',
	'cloudflare.kv.listKeys',
	'cloudflare.kv.getJson',
	'cloudflare.kv.putJsonUnderPrefix',
	'cloudflare.durableObjects.listNamespaces',
	'cloudflare.durableObjects.listObjects',
	'cloudflare.durableObjects.inspectViaAdminRoute',
	'cloudflare.workers.tailRecentErrors',
];

for (const tool of expectedTools) {
	includes(files.schemas, `"${tool}"`, 'agent gateway tool schemas');
	includes(files.allowlist, `"${tool}"`, 'agent gateway allowlist');
	includes(files.index, `"${tool}"`, 'agent gateway router');
}

includes(files.schemas, 'environment: "production";', 'agent gateway schemas');
includes(files.schemas, 'actor: string;', 'agent gateway schemas');
includes(files.schemas, 'reason?: string;', 'agent gateway schemas');
includes(files.schemas, 'APPROVED_D1_FIXTURES', 'agent gateway schemas');
includes(files.schemas, 'agent-gateway-smoke-fixture-v1', 'agent gateway schemas');

includes(files.allowlist, 'OPERATION_ALLOWLIST', 'agent gateway allowlist');
includes(files.allowlist, 'requiresReason: true', 'agent gateway allowlist');
includes(files.allowlist, 'requiresApprovedFixture: true', 'agent gateway allowlist');
includes(files.allowlist, 'researchops:fixtures:', 'agent gateway allowlist');
includes(files.allowlist, 'researchops:test-automation:', 'agent gateway allowlist');
includes(files.allowlist, 'researchops:seed:', 'agent gateway allowlist');
includes(files.allowlist, 'assertReadOnlySql', 'agent gateway allowlist');
includes(files.allowlist, 'DESTRUCTIVE_SQL', 'agent gateway allowlist');
includes(
	files.allowlist,
	'Only production environment requests',
	'agent gateway allowlist'
);
includes(
	files.allowlist,
	'A reason is required for write operations',
	'agent gateway allowlist'
);
includes(files.allowlist, 'approved fixture name', 'agent gateway allowlist');
includes(files.allowlist, 'approved production-safe prefix', 'agent gateway allowlist');
includes(files.allowlist, '/admin/agents/durable-objects/', 'agent gateway allowlist');

includes(files.audit, 'agent_gateway_audit', 'agent gateway audit log');
includes(files.audit, 'AUDIT_DB binding is required', 'agent gateway audit log');
includes(files.audit, 'persistAudit', 'agent gateway audit log');
includes(files.audit, 'accepted', 'agent gateway audit log');
includes(files.audit, 'completed', 'agent gateway audit log');
includes(files.audit, 'failed', 'agent gateway audit log');
includes(files.audit, 'blocked', 'agent gateway audit log');

includes(files.index, 'AGENT_GATEWAY_TOKEN', 'agent gateway router');
includes(files.index, 'authorization', 'agent gateway router');
includes(files.index, 'assertAuthorized', 'agent gateway router');
includes(files.index, 'persistAudit', 'agent gateway router');
includes(files.index, 'Request accepted by policy', 'agent gateway router');
includes(files.index, 'Request completed', 'agent gateway router');
includes(files.index, 'POST', 'agent gateway router');
includes(files.index, '/tools', 'agent gateway router');

includes(files.client, 'https://api.cloudflare.com/client/v4', 'Cloudflare API client');
includes(files.client, 'CF_ACCOUNT_ID', 'Cloudflare API client');
includes(files.client, 'CF_API_TOKEN', 'Cloudflare API client');
excludes(files.client, 'X-Auth-Key', 'Cloudflare API client');
excludes(files.client, 'X-Auth-Email', 'Cloudflare API client');

includes(files.d1, '/d1/database/', 'D1 tool module');
includes(files.d1, 'sqlite_master', 'D1 tool module');
includes(files.d1, 'assertReadOnlySql', 'D1 tool module');
includes(files.d1, 'seedApprovedFixture', 'D1 tool module');
includes(files.d1, 'APPROVED_D1_FIXTURES', 'D1 tool module');

includes(files.kv, '/storage/kv/namespaces/', 'KV tool module');
includes(files.kv, 'listKeys', 'KV tool module');
includes(files.kv, 'getJson', 'KV tool module');
includes(files.kv, 'putJsonUnderPrefix', 'KV tool module');
includes(files.kv, 'assertJsonObject', 'KV tool module');

includes(
	files.durableObjects,
	'/workers/durable_objects/namespaces',
	'Durable Objects tool module'
);
includes(
	files.durableObjects,
	'inspectViaAdminRoute',
	'Durable Objects tool module'
);
includes(
	files.durableObjects,
	'RESEARCHOPS_ADMIN_ORIGIN',
	'Durable Objects tool module'
);

includes(files.workers, 'tailRecentErrors', 'Workers observability tool module');
includes(
	files.workers,
	'researchops:agent-gateway:tail-errors:recent',
	'Workers observability tool module'
);

includes(files.wrangler, 'researchops-agent-gateway', 'agent gateway Wrangler config');
includes(files.wrangler, 'src/index.ts', 'agent gateway Wrangler config');
includes(files.wrangler, 'AUDIT_DB', 'agent gateway Wrangler config');
includes(
	files.wrangler,
	'00000000-0000-0000-0000-000000000000',
	'agent gateway Wrangler config'
);

includes(files.readme, 'production-safe capability layer', 'agent gateway README');
includes(
	files.readme,
	'same Cloudflare infrastructure governance area',
	'agent gateway README'
);
includes(
	files.readme,
	'Do not use an account-wide super token',
	'agent gateway README'
);
includes(files.readme, 'audit = persisted', 'agent gateway README');
includes(
	files.readme,
	'npx --yes wrangler@${WRANGLER_VERSION} deploy --config infra/cloudflare/agent-gateway/wrangler.toml',
	'agent gateway README'
);

includes(files.workerCi, 'infra/cloudflare/agent-gateway/**', 'Worker CI workflow');
includes(
	files.workerCi,
	'npx --yes wrangler@${WRANGLER_VERSION} deploy --config infra/cloudflare/agent-gateway/wrangler.toml --dry-run',
	'Worker CI workflow'
);
includes(
	files.deployGateway,
	'Deploy ResearchOps Agent Gateway',
	'agent gateway deployment workflow'
);
includes(
	files.deployGateway,
	'infra/cloudflare/agent-gateway/**',
	'agent gateway deployment workflow'
);
includes(
	files.deployGateway,
	'npx --yes wrangler@${WRANGLER_VERSION} deploy --config infra/cloudflare/agent-gateway/wrangler.toml',
	'agent gateway deployment workflow'
);
includes(files.deploymentToolchain, 'cloudflare_agent_gateway', 'deployment toolchain');
includes(
	files.deploymentToolchain,
	'infra/cloudflare/agent-gateway/wrangler.toml',
	'deployment toolchain'
);
includes(
	files.wranglerToolchain,
	'ResearchOps Agent Gateway Worker',
	'Wrangler toolchain documentation'
);
includes(
	files.wranglerToolchain,
	'infra/cloudflare/agent-gateway/wrangler.toml',
	'Wrangler toolchain documentation'
);
