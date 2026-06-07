// functions/api/repository/[[path]].js
import { resolveAuthenticatedContext } from '../../../infra/cloudflare/src/core/auth/access-scoped.js';
import { assertRoutePermission } from '../../../infra/cloudflare/src/core/auth/route-permissions.js';
import { ResearchOpsService } from '../../../infra/cloudflare/src/service/index.js';

function jsonResponse(body, status = 200, origin = null) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
			'x-content-type-options': 'nosniff',
			'Access-Control-Allow-Origin': origin || '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ResearchOps-Team-Id',
			'Access-Control-Allow-Credentials': 'true',
			Vary: 'Origin',
		},
	});
}

function repositoryUnavailable(origin, status = 500) {
	return jsonResponse(
		{
			ok: false,
			error: 'repository_api_unavailable',
			message: 'Repository data could not be loaded. Try again or contact the ResearchOps team if the problem continues.',
		},
		status,
		origin,
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

	if (request.method === 'OPTIONS') return jsonResponse({}, 204, origin);
	if (request.method !== 'GET') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, origin);

	try {
		const compatibleEnv = envCompat(env);
		const authContext = await resolveAuthenticatedContext(request, compatibleEnv);
		const service = new ResearchOpsService(compatibleEnv);

		if (pathname === '/api/repository' || pathname === '/api/repository/artefacts') {
			await assertRoutePermission(request, compatibleEnv, authContext);
			return service.listRepository(origin, url, authContext);
		}

		const artefactMatch = pathname.match(/^\/api\/repository\/artefacts\/([^/]+)$/);
		if (artefactMatch) {
			await assertRoutePermission(routePermissionRequest(request, '/api/repository/artefacts/:id'), compatibleEnv, authContext);
			return service.readRepositoryArtefact(origin, decodeURIComponent(artefactMatch[1]));
		}

		return jsonResponse({ ok: false, error: 'repository_route_not_found' }, 404, origin);
	} catch (error) {
		if (error?.status && error?.code) {
			return jsonResponse({ ok: false, error: error.code }, error.status, origin);
		}
		return repositoryUnavailable(origin);
	}
}
