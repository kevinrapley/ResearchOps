import { getAssetFromKV } from "@cloudflare/kv-asset-handler";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // If this is an API call, route to handleApi
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, ctx);
    }

    // Otherwise serve static files from /public
    try {
      return await getAssetFromKV({ request, waitUntil: ctx.waitUntil.bind(ctx) });
    } catch (e) {
      return new Response("Not found", { status: 404 });
    }
  }
};

async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim());

  // --- CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin, allowed) });
  }

  // --- Enforce CORS allowlist
  if (origin && !allowed.includes(origin)) {
    return json({ error: "Origin not allowed" }, 403, corsHeaders(origin, allowed));
  }

  // --- Health check
  if (url.pathname === "/api/health") {
    return json({ ok: true, time: new Date().toISOString() }, 200, corsHeaders(origin, allowed));
  }

  // --- POST /api/projects
  if (url.pathname === "/api/projects" && request.method === "POST") {
    // … your Airtable logic unchanged …
  }

  // --- GET /api/projects.csv
  if (url.pathname === "/api/projects.csv" && request.method === "GET") {
    // … your SharePoint proxy logic unchanged …
  }

  // --- Fallback
  return json({ error: "Not found" }, 404, corsHeaders(origin, allowed));
}

// ---------- helpers ----------
function corsHeaders(origin, allowed) { … }
function json(body, status = 200, headers = {}) { … }
function safeText(t) { … }
