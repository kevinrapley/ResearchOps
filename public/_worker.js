const PREVIEW_API_ORIGIN = 'https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev';
const PRODUCTION_API_ORIGIN = 'https://rops-api.digikev-kevin-rapley.workers.dev';

function apiOriginFor(request, env = {}) {
	if (env.RESEARCHOPS_API_ORIGIN) return env.RESEARCHOPS_API_ORIGIN;
	if (env.UPSTREAM_API) return env.UPSTREAM_API;

	const hostname = new URL(request.url).hostname;
	if (hostname === 'fix-team-admin-sign-in-journ.researchops.pages.dev') {
		return PREVIEW_API_ORIGIN;
	}

	return PRODUCTION_API_ORIGIN;
}

function apiTargetUrl(request, env) {
	const source = new URL(request.url);
	const base = new URL(apiOriginFor(request, env));
	const path = source.pathname.startsWith('/api/') || source.pathname === '/api'
		? source.pathname
		: `/api${source.pathname.startsWith('/') ? source.pathname : `/${source.pathname}`}`;
	const target = new URL(path + source.search, base.origin);
	return target.toString();
}

function requestHeaders(request) {
	const headers = new Headers(request.headers);
	headers.delete('host');
	headers.delete('cf-connecting-ip');
	headers.delete('cf-ipcountry');
	headers.delete('cf-ray');
	headers.delete('cf-visitor');
	return headers;
}

function proxiedResponseHeaders(response) {
	const headers = new Headers(response.headers);
	headers.delete('access-control-allow-origin');
	headers.delete('access-control-allow-credentials');
	headers.delete('access-control-allow-methods');
	headers.delete('access-control-allow-headers');
	headers.delete('vary');
	headers.set('cache-control', 'no-store');
	headers.set('x-content-type-options', 'nosniff');
	return headers;
}

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
			'x-content-type-options': 'nosniff',
		},
	});
}

async function proxyApiRequest(request, env) {
	const method = request.method.toUpperCase();
	const response = await fetch(apiTargetUrl(request, env), {
		method,
		headers: requestHeaders(request),
		body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
		redirect: 'manual',
	});

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: proxiedResponseHeaders(response),
	});
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
			try {
				return await proxyApiRequest(request, env);
			} catch (error) {
				return jsonResponse(
					{
						ok: false,
						error: 'api_proxy_error',
						message: 'ResearchOps could not contact the sign-in service.',
						detail: String(error?.message || error),
					},
					502,
				);
			}
		}

		return env.ASSETS.fetch(request);
	},
};
