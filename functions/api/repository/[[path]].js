// functions/api/repository/[[path]].js
import { resolveAuthenticatedContext } from '../../../infra/cloudflare/src/core/auth/access-scoped.js';
import { assertRoutePermission } from '../../../infra/cloudflare/src/core/auth/route-permissions.js';
import { ResearchOpsService } from '../../../infra/cloudflare/src/service/index.js';

function allowedOrigins(env = {}) {
	const origins = Array.isArray(env.ALLOWED_ORIGINS) ? env.ALLOWED_ORIGINS.join(',') : String(env.ALLOWED_ORIGINS || '');
	return origins
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
}

function resolveAllowedOrigin(env = {}, origin = null, requestOrigin = '') {
	if (!origin) return '';
	if (requestOrigin && origin === requestOrigin) return origin;
	return allowedOrigins(env).includes(origin) ? origin : '';
}

function corsHeaders(env = {}, origin = null, requestOrigin = '') {
	const allowedOrigin = resolveAllowedOrigin(env, origin, requestOrigin);
	const headers = {
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ResearchOps-Team-Id',
		Vary: 'Origin',
	};
	if (allowedOrigin) {
		headers['Access-Control-Allow-Origin'] = allowedOrigin;
		headers['Access-Control-Allow-Credentials'] = 'true';
	}
	return headers;
}

function jsonResponse(body, status = 200, headers = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
			'x-content-type-options': 'nosniff',
			...headers,
		},
	});
}

function repositoryUnavailable(headers, status = 500) {
	return jsonResponse(
		{
			ok: false,
			error: 'repository_api_unavailable',
			message: 'Repository data could not be loaded. Try again or contact the ResearchOps team if the problem continues.',
		},
		status,
		headers,
	);
}

function routePermissionRequest(request, routePattern) {
	const url = new URL(request.url);
	url.pathname = routePattern;
	url.search = '';
	return new Request(url.toString(), { method: request.method, headers: request.headers });
}

function envCompat(env = {}) {
	const allowed = Array.isArray(env.ALLOWED_ORIGINS) ? env.ALLOWED_ORIGINS.join(',') : String(env.ALLOWED_ORIGINS || '');
	return { ...env, ALLOWED_ORIGINS: allowed };
}

export async function onRequest({ request, env }) {
	const origin = request.headers.get('Origin');
	const url = new URL(request.url);
	const pathname = url.pathname.replace(/\/+$/, '') || '/api/repository';
	const compatibleEnv = envCompat(env);
	const cors = corsHeaders(compatibleEnv, origin, url.origin);
	const crossOriginBlocked = Boolean(origin && !cors['Access-Control-Allow-Origin']);

	if (request.method === 'OPTIONS') {
		return crossOriginBlocked
			? jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, cors)
			: jsonResponse({}, 204, cors);
	}
	if (crossOriginBlocked) return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, cors);
	if (request.method !== 'GET') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, cors);

	try {
		const authContext = await resolveAuthenticatedContext(request, compatibleEnv);
		const service = new ResearchOpsService(compatibleEnv);
		const allowedOrigin = cors['Access-Control-Allow-Origin'] || '';

		if (pathname === '/api/repository' || pathname === '/api/repository/artefacts') {
			await assertRoutePermission(request, compatibleEnv, authContext);
			return service.listRepository(allowedOrigin, url, authContext);
		}

		const artefactMatch = pathname.match(/^\/api\/repository\/artefacts\/([^/]+)$/);
		if (artefactMatch) {
			await assertRoutePermission(routePermissionRequest(request, '/api/repository/artefacts/:id'), compatibleEnv, authContext);
			return service.readRepositoryArtefact(allowedOrigin, decodeURIComponent(artefactMatch[1]));
		}

		return jsonResponse({ ok: false, error: 'repository_route_not_found' }, 404, cors);
	} catch (error) {
		if (error?.status && error?.code) {
			return jsonResponse({ ok: false, error: error.code }, error.status, cors);
		}
		return repositoryUnavailable(cors);
	}
}
