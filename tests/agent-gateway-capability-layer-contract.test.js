import assert from "node:assert/strict";
import fs from "node:fs";

const gatewayRoot = "infra/cloudflare/agent-gateway";

const files = {
	index: `${gatewayRoot}/src/index.ts`,
	allowlist: `${gatewayRoot}/src/policies/allowlist.ts`,
	audit: `${gatewayRoot}/src/audit/log.ts`,
	schemas: `${gatewayRoot}/src/schemas/tools.ts`,
	d1: `${gatewayRoot}/src/cloudflare/d1.ts`,
	kv: `${gatewayRoot}/src/cloudflare/kv.ts`,
	durableObjects: `${gatewayRoot}/src/cloudflare/durable-objects.ts`,
	workers: `${gatewayRoot}/src/cloudflare/workers.ts`,
	client: `${gatewayRoot}/src/cloudflare/client.ts`,
	wrangler: `${gatewayRoot}/wrangler.toml`,
	readme: `${gatewayRoot}/README.md`,
	migration: `${gatewayRoot}/migrations/0001_agent_gateway_audit.sql`,
	openapi: `${gatewayRoot}/openapi.yaml`,
	connectorDocs: "docs/deployment/agent-gateway-openapi-connector.md",
	workerCi: ".github/workflows/worker-ci.yml",
	deployGateway: ".github/workflows/deploy-agent-gateway.yml",
	deploymentToolchain: "deployment-toolchain.yaml",
	wranglerToolchain: "docs/deployment/wrangler-toolchain.md",
};

const contents = Object.fromEntries(
	Object.entries(files).map(([key, path]) => [
		key,
		fs.readFileSync(path, "utf8"),
	]),
);

function includes(key, text, label) {
	assert.equal(
		contents[key].includes(text),
		true,
		`Expected ${label || key} to include: ${text}`,
	);
}

function excludes(key, text, label) {
	assert.equal(
		contents[key].includes(text),
		false,
		`Expected ${label || key} not to include: ${text}`,
	);
}

const expectedTools = [
	"cloudflare.d1.inspectSchema",
	"cloudflare.d1.runReadOnlyQuery",
	"cloudflare.d1.seedApprovedFixture",
	"cloudflare.kv.listKeys",
	"cloudflare.kv.getJson",
	"cloudflare.kv.putJsonUnderPrefix",
	"cloudflare.durableObjects.listNamespaces",
	"cloudflare.durableObjects.listObjects",
	"cloudflare.durableObjects.inspectViaAdminRoute",
	"cloudflare.workers.tailRecentErrors",
];

for (const tool of expectedTools) {
	includes("schemas", `"${tool}"`, "agent gateway tool schemas");
	includes("allowlist", `"${tool}"`, "agent gateway allowlist");
	includes("index", `"${tool}"`, "agent gateway router");
	includes("openapi", `- ${tool}`, "agent gateway OpenAPI contract");
}

const auditColumns = [
	"row_id INTEGER PRIMARY KEY AUTOINCREMENT",
	"id TEXT NOT NULL",
	"tool TEXT NOT NULL",
	"environment TEXT NOT NULL",
	"actor TEXT NOT NULL",
	"reason TEXT NOT NULL",
	"phase TEXT NOT NULL",
	"ok INTEGER NOT NULL",
	"message TEXT NOT NULL",
	"created_at TEXT NOT NULL",
	"fixture_name TEXT",
	"request_id TEXT",
	"target_resource_type TEXT",
	"target_resource_id TEXT",
	"operation_class TEXT",
	"ip_hash TEXT",
	"user_agent_hash TEXT",
	"commit_sha TEXT",
	"workflow_run_id TEXT",
	"input_hash TEXT",
];

for (const column of auditColumns) {
	includes("migration", column, "agent gateway audit migration");
	includes("audit", column, "agent gateway defensive audit schema");
}

const auditIndexes = [
	"idx_agent_gateway_audit_created_at",
	"idx_agent_gateway_audit_actor",
	"idx_agent_gateway_audit_tool",
	"idx_agent_gateway_audit_phase",
	"idx_agent_gateway_audit_operation_class",
	"idx_agent_gateway_audit_target_resource",
	"idx_agent_gateway_audit_request_id",
];

for (const indexName of auditIndexes) {
	includes("migration", indexName, "agent gateway audit migration");
	includes("audit", indexName, "agent gateway defensive audit schema");
}

const includeChecks = [
	["schemas", 'environment: "production";', "agent gateway schemas"],
	["schemas", "actor: string;", "agent gateway schemas"],
	["schemas", "reason?: string;", "agent gateway schemas"],
	["schemas", "APPROVED_D1_FIXTURES", "agent gateway schemas"],
	["schemas", "agent-gateway-smoke-fixture-v1", "agent gateway schemas"],
	["allowlist", "OPERATION_ALLOWLIST", "agent gateway allowlist"],
	["allowlist", "requiresReason: true", "agent gateway allowlist"],
	["allowlist", "requiresApprovedFixture: true", "agent gateway allowlist"],
	["allowlist", "researchops:fixtures:", "agent gateway allowlist"],
	["allowlist", "researchops:test-automation:", "agent gateway allowlist"],
	["allowlist", "researchops:seed:", "agent gateway allowlist"],
	["allowlist", "assertReadOnlySql", "agent gateway allowlist"],
	["allowlist", "DESTRUCTIVE_SQL", "agent gateway allowlist"],
	[
		"allowlist",
		"Only production environment requests",
		"agent gateway allowlist",
	],
	[
		"allowlist",
		"A reason is required for write operations",
		"agent gateway allowlist",
	],
	["allowlist", "approved fixture name", "agent gateway allowlist"],
	["allowlist", "approved production-safe prefix", "agent gateway allowlist"],
	["allowlist", "/admin/agents/durable-objects/", "agent gateway allowlist"],
	["audit", "agent_gateway_audit", "agent gateway audit log"],
	["audit", "AUDIT_DB binding is required", "agent gateway audit log"],
	["audit", "persistAudit", "agent gateway audit log"],
	["audit", "accepted", "agent gateway audit log"],
	["audit", "completed", "agent gateway audit log"],
	["audit", "failed", "agent gateway audit log"],
	["audit", "blocked", "agent gateway audit log"],
	["audit", "inputHash: await hashInput", "agent gateway audit log"],
	["audit", "operationClass: operationClass", "agent gateway audit log"],
	["audit", "targetResourceType: targetResourceType", "agent gateway audit log"],
	["index", "AGENT_GATEWAY_TOKEN", "agent gateway router"],
	["index", "authorization", "agent gateway router"],
	["index", "assertAuthorized", "agent gateway router"],
	["index", "persistAudit", "agent gateway router"],
	["index", "Request accepted by policy", "agent gateway router"],
	["index", "Request completed", "agent gateway router"],
	["index", "POST", "agent gateway router"],
	["index", "/tools", "agent gateway router"],
	["client", "https://api.cloudflare.com/client/v4", "Cloudflare API client"],
	["client", "CF_ACCOUNT_ID", "Cloudflare API client"],
	["client", "CF_API_TOKEN", "Cloudflare API client"],
	["d1", "/d1/database/", "D1 tool module"],
	["d1", "sqlite_master", "D1 tool module"],
	["d1", "assertReadOnlySql", "D1 tool module"],
	["d1", "seedApprovedFixture", "D1 tool module"],
	["d1", "APPROVED_D1_FIXTURES", "D1 tool module"],
	["kv", "/storage/kv/namespaces/", "KV tool module"],
	["kv", "listKeys", "KV tool module"],
	["kv", "getJson", "KV tool module"],
	["kv", "putJsonUnderPrefix", "KV tool module"],
	["kv", "assertJsonObject", "KV tool module"],
	[
		"durableObjects",
		"/workers/durable_objects/namespaces",
		"Durable Objects tool module",
	],
	["durableObjects", "inspectViaAdminRoute", "Durable Objects tool module"],
	["durableObjects", "RESEARCHOPS_ADMIN_ORIGIN", "Durable Objects tool module"],
	["workers", "tailRecentErrors", "Workers observability tool module"],
	[
		"workers",
		"researchops:agent-gateway:tail-errors:recent",
		"Workers observability tool module",
	],
	["wrangler", "researchops-agent-gateway", "agent gateway Wrangler config"],
	["wrangler", "src/index.ts", "agent gateway Wrangler config"],
	["wrangler", "AUDIT_DB", "agent gateway Wrangler config"],
	[
		"wrangler",
		"75196021-d2a9-435f-a0ac-654baeb111d4",
		"agent gateway Wrangler config",
	],
	["readme", "production-safe capability layer", "agent gateway README"],
	[
		"readme",
		"same Cloudflare infrastructure governance area",
		"agent gateway README",
	],
	["readme", "Do not use an account-wide super token", "agent gateway README"],
	["readme", "audit = persisted", "agent gateway README"],
	["readme", "infra/cloudflare/agent-gateway/openapi.yaml", "agent gateway README"],
	[
		"readme",
		"docs/deployment/agent-gateway-openapi-connector.md",
		"agent gateway README",
	],
	[
		"readme",
		"npx --yes wrangler@${WRANGLER_VERSION} deploy --config infra/cloudflare/agent-gateway/wrangler.toml",
		"agent gateway README",
	],
	["openapi", "openapi: 3.1.0", "agent gateway OpenAPI contract"],
	[
		"openapi",
		"ResearchOps Cloudflare Agent Gateway",
		"agent gateway OpenAPI contract",
	],
	[
		"openapi",
		"https://researchops-agent-gateway.digikev-kevin-rapley.workers.dev",
		"agent gateway OpenAPI contract",
	],
	["openapi", "operationId: getAgentGatewayHealth", "agent gateway OpenAPI contract"],
	["openapi", "operationId: runAgentGatewayTool", "agent gateway OpenAPI contract"],
	["openapi", "bearerAuth", "agent gateway OpenAPI contract"],
	[
		"openapi",
		"Store AGENT_GATEWAY_TOKEN as a connector secret",
		"agent gateway OpenAPI contract",
	],
	[
		"openapi",
		"Never expose this token in chat, source control or logs",
		"agent gateway OpenAPI contract",
	],
	["openapi", "const: production", "agent gateway OpenAPI contract"],
	["openapi", "cloudflare.d1.runReadOnlyQuery", "agent gateway OpenAPI contract"],
	["openapi", "cloudflare.kv.putJsonUnderPrefix", "agent gateway OpenAPI contract"],
	[
		"openapi",
		"pattern: ^/admin/agents/durable-objects/",
		"agent gateway OpenAPI contract",
	],
	[
		"connectorDocs",
		"The connector does not receive raw Cloudflare credentials",
		"agent gateway connector docs",
	],
	[
		"connectorDocs",
		"Do not configure the connector with `CF_API_TOKEN`",
		"agent gateway connector docs",
	],
	[
		"connectorDocs",
		"infra/cloudflare/agent-gateway/openapi.yaml",
		"agent gateway connector docs",
	],
	[
		"connectorDocs",
		"Authorization: Bearer <AGENT_GATEWAY_TOKEN>",
		"agent gateway connector docs",
	],
	[
		"connectorDocs",
		"accepted\ncompleted",
		"agent gateway connector docs",
	],
	["workerCi", "infra/cloudflare/agent-gateway/**", "Worker CI workflow"],
	[
		"workerCi",
		"npx --yes wrangler@${WRANGLER_VERSION} deploy --config infra/cloudflare/agent-gateway/wrangler.toml --dry-run",
		"Worker CI workflow",
	],
	[
		"deployGateway",
		"Deploy ResearchOps Agent Gateway",
		"agent gateway deployment workflow",
	],
	[
		"deployGateway",
		"infra/cloudflare/agent-gateway/**",
		"agent gateway deployment workflow",
	],
	[
		"deployGateway",
		"npx --yes wrangler@${WRANGLER_VERSION} deploy --config infra/cloudflare/agent-gateway/wrangler.toml",
		"agent gateway deployment workflow",
	],
	["deploymentToolchain", "cloudflare_agent_gateway", "deployment toolchain"],
	[
		"deploymentToolchain",
		"infra/cloudflare/agent-gateway/wrangler.toml",
		"deployment toolchain",
	],
	[
		"wranglerToolchain",
		"ResearchOps Agent Gateway Worker",
		"Wrangler toolchain documentation",
	],
	[
		"wranglerToolchain",
		"infra/cloudflare/agent-gateway/wrangler.toml",
		"Wrangler toolchain documentation",
	],
];

for (const [key, text, label] of includeChecks) {
	includes(key, text, label);
}

excludes("client", "X-Auth-Key", "Cloudflare API client");
excludes("client", "X-Auth-Email", "Cloudflare API client");
excludes("audit", "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", "agent gateway audit log");
excludes("wrangler", "00000000-0000-0000-0000-000000000000", "agent gateway Wrangler config");
excludes("openapi", "CF_API_TOKEN", "agent gateway OpenAPI contract");
