import { resolveAuthenticatedContext as resolveAccessAuthenticatedContext } from './access.js';
import { resolvePasswordlessSessionContext } from './passwordless.js';
import {
	assertRoutePermission,
	routePermissionErrorResponse,
} from './route-permissions.js';

const JSON_HEADERS = {
	'content-type': 'application/json; charset=utf-8',
	'cache-control': 'no-store',
	'x-content-type-options': 'nosniff',
};

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function resolveAuthenticatedContext(request, env) {
	const passwordlessContext = await resolvePasswordlessSessionContext(request, env);
	if (passwordlessContext) return passwordlessContext;
	return resolveAccessAuthenticatedContext(request, env);
}

export async function handleMeRoute(request, env, apiPath) {
	try {
		const context = await resolveAuthenticatedContext(request, env);
		await assertRoutePermission(request, env, context);

		if (apiPath === '/api/me/permissions') {
			return jsonResponse({
				ok: true,
				authenticated: true,
				user: context.user,
				activeTeam: context.activeTeam,
				permissions: context.permissions,
			});
		}

		return jsonResponse({ ok: true, ...context });
	} catch (error) {
		try {
			return routePermissionErrorResponse(error);
		} catch {}

		if (error?.status && error?.code) {
			return jsonResponse({ ok: false, error: error.code, message: error.message }, error.status);
		}

		return jsonResponse(
			{
				ok: false,
				error: 'authentication_error',
				message: 'Authentication could not be completed.',
			},
			500,
		);
	}
}
