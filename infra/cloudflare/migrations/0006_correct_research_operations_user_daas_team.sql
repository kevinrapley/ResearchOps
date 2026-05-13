-- Authentication data correction for account dashboard review
-- Date: 2026-05-14
-- Scope: move kevin.rapley@research-operations.com Observer access from
-- ResearchOps Core Team to DaaS in the ResearchOps auth database.
--
-- This is an idempotent correction. It is safe to run more than once.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO auth_teams (id, name, team_status, created_at, updated_at)
VALUES (
	'team_daas',
	'DaaS',
	'active',
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

UPDATE auth_teams
SET
	name = 'DaaS',
	team_status = 'active',
	updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'team_daas';

INSERT INTO auth_team_memberships (id, user_id, team_id, membership_status, created_at, removed_at)
SELECT
	'membership_kevin_research_operations_daas',
	u.id,
	(
		SELECT id
		FROM auth_teams
		WHERE lower(name) = lower('DaaS')
			AND team_status = 'active'
		ORDER BY CASE WHEN id = 'team_daas' THEN 0 ELSE 1 END, created_at ASC
		LIMIT 1
	),
	'active',
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	NULL
FROM auth_users u
WHERE lower(u.email) = lower('kevin.rapley@research-operations.com')
ON CONFLICT(user_id, team_id) DO UPDATE SET
	membership_status = 'active',
	removed_at = NULL;

INSERT INTO auth_role_assignments (
	id,
	user_id,
	role_id,
	scope_type,
	scope_id,
	assignment_status,
	requested_reason,
	approved_by_user_id,
	approved_at,
	expires_at,
	created_at,
	updated_at
)
SELECT
	'assignment_kevin_research_operations_observer_daas',
	u.id,
	'role_observer',
	'team',
	(
		SELECT id
		FROM auth_teams
		WHERE lower(name) = lower('DaaS')
			AND team_status = 'active'
		ORDER BY CASE WHEN id = 'team_daas' THEN 0 ELSE 1 END, created_at ASC
		LIMIT 1
	),
	'active',
	'Correct account data so this user is an Observer in DaaS.',
	(
		SELECT id
		FROM auth_users
		WHERE lower(email) = lower('digikev.kevin.rapley@gmail.com')
		LIMIT 1
	),
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	NULL,
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM auth_users u
WHERE lower(u.email) = lower('kevin.rapley@research-operations.com')
ON CONFLICT(user_id, role_id, scope_type, scope_id) DO UPDATE SET
	assignment_status = 'active',
	requested_reason = excluded.requested_reason,
	approved_by_user_id = excluded.approved_by_user_id,
	approved_at = excluded.approved_at,
	expires_at = excluded.expires_at,
	updated_at = excluded.updated_at;

UPDATE auth_role_assignments
SET
	assignment_status = 'revoked',
	updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE role_id = 'role_observer'
	AND scope_type = 'team'
	AND scope_id = 'team_researchops_core'
	AND user_id IN (
		SELECT id
		FROM auth_users
		WHERE lower(email) = lower('kevin.rapley@research-operations.com')
	);

UPDATE auth_team_memberships
SET
	membership_status = 'removed',
	removed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE team_id = 'team_researchops_core'
	AND user_id IN (
		SELECT id
		FROM auth_users
		WHERE lower(email) = lower('kevin.rapley@research-operations.com')
	)
	AND NOT EXISTS (
		SELECT 1
		FROM auth_role_assignments ra
		WHERE ra.user_id = auth_team_memberships.user_id
			AND ra.scope_type = 'team'
			AND ra.scope_id = auth_team_memberships.team_id
			AND ra.assignment_status = 'active'
			AND (ra.expires_at IS NULL OR ra.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	);

INSERT INTO auth_audit_events (
	id,
	event_type,
	actor_user_id,
	team_id,
	target_type,
	target_id,
	permission_code,
	route_path,
	request_id,
	field_group,
	outcome,
	is_safeguarding,
	metadata_json,
	created_at
)
SELECT
	'audit_kevin_research_operations_daas_' || strftime('%Y%m%d%H%M%S', 'now'),
	'auth.account_data.corrected',
	NULL,
	(
		SELECT id
		FROM auth_teams
		WHERE lower(name) = lower('DaaS')
			AND team_status = 'active'
		ORDER BY CASE WHEN id = 'team_daas' THEN 0 ELSE 1 END, created_at ASC
		LIMIT 1
	),
	'user',
	u.id,
	'role.assign',
	'/auth/data-correction',
	NULL,
	'account-access',
	'succeeded',
	0,
	'{"email":"kevin.rapley@research-operations.com","team":"DaaS","role":"Observer","reason":"Correct account data after role assignment review."}',
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM auth_users u
WHERE lower(u.email) = lower('kevin.rapley@research-operations.com')
	AND NOT EXISTS (
		SELECT 1
		FROM auth_audit_events a
		WHERE a.event_type = 'auth.account_data.corrected'
			AND a.target_id = u.id
			AND a.field_group = 'account-access'
			AND a.metadata_json LIKE '%"team":"DaaS"%'
	);
