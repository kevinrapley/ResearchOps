-- Bridge Test Project 1 users to a visible auth team scope.
-- Current project visibility is team-key based, while 0020 seeds Test Project 1 role assignments with project scope.
-- This migration mirrors those project-scoped assignments onto the Home Office Biometrics team so the users have an active team context.
-- It does not insert login challenges, one-time codes, sessions or outbound email events.

PRAGMA foreign_keys = ON;

INSERT INTO auth_teams (id, name, team_status)
VALUES ('team_home_office_biometrics', 'Home Office Biometrics', 'active')
ON CONFLICT(id) DO UPDATE SET
	name = 'Home Office Biometrics',
	team_status = 'active',
	updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

INSERT INTO auth_team_memberships (id, user_id, team_id, membership_status, removed_at)
SELECT
	'mbr_visible_scope_' || replace(u.id, 'usr_', ''),
	u.id,
	'team_home_office_biometrics',
	'active',
	NULL
FROM auth_users u
WHERE EXISTS (
	SELECT 1
	FROM auth_role_assignments ra
	WHERE ra.user_id = u.id
		AND ra.scope_type = 'project'
		AND ra.scope_id = 'recgdpwEI5hF07bUZ'
		AND ra.assignment_status = 'active'
)
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
	expires_at
)
SELECT
	'asn_visible_scope_' || ra.id,
	ra.user_id,
	ra.role_id,
	'team',
	'team_home_office_biometrics',
	'active',
	'Visibility bridge for Test Project 1 while project visibility is team-key based.',
	ra.approved_by_user_id,
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	NULL
FROM auth_role_assignments ra
WHERE ra.scope_type = 'project'
	AND ra.scope_id = 'recgdpwEI5hF07bUZ'
	AND ra.assignment_status = 'active'
ON CONFLICT(user_id, role_id, scope_type, scope_id) DO UPDATE SET
	assignment_status = 'active',
	requested_reason = excluded.requested_reason,
	approved_by_user_id = excluded.approved_by_user_id,
	approved_at = excluded.approved_at,
	expires_at = NULL,
	updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

INSERT INTO auth_audit_events (
	id,
	event_type,
	actor_user_id,
	team_id,
	target_type,
	target_id,
	permission_code,
	route_path,
	field_group,
	outcome,
	is_safeguarding,
	metadata_json
)
SELECT
	'aud_visible_scope_' || u.id,
	'auth.colleague_user.visible_team_scope_seeded',
	(SELECT id FROM auth_users WHERE lower(email) = lower('digikev.kevin.rapley@gmail.com') LIMIT 1),
	'team_home_office_biometrics',
	'auth_users',
	u.id,
	'role.assign',
	'infra/cloudflare/migrations/0021_bridge_test_project_1_users_to_visible_team_scope.sql',
	'colleague-access-visible-team-bridge',
	'succeeded',
	0,
	'{"visibleTeamId":"team_home_office_biometrics","visibleTeamName":"Home Office Biometrics","projectRecordId":"recgdpwEI5hF07bUZ","projectLocalId":"d04ab32e-6756-408e-a649-6859dd0079f2","reason":"project_visibility_is_currently_team_key_based"}'
FROM auth_users u
WHERE EXISTS (
	SELECT 1
	FROM auth_role_assignments ra
	WHERE ra.user_id = u.id
		AND ra.scope_type = 'project'
		AND ra.scope_id = 'recgdpwEI5hF07bUZ'
		AND ra.assignment_status = 'active'
)
ON CONFLICT(id) DO NOTHING;
