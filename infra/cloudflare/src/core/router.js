/**
 * @file src/core/router.js
 * @summary Router for Cloudflare Worker entrypoint (ResearchOps API).
 *
 * Update:
 *  - Added safe handler muralResolveDirect() for GET /api/mural/resolve when uid=anon/misconfigured.
 *    Returns: { ok:true, found:false, reason:"not_authenticated"|"not_configured" }
 *    This mirrors the earlier /api/mural/verify stub.
 */

import { aiRewrite } from "./ai-rewrite.js";

/* ───────────── Shared utilities (unchanged) ───────────── */
function canonicalizePath(pathname) { /* ... same as before ... */ }
function maybeRedirect(request, canonicalPath) { /* ... same as before ... */ }
function normalizeAllowedOrigins(val) { /* ... same as before ... */ }
function corsHeadersForEnv(env, origin) { /* ... same as before ... */ }
function json(x) { return JSON.stringify(x); }
function safeSlice(s, n) { return s && s.length > n ? s.slice(0, n) + "…" : s; }
function requireEnv(env, keys) { /* ... same as before ... */ }
function assertAirtableEnv(env) { /* ... same as before ... */ }

/* ───────────── Existing direct handlers (projects/studies/verify) ───────────── */
// projectsCsvDirect(...)
// projectsJsonDirect(...)
// studiesJsonDirect(...)
/** GET /api/mural/verify[?uid=...] — safe stub for anon/misconfig */
async function muralVerifyDirect(request, env, origin, url) {
  try {
    const uid = url.searchParams.get("uid") || "anon";
    const configured = Boolean(env.MURAL_API_BASE && env.MURAL_COMPANY_ID);
    if (uid === "anon" || !configured) {
      return new Response(json({
        ok: true,
        connected: false,
        reason: uid === "anon" ? "not_authenticated" : "not_configured"
      }), {
        status: 200,
        headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
      });
    }
    return null; // fallthrough to service for signed-in users
  } catch (e) {
    return new Response(json({ ok: false, connected: false, error: String(e?.message || e) }), {
      status: 200,
      headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
    });
  }
}

/* ★ NEW: safe stub for /api/mural/resolve when anon/misconfigured */
async function muralResolveDirect(request, env, origin, url) {
  try {
    const uid = url.searchParams.get("uid") || "anon";
    const configured = Boolean(env.MURAL_API_BASE && env.MURAL_COMPANY_ID);

    if (uid === "anon" || !configured) {
      // Always return a controlled “not found” response instead of throwing.
      return new Response(json({
        ok: true,
        found: false,
        board: null,
        reason: uid === "anon" ? "not_authenticated" : "not_configured"
      }), {
        status: 200,
        headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
      });
    }

    return null; // fallthrough to service.mural.muralResolve for signed-in users
  } catch (e) {
    return new Response(json({ ok: false, found: false, error: String(e?.message || e) }), {
      status: 200,
      headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
    });
  }
}

/* ───────────── Entry router (only the mural/resolve branch is new) ───────────── */
export async function handleRequest(request, env) {
  const origin = request.headers.get("Origin") || "";
  const url = new URL(request.url);

  // canonicalize path (unchanged)
  {
    const canonical = canonicalizePath(url.pathname);
    const redirect = maybeRedirect(request, canonical);
    if (redirect) return redirect;
    url.pathname = canonical;
  }

  try {
    // OPTIONS / health / ping (unchanged)...

    // ── Direct, fail-safe endpoints used by dashboard ──
    if (url.pathname === "/api/studies" && request.method === "GET") {
      return studiesJsonDirect(request, env, origin, url);
    }
    if (url.pathname === "/api/mural/verify" && request.method === "GET") {
      const stub = await muralVerifyDirect(request, env, origin, url);
      if (stub) return stub;
    }
    /* ★ NEW: safe stub for anon resolve */
    if (url.pathname === "/api/mural/resolve" && request.method === "GET") {
      const stub = await muralResolveDirect(request, env, origin, url);
      if (stub) return stub;
    }

    if (url.pathname === "/api/projects" && request.method === "GET") {
      return projectsJsonDirect(request, env, origin);
    }
    if (url.pathname === "/api/projects.csv" && request.method === "GET") {
      return projectsCsvDirect(request, env, origin);
    }

    // ── Everything else via service.js (dynamic import) ──
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

    // …rest of routes unchanged…

    // Mural (signed-in flows)
    if (url.pathname === "/api/mural/auth" && request.method === "GET") return service.mural.muralAuth(origin, url);
    if (url.pathname === "/api/mural/callback" && request.method === "GET") return service.mural.muralCallback(origin, url);
    if (url.pathname === "/api/mural/verify" && request.method === "GET") return service.mural.muralVerify(origin, url);
    /* resolves for signed-in users */
    if (url.pathname === "/api/mural/resolve" && request.method === "GET") return service.mural.muralResolve(origin, url);
    if (url.pathname === "/api/mural/setup" && request.method === "POST") return service.mural.muralSetup(request, origin);
    if (url.pathname === "/api/mural/find" && request.method === "GET") return service.mural.muralFind(origin, url);
    if (request.method === "POST" && url.pathname === "/api/mural/journal-sync") return service.mural.muralJournalSync(request, origin);
    if (url.pathname === "/api/mural/workspaces" && request.method === "GET") return service.mural.muralListWorkspaces(origin, url);
    if (url.pathname === "/api/mural/me" && request.method === "GET") return service.mural.muralMe(origin, url);
    if (url.pathname === "/api/mural/debug-env" && request.method === "GET") return service.mural.muralDebugEnv(origin);

    // …static fallback & error handling unchanged…
  } catch (e) {
    return new Response(json({ error: "Internal error", detail: String(e?.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeadersForEnv(env, origin) }
    });
  }
}
