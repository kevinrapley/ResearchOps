/**
 * @file src/core/router.js
 * @module core/router
 * @summary Router for Cloudflare Worker entrypoint (ResearchOps API).
 *
 * Fail-safe design:
 *  - Direct, try/catch-wrapped handlers for:
 *      • GET /api/projects            (Airtable → JSON)
 *      • GET /api/projects.csv        (GitHub raw → CSV)
 *      • GET /api/studies             (Airtable → JSON; supports ?project=recXXXX)
 *      • GET /api/mural/verify        (safe stub when anon/misconfigured)
 *  - Dynamic import of service.js for everything else to avoid 1101 on module init.
 *  - Strict CORS + OPTIONS everywhere.
 */

import { aiRewrite } from "./ai-rewrite.js";

/* ────────────────────────────────────────────────────────────────────────────
   Small utilities
   ──────────────────────────────────────────────────────────────────────────── */

function canonicalizePath(pathname) {
  let p = pathname || "/";
  p = p.replace(/\/(pages|components|partials|css|js|images|img|assets)\/(\1\/)+/g, "/$1/");
  p = p.replace(/\/{2,}/g, "/");
  p = p.replace(/\/index\.html$/i, "/");
  if (p.startsWith("/api/") && p.endsWith("/") && p !== "/api/") p = p.slice(0, -1);
  return p;
}

function maybeRedirect(request, canonicalPath) {
  const url = new URL(request.url);
  if (url.pathname !== canonicalPath) {
    url.pathname = canonicalPath;
    return Response.redirect(url.toString(), 302);
  }
  return null;
}

function normalizeAllowedOrigins(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") return val.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}

function corsHeadersForEnv(env, origin) {
  const allowList = normalizeAllowedOrigins(env?.ALLOWED_ORIGINS);
  const allow = allowList.includes(origin);
  return {
    "access-control-allow-origin": allow ? origin : (allowList[0] || "*"),
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "vary": "Origin"
  };
}

function json(x) { return JSON.stringify(x); }
function safeSlice(s, n) { return s && s.length > n ? s.slice(0, n) + "…" : s; }
function requireEnv(env, keys) { const m = keys.filter(k => !env[k]); if (m.length) throw new Error(`Missing env: ${m.join(", ")}`); }
function assertAirtableEnv(env) {
  if (!env.AIRTABLE_BASE && !env.AIRTABLE_BASE_ID) throw new Error("Missing env: AIRTABLE_BASE or AIRTABLE_BASE_ID");
  if (!env.AIRTABLE_API_KEY && !env.AIRTABLE_PAT) throw new Error("Missing env: AIRTABLE_API_KEY or AIRTABLE_PAT");
}

/* ────────────────────────────────────────────────────────────────────────────
   Direct, fail-safe endpoints (do not depend on service.js)
   ──────────────────────────────────────────────────────────────────────────── */

/** GET /api/projects.csv */
async function projectsCsvDirect(request, env, origin) {
  try {
    requireEnv(env, ["GH_OWNER", "GH_REPO", "GH_BRANCH", "GH_PATH_PROJECTS"]);
    const rawUrl = `https://raw.githubusercontent.com/${env.GH_OWNER}/${env.GH_REPO}/${env.GH_BRANCH}/${env.GH_PATH_PROJECTS}`;
    const r = await fetch(rawUrl, { headers: { accept: "text/plain" } });
    if (!r.ok) {
      return new Response(`Upstream CSV fetch failed: ${r.status}`, {
        status: 502, headers: { ...corsHeadersForEnv(env, origin), "content-type": "text/plain; charset=utf-8" }
      });
    }
    const body = await r.text();
    return new Response(body, {
      status: 200, headers: { ...corsHeadersForEnv(env, origin), "content-type": "text/csv; charset=utf-8" }
    });
  } catch (e) {
    return new Response(`Handler error (projects.csv): ${String(e?.message || e)}`, {
      status: 500, headers: { ...corsHeadersForEnv(env, origin), "content-type": "text/plain; charset=utf-8" }
    });
  }
}

/** GET /api/projects */
async function projectsJsonDirect(request, env, origin) {
  try {
    assertAirtableEnv(env);
    requireEnv(env, ["AIRTABLE_TABLE_PROJECTS"]);
    const base = env.AIRTABLE_BASE || env.AIRTABLE_BASE_ID;
    const key  = env.AIRTABLE_API_KEY || env.AIRTABLE_PAT;
    const table = encodeURIComponent(env.AIRTABLE_TABLE_PROJECTS);
    const url = `https://api.airtable.com/v0/${base}/${table}?pageSize=100`;
    const r = await fetch(url, { headers: { authorization: `Bearer ${key}`, accept: "application/json" } });
    if (!r.ok) {
      const raw = await r.text().catch(() => "");
      return new Response(json({ ok: false, source: "airtable", status: r.status, error: safeSlice(raw, 2000) }), {
        status: 500, headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
      });
    }
    const data = await r.json();
    const projects = (Array.isArray(data?.records) ? data.records : []).map(rec => ({ id: rec.id, ...(rec.fields || {}) }));
    return new Response(json({ ok: true, projects }), {
      status: 200, headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
    });
  } catch (e) {
    return new Response(json({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
    });
  }
}

/** GET /api/studies[?project=recXXXX] */
async function studiesJsonDirect(request, env, origin, url) {
  try {
    assertAirtableEnv(env);
    requireEnv(env, ["AIRTABLE_TABLE_STUDIES"]);
    const base = env.AIRTABLE_BASE || env.AIRTABLE_BASE_ID;
    const key  = env.AIRTABLE_API_KEY || env.AIRTABLE_PAT;
    const table = encodeURIComponent(env.AIRTABLE_TABLE_STUDIES);

    const project = url.searchParams.get("project");
    const params = new URLSearchParams({ pageSize: "100" });

    // If your linked field is named something else, change {Project} below
    if (project) {
      const formula = `IF({Project}, FIND("${project}", ARRAYJOIN({Project} & "")), 0)`;
      params.set("filterByFormula", formula);
    }

    const apiUrl = `https://api.airtable.com/v0/${base}/${table}?${params.toString()}`;
    const r = await fetch(apiUrl, { headers: { authorization: `Bearer ${key}`, accept: "application/json" } });

    if (!r.ok) {
      const raw = await r.text().catch(() => "");
      return new Response(json({ ok: false, source: "airtable", status: r.status, error: safeSlice(raw, 2000) }), {
        status: 500, headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
      });
    }

    const data = await r.json();
    const studies = (Array.isArray(data?.records) ? data.records : []).map(rec => ({ id: rec.id, ...(rec.fields || {}) }));
    return new Response(json({ ok: true, studies }), {
      status: 200, headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
    });
  } catch (e) {
    return new Response(json({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
    });
  }
}

/** GET /api/mural/verify[?uid=...] — safe stub for anon/misconfig */
async function muralVerifyDirect(request, env, origin, url) {
  try {
    const uid = url.searchParams.get("uid") || "anon";
    const configured = Boolean(env.MURAL_API_BASE && env.MURAL_COMPANY_ID);
    if (uid === "anon" || !configured) {
      return new Response(json({ ok: true, connected: false, reason: uid === "anon" ? "not_authenticated" : "not_configured" }), {
        status: 200, headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
      });
    }
    // If you want to call your service layer’s verify for signed-in users,
    // the main router below will handle it via service.mural.muralVerify.
    return null; // allow fallthrough
  } catch (e) {
    return new Response(json({ ok: false, connected: false, error: String(e?.message || e) }), {
      status: 200, headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
    });
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Entry router
   ──────────────────────────────────────────────────────────────────────────── */

export async function handleRequest(request, env) {
  const origin = request.headers.get("Origin") || "";
  const url = new URL(request.url);

  // canonicalize path
  {
    const canonical = canonicalizePath(url.pathname);
    const redirect = maybeRedirect(request, canonical);
    if (redirect) return redirect;
    url.pathname = canonical;
  }

  try {
    // CORS preflight
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

    // Quick pings
    if (url.pathname === "/api/_diag/ping" && request.method === "GET") {
      return new Response(json({ ok: true, time: new Date().toISOString(), note: "handleRequest" }), {
        status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
      });
    }
    if (url.pathname === "/api/health") {
      return new Response(json({ ok: true, service: "ResearchOps API", time: new Date().toISOString() }), {
        status: 200, headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
      });
    }

    // ── Fail-safe endpoints used by /project-dashboard/ ──
    if (url.pathname === "/api/studies" && request.method === "GET") {
      return studiesJsonDirect(request, env, origin, url);
    }
    if (url.pathname === "/api/mural/verify" && request.method === "GET") {
      const stub = await muralVerifyDirect(request, env, origin, url);
      if (stub) return stub; // anon/misconfigured handled here
      // else fall through to service.mural.muralVerify for signed-in users
    }
    if (url.pathname === "/api/projects" && request.method === "GET") {
      return projectsJsonDirect(request, env, origin);
    }
    if (url.pathname === "/api/projects.csv" && request.method === "GET") {
      return projectsCsvDirect(request, env, origin);
    }

    // ── Everything else via service.js (dynamic import to avoid 1101 on init) ──
    let ResearchOpsService;
    try {
      ({ ResearchOpsService } = await import("./service.js"));
    } catch (e) {
      return new Response(json({ ok: false, error: "Service module load failed", detail: String(e?.message || e) }), {
        status: 500, headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
      });
    }

    const service = new ResearchOpsService(env);

    // Diagnostics
    if (url.pathname === "/api/_diag/airtable" && request.method === "GET") {
      return service.airtableProbe(origin, url);
    }

    // AI Assist
    if (url.pathname === "/api/ai-rewrite" && request.method === "POST") {
      return aiRewrite(request, env, origin);
    }

    // Project details CSV (reuses service utility)
    if (url.pathname === "/api/project-details.csv" && request.method === "GET") {
      return service.streamCsv(origin, env.GH_PATH_DETAILS);
    }

    // Journals
    if (url.pathname === "/api/journal-entries" && request.method === "GET") return service.listJournalEntries(origin, url);
    if (url.pathname === "/api/journal-entries" && request.method === "POST") return service.createJournalEntry(request, origin);
    if (url.pathname.startsWith("/api/journal-entries/")) {
      const entryId = decodeURIComponent(url.pathname.slice("/api/journal-entries/".length));
      if (request.method === "GET") return service.getJournalEntry(origin, entryId);
      if (request.method === "PATCH") return service.updateJournalEntry(request, origin, entryId);
      if (request.method === "DELETE") return service.deleteJournalEntry(origin, entryId);
    }

    // Excerpts
    if (url.pathname === "/api/excerpts" && request.method === "GET") return service.listExcerpts(origin, url);
    if (url.pathname === "/api/excerpts" && request.method === "POST") return service.createExcerpt(request, origin);
    if (url.pathname.startsWith("/api/excerpts/") && request.method === "PATCH") {
      const excerptId = decodeURIComponent(url.pathname.slice("/api/excerpts/".length));
      return service.updateExcerpt(request, origin, excerptId);
    }

    // Memos
    if (url.pathname === "/api/memos" && request.method === "GET") return service.listMemos(origin, url);
    if (url.pathname === "/api/memos" && request.method === "POST") return service.createMemo(request, origin);
    if (url.pathname.startsWith("/api/memos/") && request.method === "PATCH") {
      const memoId = decodeURIComponent(url.pathname.slice("/api/memos/".length));
      return service.updateMemo(request, origin, memoId);
    }

    // Code Applications
    if (url.pathname === "/api/code-applications" && request.method === "GET") return service.listCodeApplications(origin, url);

    // Codes
    if (url.pathname === "/api/codes" && request.method === "GET") return service.listCodes(origin, url);
    if (url.pathname === "/api/codes" && request.method === "POST") return service.createCode(request, origin);
    if (url.pathname.startsWith("/api/codes/") && request.method === "PATCH") {
      const codeId = decodeURIComponent(url.pathname.slice("/api/codes/".length));
      return (typeof service.updateCode === "function")
        ? service.updateCode(request, origin, codeId)
        : service.createCode(request, origin);
    }

    // Analysis
    if (url.pathname === "/api/analysis/timeline" && request.method === "GET") return service.timeline(origin, url);
    if (url.pathname === "/api/analysis/cooccurrence" && request.method === "GET") return service.cooccurrence(origin, url);
    if (url.pathname === "/api/analysis/retrieval" && request.method === "GET") return service.retrieval(origin, url);
    if (url.pathname === "/api/analysis/export" && request.method === "GET") return service.exportAnalysis(origin, url);

    // Studies (non-GET operations still through service)
    if (url.pathname === "/api/studies" && request.method === "POST") return service.createStudy(request, origin);
    if (url.pathname.startsWith("/api/studies/")) {
      const m = url.pathname.match(/^\/api\/studies\/([^/]+)$/);
      if (m && request.method === "PATCH") {
        const studyId = decodeURIComponent(m[1]);
        return service.updateStudy(request, origin, studyId);
      }
    }
    if (url.pathname === "/api/studies.csv" && request.method === "GET") {
      if (env.GH_PATH_STUDIES) return service.streamCsv(origin, env.GH_PATH_STUDIES);
    }

    // Guides
    if (url.pathname === "/api/guides" && request.method === "GET") return service.listGuides(origin, url);
    if (url.pathname === "/api/guides" && request.method === "POST") return service.createGuide(request, origin);
    if (url.pathname.startsWith("/api/guides/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 3) {
        const guideId = decodeURIComponent(parts[2]);
        if (request.method === "GET") return service.readGuide(origin, guideId);
        if (request.method === "PATCH") return service.updateGuide(request, origin, guideId);
      }
      if (parts.length === 4 && parts[3] === "publish" && request.method === "POST") {
        const guideId = decodeURIComponent(parts[2]);
        return service.publishGuide(origin, guideId);
      }
    }

    // Partials
    if (url.pathname === "/api/partials" && request.method === "GET") return service.listPartials(origin);
    if (url.pathname === "/api/partials" && request.method === "POST") return service.createPartial(request, origin);
    if (url.pathname.startsWith("/api/partials/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 3) {
        const partialId = decodeURIComponent(parts[2]);
        if (request.method === "GET") return service.readPartial(origin, partialId);
        if (request.method === "PATCH") return service.updatePartial(request, origin, partialId);
        if (request.method === "DELETE") return service.deletePartial(origin, partialId);
      }
    }

    // Participants
    if (url.pathname === "/api/participants" && request.method === "GET") {
      if (typeof service.listParticipants === "function") return service.listParticipants(origin, url);
    }
    if (url.pathname === "/api/participants" && request.method === "POST") {
      if (typeof service.createParticipant === "function") return service.createParticipant(request, origin);
    }

    // Sessions
    if (url.pathname === "/api/sessions" && request.method === "GET") {
      if (typeof service.listSessions === "function") return service.listSessions(origin, url);
    }
    if (url.pathname === "/api/sessions" && request.method === "POST") {
      if (typeof service.createSession === "function") return service.createSession(request, origin);
    }
    if (url.pathname.startsWith("/api/sessions/")) {
      const match = url.pathname.match(/^\/api\/sessions\/([^/]+)(\/ics)?$/);
      if (match) {
        const sessionId = decodeURIComponent(match[1]);
        const isIcs = match[2] === "/ics";
        if (request.method === "GET" && !isIcs) {
          if (typeof service.getSession === "function") return service.getSession(origin, sessionId);
        }
        if (request.method === "PATCH" && !isIcs) {
          if (typeof service.updateSession === "function") return service.updateSession(request, origin, sessionId);
        }
        if (request.method === "GET" && isIcs) {
          if (typeof service.sessionIcs === "function") return service.sessionIcs(origin, sessionId);
        }
      }
    }

    // Session Notes
    if (url.pathname === "/api/session-notes" && request.method === "GET") return service.listSessionNotes(origin, url);
    if (url.pathname === "/api/session-notes" && request.method === "POST") return service.createSessionNote(request, origin);
    if (url.pathname.startsWith("/api/session-notes/")) {
      const m = url.pathname.match(/^\/api\/session-notes\/([^/]+)$/);
      if (m && request.method === "PATCH") {
        const noteId = decodeURIComponent(m[1]);
        return service.updateSessionNote(request, origin, noteId);
      }
    }

    // Comms
    if (url.pathname === "/api/comms/send" && request.method === "POST") {
      if (typeof service.sendComms === "function") return service.sendComms(request, origin);
    }

    // Mural (signed-in flows fall here)
    if (url.pathname === "/api/mural/auth" && request.method === "GET") return service.mural.muralAuth(origin, url);
    if (url.pathname === "/api/mural/callback" && request.method === "GET") return service.mural.muralCallback(origin, url);
    if (url.pathname === "/api/mural/verify" && request.method === "GET") return service.mural.muralVerify(origin, url);
    if (url.pathname === "/api/mural/setup" && request.method === "POST") return service.mural.muralSetup(request, origin);
    if (url.pathname === "/api/mural/resolve" && request.method === "GET") return service.mural.muralResolve(origin, url);
    if (url.pathname === "/api/mural/find" && request.method === "GET") return service.mural.muralFind(origin, url);
    if (request.method === "POST" && url.pathname === "/api/mural/journal-sync") return service.mural.muralJournalSync(request, origin);
    if (url.pathname === "/api/mural/workspaces" && request.method === "GET") return service.mural.muralListWorkspaces(origin, url);
    if (url.pathname === "/api/mural/me" && request.method === "GET") return service.mural.muralMe(origin, url);
    if (url.pathname === "/api/mural/debug-env" && request.method === "GET") return service.mural.muralDebugEnv(origin);

    // Unknown API route
    if (url.pathname.startsWith("/api/")) {
      return new Response(json({ error: "Not found", path: url.pathname }), {
        status: 404, headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8" }
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
    // safety net: never leak thrown exception
    return new Response(json({ error: "Internal error", detail: String(e?.message || e) }), {
      status: 500, headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeadersForEnv(env, origin) }
    });
  }
}
