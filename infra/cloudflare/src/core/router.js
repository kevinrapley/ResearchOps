/**
 * @file src/core/router.js
 * @summary Router with Response coercion (prevents "Promise did not resolve to Response").
 */

import { aiRewrite } from "./ai-rewrite.js";

/* ───── helpers ───── */
function canonicalizePath(pathname) { /* unchanged */ }
function maybeRedirect(request, canonicalPath) { /* unchanged */ }
function normalizeAllowedOrigins(val) { /* unchanged */ }
function corsHeadersForEnv(env, origin) { /* unchanged */ }
function json(x) { return JSON.stringify(x); }
function safeSlice(s, n) { return s && s.length > n ? s.slice(0, n) + "…" : s; }
function requireEnv(env, keys) { const m = keys.filter(k => !env[k]); if (m.length) throw new Error(`Missing env: ${m.join(", ")}`); }
function assertAirtableEnv(env) {
  if (!env.AIRTABLE_BASE && !env.AIRTABLE_BASE_ID) throw new Error("Missing env: AIRTABLE_BASE or AIRTABLE_BASE_ID");
  if (!env.AIRTABLE_API_KEY && !env.AIRTABLE_PAT) throw new Error("Missing env: AIRTABLE_API_KEY or AIRTABLE_PAT");
}

/* ★ NEW: normalize any return into a Response */
function toResponse(res, env, origin, status = 200, type = "application/json; charset=utf-8") {
  if (res instanceof Response) return res;
  if (res === undefined || res === null) {
    return new Response(json({ error: "Handler returned no response" }), {
      status: 500,
      headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
    });
  }
  if (typeof res === "string" || res instanceof ArrayBuffer || res instanceof Uint8Array) {
    return new Response(res, { status, headers: { ...corsHeadersForEnv(env, origin) } });
  }
  return new Response(json(res), { status, headers: { ...corsHeadersForEnv(env, origin), "content-type": type } });
}

/* ───── direct handlers (unchanged logic, wrapped with toResponse just in case) ───── */
async function projectsCsvDirect(request, env, origin) { /* unchanged, returns Response */ }
async function projectsJsonDirect(request, env, origin) { /* unchanged, returns Response */ }
async function studiesJsonDirect(request, env, origin, url) { /* unchanged, returns Response */ }
async function muralVerifyDirect(request, env, origin, url) { /* unchanged, returns Response or null */ }
async function muralResolveDirect(request, env, origin, url) { /* unchanged, returns Response or null */ }

/* ───── main entry ───── */
export async function handleRequest(request, env) {
  const origin = request.headers.get("Origin") || "";
  const url = new URL(request.url);

  // canonicalize (unchanged)
  const canonical = canonicalizePath(url.pathname);
  const redirect = maybeRedirect(request, canonical);
  if (redirect) return redirect;
  url.pathname = canonical;

  try {
    // OPTIONS / pings (unchanged)

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeadersForEnv(env, origin),
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    if (url.pathname === "/api/_diag/ping" && request.method === "GET") {
      return new Response(json({ ok: true, time: new Date().toISOString(), note: "handleRequest" }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
      });
    }

    if (url.pathname === "/api/health") {
      return new Response(json({ ok: true, service: "ResearchOps API", time: new Date().toISOString() }), {
        status: 200,
        headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
      });
    }

    // ── direct, fail-safe endpoints
    if (url.pathname === "/api/projects" && request.method === "GET") {
      const r = await projectsJsonDirect(request, env, origin);
      return toResponse(r, env, origin);
    }
    if (url.pathname === "/api/projects.csv" && request.method === "GET") {
      const r = await projectsCsvDirect(request, env, origin);
      return toResponse(r, env, origin, 200, "text/csv; charset=utf-8");
    }
    if (url.pathname === "/api/studies" && request.method === "GET") {
      const r = await studiesJsonDirect(request, env, origin, url);
      return toResponse(r, env, origin);
    }
    if (url.pathname === "/api/mural/verify" && request.method === "GET") {
      const stub = await muralVerifyDirect(request, env, origin, url);
      if (stub) return toResponse(stub, env, origin);
    }
    if (url.pathname === "/api/mural/resolve" && request.method === "GET") {
      const stub = await muralResolveDirect(request, env, origin, url);
      if (stub) return toResponse(stub, env, origin);
    }

    // ── dynamic import for service.js (unchanged)
    let ResearchOpsService;
    try {
      ({ ResearchOpsService } = await import("./service.js"));
    } catch (e) {
      return new Response(json({ ok: false, error: "Service module load failed", detail: String(e?.message || e) }), {
        status: 500,
        headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
      });
    }
    const service = new ResearchOpsService(env);

    // …rest of routes unchanged (they already return Response) …

    // Unknown API route
    if (url.pathname.startsWith("/api/")) {
      return new Response(json({ error: "Not found", path: url.pathname }), {
        status: 404,
        headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
      });
    }

    // Static (SPA fallback)
    let resp = await env.ASSETS.fetch(request);
    if (resp.status === 404) {
      const indexReq = new Request(new URL("/index.html", url), request);
      resp = await env.ASSETS.fetch(indexReq);
    }
    return resp;

  } catch (e) {
    return new Response(json({ error: "Internal error", detail: String(e?.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeadersForEnv(env, origin) }
    });
  }
}
