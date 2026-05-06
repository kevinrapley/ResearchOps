export const TOOL_NAMES = [
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
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type ToolRequest = {
  tool: ToolName;
  environment: "production";
  actor: string;
  reason?: string;
  input?: Record<string, unknown>;
};

export type ToolResponse = {
  ok: boolean;
  tool: ToolName;
  auditId: string;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
};

export type ApprovedD1Fixture = {
  fixtureName: string;
  description: string;
  statements: Array<{
    sql: string;
    params?: Array<string | number | boolean | null>;
  }>;
};

export const APPROVED_D1_FIXTURES: Record<string, ApprovedD1Fixture> = Object.freeze({
  "agent-gateway-smoke-fixture-v1": {
    fixtureName: "agent-gateway-smoke-fixture-v1",
    description:
      "Creates and records a minimal production-safe agent gateway smoke-test marker. It does not mutate ResearchOps application tables.",
    statements: [
      {
        sql: "CREATE TABLE IF NOT EXISTS agent_gateway_seed_markers (fixture_name TEXT PRIMARY KEY, seeded_at TEXT NOT NULL, seeded_by TEXT NOT NULL, reason TEXT NOT NULL)",
      },
      {
        sql: "INSERT OR REPLACE INTO agent_gateway_seed_markers (fixture_name, seeded_at, seeded_by, reason) VALUES (?, datetime('now'), ?, ?)",
        params: ["agent-gateway-smoke-fixture-v1", "${actor}", "${reason}"],
      },
    ],
  },
});

export function isToolName(value: unknown): value is ToolName {
  return typeof value === "string" && TOOL_NAMES.includes(value as ToolName);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export async function readToolRequest(request: Request): Promise<ToolRequest> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new Error("Request body must be valid JSON.");
  }

  if (!isRecord(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  if (!isToolName(body.tool)) {
    throw new Error("Request tool must be one of the allowed Cloudflare agent gateway tools.");
  }

  if (body.environment !== "production") {
    throw new Error("Request environment must be production.");
  }

  const actor = stringValue(body.actor);
  if (!actor) {
    throw new Error("Request actor is required.");
  }

  return {
    tool: body.tool,
    environment: body.environment,
    actor,
    reason: stringValue(body.reason) || undefined,
    input: isRecord(body.input) ? body.input : {},
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
