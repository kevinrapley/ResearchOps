import { assertJsonObject } from "../policies/allowlist";
import { stringValue, type ToolRequest } from "../schemas/tools";
import { accountPath, cloudflareApi, type CloudflareEnv } from "./client";

function namespaceId(request: ToolRequest): string {
  const value = stringValue(request.input?.namespaceId);
  if (!value) {
    throw new Error("KV namespaceId is required.");
  }

  return value;
}

function keyName(request: ToolRequest): string {
  const value = stringValue(request.input?.key);
  if (!value) {
    throw new Error("KV key is required.");
  }

  return value;
}

export async function listKeys(env: CloudflareEnv, request: ToolRequest): Promise<unknown> {
  const prefix = stringValue(request.input?.prefix);
  const limit = Number(request.input?.limit || 100);
  const cursor = stringValue(request.input?.cursor);
  const params = new URLSearchParams();

  if (prefix) params.set("prefix", prefix);
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(Math.min(Math.max(limit, 1), 1000)));

  return cloudflareApi(
    env,
    accountPath(
      env,
      `/storage/kv/namespaces/${encodeURIComponent(namespaceId(request))}/keys?${params}`,
    ),
  );
}

export async function getJson(env: CloudflareEnv, request: ToolRequest): Promise<unknown> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4${accountPath(
      env,
      `/storage/kv/namespaces/${encodeURIComponent(namespaceId(request))}/values/${encodeURIComponent(keyName(request))}`,
    )}`,
    {
      headers: {
        authorization: `Bearer ${env.CF_API_TOKEN}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`KV value read failed with status ${response.status}.`);
  }

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return {
      value: text,
      contentType: response.headers.get("content-type") || "text/plain",
    };
  }
}

export async function putJsonUnderPrefix(env: CloudflareEnv, request: ToolRequest): Promise<unknown> {
  const value = assertJsonObject(request.input?.value, "KV value");
  const response = await fetch(
    `https://api.cloudflare.com/client/v4${accountPath(
      env,
      `/storage/kv/namespaces/${encodeURIComponent(namespaceId(request))}/values/${encodeURIComponent(keyName(request))}`,
    )}`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${env.CF_API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(value),
    },
  );

  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    throw new Error(`KV value write failed with status ${response.status}.`);
  }

  return body?.result || { ok: true };
}
