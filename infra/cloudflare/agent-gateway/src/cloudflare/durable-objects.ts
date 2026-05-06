import { assertAdminRoutePath } from "../policies/allowlist";
import { stringValue, type ToolRequest } from "../schemas/tools";
import { accountPath, cloudflareApi, type CloudflareEnv } from "./client";

export async function listNamespaces(env: CloudflareEnv): Promise<unknown> {
  return cloudflareApi(env, accountPath(env, "/workers/durable_objects/namespaces"));
}

export async function listObjects(env: CloudflareEnv, request: ToolRequest): Promise<unknown> {
  const namespaceId = stringValue(request.input?.namespaceId);
  if (!namespaceId) {
    throw new Error("Durable Objects namespaceId is required.");
  }

  return cloudflareApi(
    env,
    accountPath(
      env,
      `/workers/durable_objects/namespaces/${encodeURIComponent(namespaceId)}/objects`,
    ),
  );
}

export async function inspectViaAdminRoute(
  env: CloudflareEnv,
  request: ToolRequest,
): Promise<unknown> {
  const origin = stringValue(env.RESEARCHOPS_ADMIN_ORIGIN);
  if (!origin) {
    throw new Error("RESEARCHOPS_ADMIN_ORIGIN is required for Durable Object admin inspection.");
  }

  const routePath = assertAdminRoutePath(request.input?.path);
  const payload = request.input?.payload || {};
  const response = await fetch(`${origin}${routePath}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.CF_API_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      actor: request.actor,
      reason: request.reason || "read-only admin inspection",
      payload,
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`ResearchOps Durable Object admin route failed with status ${response.status}.`);
  }

  return body;
}
