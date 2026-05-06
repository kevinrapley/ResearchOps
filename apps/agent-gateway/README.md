# ResearchOps Cloudflare agent gateway

This Worker is a production-safe capability layer for AI agents that need controlled access to Cloudflare resources used by ResearchOps.

It does not expose raw Cloudflare account access. It exposes named tools only.

## Purpose

The gateway lets authorised agents inspect, seed, debug and support test automation against the ResearchOps production Cloudflare environment while keeping production writes constrained, attributable and auditable.

The gateway is intended for agent-facing operations such as:

- inspecting D1 schema
- running read-only D1 queries
- seeding approved D1 fixtures
- listing KV keys
- reading JSON from KV
- writing JSON under approved KV prefixes
- listing Durable Object namespaces and objects
- calling approved ResearchOps Durable Object admin inspection routes
- reading recent Worker error records from an approved log sink

## Endpoint

```text
POST /tools
```

Every request must include:

```text
Authorization: Bearer <AGENT_GATEWAY_TOKEN>
Content-Type: application/json
```

Example request:

```json
{
  "tool": "cloudflare.d1.inspectSchema",
  "environment": "production",
  "actor": "agent:researchops-debugger",
  "input": {
    "databaseId": "<production-d1-database-id>"
  }
}
```

## Production write rules

Every write must satisfy all of these rules:

```text
environment = production
operation = explicit allowlist match
fixture = approved fixture name, where fixture seeding is used
actor = agent identity
reason = required
audit = persisted
```

The gateway rejects write attempts that do not meet those rules.

## Approved write surfaces

D1 fixture seeding is allowed only through `cloudflare.d1.seedApprovedFixture` and only for fixtures declared in `src/schemas/tools.ts`.

KV writes are allowed only through `cloudflare.kv.putJsonUnderPrefix` and only for these prefixes:

```text
researchops:fixtures:
researchops:test-automation:
researchops:seed:
```

The gateway does not expose arbitrary SQL mutation or arbitrary KV writes.

## Durable Objects

The Cloudflare account API can list Durable Object namespaces and objects, but object internals must be inspected through explicit ResearchOps admin routes.

Allowed inspection paths must start with:

```text
/admin/agents/durable-objects/
```

Those routes must be implemented deliberately in the ResearchOps Worker or the Durable Object fronting Worker.

## Audit persistence

The gateway requires an `AUDIT_DB` D1 binding. Every accepted operation writes audit rows to `agent_gateway_audit`.

The gateway writes audit records for:

- accepted requests
- completed requests
- failed or blocked requests after a valid tool request has been parsed

## Required secrets

Set these secrets on the gateway Worker:

```bash
npx wrangler secret put AGENT_GATEWAY_TOKEN --config apps/agent-gateway/wrangler.jsonc
npx wrangler secret put CF_API_TOKEN --config apps/agent-gateway/wrangler.jsonc
```

Set this variable or secret for the Cloudflare account ID:

```bash
npx wrangler secret put CF_ACCOUNT_ID --config apps/agent-gateway/wrangler.jsonc
```

`CF_API_TOKEN` should be a narrow production token. Do not use an account-wide super token.

## Deployment

Replace the audit D1 database ID in `apps/agent-gateway/wrangler.jsonc`, then deploy with:

```bash
npx wrangler deploy --config apps/agent-gateway/wrangler.jsonc
```

## Safety posture

This gateway is a control surface for production operations. Treat it as privileged infrastructure.

Do not add new tools unless they include:

- an allowlist policy
- request validation
- audit persistence
- tests for blocked unsafe use
- clear documentation of production impact
