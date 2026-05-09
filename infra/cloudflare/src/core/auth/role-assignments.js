import { resolveAuthenticatedContext } from './access.js';
import { assertRoutePermission, routePermissionErrorResponse } from './route-permissions.js';

const JSON_HEADERS = {
	'content-type': 'application/json; charset=utf-8',
	'cache-control': 'no-store',
	'x-content-type-options': 'nosniff',
};

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
	if (!db || typeof db.prepare !== 'function') {
		throw new RoleAssignmentError(
			503,
			'role_assignment_store_unavailable',
			'Role assignments cannot be changed right now.',
		);
	}
	return db;
}

function makeId(prefix) {
	return `${prefix}_${crypto.randomUUID()}`;
}

function normaliseEmail(email) {
	return String(email || '')
		.trim()
		.toLowerCase();
}

function cleanText(value) {
	return String(value || '').trim();
}

async function readJson(request) {
	try {
		const body = await request.json();
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			throw new RoleAssignmentError(400, 'invalid_request_body', 'Request body must be a JSON object.');
		}
		return body;
	} catch (error) {
		if (error instanceof RoleAssignmentError) throw error;
		throw new RoleAssignmentError(400, 'invalid_json', 'Request body must be valid JSON.');
	}
}

function targetSelectorFor(body) {
	const targetUserId = cleanText(body.targetUserId);
	const targetEmail = normaliseEmail(body.targetEmail);

	if (!targetUserId && !targetEmail) {
		throw new RoleAssignmentError(
			400,
			'target_required',
			'Provide targetUserId or targetEmail for the user receiving the role.',
		);
	}

	return { targetUserId, targetEmail };
}

function requestedRoleKeyFor(body) {
	const roleKey = cleanText(body.roleKey);
	if (!roleKey) {
		throw new RoleAssignmentError(400, 'role_required', 'Provide roleKey for the role to assign.');
	}
	return roleKey;
}

function requestedReasonFor(body) {
	const requestedReason = cleanText(body.requestedReason);
	if (requestedReason.length < 12) {
		throw new RoleAssignmentError(
			400,
			'role_assignment_reason_required',
			'Provide a clear reason for assigning this role.',
		);
	}
	return requestedReason;
}

function expiresAtFor(body) {
	const expiresAt = cleanText(body.expiresAt);
	if (!expiresAt) return null;

	const parsed = Date.parse(expiresAt);
	if (Number.isNaN(parsed)) {
		throw new RoleAssignmentError(
			400,
			'invalid_expiry',
			'expiresAt must be an ISO-8601 date-time when provided.',
		);
	}

	return new Date(parsed).toISOString();
}

function assertActiveTeam(context) {
	if (!context.activeTeam?.id) {
		throw new RoleAssignmentError(
			403,
			'active_team_required',
			'Choose an active team before assigning roles.',
		);
	}
	return context.activeTeam;
}

function assertSensitiveRoleConfirmation(role, body) {
	const roleKey = role.role_key;
	const roleIsSensitive = role.is_sensitive === 1 || role.approval_required === 1;
	if (!roleIsSensitive) return;

	if (body.sensitiveRoleConfirmation !== 'ASSIGN_SENSITIVE_ROLE') {
		throw new RoleAssignmentError(
			400,
			'sensitive_role_confirmation_required',
			'Confirm that this sensitive role assignment is intentional.',
		);
	}

	if (roleKey === 'safeguarding_lead' && body.safeguardingConfirmation !== 'ASSIGN_SAFEGUARDING_LEAD') {
		throw new RoleAssignmentError(
			400,
			'safeguarding_role_confirmation_required',
			'Confirm that safeguarding lead access is intentionally required.',
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

async function readTargetUser(db, targetUserId, targetEmail) {
	let query = `
		SELECT id, email, display_name, account_status
		FROM auth_users
		WHERE id = ?
		LIMIT 1
	`;
	let value = targetUserId;

	if (!targetUserId && targetEmail) {
		query = `
			SELECT id, email, display_name, account_status
			FROM auth_users
			WHERE lower(email) = lower(?)
			LIMIT 1
		`;
		value = targetEmail;
	}

	return db.prepare(query).bind(value).first();
}

async function readActiveMembership(db, targetUserId, teamId) {
	return db
		.prepare(`
			SELECT id, membership_status
			FROM auth_team_memberships
			WHERE user_id = ? AND team_id = ? AND membership_status = 'active'
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

async function writeAssignment(db, context, targetUser, role, team, requestedReason, expiresAt) {
	const assignmentId = makeId('asn');

	await db
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
		.bind(assignmentId, targetUser.id, role.id, team.id, requestedReason, context.user.id, expiresAt)
		.run();

	return readAssignment(db, targetUser.id, role.id, team.id);
}

async function writeAuditEvent(db, request, context, targetUser, role, team, requestedReason, assignment) {
	const url = new URL(request.url);
	await db
		.prepare(`
			INSERT INTO auth_audit_events
				(id, event_type, actor_user_id, team_id, target_type, target_id, permission_code, route_path, outcome, is_safeguarding, metadata_json)
			VALUES (?, 'auth.role_assignment.created', ?, ?, 'auth_role_assignment', ?, 'role.assign', ?, 'succeeded', ?, json_object(
				'role_key', ?,
				'target_user_id', ?,
				'requested_reason', ?,
				'assignment_status', ?
			))
		`)
		.bind(
			makeId('audit'),
			context.user.id,
			team.id,
			assignment.id,
			url.pathname,
			role.role_key === 'safeguarding_lead' ? 1 : 0,
			role.role_key,
			targetUser.id,
			requestedReason,
			assignment.assignment_status,
		)
		.run();
}

async function assignRole(request, env, context, body) {
	const db = dbFor(env);
	const team = assertActiveTeam(context);
	const { targetUserId, targetEmail } = targetSelectorFor(body);
	const roleKey = requestedRoleKeyFor(body);
	const requestedReason = requestedReasonFor(body);
	const expiresAt = expiresAtFor(body);
	const role = await readRole(db, roleKey);

	if (!role) {
		throw new RoleAssignmentError(404, 'role_not_found', 'The requested role does not exist.');
	}

	assertSensitiveRoleConfirmation(role, body);

	const targetUser = await readTargetUser(db, targetUserId, targetEmail);
	if (!targetUser) {
		throw new RoleAssignmentError(404, 'target_user_not_found', 'The target user does not exist.');
	}

	if (['suspended', 'closed'].includes(targetUser.account_status)) {
		throw new RoleAssignmentError(409, 'target_user_inactive', 'The target user cannot receive roles.');
	}

	const membership = await readActiveMembership(db, targetUser.id, team.id);
	if (!membership) {
		throw new RoleAssignmentError(
			400,
			'target_not_team_member',
			'The target user must be an active member of the active team before a role can be assigned.',
		);
	}

	const assignment = await writeAssignment(db, context, targetUser, role, team, requestedReason, expiresAt);
	await writeAuditEvent(db, request, context, targetUser, role, team, requestedReason, assignment);

	return {
		assignment,
		role,
		targetUser,
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
					scopeType: 'team',
					scopeId: result.team.id,
					expiresAt: result.assignment.expires_at,
				},
				role: {
					key: result.role.role_key,
					label: result.role.label,
					sensitive: result.role.is_sensitive === 1,
				},
				targetUser: {
					id: result.targetUser.id,
					email: result.targetUser.email,
					displayName: result.targetUser.display_name,
					accountStatus: result.targetUser.account_status,
				},
			},
			201,
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
				error: 'role_assignment_error',
				message: 'Role assignment could not be completed.',
			},
			500,
		);
	}
}
