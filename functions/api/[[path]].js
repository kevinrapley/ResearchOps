/**
 * Cloudflare Pages Function: proxy /api/* to your Worker API.
 *
 * Env var required on Pages:
 *   UPSTREAM_API = https://rops-api.digikev-kevin-rapley.workers.dev
 */
export async function onRequest(context) {
  const { request, env, params, next } = context;
  const upstream = env.UPSTREAM_API;
  if (!upstream) {
    return new Response('UPSTREAM_API not configured', { status: 500 });
  }

  // Handle CORS preflight at the Pages edge (same-origin for the browser)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Vary': 'Origin',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // Rebuild target URL: /api/<rest>?<query>
  const url = new URL(request.url);
  const rest = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');
  const target = new URL(`/api/${rest}`, upstream);
  target.search = url.search; // preserve query string

  // Clone request: pass method/body + safe headers
  const hopByHop = new Set([
    'connection','keep-alive','proxy-authenticate','proxy-authorization',
    'te','trailers','transfer-encoding','upgrade'
  ]);
  const outHeaders = new Headers();
  for (const [k, v] of request.headers) {
    const lk = k.toLowerCase();
    if (hopByHop.has(lk)) continue;
    // Preserve basics only
    if (['content-type', 'authorization'].includes(lk)) outHeaders.set(k, v);
  }

  // Only include a body for methods that support it
  const method = request.method.toUpperCase();
  const init = { method, headers: outHeaders };
  if (!['GET','HEAD'].includes(method)) init.body = await request.arrayBuffer();

  // Fetch the Worker
  const res = await fetch(target.toString(), init);

  // Pass response back; adjust CORS for the browser (same-origin to Pages)
  const resHeaders = new Headers(res.headers);
  resHeaders.set('Access-Control-Allow-Origin', url.origin);
  resHeaders.set('Vary', 'Origin');

  return new Response(res.body, {
    status: res.status,
    headers: resHeaders
  });
}
