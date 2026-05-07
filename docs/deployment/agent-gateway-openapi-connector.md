# Agent Gateway OpenAPI connector setup

This document explains how to expose the ResearchOps Cloudflare Agent Gateway to an AI agent as a secured API tool connector.

The gateway remains the only runtime that can call Cloudflare production resources. The connector does not receive raw Cloudflare credentials. It only receives a bearer token for the Agent Gateway.

## Source contract

The OpenAPI contract is source-controlled at:

```text
infra/cloudflare/agent-gateway/openapi.yaml
```

The production gateway origin is:

```text
https://researchops-agent-gateway.digikev-kevin-rapley.workers.dev
```

The contract exposes:

```text
GET /health
POST /tools
```

`POST /tools` is the only privileged operation. It accepts one named tool request and returns an audited response with an `auditId`.

## Authentication model

Store this value as a connector secret:

```text
AGENT_GATEWAY_TOKEN
```

The connector must send it as:

```text
Authorization: Bearer <AGENT_GATEWAY_TOKEN>
```

Do not paste the token into chat.

Do not commit the token to GitHub.

Do not expose the Cloudflare API token to the connector.

## Required connector configuration

When creating the secured API connector, use:

```text
OpenAPI file: infra/cloudflare/agent-gateway/openapi.yaml
Authentication: HTTP bearer token
Bearer token source: connector secret
Secret value: AGENT_GATEWAY_TOKEN
Base URL: https://researchops-agent-gateway.digikev-kevin-rapley.workers.dev
```

The connector should make only HTTPS requests.

The connector should not allow arbitrary URL override.

The connector should not expose request headers, bearer tokens or Cloudflare API tokens in model-visible output.

## Tool request shape

Example read-only request:

```json
{
	"tool": "cloudflare.d1.inspectSchema",
	"environment": "production",
	"actor": "agent:chatgpt",
	"reason": "Inspect the schema before debugging a production issue.",
	"input": {
		"databaseId": "75196021-d2a9-435f-a0ac-654baeb111d4"
	}
}
```

Example read-only D1 query:

```json
{
	"tool": "cloudflare.d1.runReadOnlyQuery",
	"environment": "production",
	"actor": "agent:chatgpt",
	"reason": "Check recent audit rows after a gateway operation.",
	"input": {
		"databaseId": "75196021-d2a9-435f-a0ac-654baeb111d4",
		"sql": "SELECT id, tool, actor, phase, ok, created_at FROM agent_gateway_audit ORDER BY row_id DESC LIMIT 10",
		"params": []
	}
}
```

Example write request shape:

```json
{
	"tool": "cloudflare.kv.putJsonUnderPrefix",
	"environment": "production",
	"actor": "agent:chatgpt",
	"reason": "Seed an approved test automation fixture under an approved prefix.",
	"input": {
		"namespaceId": "example-kv-namespace-id",
		"key": "researchops:test-automation:example",
		"value": {
			"ok": true
		}
	}
}
```

Write requests remain controlled server-side by the Agent Gateway allowlist. The OpenAPI contract describes the request shape, but the Worker remains the policy enforcement point.

## Available tools

```text
cloudflare.d1.inspectSchema
cloudflare.d1.runReadOnlyQuery
cloudflare.d1.seedApprovedFixture
cloudflare.kv.listKeys
cloudflare.kv.getJson
cloudflare.kv.putJsonUnderPrefix
cloudflare.durableObjects.listNamespaces
cloudflare.durableObjects.listObjects
cloudflare.durableObjects.inspectViaAdminRoute
cloudflare.workers.tailRecentErrors
```

## Audit expectations

Every authorised request should create audit rows in:

```text
researchops-agent-gateway-audit.agent_gateway_audit
```

Expected successful read-only phases:

```text
accepted
completed
```

Expected blocked write phases:

```text
blocked
```

Each response includes:

```text
auditId
```

Use that value to find the audit trail for the request.

## Acceptance checks

After configuring the connector, run these checks.

1. Call `getAgentGatewayHealth`.

Expected result:

```json
{
	"ok": true,
	"service": "ResearchOps Cloudflare agent gateway"
}
```

2. Call `runAgentGatewayTool` with `cloudflare.d1.inspectSchema` against the audit database.

Expected result:

```text
ok = true
auditId present
result includes agent_gateway_audit schema rows
```

3. Query the audit table for the returned `auditId`.

Expected phases:

```text
accepted
completed
```

4. Attempt a write without a required reason.

Expected result:

```text
ok = false
error.message explains the write was blocked
blocked audit row exists
```

## Safety rules

The connector must not be configured with a Cloudflare API token.

The connector must not expose arbitrary Cloudflare HTTP endpoints.

The connector must not allow raw SQL mutation. D1 read-only enforcement remains in the Agent Gateway policy.

The connector must not allow unaudited requests.

If the OpenAPI contract and gateway implementation disagree, the gateway implementation is the source of enforcement and the OpenAPI file must be updated.
