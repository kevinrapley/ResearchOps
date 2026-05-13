import { resolveAuthenticatedContext as resolveBaseAuthenticatedContext } from './access.js';
import { assertRoutePermission, routePermissionErrorResponse } from './route-permissions.js';

const JSON_HEADERS = {
	'content-type': 'application/json; charset=utf-8',
	'cache-control': 'no-store',
	'x-content-type-options': 'nosniff',
};

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function dbFor(env = {}) {
	const db = env.RESEARCHOPS_D1;
	if (!db || typeof db.prepare !== 'function') return null;
	return db;
}

function permissionExists(permissions, code) {
	return (permissions || []).some((permission) => permission.code === code);
}

async function isResearchOpsCoreTeamAdmin(db, userId) {
	if (!db || !userId) return false;
	const row = await db
		.prepare(`
			SELECT ra.id
			FROM auth_role_assignments ra
			INNER JOIN auth_roles r ON r.id = ra.role_id
			INNER JOIN auth_teams t ON t.id = ra.scope_id
			WHERE ra.user_id = ?
				AND ra.scope_type = 'team'
				AND ra.assignment_status = 'active'
				AND r.role_key = 'team_admin'
				AND (t.id = 'team_researchops_core' OR t.name = 'ResearchOps Core Team')
				AND (ra.expires_at IS NULL OR ra.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			LIMIT 1
		`)
		.bind(userId)
		.first();
	return Boolean(row);
}

async function listAllActiveTeams(db) {
	if (!db) return [];
	const result = await db
		.prepare(`
			SELECT id, name
			FROM auth_teams
			WHERE team_status = 'active'
			ORDER BY name ASC
		`)
		.all();
	return result.results || [];
}

async function listTeamsManagedByUser(db, userId) {
	if (!db || !userId) return [];
	const result = await db
		.prepare(`
			SELECT DISTINCT t.id, t.name
			FROM auth_role_assignments ra
			INNER JOIN auth_role_permissions rp ON rp.role_id = ra.role_id
			INNER JOIN auth_permissions p ON p.code = rp.permission_code
			INNER JOIN auth_teams t ON t.id = ra.scope_id
			WHERE ra.user_id = ?
				AND ra.scope_type = 'team'
				AND ra.assignment_status = 'active'
				AND t.team_status = 'active'
				AND p.code = 'role.assign'
				AND (ra.expires_at IS NULL OR ra.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			ORDER BY t.name ASC
		`)
		.bind(userId)
		.all();
	return result.results || [];
}

function globalTeamAdminPermissions(permissions) {
	const next = [...(permissions || [])];
	for (const permission of [
		{
			code: 'team.manage',
			label: 'Manage team membership',
			description: 'Can manage team members and team settings.',
			sensitive: true,
			reserved: false,
		},
		{
			code: 'role.assign',
			label: 'Assign roles',
			description: 'Can assign or approve role access where policy permits.',
			sensitive: true,
			reserved: false,
		},
		{
			code: 'team.manage.global',
			label: 'Manage all teams',
			description: 'Can administer teams across ResearchOps through ResearchOps Core Team.',
			sensitive: true,
			reserved: false,
		},
		{
			code: 'role.assign.global',
			label: 'Assign roles across teams',
			description: 'Can assign roles across ResearchOps teams through ResearchOps Core Team.',
			sensitive: true,
			reserved: false,
		},
	]) {
		if (!permissionExists(next, permission.code)) next.push(permission);
	}
	return next;
}

export async function resolveAuthenticatedContext(request, env) {
	const baseContext = await resolveBaseAuthenticatedContext(request, env);
	const db = dbFor(env);
	const isCoreTeamAdmin = await isResearchOpsCoreTeamAdmin(db, baseContext?.user?.id);
	const memberTeams = baseContext.teams || [];
	const manageableTeams = isCoreTeamAdmin ? await listAllActiveTeams(db) : await listTeamsManagedByUser(db, baseContext?.user?.id);

	return {
		...baseContext,
		isResearchOpsCoreTeamAdmin: isCoreTeamAdmin,
		memberTeams,
		manageableTeams,
		roleAssignableTeams: manageableTeams,
		teams: manageableTeams,
		permissions: isCoreTeamAdmin ? globalTeamAdminPermissions(baseContext.permissions) : baseContext.permissions,
	};
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
		} catch {
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
}
