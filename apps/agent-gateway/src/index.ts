import { createAuditId, persistAudit, type AuditEnv } from "./audit/log";
import { inspectSchema, runReadOnlyQuery, seedApprovedFixture } from "./cloudflare/d1";
import {
  inspectViaAdminRoute,
  listNamespaces,
  listObjects,
} from "./cloudflare/durable-objects";
import { getJson, listKeys, putJsonUnderPrefix } from "./cloudflare/kv";
import { tailRecentErrors } from "./cloudflare/workers";
import { requireCloudflareEnv, type CloudflareEnv } from "./cloudflare/client";
import { assertAuthorized } from "./policies/allowlist";
import { jsonResponse, readToolRequest, type ToolRequest, type ToolResponse } from "./schemas/tools";

type Env = CloudflareEnv & AuditEnv & {
  AGENT_GATEWAY_TOKEN: string;
};

type ToolHandler = (env: CloudflareEnv, request: ToolRequest) => Promise<unknown>;

const TOOL_HANDLERS: Record<ToolRequest["tool"], ToolHandler> = {
  "cloudflare.d1.inspectSchema": inspectSchema,
  "cloudflare.d1.runReadOnlyQuery": runReadOnlyQuery,
  "cloudflare.d1.seedApprovedFixture": seedApprovedFixture,
  "cloudflare.kv.listKeys": listKeys,
  "cloudflare.kv.getJson": getJson,
  "cloudflare.kv.putJsonUnderPrefix": putJsonUnderPrefix,
  "cloudflare.durableObjects.listNamespaces": listNamespaces,
  "cloudflare.durableObjects.listObjects": listObjects,
  "cloudflare.durableObjects.inspectViaAdminRoute": inspectViaAdminRoute,
  "cloudflare.workers.tailRecentErrors": tailRecentErrors,
};

function assertGatewayAuth(request: Request, env: Env): void {
  if (!env.AGENT_GATEWAY_TOKEN) {
    throw new Error("AGENT_GATEWAY_TOKEN is required.");
  }

  const header = request.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();

  if (!token || token !== env.AGENT_GATEWAY_TOKEN) {
    throw new Error("Agent gateway authentication failed.");
  }
}

async function runTool(request: Request, env: Env): Promise<Response> {
  assertGatewayAuth(request, env);

  const toolRequest = await readToolRequest(request);
  const auditId = createAuditId();
  let policyAccepted = false;

  try {
    assertAuthorized(toolRequest);
    policyAccepted = true;
    await persistAudit(env, toolRequest, auditId, "accepted", true, "Request accepted by policy.");

    const cloudflareEnv = requireCloudflareEnv(env);
    const result = await TOOL_HANDLERS[toolRequest.tool](cloudflareEnv, toolRequest);

    await persistAudit(env, toolRequest, auditId, "completed", true, "Request completed.");

    return jsonResponse({
      ok: true,
      tool: toolRequest.tool,
      auditId,
      result,
    } satisfies ToolResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await persistAudit(env, toolRequest, auditId, policyAccepted ? "failed" : "blocked", false, message).catch(
      () => undefined,
    );

    return jsonResponse(
      {
        ok: false,
        tool: toolRequest.tool,
        auditId,
        error: {
          code: "AGENT_GATEWAY_TOOL_FAILED",
          message,
        },
      } satisfies ToolResponse,
      400,
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return jsonResponse({ ok: true, service: "ResearchOps Cloudflare agent gateway" });
    }

    if (url.pathname === "/tools" && request.method === "POST") {
      return runTool(request, env);
    }

    return jsonResponse(
      {
        ok: false,
        error: "Not found.",
      },
      404,
    );
  },
};

export { assertGatewayAuth, runTool, TOOL_HANDLERS };
