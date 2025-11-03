/**
 * Cloudflare Pages Functions proxy for `/api/*` → Worker API.
 * Set UPSTREAM_API in Pages → Settings → Variables (e.g. https://rops-api….workers.dev)
 */

/**
 * @param {import('@cloudflare/workers-types').Request} request
 * @param {{UPSTREAM_API?: string}} env
 * @param {{params: {path?: string[]}}} context
 */
export async function onRequest({ request, env, params: _params }) {
	if (!env.UPSTREAM_API) {
		return new Response(JSON.stringify({ ok: false, error: 'UPSTREAM_API not configured' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// CORS preflight (let Pages answer quickly)
	if (request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: corsHeaders(request.headers.get('Origin')),
		});
	}

	// Build upstream URL: <UPSTREAM_API>/api/<...path...>?<query>
	const inReqUrl = new URL(request.url);
	const upstreamBase = new URL(env.UPSTREAM_API);

	// Everything after '/api' from the incoming request
	const tailPath = inReqUrl.pathname.replace(/^\/api\/?/, ''); // e.g. 'studies'
	const cleanBasePath = upstreamBase.pathname.replace(/\/+$/, ''); // no trailing slash
	const upstreamPath = `${cleanBasePath}/api/${tailPath}`; // ensure single /api

	const outUrl = new URL(upstreamBase.origin + upstreamPath);
	outUrl.search = inReqUrl.search; // preserve ?query

	// Clone headers, but don’t forward Host; ensure we include browser Origin (for Worker CORS check)
	const fwdHeaders = new Headers(request.headers);
	fwdHeaders.delete('host');
	const browserOrigin = request.headers.get('Origin');
	if (browserOrigin) {
		fwdHeaders.set('Origin', browserOrigin);
	}

	// Forward method & body (no body for GET/HEAD)
	const init = {
		method: request.method,
		headers: fwdHeaders,
	};
	if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
		init.body = await request.arrayBuffer();
	}

	let upstreamResp;
	try {
		upstreamResp = await fetch(outUrl.toString(), init);
	} catch (err) {
		return new Response(
			JSON.stringify({ ok: false, error: 'Upstream fetch failed', detail: String(err) }),
			{
				status: 502,
				headers: { 'Content-Type': 'application/json', ...corsHeaders(browserOrigin) },
			},
		);
	}

	// Mirror upstream response with our CORS headers
	const respHeaders = new Headers(upstreamResp.headers);
	const cors = corsHeaders(browserOrigin);
	for (const [k, v] of Object.entries(cors)) respHeaders.set(k, v);

	return new Response(upstreamResp.body, {
		status: upstreamResp.status,
		headers: respHeaders,
	});
}

/**
 * Build permissive CORS headers for the calling Origin.
 * @param {string|null} origin
 */
function corsHeaders(origin) {
	return {
		'Access-Control-Allow-Origin': origin || '*',
		'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		Vary: 'Origin',
		'Access-Control-Max-Age': '86400',
	};
}
