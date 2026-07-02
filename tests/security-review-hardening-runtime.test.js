import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../infra/cloudflare/src/worker.js';

function createRoutePermissionD1() {
	const routePermissions = new Map();
	return {
		prepare(sql) {
			return {
				bind(...params) {
					return {
						async run() {
							if (String(sql).includes('INSERT OR IGNORE INTO auth_route_permissions')) {
								const [, method, routePattern, requiredPermissionsJson, authRequired] = params;
								routePermissions.set(`${method}:${routePattern}`, {
									method,
									route_pattern: routePattern,
									required_permissions_json: requiredPermissionsJson,
									auth_required: authRequired ?? 1,
									implementation_status: 'implemented',
								});
							}
							return { success: true };
						},
						async first() {
							if (String(sql).includes('FROM auth_route_permissions')) {
								const [method, routePattern] = params;
								return routePermissions.get(`${method}:${routePattern}`) || null;
							}
							return null;
						},
						async all() {
							return { results: [] };
						},
					};
				},
			};
		},
	};
}

test('Worker rejects cross-origin cookie mutations without CSRF confirmation', async () => {
	const response = await worker.fetch(
		new Request('https://rops-api.test/api/session-notes', {
			method: 'POST',
			headers: {
				Origin: 'https://researchops.pages.dev',
				Cookie: 'rops_session=session_token',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ session_airtable_id: 'recSession', content: 'Note' }),
		}),
		{
			ALLOWED_ORIGINS: 'https://researchops.pages.dev',
		},
		{}
	);

	assert.equal(response.status, 403);
	assert.equal((await response.json()).error, 'csrf_header_required');
});

test('Worker requires authentication before legacy fallback API routes reach services', async () => {
	const response = await worker.fetch(
		new Request('https://rops-api.test/api/session-notes?session=recSession', {
			headers: { Origin: 'https://researchops.pages.dev' },
		}),
		{
			ALLOWED_ORIGINS: 'https://researchops.pages.dev',
			RESEARCHOPS_D1: createRoutePermissionD1(),
		},
		{}
	);

	assert.equal(response.status, 401);
	assert.equal((await response.json()).error, 'authentication_required');
});

test('Worker sanitises internal error details from API 5xx responses', async () => {
	const response = await worker.fetch(
		new Request('https://rops-api.test/api/session-notes?session=recSession', {
			headers: { Origin: 'https://researchops.pages.dev' },
		}),
		{
			ALLOWED_ORIGINS: 'https://researchops.pages.dev',
			RESEARCHOPS_D1: {
				prepare() {
					return {
						bind() {
							return {
								async run() {
									throw new Error('internal database table name should not leak');
								},
							};
						},
					};
				},
			},
		},
		{}
	);

	assert.equal(response.status, 500);
	const body = await response.json();
	assert.equal(body.error, 'internal_error');
	assert.equal(Object.hasOwn(body, 'detail'), false);
	assert.equal(JSON.stringify(body).includes('database table name'), false);
});
