/**
 * Cloudflare Pages Function proxy for /api/* → your Worker API.
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

  // Preflight
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
  const rest = typeof params.path === "string" ? params.path : "";
  const target = new URL(`/api/${rest}`, env.UPSTREAM_API);
  target.search = inUrl.search;

  // Copy allowed headers + body when needed
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

  // Fetch upstream
  let res;
  try {
    res = await fetch(target.toString(), init);
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: "Upstream fetch failed",
      detail: String(err?.message || err),
      _proxy: { target: target.toString() }
    }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Bubble up JSON body on non-2xx for easier debugging
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return new Response(text || JSON.stringify({
      ok: false,
      error: "Upstream returned non-2xx",
      status: res.status,
      _proxy: { target: target.toString() }
    }), {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": inUrl.origin,
        "Vary": "Origin",
        "X-Proxy-Target": target.toString(),
        "X-Proxy-Upstream-Status": String(res.status)
      }
    });
  }

  // Pass through on success
  const hdrs = new Headers(res.headers);
  hdrs.set("Access-Control-Allow-Origin", inUrl.origin);
  hdrs.set("Vary", "Origin");
  hdrs.set("X-Proxy-Target", target.toString());
  hdrs.set("X-Proxy-Upstream-Status", String(res.status));
  return new Response(res.body, { status: res.status, headers: hdrs });
}
