import type { ToolRequest } from "../schemas/tools";

export type AuditRecord = {
  id: string;
  tool: string;
  environment: string;
  actor: string;
  reason: string;
  phase: "accepted" | "blocked" | "completed" | "failed";
  ok: boolean;
  message: string;
  createdAt: string;
  fixtureName: string;
  requestId: string;
  targetResourceType: string;
  targetResourceId: string;
  operationClass: "read" | "write";
  ipHash: string;
  userAgentHash: string;
  commitSha: string;
  workflowRunId: string;
  inputHash: string;
};

export type AuditBinding = {
  prepare: (sql: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<unknown>;
    };
  };
};

export type AuditEnv = {
  AUDIT_DB?: AuditBinding;
};

const WRITE_TOOLS = new Set([
  "cloudflare.d1.seedApprovedFixture",
  "cloudflare.kv.putJsonUnderPrefix",
]);

const AUDIT_TABLE_SQL = `CREATE TABLE IF NOT EXISTS agent_gateway_audit (
	row_id INTEGER PRIMARY KEY AUTOINCREMENT,
	id TEXT NOT NULL,
	tool TEXT NOT NULL,
	environment TEXT NOT NULL,
	actor TEXT NOT NULL,
	reason TEXT NOT NULL,
	phase TEXT NOT NULL,
	ok INTEGER NOT NULL,
	message TEXT NOT NULL,
	created_at TEXT NOT NULL,
	fixture_name TEXT,
	request_id TEXT,
	target_resource_type TEXT,
	target_resource_id TEXT,
	operation_class TEXT,
	ip_hash TEXT,
	user_agent_hash TEXT,
	commit_sha TEXT,
	workflow_run_id TEXT,
	input_hash TEXT
)`;

const AUDIT_INDEX_SQL = [
  "CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_created_at ON agent_gateway_audit (created_at)",
  "CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_actor ON agent_gateway_audit (actor)",
  "CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_tool ON agent_gateway_audit (tool)",
  "CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_phase ON agent_gateway_audit (phase)",
  "CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_operation_class ON agent_gateway_audit (operation_class)",
  "CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_target_resource ON agent_gateway_audit (target_resource_type, target_resource_id)",
  "CREATE INDEX IF NOT EXISTS idx_agent_gateway_audit_request_id ON agent_gateway_audit (request_id)",
];

export function createAuditId(): string {
  return `agw_${crypto.randomUUID()}`;
}

function auditString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function targetResourceType(request: ToolRequest): string {
  if (request.tool.startsWith("cloudflare.d1.")) return "d1";
  if (request.tool.startsWith("cloudflare.kv.")) return "kv";
  if (request.tool.startsWith("cloudflare.durableObjects.")) return "durable-object";
  if (request.tool.startsWith("cloudflare.workers.")) return "worker";
  return "cloudflare";
}

function targetResourceId(request: ToolRequest): string {
  return (
    auditString(request.input?.databaseId) ||
    auditString(request.input?.namespaceId) ||
    auditString(request.input?.scriptName) ||
    auditString(request.input?.key) ||
    auditString(request.input?.path)
  );
}

function operationClass(request: ToolRequest): "read" | "write" {
  return WRITE_TOOLS.has(request.tool) ? "write" : "read";
}

async function hashInput(input: unknown): Promise<string> {
  const value = JSON.stringify(input || {});
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureAuditSchema(db: AuditBinding): Promise<void> {
  await db.prepare(AUDIT_TABLE_SQL).bind().run();

  for (const sql of AUDIT_INDEX_SQL) {
    await db.prepare(sql).bind().run();
  }
}

export async function persistAudit(
  env: AuditEnv,
  request: ToolRequest,
  auditId: string,
  phase: AuditRecord["phase"],
  ok: boolean,
  message: string,
): Promise<AuditRecord> {
  const record: AuditRecord = {
    id: auditId,
    tool: request.tool,
    environment: request.environment,
    actor: request.actor,
    reason: request.reason || "",
    phase,
    ok,
    message,
    createdAt: new Date().toISOString(),
    fixtureName: auditString(request.input?.fixtureName),
    requestId: auditString(request.input?.requestId),
    targetResourceType: targetResourceType(request),
    targetResourceId: targetResourceId(request),
    operationClass: operationClass(request),
    ipHash: auditString(request.input?.ipHash),
    userAgentHash: auditString(request.input?.userAgentHash),
    commitSha: auditString(request.input?.commitSha),
    workflowRunId: auditString(request.input?.workflowRunId),
    inputHash: await hashInput(request.input),
  };

  if (!env.AUDIT_DB) {
    throw new Error("AUDIT_DB binding is required so agent gateway activity is persisted.");
  }

  await ensureAuditSchema(env.AUDIT_DB);

  await env.AUDIT_DB.prepare(
    "INSERT INTO agent_gateway_audit (id, tool, environment, actor, reason, phase, ok, message, created_at, fixture_name, request_id, target_resource_type, target_resource_id, operation_class, ip_hash, user_agent_hash, commit_sha, workflow_run_id, input_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      record.id,
      record.tool,
      record.environment,
      record.actor,
      record.reason,
      record.phase,
      record.ok ? 1 : 0,
      record.message,
      record.createdAt,
      record.fixtureName,
      record.requestId,
      record.targetResourceType,
      record.targetResourceId,
      record.operationClass,
      record.ipHash,
      record.userAgentHash,
      record.commitSha,
      record.workflowRunId,
      record.inputHash,
    )
    .run();

  return record;
}
