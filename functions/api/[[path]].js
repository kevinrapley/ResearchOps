const PREVIEW_API_ORIGIN = 'https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev';
const PRODUCTION_API_ORIGIN = 'https://rops-api.digikev-kevin-rapley.workers.dev';
const PRODUCTION_PAGES_HOST = 'researchops.pages.dev';

function isPagesPreviewHost(hostname) {
	return hostname.endsWith('.researchops.pages.dev') && hostname !== PRODUCTION_PAGES_HOST;
}

function upstreamApiFor(request, env = {}) {
	if (env.UPSTREAM_API) return env.UPSTREAM_API;
	if (env.RESEARCHOPS_API_ORIGIN) return env.RESEARCHOPS_API_ORIGIN;

	const hostname = new URL(request.url).hostname;
	if (isPagesPreviewHost(hostname)) return PREVIEW_API_ORIGIN;
	return PRODUCTION_API_ORIGIN;
}

function corsHeaders(origin) {
	return {
		'Access-Control-Allow-Origin': origin || '*',
		'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ResearchOps-Team-Id',
		'Access-Control-Allow-Credentials': 'true',
		Vary: 'Origin',
		'Access-Control-Max-Age': '86400',
	};
}

function buildUpstreamUrl(request, env) {
	const inReqUrl = new URL(request.url);
	const upstreamBase = new URL(upstreamApiFor(request, env));
	const tailPath = inReqUrl.pathname.replace(/^\/api\/?/, '');
	const cleanBasePath = upstreamBase.pathname.replace(/\/+$/, '');
	const tailSegment = tailPath ? `/${tailPath}` : '';
	const normalizedBasePath = cleanBasePath.toLowerCase();
	let upstreamPath;

	if (normalizedBasePath.endsWith('/api') || normalizedBasePath.includes('/api/')) {
		upstreamPath = `${cleanBasePath}${tailSegment}`;
	} else {
		upstreamPath = `${cleanBasePath}/api${tailSegment}`;
	}

	if (!upstreamPath.startsWith('/')) {
		upstreamPath = `/${upstreamPath.replace(/^\/+/, '')}`;
	}

	const outUrl = new URL(upstreamBase.origin + upstreamPath);
	outUrl.search = inReqUrl.search;
	return outUrl;
}

function forwardedHeaders(request) {
	const headers = new Headers(request.headers);
	headers.delete('host');
	headers.delete('cf-connecting-ip');
	headers.delete('cf-ipcountry');
	headers.delete('cf-ray');
	headers.delete('cf-visitor');
	return headers;
}

function jsonResponse(body, status = 200, origin = null) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
			'x-content-type-options': 'nosniff',
			'x-researchops-api-proxy': 'pages-function',
			...corsHeaders(origin),
		},
	});
}

export async function onRequest({ request, env }) {
	const method = request.method.toUpperCase();
	const origin = request.headers.get('Origin');

	if (method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: corsHeaders(origin),
		});
	}

	try {
		const targetUrl = buildUpstreamUrl(request, env);
		const response = await fetch(targetUrl.toString(), {
			method,
			headers: forwardedHeaders(request),
			body: method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer(),
			redirect: 'manual',
		});

		const headers = new Headers(response.headers);
		headers.set('cache-control', 'no-store');
		headers.set('x-content-type-options', 'nosniff');
		headers.set('x-researchops-api-proxy', 'pages-function');
		headers.set('x-researchops-api-upstream', targetUrl.origin);
		for (const [key, value] of Object.entries(corsHeaders(origin))) headers.set(key, value);

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	} catch (error) {
		return jsonResponse(
			{
				ok: false,
				error: 'api_proxy_error',
				message: 'ResearchOps could not contact the sign-in service.',
				detail: String(error?.message || error),
			},
			502,
			origin,
		);
	}
}
