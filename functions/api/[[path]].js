/**
 * Cloudflare Pages Function proxy for /api/* → Worker API.
 * Set UPSTREAM_API in Pages env, e.g. https://rops-api.digikev-kevin-rapley.workers.dev
 */
export async function onRequest(context) {
  const { request, env, params } = context;

  if (!env.UPSTREAM_API) {
    return new Response(JSON.stringify({ ok: false, error: "UPSTREAM_API not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Vary": "Origin",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  // Build upstream URL: /api/<rest>?<query>
  const inUrl = new URL(request.url);
  inUrl.pathname = "/api/" + params.path.join("/");
  const rest = typeof params.path === "string" ? params.path : "";
  const target = new URL(`/api/${rest}${inUrl.search}`, env.UPSTREAM_API);

  const outHeaders = new Headers();
  const ct = request.headers.get("content-type");
  if (ct) outHeaders.set("content-type", ct);
  const auth = request.headers.get("authorization");
  if (auth) outHeaders.set("authorization", auth);

  const method = request.method.toUpperCase();
  const init = { method, headers: outHeaders };
  if (!["GET", "HEAD"].includes(method)) {
    init.body = await request.arrayBuffer();
  }

  let res;
  try {
    res = await fetch(target.toString(), init);
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: "Upstream fetch failed",
      detail: String(err?.message || err),
      _proxy: { target: target.toString() }
    }), { status: 502, headers: { "Content-Type": "application/json" } });
  }

  const hdrs = new Headers(res.headers);
  hdrs.set("Access-Control-Allow-Origin", inUrl.origin);
  hdrs.set("Vary", "Origin");
  hdrs.set("X-Proxy-Target", target.toString());
  hdrs.set("X-Proxy-Upstream-Status", String(res.status));

  return new Response(res.body, { status: res.status, headers: hdrs });
}
