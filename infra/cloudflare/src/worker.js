/**
 * @file worker.js
 * @summary Cloudflare Worker entrypoint with hard Response guard + uniform CORS.
 * @version 2.2.0
 *
 * - Preserves Response coercion to avoid 1101 errors.
 * - Adds ALLOWED_ORIGINS-based CORS to all responses (success + errors).
 * - Handles OPTIONS preflight centrally.
 * - Routes GET /api/projects through the composed Projects service contract.
 */

import { handleRequest } from "./core/router.js";
import { ResearchOpsService } from "./service/index.js";

/** Coerce any value to a Response object. */
function coerceResponse(res) {
  if (res instanceof Response) return res;

  if (res === undefined || res === null) {
    console.error("[worker] Handler returned no response");
    return new Response(JSON.stringify({ error: "Handler returned no response" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  if (typeof res === "string" || res instanceof ArrayBuffer || res instanceof Uint8Array) {
    return new Response(res);
  }

  return new Response(JSON.stringify(res), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

/** Resolve an allowed Origin from env.ALLOWED_ORIGINS (array or CSV). */
function resolveAllowedOrigin(env, request) {
  try {
    const origin = request.headers.get("Origin") || "";
    const raw = env.ALLOWED_ORIGINS;
    const list = Array.isArray(raw) ? raw : String(raw || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    if (!origin) return "*"; // non-CORS request
    return list.includes(origin) ? origin : "null";
  } catch {
    return "*";
  }
}

/** Build CORS headers for the current request. */
function buildCorsHeaders(env, request) {
  const allowOrigin = resolveAllowedOrigin(env, request);
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Credentials": "true"
  };
}

/** Attach/merge CORS headers onto a Response. */
function withCORS(env, request, response) {
  try {
    const cors = buildCorsHeaders(env, request);
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(cors)) {
      if (!headers.has(k)) headers.set(k, v);
    }
    return new Response(response.body, { status: response.status, headers });
  } catch {
    // Fallback: if cloning fails, just return original response.
    return response;
  }
}

function normaliseApiPath(pathname) {
  let path = pathname || "/";
  path = path.replace(/\/{2,}/g, "/");
  if (path.startsWith("/api/") && path.endsWith("/") && path !== "/api/") {
    path = path.slice(0, -1);
  }
  return path;
}

function envCompat(env) {
  const allowed = Array.isArray(env.ALLOWED_ORIGINS) ? env.ALLOWED_ORIGINS.join(",") : String(env.ALLOWED_ORIGINS || "");
  return {
    ...env,
    ALLOWED_ORIGINS: allowed
  };
}

async function handleCanonicalProjectsRoute(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") || "";
  const service = new ResearchOpsService(envCompat(env));
  return service.listProjectsFromAirtable(origin, url);
}

export default {
  async fetch(request, env, ctx) {
    const { method, url } = request;
    const pathname = new URL(url).pathname;
    const apiPath = normaliseApiPath(pathname);

    // Centralised preflight
    if (method === "OPTIONS") {
      return withCORS(env, request, new Response(null, { status: 204 }));
    }

    try {
      console.log("[worker] Handling:", method, pathname);

      if (method === "GET" && apiPath === "/api/projects") {
        console.log("[worker] Routing /api/projects through ResearchOpsService");
        const result = await handleCanonicalProjectsRoute(request, env);
        const coerced = coerceResponse(result);
        const finalRes = withCORS(env, request, coerced);
        console.log("[worker] Response status:", finalRes.status);
        return finalRes;
      }

      const result = await handleRequest(request, env, ctx);
      const coerced = coerceResponse(result);
      const finalRes = withCORS(env, request, coerced);
      console.log("[worker] Response status:", finalRes.status);
      return finalRes;
    } catch (e) {
      console.error("[worker] Unhandled exception:", e);
      const errRes = new Response(JSON.stringify({
        error: "Internal error",
        detail: String(e?.message || e)
      }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
      return withCORS(env, request, errRes);
    }
  }
};
