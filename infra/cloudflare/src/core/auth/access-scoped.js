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

function mapRole(row) {
	return {
		key: row.role_key,
		label: row.label,
		description: row.description,
		sensitive: row.is_sensitive === 1,
		scopeType: row.scope_type,
		scopeId: row.scope_id,
		expiresAt: row.expires_at,
	};
}

function mapPermission(row) {
	return {
		code: row.code,
		label: row.label,
		description: row.description,
		sensitive: row.is_sensitive === 1,
		reserved: row.is_reserved === 1,
	};
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

async function listMembershipTeams(db, userId) {
	if (!db || !userId) return [];
	const result = await db
		.prepare(`
			SELECT
				t.id,
				t.name,
				m.membership_status AS membershipStatus,
				m.created_at AS membershipCreatedAt,
				'membership' AS membershipSource
			FROM auth_team_memberships m
			INNER JOIN auth_teams t ON t.id = m.team_id
			WHERE m.user_id = ?
				AND m.membership_status = 'active'
				AND t.team_status = 'active'
			ORDER BY t.name ASC
		`)
		.bind(userId)
		.all();
	return result.results || [];
}

async function listRoleAssignmentTeams(db, userId) {
	if (!db || !userId) return [];
	const result = await db
		.prepare(`
			SELECT DISTINCT
				t.id,
				t.name,
				'active' AS membershipStatus,
				MIN(ra.created_at) AS membershipCreatedAt,
				'role_assignment' AS membershipSource
			FROM auth_role_assignments ra
			INNER JOIN auth_teams t ON t.id = ra.scope_id
			WHERE ra.user_id = ?
				AND ra.scope_type = 'team'
				AND ra.assignment_status = 'active'
				AND t.team_status = 'active'
				AND (ra.expires_at IS NULL OR ra.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			GROUP BY t.id, t.name
			ORDER BY t.name ASC
		`)
		.bind(userId)
		.all();
	return result.results || [];
}

async function listRolesForTeam(db, userId, teamId) {
	if (!db || !userId || !teamId) return [];
	const result = await db
		.prepare(`
			SELECT r.role_key, r.label, r.description, r.is_sensitive, ra.scope_type, ra.scope_id, ra.expires_at
			FROM auth_role_assignments ra
			INNER JOIN auth_roles r ON r.id = ra.role_id
			WHERE ra.user_id = ?
				AND ra.scope_type = 'team'
				AND ra.scope_id = ?
				AND ra.assignment_status = 'active'
				AND (ra.expires_at IS NULL OR ra.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			ORDER BY r.label ASC
		`)
		.bind(userId, teamId)
		.all();
	return (result.results || []).map(mapRole);
}

async function listPermissionsForTeam(db, userId, teamId) {
	if (!db || !userId || !teamId) return [];
	const result = await db
		.prepare(`
			SELECT DISTINCT p.code, p.label, p.description, p.is_sensitive, p.is_reserved
			FROM auth_role_assignments ra
			INNER JOIN auth_role_permissions rp ON rp.role_id = ra.role_id
			INNER JOIN auth_permissions p ON p.code = rp.permission_code
			WHERE ra.user_id = ?
				AND ra.scope_type = 'team'
				AND ra.scope_id = ?
				AND ra.assignment_status = 'active'
				AND (ra.expires_at IS NULL OR ra.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			UNION
			SELECT DISTINCT p.code, p.label, p.description, p.is_sensitive, p.is_reserved
			FROM auth_permission_exceptions e
			INNER JOIN auth_permissions p ON p.code = e.permission_code
			WHERE e.user_id = ?
				AND e.scope_type = 'team'
				AND e.scope_id = ?
				AND e.exception_status = 'active'
				AND e.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			ORDER BY code ASC
		`)
		.bind(userId, teamId, userId, teamId)
		.all();
	return (result.results || []).map(mapPermission);
}

function combineTeamSources(membershipTeams, roleAssignmentTeams) {
	const byId = new Map();
	for (const team of roleAssignmentTeams || []) {
		if (team?.id) byId.set(team.id, team);
	}
	for (const team of membershipTeams || []) {
		if (team?.id) byId.set(team.id, team);
	}
	return [...byId.values()].sort((first, second) => String(first.name || '').localeCompare(String(second.name || '')));
}

async function buildMemberTeams(db, userId) {
	if (!db || !userId) return [];
	const membershipTeams = await listMembershipTeams(db, userId);
	const roleAssignmentTeams = await listRoleAssignmentTeams(db, userId);
	const teams = combineTeamSources(membershipTeams, roleAssignmentTeams);
	const enrichedTeams = [];

	for (const team of teams) {
		const roles = await listRolesForTeam(db, userId, team.id);
		const permissions = await listPermissionsForTeam(db, userId, team.id);
		enrichedTeams.push({ ...team, roles, permissions });
	}

	return enrichedTeams;
}

function selectActiveTeamFromMemberships(baseActiveTeam, memberTeams) {
	if (baseActiveTeam?.id && memberTeams.some((team) => team.id === baseActiveTeam.id)) return baseActiveTeam;
	return memberTeams[0] ? { id: memberTeams[0].id, name: memberTeams[0].name } : null;
}

function rolesForActiveTeam(baseRoles, activeTeam, memberTeams) {
	const team = activeTeam?.id ? memberTeams.find((candidate) => candidate.id === activeTeam.id) : null;
	return team?.roles || baseRoles || [];
}

function permissionsForActiveTeam(basePermissions, activeTeam, memberTeams) {
	const team = activeTeam?.id ? memberTeams.find((candidate) => candidate.id === activeTeam.id) : null;
	return team?.permissions || basePermissions || [];
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
	const memberTeams = await buildMemberTeams(db, baseContext?.user?.id);
	const activeTeam = selectActiveTeamFromMemberships(baseContext.activeTeam, memberTeams);
	const isCoreTeamAdmin = await isResearchOpsCoreTeamAdmin(db, baseContext?.user?.id);
	const manageableTeams = isCoreTeamAdmin ? await listAllActiveTeams(db) : await listTeamsManagedByUser(db, baseContext?.user?.id);
	const activeTeamRoles = rolesForActiveTeam(baseContext.roles, activeTeam, memberTeams);
	const activeTeamPermissions = permissionsForActiveTeam(baseContext.permissions, activeTeam, memberTeams);

	return {
		...baseContext,
		activeTeam,
		roles: activeTeamRoles,
		permissions: isCoreTeamAdmin ? globalTeamAdminPermissions(activeTeamPermissions) : activeTeamPermissions,
		isResearchOpsCoreTeamAdmin: isCoreTeamAdmin,
		memberTeams,
		teamMemberships: memberTeams,
		manageableTeams,
		roleAssignableTeams: manageableTeams,
		teams: manageableTeams,
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
		if (error?.status && error?.code) {
			return jsonResponse({ ok: false, error: error.code, message: error.message }, error.status);
		}

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
