import {
  APPROVED_D1_FIXTURES,
  type ToolName,
  type ToolRequest,
  isRecord,
  stringValue,
} from "../schemas/tools";

export type OperationPolicy = {
  tool: ToolName;
  requiresReason: boolean;
  requiresApprovedFixture: boolean;
  allowedKvPrefixes?: string[];
  readOnlySql?: boolean;
};

export const OPERATION_ALLOWLIST: Record<ToolName, OperationPolicy> = Object.freeze({
  "cloudflare.d1.inspectSchema": {
    tool: "cloudflare.d1.inspectSchema",
    requiresReason: false,
    requiresApprovedFixture: false,
    readOnlySql: true,
  },
  "cloudflare.d1.runReadOnlyQuery": {
    tool: "cloudflare.d1.runReadOnlyQuery",
    requiresReason: false,
    requiresApprovedFixture: false,
    readOnlySql: true,
  },
  "cloudflare.d1.seedApprovedFixture": {
    tool: "cloudflare.d1.seedApprovedFixture",
    requiresReason: true,
    requiresApprovedFixture: true,
  },
  "cloudflare.kv.listKeys": {
    tool: "cloudflare.kv.listKeys",
    requiresReason: false,
    requiresApprovedFixture: false,
  },
  "cloudflare.kv.getJson": {
    tool: "cloudflare.kv.getJson",
    requiresReason: false,
    requiresApprovedFixture: false,
  },
  "cloudflare.kv.putJsonUnderPrefix": {
    tool: "cloudflare.kv.putJsonUnderPrefix",
    requiresReason: true,
    requiresApprovedFixture: false,
    allowedKvPrefixes: ["researchops:fixtures:", "researchops:test-automation:", "researchops:seed:"],
  },
  "cloudflare.durableObjects.listNamespaces": {
    tool: "cloudflare.durableObjects.listNamespaces",
    requiresReason: false,
    requiresApprovedFixture: false,
  },
  "cloudflare.durableObjects.listObjects": {
    tool: "cloudflare.durableObjects.listObjects",
    requiresReason: false,
    requiresApprovedFixture: false,
  },
  "cloudflare.durableObjects.inspectViaAdminRoute": {
    tool: "cloudflare.durableObjects.inspectViaAdminRoute",
    requiresReason: false,
    requiresApprovedFixture: false,
  },
  "cloudflare.workers.tailRecentErrors": {
    tool: "cloudflare.workers.tailRecentErrors",
    requiresReason: false,
    requiresApprovedFixture: false,
  },
});

const DESTRUCTIVE_SQL = /\b(alter|attach|create\s+trigger|delete|detach|drop|insert|pragma|reindex|replace|update|vacuum)\b/i;
const READONLY_SQL = /^\s*(select|with|explain)\b/i;

export function assertAuthorized(request: ToolRequest): void {
  const policy = OPERATION_ALLOWLIST[request.tool];
  if (!policy) {
    throw new Error("Operation is not in the explicit allowlist.");
  }

  if (request.environment !== "production") {
    throw new Error("Only production environment requests are accepted by this gateway.");
  }

  if (!request.actor) {
    throw new Error("Actor identity is required.");
  }

  if (policy.requiresReason && !request.reason) {
    throw new Error("A reason is required for write operations.");
  }

  if (policy.requiresApprovedFixture) {
    const fixtureName = stringValue(request.input?.fixtureName);
    if (!fixtureName || !APPROVED_D1_FIXTURES[fixtureName]) {
      throw new Error("Write operation requires an approved fixture name.");
    }
  }

  if (policy.allowedKvPrefixes) {
    const key = stringValue(request.input?.key);
    const allowed = policy.allowedKvPrefixes.some((prefix) => key.startsWith(prefix));
    if (!allowed) {
      throw new Error("KV write key must use an approved production-safe prefix.");
    }
  }

  if (policy.readOnlySql) {
    const sql = stringValue(request.input?.sql);
    if (sql) assertReadOnlySql(sql);
  }
}

export function assertReadOnlySql(sql: string): void {
  if (!READONLY_SQL.test(sql)) {
    throw new Error("Only SELECT, WITH, or EXPLAIN statements are allowed by the read-only D1 tool.");
  }

  if (DESTRUCTIVE_SQL.test(sql)) {
    throw new Error("Potentially mutating SQL is blocked by the read-only D1 tool.");
  }
}

export function assertAdminRoutePath(value: unknown): string {
  const path = stringValue(value);
  if (!path.startsWith("/admin/agents/durable-objects/")) {
    throw new Error("Durable Object inspection must use an approved ResearchOps admin agent route.");
  }

  return path;
}

export function assertJsonObject(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return value;
}
