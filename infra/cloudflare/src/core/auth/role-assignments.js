import { resolveAuthenticatedContext } from "./access.js";
import { assertRoutePermission, routePermissionErrorResponse } from "./route-permissions.js";

const JSON_HEADERS = {
	"content-type": "application/json; charset=utf-8",
	"cache-control": "no-store",
	"x-content-type-options": "nosniff",
};

const CREATE_TEAM_ACTION = "create";

class RoleAssignmentError extends Error {
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function dbFor(env = {}) {
	const db = env.RESEARCHOPS_D1;
	if (!db || typeof db.prepare !== "function") {
		throw new RoleAssignmentError(
			503,
			"role_assignment_store_unavailable",
			"Role assignments cannot be changed right now."
		);
	}
	return db;
}

function makeId(prefix) {
	return `${prefix}_${crypto.randomUUID()}`;
}

function stableHash(value) {
	let hash = 2166136261;
	for (const char of String(value)) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableAssignmentId(userId, roleId, teamId) {
	return `asn_${stableHash(`${userId}:${roleId}:${teamId}`)}`;
}

function stableMembershipId(userId, teamId) {
	return `mem_${stableHash(`${userId}:${teamId}`)}`;
}

function normaliseEmail(email) {
	return String(email || "")
		.trim()
		.toLowerCase();
}

function cleanText(value) {
	return String(value || "").trim();
}

function cleanSingleLine(value) {
	return cleanText(value).replace(/\s+/g, " ");
}

async function readJson(request) {
	try {
		const body = await request.json();
		if (!body || typeof body !== "object" || Array.isArray(body)) {
			throw new RoleAssignmentError(400, "invalid_request_body", "Request body must be a JSON object.");
		}
		return body;
	} catch (error) {
		if (error instanceof RoleAssignmentError) throw error;
		throw new RoleAssignmentError(400, "invalid_json", "Request body must be valid JSON.");
	}
}

function targetSelectorFor(body) {
	const targetUserId = cleanText(body.targetUserId);
	const targetEmail = normaliseEmail(body.targetEmail);

	if (!targetUserId && !targetEmail) {
		throw new RoleAssignmentError(
			400,
			"target_required",
			"Provide targetUserId or targetEmail for the user receiving the role."
		);
	}

	return { targetUserId, targetEmail };
}

function requestedRoleKeyFor(body) {
	const roleKey = cleanText(body.roleKey);
	if (!roleKey) {
		throw new RoleAssignmentError(400, "role_required", "Provide roleKey for the role to assign.");
	}
	return roleKey;
}

function requestedReasonFor(body) {
	const requestedReason = cleanText(body.requestedReason);
	if (requestedReason.length < 12) {
		throw new RoleAssignmentError(
			400,
			"role_assignment_reason_required",
			"Provide a clear reason for assigning this role."
		);
	}
	return requestedReason;
}

function requestedTeamIdFor(body, context) {
	const teamId = cleanText(body.teamId || context.activeTeam?.id);
	if (!teamId) {
		throw new RoleAssignmentError(
			403,
			"active_team_required",
			"Choose an active team before assigning roles."
		);
	}
	return teamId;
}

function requestedNewTeamNameFor(body) {
	const name = cleanSingleLine(body.newTeamName);
	if (name.length < 3) {
		throw new RoleAssignmentError(400, "new_team_name_required", "Provide a team name of at least 3 characters.");
	}
	if (name.length > 80) {
		throw new RoleAssignmentError(400, "new_team_name_too_long", "Team names must be 80 characters or fewer.");
	}
	return name;
}

function newTeamReasonFor(body) {
	return cleanText(body.newTeamReason);
}

function isCreateTeamRequest(body) {
	return cleanText(body.teamAction) === CREATE_TEAM_ACTION;
}

function expiresAtFor(body) {
	const expiresAt = cleanText(body.expiresAt);
	if (!expiresAt) return null;

	const parsed = Date.parse(expiresAt);
	if (Number.isNaN(parsed)) {
		throw new RoleAssignmentError(
			400,
			"invalid_expiry",
			"expiresAt must be an ISO-8601 date-time when provided."
		);
	}

	return new Date(parsed).toISOString();
}

function permissionCodes(context) {
	return new Set((context.permissions || []).map((permission) => permission.code).filter(Boolean));
}

function assertCanCreateTeam(context) {
	const permissions = permissionCodes(context);
	if (!permissions.has("team.manage") || !permissions.has("role.assign")) {
		throw new RoleAssignmentError(403, "team_creation_forbidden", "You do not have permission to create teams.");
	}
}

function assertTeamAvailableToAssigner(context, teamId) {
	const team = (context.teams || []).find((candidate) => candidate.id === teamId);
	if (!team) {
		throw new RoleAssignmentError(403, "team_not_available", "You cannot assign roles in that team.");
	}
	return team;
}

async function canAssignRolesInTeam(db, userId, teamId) {
	const row = await db
		.prepare(`
			SELECT p.code
			FROM auth_role_assignments ra
			INNER JOIN auth_role_permissions rp ON rp.role_id = ra.role_id
			INNER JOIN auth_permissions p ON p.code = rp.permission_code
			WHERE ra.user_id = ?
				AND ra.scope_type = 'team'
				AND ra.scope_id = ?
				AND ra.assignment_status = 'active'
				AND p.code = 'role.assign'
				AND (ra.expires_at IS NULL OR ra.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			LIMIT 1
		`)
		.bind(userId, teamId)
		.first();
	return Boolean(row);
}

async function readActiveTeamByName(db, teamName) {
	return db
		.prepare(`
			SELECT id, name
			FROM auth_teams
			WHERE lower(name) = lower(?) AND team_status = 'active'
			LIMIT 1
		`)
		.bind(teamName)
		.first();
}

async function readTeamAdminRole(db) {
	return db
		.prepare(`
			SELECT id, role_key, label
			FROM auth_roles
			WHERE role_key = 'team_admin'
			LIMIT 1
		`)
		.first();
}

function prepareCreateTeamStatement(db, team) {
	return db
		.prepare(`
			INSERT INTO auth_teams (id, name, team_status)
			VALUES (?, ?, 'active')
		`)
		.bind(team.id, team.name);
}

function prepareAdminMembershipStatement(db, context, team) {
	return db
		.prepare(`
			INSERT INTO auth_team_memberships (id, user_id, team_id, membership_status)
			VALUES (?, ?, ?, 'active')
			ON CONFLICT(user_id, team_id) DO UPDATE SET
				membership_status = 'active',
				removed_at = NULL
		`)
		.bind(stableMembershipId(context.user.id, team.id), context.user.id, team.id);
}

function prepareAdminRoleAssignmentStatement(db, context, team, teamAdminRole, requestedReason) {
	return db
		.prepare(`
			INSERT INTO auth_role_assignments
				(id, user_id, role_id, scope_type, scope_id, assignment_status, requested_reason, approved_by_user_id, approved_at, expires_at)
			VALUES (?, ?, ?, 'team', ?, 'active', ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL)
			ON CONFLICT(user_id, role_id, scope_type, scope_id) DO UPDATE SET
				assignment_status = 'active',
				requested_reason = excluded.requested_reason,
				approved_by_user_id = excluded.approved_by_user_id,
				approved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
				updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		`)
		.bind(
			stableAssignmentId(context.user.id, teamAdminRole.id, team.id),
			context.user.id,
			teamAdminRole.id,
			team.id,
			requestedReason,
			context.user.id
		);
}

function prepareTeamCreationAuditStatement(db, request, context, team, reason) {
	const url = new URL(request.url);
	return db
		.prepare(`
			INSERT INTO auth_audit_events
				(id, event_type, actor_user_id, team_id, target_type, target_id, permission_code, route_path, outcome, is_safeguarding, metadata_json)
			VALUES (?, 'auth.team.created', ?, ?, 'auth_team', ?, 'team.manage', ?, 'succeeded', 0, json_object(
				'team_name', ?,
				'reason', ?
			))
		`)
		.bind(makeId("audit"), context.user.id, team.id, team.id, url.pathname, team.name, reason || null);
}

async function buildNewAssignmentTeam(db, request, context, body) {
	assertCanCreateTeam(context);
	const teamName = requestedNewTeamNameFor(body);
	const existingTeam = await readActiveTeamByName(db, teamName);
	if (existingTeam) {
		throw new RoleAssignmentError(409, "team_name_already_exists", "A team with this name already exists.");
	}

	const teamAdminRole = await readTeamAdminRole(db);
	if (!teamAdminRole) {
		throw new RoleAssignmentError(503, "team_admin_role_unavailable", "ResearchOps cannot create a team right now.");
	}

	const team = {
		id: makeId("team"),
		name: teamName,
		created: true,
	};
	const reason = newTeamReasonFor(body);
	const adminReason = reason || `Created team ${teamName}`;

	team.preAssignmentStatements = [
		prepareCreateTeamStatement(db, team),
		prepareAdminMembershipStatement(db, context, team),
		prepareAdminRoleAssignmentStatement(db, context, team, teamAdminRole, adminReason),
		prepareTeamCreationAuditStatement(db, request, context, team, reason),
	];

	return team;
}

async function resolveExistingAssignmentTeam(db, context, body) {
	const teamId = requestedTeamIdFor(body, context);
	const team = assertTeamAvailableToAssigner(context, teamId);
	const allowed = await canAssignRolesInTeam(db, context.user.id, team.id);
	if (!allowed) {
		throw new RoleAssignmentError(
			403,
			"selected_team_role_assignment_forbidden",
			"You do not have permission to assign roles in that team."
		);
	}
	return { ...team, created: false, preAssignmentStatements: [] };
}

async function resolveAssignmentTeam(db, request, context, body) {
	if (isCreateTeamRequest(body)) {
		return buildNewAssignmentTeam(db, request, context, body);
	}
	return resolveExistingAssignmentTeam(db, context, body);
}

function assertSensitiveRoleConfirmation(role, body) {
	const roleKey = role.role_key;
	const roleIsSensitive = role.is_sensitive === 1 || role.approval_required === 1;
	if (!roleIsSensitive) return;

	if (body.sensitiveRoleConfirmation !== "ASSIGN_SENSITIVE_ROLE") {
		throw new RoleAssignmentError(
			400,
			"sensitive_role_confirmation_required",
			"Confirm that this sensitive role assignment is intentional."
		);
	}

	if (roleKey === "safeguarding_lead" && body.safeguardingConfirmation !== "ASSIGN_SAFEGUARDING_LEAD") {
		throw new RoleAssignmentError(
			400,
			"safeguarding_role_confirmation_required",
			"Confirm that safeguarding lead access is intentionally required."
		);
	}
}

async function readRole(db, roleKey) {
	return db
		.prepare(`
			SELECT id, role_key, label, description, is_sensitive, approval_required, default_expiry_days
			FROM auth_roles
			WHERE role_key = ?
			LIMIT 1
		`)
		.bind(roleKey)
		.first();
}

async function readUserById(db, targetUserId) {
	if (!targetUserId) return null;
	return db
		.prepare(`
			SELECT id, email, display_name, account_status
			FROM auth_users
			WHERE id = ?
			LIMIT 1
		`)
		.bind(targetUserId)
		.first();
}

async function readUserByEmail(db, targetEmail) {
	if (!targetEmail) return null;
	return db
		.prepare(`
			SELECT id, email, display_name, account_status
			FROM auth_users
			WHERE lower(email) = lower(?)
			LIMIT 1
		`)
		.bind(targetEmail)
		.first();
}

async function readTargetUser(db, targetUserId, targetEmail) {
	const userById = await readUserById(db, targetUserId);
	const userByEmail = await readUserByEmail(db, targetEmail);

	if (targetUserId && targetEmail) {
		if (!userById || !userByEmail || userById.id !== userByEmail.id) {
			throw new RoleAssignmentError(
				400,
				"target_identifier_conflict",
				"targetUserId and targetEmail must resolve to the same user."
			);
		}
		return userById;
	}

	return userById || userByEmail;
}

async function readTeamMembership(db, targetUserId, teamId) {
	return db
		.prepare(`
			SELECT id, membership_status
			FROM auth_team_memberships
			WHERE user_id = ? AND team_id = ?
			LIMIT 1
		`)
		.bind(targetUserId, teamId)
		.first();
}

async function readAssignment(db, targetUserId, roleId, teamId) {
	return db
		.prepare(`
			SELECT id, assignment_status, requested_reason, approved_by_user_id, approved_at, expires_at
			FROM auth_role_assignments
			WHERE user_id = ? AND role_id = ? AND scope_type = 'team' AND scope_id = ?
			LIMIT 1
		`)
		.bind(targetUserId, roleId, teamId)
		.first();
}

function prepareActivateUserStatement(db, targetUser) {
	return db
		.prepare(`
			UPDATE auth_users
			SET account_status = 'active', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			WHERE id = ? AND account_status = 'pending'
		`)
		.bind(targetUser.id);
}

function prepareMembershipStatement(db, targetUser, team) {
	return db
		.prepare(`
			INSERT INTO auth_team_memberships (id, user_id, team_id, membership_status)
			VALUES (?, ?, ?, 'active')
			ON CONFLICT(user_id, team_id) DO UPDATE SET
				membership_status = 'active',
				removed_at = NULL
		`)
		.bind(stableMembershipId(targetUser.id, team.id), targetUser.id, team.id);
}

function prepareAssignmentStatement(db, assignmentId, context, targetUser, role, team, requestedReason, expiresAt) {
	return db
		.prepare(`
			INSERT INTO auth_role_assignments
				(id, user_id, role_id, scope_type, scope_id, assignment_status, requested_reason, approved_by_user_id, approved_at, expires_at)
			VALUES (?, ?, ?, 'team', ?, 'active', ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?)
			ON CONFLICT(user_id, role_id, scope_type, scope_id) DO UPDATE SET
				assignment_status = 'active',
				requested_reason = excluded.requested_reason,
				approved_by_user_id = excluded.approved_by_user_id,
				approved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
				expires_at = excluded.expires_at,
				updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		`)
		.bind(assignmentId, targetUser.id, role.id, team.id, requestedReason, context.user.id, expiresAt);
}

function prepareAuditStatement(db, request, context, targetUser, role, team, requestedReason, assignmentId, membershipActivated, accountActivated) {
	const url = new URL(request.url);
	return db
		.prepare(`
			INSERT INTO auth_audit_events
				(id, event_type, actor_user_id, team_id, target_type, target_id, permission_code, route_path, outcome, is_safeguarding, metadata_json)
			VALUES (?, 'auth.role_assignment.created', ?, ?, 'auth_role_assignment', ?, 'role.assign', ?, 'succeeded', ?, json_object(
				'role_key', ?,
				'target_user_id', ?,
				'requested_reason', ?,
				'assignment_status', 'active',
				'team_membership_activated', ?,
				'account_activated', ?,
				'team_created', ?
			))
		`)
		.bind(
			makeId("audit"),
			context.user.id,
			team.id,
			assignmentId,
			url.pathname,
			role.role_key === "safeguarding_lead" ? 1 : 0,
			role.role_key,
			targetUser.id,
			requestedReason,
			membershipActivated ? 1 : 0,
			accountActivated ? 1 : 0,
			team.created ? 1 : 0
		);
}

async function writeAssignmentWithAudit(db, request, context, targetUser, role, team, requestedReason, expiresAt, membership) {
	if (typeof db.batch !== "function") {
		throw new RoleAssignmentError(
			503,
			"role_assignment_transaction_unavailable",
			"Role assignment writes cannot be made safely right now."
		);
	}

	const existingAssignment = team.created ? null : await readAssignment(db, targetUser.id, role.id, team.id);
	const assignmentId = existingAssignment?.id || stableAssignmentId(targetUser.id, role.id, team.id);
	const accountActivated = targetUser.account_status === "pending";
	const membershipActivated = !membership || membership.membership_status !== "active";
	const statements = [...(team.preAssignmentStatements || [])];

	if (accountActivated) statements.push(prepareActivateUserStatement(db, targetUser));
	if (membershipActivated) statements.push(prepareMembershipStatement(db, targetUser, team));

	statements.push(
		prepareAssignmentStatement(db, assignmentId, context, targetUser, role, team, requestedReason, expiresAt),
		prepareAuditStatement(
			db,
			request,
			context,
			targetUser,
			role,
			team,
			requestedReason,
			assignmentId,
			membershipActivated,
			accountActivated
		)
	);

	await db.batch(statements);
	return {
		assignment: await readAssignment(db, targetUser.id, role.id, team.id),
		accountActivated,
		membershipActivated,
	};
}

async function assignRole(request, env, context, body) {
	const db = dbFor(env);
	const team = await resolveAssignmentTeam(db, request, context, body);
	const { targetUserId, targetEmail } = targetSelectorFor(body);
	const roleKey = requestedRoleKeyFor(body);
	const requestedReason = requestedReasonFor(body);
	const expiresAt = expiresAtFor(body);
	const role = await readRole(db, roleKey);

	if (!role) {
		throw new RoleAssignmentError(404, "role_not_found", "The requested role does not exist.");
	}

	assertSensitiveRoleConfirmation(role, body);

	const targetUser = await readTargetUser(db, targetUserId, targetEmail);
	if (!targetUser) {
		throw new RoleAssignmentError(404, "target_user_not_found", "The target user does not exist.");
	}

	if (["suspended", "closed"].includes(targetUser.account_status)) {
		throw new RoleAssignmentError(409, "target_user_inactive", "The target user cannot receive roles.");
	}

	const membership = team.created ? null : await readTeamMembership(db, targetUser.id, team.id);
	const assignmentResult = await writeAssignmentWithAudit(
		db,
		request,
		context,
		targetUser,
		role,
		team,
		requestedReason,
		expiresAt,
		membership
	);

	return {
		assignment: assignmentResult.assignment,
		accountActivated: assignmentResult.accountActivated,
		membershipActivated: assignmentResult.membershipActivated,
		role,
		targetUser: {
			...targetUser,
			account_status: assignmentResult.accountActivated ? "active" : targetUser.account_status,
		},
		team,
	};
}

function roleAssignmentErrorResponse(error) {
	if (!(error instanceof RoleAssignmentError)) throw error;
	return jsonResponse({ ok: false, error: error.code, message: error.message }, error.status);
}

export async function handleRoleAssignmentsRoute(request, env) {
	try {
		const context = await resolveAuthenticatedContext(request, env);
		await assertRoutePermission(request, env, context);
		const body = await readJson(request);
		const result = await assignRole(request, env, context, body);

		return jsonResponse(
			{
				ok: true,
				assignment: {
					id: result.assignment.id,
					status: result.assignment.assignment_status,
					scopeType: "team",
					scopeId: result.team.id,
					expiresAt: result.assignment.expires_at,
				},
				teamMembership: {
					status: "active",
					createdOrReactivated: result.membershipActivated,
				},
				role: {
					key: result.role.role_key,
					label: result.role.label,
					sensitive: result.role.is_sensitive === 1,
				},
				team: {
					id: result.team.id,
					name: result.team.name,
					created: result.team.created === true,
				},
				targetUser: {
					id: result.targetUser.id,
					email: result.targetUser.email,
					displayName: result.targetUser.display_name,
					accountStatus: result.targetUser.account_status,
				},
			},
			201
		);
	} catch (error) {
		try {
			return roleAssignmentErrorResponse(error);
		} catch {}

		try {
			return routePermissionErrorResponse(error);
		} catch {}

		if (error?.status && error?.code) {
			return jsonResponse({ ok: false, error: error.code, message: error.message }, error.status);
		}

		return jsonResponse(
			{
				ok: false,
				error: "role_assignment_error",
				message: "Role assignment could not be completed.",
			},
			500
		);
	}
}
