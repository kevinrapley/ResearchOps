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

export function createAuditId(): string {
  return `agw_${crypto.randomUUID()}`;
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
  };

  if (!env.AUDIT_DB) {
    throw new Error("AUDIT_DB binding is required so agent gateway activity is persisted.");
  }

  await env.AUDIT_DB.prepare(
    "CREATE TABLE IF NOT EXISTS agent_gateway_audit (id TEXT NOT NULL, tool TEXT NOT NULL, environment TEXT NOT NULL, actor TEXT NOT NULL, reason TEXT NOT NULL, phase TEXT NOT NULL, ok INTEGER NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL)",
  )
    .bind()
    .run();

  await env.AUDIT_DB.prepare(
    "INSERT INTO agent_gateway_audit (id, tool, environment, actor, reason, phase, ok, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
    )
    .run();

  return record;
}
