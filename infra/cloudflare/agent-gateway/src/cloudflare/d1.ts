import { APPROVED_D1_FIXTURES, arrayValue, stringValue, type ToolRequest } from "../schemas/tools";
import { assertReadOnlySql } from "../policies/allowlist";
import { accountPath, cloudflareApi, type CloudflareEnv } from "./client";

export type D1QueryResult = {
  results?: unknown[];
  success?: boolean;
  meta?: Record<string, unknown>;
};

function databaseId(request: ToolRequest): string {
  const value = stringValue(request.input?.databaseId);
  if (!value) {
    throw new Error("D1 databaseId is required.");
  }

  return value;
}

function d1QueryPath(env: CloudflareEnv, request: ToolRequest): string {
  return accountPath(env, `/d1/database/${encodeURIComponent(databaseId(request))}/query`);
}

export async function inspectSchema(env: CloudflareEnv, request: ToolRequest): Promise<unknown> {
  return cloudflareApi<D1QueryResult[]>(env, d1QueryPath(env, request), {
    method: "POST",
    body: JSON.stringify({
      sql: "SELECT name, type, sql FROM sqlite_master WHERE type IN ('table', 'index', 'view') ORDER BY type, name",
      params: [],
    }),
  });
}

export async function runReadOnlyQuery(env: CloudflareEnv, request: ToolRequest): Promise<unknown> {
  const sql = stringValue(request.input?.sql);
  if (!sql) {
    throw new Error("Read-only D1 query requires sql.");
  }

  assertReadOnlySql(sql);

  return cloudflareApi<D1QueryResult[]>(env, d1QueryPath(env, request), {
    method: "POST",
    body: JSON.stringify({
      sql,
      params: arrayValue(request.input?.params),
    }),
  });
}

export async function seedApprovedFixture(env: CloudflareEnv, request: ToolRequest): Promise<unknown> {
  const fixtureName = stringValue(request.input?.fixtureName);
  const fixture = APPROVED_D1_FIXTURES[fixtureName];

  if (!fixture) {
    throw new Error("Approved D1 fixture was not found.");
  }

  const statements = fixture.statements.map((statement) => ({
    sql: statement.sql,
    params: (statement.params || []).map((param) => {
      if (param === "${actor}") return request.actor;
      if (param === "${reason}") return request.reason || "";
      return param;
    }),
  }));

  const results = [];
  for (const statement of statements) {
    results.push(
      await cloudflareApi<D1QueryResult[]>(env, d1QueryPath(env, request), {
        method: "POST",
        body: JSON.stringify(statement),
      }),
    );
  }

  return {
    fixtureName: fixture.fixtureName,
    description: fixture.description,
    statementCount: statements.length,
    results,
  };
}
