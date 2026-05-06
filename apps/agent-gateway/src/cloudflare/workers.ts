import { stringValue, type ToolRequest } from "../schemas/tools";
import { accountPath, cloudflareApi, type CloudflareEnv } from "./client";

export async function tailRecentErrors(env: CloudflareEnv, request: ToolRequest): Promise<unknown> {
  const namespaceId = stringValue(request.input?.namespaceId);
  const key = stringValue(request.input?.key) || "researchops:agent-gateway:tail-errors:recent";

  if (namespaceId) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4${accountPath(
        env,
        `/storage/kv/namespaces/${encodeURIComponent(namespaceId)}/values/${encodeURIComponent(key)}`,
      )}`,
      {
        headers: {
          authorization: `Bearer ${env.CF_API_TOKEN}`,
        },
      },
    );

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`Recent Worker error log read failed with status ${response.status}.`);
    }

    return response.json().catch(async () => ({ value: await response.text() }));
  }

  const scriptName = stringValue(request.input?.scriptName);
  if (!scriptName) {
    throw new Error("tailRecentErrors requires either namespaceId for the log sink or scriptName for Worker metadata lookup.");
  }

  return cloudflareApi(env, accountPath(env, `/workers/scripts/${encodeURIComponent(scriptName)}`));
}
