import assert from "node:assert/strict";
import fs from "node:fs";

const files = {
  index: fs.readFileSync("apps/agent-gateway/src/index.ts", "utf8"),
  allowlist: fs.readFileSync("apps/agent-gateway/src/policies/allowlist.ts", "utf8"),
  audit: fs.readFileSync("apps/agent-gateway/src/audit/log.ts", "utf8"),
  schemas: fs.readFileSync("apps/agent-gateway/src/schemas/tools.ts", "utf8"),
  d1: fs.readFileSync("apps/agent-gateway/src/cloudflare/d1.ts", "utf8"),
  kv: fs.readFileSync("apps/agent-gateway/src/cloudflare/kv.ts", "utf8"),
  durableObjects: fs.readFileSync(
    "apps/agent-gateway/src/cloudflare/durable-objects.ts",
    "utf8",
  ),
  workers: fs.readFileSync("apps/agent-gateway/src/cloudflare/workers.ts", "utf8"),
  client: fs.readFileSync("apps/agent-gateway/src/cloudflare/client.ts", "utf8"),
  wrangler: fs.readFileSync("apps/agent-gateway/wrangler.jsonc", "utf8"),
  readme: fs.readFileSync("apps/agent-gateway/README.md", "utf8"),
};

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
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
  includes(files.schemas, `"${tool}"`, "agent gateway tool schemas");
  includes(files.allowlist, `"${tool}"`, "agent gateway allowlist");
  includes(files.index, `"${tool}"`, "agent gateway router");
}

includes(files.schemas, "environment: \"production\";", "agent gateway schemas");
includes(files.schemas, "actor: string;", "agent gateway schemas");
includes(files.schemas, "reason?: string;", "agent gateway schemas");
includes(files.schemas, "APPROVED_D1_FIXTURES", "agent gateway schemas");
includes(files.schemas, "agent-gateway-smoke-fixture-v1", "agent gateway schemas");

includes(files.allowlist, "OPERATION_ALLOWLIST", "agent gateway allowlist");
includes(files.allowlist, "requiresReason: true", "agent gateway allowlist");
includes(files.allowlist, "requiresApprovedFixture: true", "agent gateway allowlist");
includes(files.allowlist, "researchops:fixtures:", "agent gateway allowlist");
includes(files.allowlist, "researchops:test-automation:", "agent gateway allowlist");
includes(files.allowlist, "researchops:seed:", "agent gateway allowlist");
includes(files.allowlist, "assertReadOnlySql", "agent gateway allowlist");
includes(files.allowlist, "DESTRUCTIVE_SQL", "agent gateway allowlist");
includes(files.allowlist, "Only production environment requests", "agent gateway allowlist");
includes(files.allowlist, "A reason is required for write operations", "agent gateway allowlist");
includes(files.allowlist, "approved fixture name", "agent gateway allowlist");
includes(files.allowlist, "approved production-safe prefix", "agent gateway allowlist");
includes(files.allowlist, "/admin/agents/durable-objects/", "agent gateway allowlist");

includes(files.audit, "agent_gateway_audit", "agent gateway audit log");
includes(files.audit, "AUDIT_DB binding is required", "agent gateway audit log");
includes(files.audit, "persistAudit", "agent gateway audit log");
includes(files.audit, "accepted", "agent gateway audit log");
includes(files.audit, "completed", "agent gateway audit log");
includes(files.audit, "failed", "agent gateway audit log");

includes(files.index, "AGENT_GATEWAY_TOKEN", "agent gateway router");
includes(files.index, "authorization", "agent gateway router");
includes(files.index, "assertAuthorized", "agent gateway router");
includes(files.index, "persistAudit", "agent gateway router");
includes(files.index, "Request accepted by policy", "agent gateway router");
includes(files.index, "Request completed", "agent gateway router");
includes(files.index, "POST", "agent gateway router");
includes(files.index, "/tools", "agent gateway router");

includes(files.client, "https://api.cloudflare.com/client/v4", "Cloudflare API client");
includes(files.client, "CF_ACCOUNT_ID", "Cloudflare API client");
includes(files.client, "CF_API_TOKEN", "Cloudflare API client");
excludes(files.client, "X-Auth-Key", "Cloudflare API client");
excludes(files.client, "X-Auth-Email", "Cloudflare API client");

includes(files.d1, "/d1/database/", "D1 tool module");
includes(files.d1, "sqlite_master", "D1 tool module");
includes(files.d1, "assertReadOnlySql", "D1 tool module");
includes(files.d1, "seedApprovedFixture", "D1 tool module");
includes(files.d1, "APPROVED_D1_FIXTURES", "D1 tool module");

includes(files.kv, "/storage/kv/namespaces/", "KV tool module");
includes(files.kv, "listKeys", "KV tool module");
includes(files.kv, "getJson", "KV tool module");
includes(files.kv, "putJsonUnderPrefix", "KV tool module");
includes(files.kv, "assertJsonObject", "KV tool module");

includes(files.durableObjects, "/workers/durable_objects/namespaces", "Durable Objects tool module");
includes(files.durableObjects, "inspectViaAdminRoute", "Durable Objects tool module");
includes(files.durableObjects, "RESEARCHOPS_ADMIN_ORIGIN", "Durable Objects tool module");

includes(files.workers, "tailRecentErrors", "Workers observability tool module");
includes(files.workers, "researchops:agent-gateway:tail-errors:recent", "Workers observability tool module");

includes(files.wrangler, "researchops-agent-gateway", "agent gateway Wrangler config");
includes(files.wrangler, "src/index.ts", "agent gateway Wrangler config");
includes(files.wrangler, "AUDIT_DB", "agent gateway Wrangler config");
includes(files.wrangler, "REPLACE_WITH_PRODUCTION_AUDIT_D1_DATABASE_ID", "agent gateway Wrangler config");

includes(files.readme, "production-safe capability layer", "agent gateway README");
includes(files.readme, "Do not use an account-wide super token", "agent gateway README");
includes(files.readme, "audit = persisted", "agent gateway README");
includes(files.readme, "npx wrangler deploy --config apps/agent-gateway/wrangler.jsonc", "agent gateway README");
