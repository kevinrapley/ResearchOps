export type CloudflareEnv = {
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  RESEARCHOPS_ADMIN_ORIGIN?: string;
};

export type CloudflareApiResponse<T = unknown> = {
  success?: boolean;
  result?: T;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: Array<{ code?: number; message?: string }>;
};

export function requireCloudflareEnv(env: Partial<CloudflareEnv>): CloudflareEnv {
  if (!env.CF_ACCOUNT_ID) {
    throw new Error("CF_ACCOUNT_ID is required.");
  }

  if (!env.CF_API_TOKEN) {
    throw new Error("CF_API_TOKEN is required.");
  }

  return {
    CF_ACCOUNT_ID: env.CF_ACCOUNT_ID,
    CF_API_TOKEN: env.CF_API_TOKEN,
    RESEARCHOPS_ADMIN_ORIGIN: env.RESEARCHOPS_ADMIN_ORIGIN,
  };
}

export async function cloudflareApi<T = unknown>(
  env: CloudflareEnv,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.CF_API_TOKEN}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });

  const body = (await response.json().catch(() => null)) as CloudflareApiResponse<T> | null;

  if (!response.ok || body?.success === false) {
    const message = body?.errors?.map((error) => error.message).filter(Boolean).join("; ");
    throw new Error(message || `Cloudflare API request failed with status ${response.status}.`);
  }

  return body?.result as T;
}

export function accountPath(env: CloudflareEnv, suffix: string): string {
  return `/accounts/${encodeURIComponent(env.CF_ACCOUNT_ID)}${suffix}`;
}
