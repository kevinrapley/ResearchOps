-- Seed colleague ResearchOps accounts without sending notifications.
-- Date: 2026-06-10
-- Scope: create active users and role assignments in D1 only.
-- This migration does not insert login challenges, one-time codes, sessions or outbound email events.

PRAGMA foreign_keys = ON;

INSERT INTO auth_teams (id, name, team_status)
VALUES ('team_researchops_core', 'ResearchOps Core Team', 'active')
ON CONFLICT(id) DO UPDATE SET
	name = 'ResearchOps Core Team',
	team_status = 'active',
	updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

WITH seed_users(id, email, display_name) AS (
	VALUES
		('usr_seed_team_admin_one', 'team.admin.one@example.test', 'Team Admin One'),
		('usr_seed_team_admin_two', 'team.admin.two@example.test', 'Team Admin Two'),
		('usr_seed_researcher_two', 'researcher.two@example.test', 'Researcher Two'),
		('usr_seed_research_lead_one', 'research.lead.one@example.test', 'Research Lead One'),
		('usr_seed_researcher_three', 'researcher.three@example.test', 'Researcher Three'),
		('usr_seed_researcher_four', 'researcher.four@example.test', 'Researcher Four'),
		('usr_seed_researcher_five', 'researcher.five@example.test', 'Researcher Five'),
		('usr_seed_researcher_six', 'researcher.six@example.test', 'Researcher Six'),
		('usr_seed_researcher_seven', 'researcher.seven@example.test', 'Researcher Seven'),
		('usr_seed_researcher_eight', 'researcher.eight@example.test', 'Researcher Eight'),
		('usr_seed_researcher_nine', 'researcher.nine@example.test', 'Researcher Nine')
)
INSERT INTO auth_users (id, email, display_name, account_status)
SELECT id, email, display_name, 'active'
FROM seed_users
WHERE NOT EXISTS (
	SELECT 1 FROM auth_users u WHERE lower(u.email) = lower(seed_users.email)
);

WITH seed_users(email, display_name) AS (
	VALUES
		('team.admin.one@example.test', 'Team Admin One'),
		('team.admin.two@example.test', 'Team Admin Two'),
		('researcher.two@example.test', 'Researcher Two'),
		('research.lead.one@example.test', 'Research Lead One'),
		('researcher.three@example.test', 'Researcher Three'),
		('researcher.four@example.test', 'Researcher Four'),
		('researcher.five@example.test', 'Researcher Five'),
		('researcher.six@example.test', 'Researcher Six'),
		('researcher.seven@example.test', 'Researcher Seven'),
		('researcher.eight@example.test', 'Researcher Eight'),
		('researcher.nine@example.test', 'Researcher Nine')
)
UPDATE auth_users
SET display_name = (
		SELECT display_name FROM seed_users WHERE lower(seed_users.email) = lower(auth_users.email)
	),
	account_status = 'active',
	updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE EXISTS (
	SELECT 1 FROM seed_users WHERE lower(seed_users.email) = lower(auth_users.email)
);

WITH team_members(email, membership_id) AS (
	VALUES
		('team.admin.one@example.test', 'mbr_seed_team_admin_one_researchops_core'),
		('team.admin.two@example.test', 'mbr_seed_team_admin_two_researchops_core')
)
INSERT INTO auth_team_memberships (id, user_id, team_id, membership_status, removed_at)
SELECT team_members.membership_id, u.id, 'team_researchops_core', 'active', NULL
FROM team_members
INNER JOIN auth_users u ON lower(u.email) = lower(team_members.email)
ON CONFLICT(user_id, team_id) DO UPDATE SET
	membership_status = 'active',
	removed_at = NULL;

WITH role_seed(email, role_id, scope_type, scope_id, assignment_id, requested_reason) AS (
	VALUES
		('team.admin.one@example.test', 'role_team_admin', 'team', 'team_researchops_core', 'asn_seed_team_admin_one_team_admin_core', 'Colleague access seeded by Team Admin: team_admin for ResearchOps Core Team.'),
		('team.admin.one@example.test', 'role_approver', 'team', 'team_researchops_core', 'asn_seed_team_admin_one_approver_core', 'Colleague access seeded by Team Admin: approver for ResearchOps Core Team.'),
		('team.admin.one@example.test', 'role_safeguarding_lead', 'team', 'team_researchops_core', 'asn_seed_team_admin_one_safeguarding_lead_core', 'Colleague access seeded by Team Admin: safeguarding_lead for ResearchOps Core Team.'),
		('team.admin.two@example.test', 'role_team_admin', 'team', 'team_researchops_core', 'asn_seed_team_admin_two_team_admin_core', 'Colleague access seeded by Team Admin: team_admin for ResearchOps Core Team.'),
		('team.admin.two@example.test', 'role_approver', 'team', 'team_researchops_core', 'asn_seed_team_admin_two_approver_core', 'Colleague access seeded by Team Admin: approver for ResearchOps Core Team.'),
		('team.admin.two@example.test', 'role_safeguarding_lead', 'team', 'team_researchops_core', 'asn_seed_team_admin_two_safeguarding_lead_core', 'Colleague access seeded by Team Admin: safeguarding_lead for ResearchOps Core Team.'),
		('researcher.two@example.test', 'role_research_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_two_research_lead_tp1', 'Colleague access seeded by Team Admin: research_lead for Test Project 1.'),
		('researcher.two@example.test', 'role_approver', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_two_approver_tp1', 'Colleague access seeded by Team Admin: approver for Test Project 1.'),
		('researcher.two@example.test', 'role_safeguarding_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_two_safeguarding_lead_tp1', 'Colleague access seeded by Team Admin: safeguarding_lead for Test Project 1.'),
		('research.lead.one@example.test', 'role_research_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_research_lead_one_research_lead_tp1', 'Colleague access seeded by Team Admin: research_lead for Test Project 1.'),
		('research.lead.one@example.test', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_research_lead_one_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('research.lead.one@example.test', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_research_lead_one_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.'),
		('researcher.three@example.test', 'role_research_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_three_research_lead_tp1', 'Colleague access seeded by Team Admin: research_lead for Test Project 1.'),
		('researcher.three@example.test', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_three_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('researcher.three@example.test', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_three_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.'),
		('researcher.four@example.test', 'role_research_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_four_research_lead_tp1', 'Colleague access seeded by Team Admin: research_lead for Test Project 1.'),
		('researcher.four@example.test', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_four_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('researcher.four@example.test', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_four_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.'),
		('researcher.four@example.test', 'role_approver', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_four_approver_tp1', 'Colleague access seeded by Team Admin: approver for Test Project 1.'),
		('researcher.four@example.test', 'role_safeguarding_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_four_safeguarding_lead_tp1', 'Colleague access seeded by Team Admin: safeguarding_lead for Test Project 1.'),
		('researcher.five@example.test', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_five_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('researcher.five@example.test', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_five_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.'),
		('researcher.six@example.test', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_six_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('researcher.six@example.test', 'role_research_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_six_research_lead_tp1', 'Colleague access seeded by Team Admin: research_lead for Test Project 1.'),
		('researcher.six@example.test', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_six_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.'),
		('researcher.seven@example.test', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_seven_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('researcher.seven@example.test', 'role_research_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_seven_research_lead_tp1', 'Colleague access seeded by Team Admin: research_lead for Test Project 1.'),
		('researcher.seven@example.test', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_seven_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.'),
		('researcher.eight@example.test', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_eight_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('researcher.eight@example.test', 'role_research_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_eight_research_lead_tp1', 'Colleague access seeded by Team Admin: research_lead for Test Project 1.'),
		('researcher.eight@example.test', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_eight_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.'),
		('researcher.nine@example.test', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_nine_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('researcher.nine@example.test', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_researcher_nine_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.')
)
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
	role_seed.assignment_id,
	u.id,
	role_seed.role_id,
	role_seed.scope_type,
	role_seed.scope_id,
	'active',
	role_seed.requested_reason,
	(SELECT id FROM auth_users WHERE lower(email) = lower('system.admin@example.test') LIMIT 1),
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	NULL
FROM role_seed
INNER JOIN auth_users u ON lower(u.email) = lower(role_seed.email)
ON CONFLICT(user_id, role_id, scope_type, scope_id) DO UPDATE SET
	assignment_status = 'active',
	requested_reason = excluded.requested_reason,
	approved_by_user_id = excluded.approved_by_user_id,
	approved_at = excluded.approved_at,
	expires_at = NULL,
	updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

WITH audit_seed(audit_id, email, scope_type, scope_id, roles_json) AS (
	VALUES
		('aud_seed_colleague_team_admin_one', 'team.admin.one@example.test', 'team', 'team_researchops_core', '["team_admin","approver","safeguarding_lead"]'),
		('aud_seed_colleague_team_admin_two', 'team.admin.two@example.test', 'team', 'team_researchops_core', '["team_admin","approver","safeguarding_lead"]'),
		('aud_seed_colleague_researcher_two', 'researcher.two@example.test', 'project', 'recgdpwEI5hF07bUZ', '["research_lead","approver","safeguarding_lead"]'),
		('aud_seed_colleague_research_lead_one', 'research.lead.one@example.test', 'project', 'recgdpwEI5hF07bUZ', '["research_lead","researcher","observer"]'),
		('aud_seed_colleague_researcher_three', 'researcher.three@example.test', 'project', 'recgdpwEI5hF07bUZ', '["research_lead","researcher","observer"]'),
		('aud_seed_colleague_researcher_four', 'researcher.four@example.test', 'project', 'recgdpwEI5hF07bUZ', '["research_lead","researcher","observer","approver","safeguarding_lead"]'),
		('aud_seed_colleague_researcher_five', 'researcher.five@example.test', 'project', 'recgdpwEI5hF07bUZ', '["researcher","observer"]'),
		('aud_seed_colleague_researcher_six', 'researcher.six@example.test', 'project', 'recgdpwEI5hF07bUZ', '["researcher","research_lead","observer"]'),
		('aud_seed_colleague_researcher_seven', 'researcher.seven@example.test', 'project', 'recgdpwEI5hF07bUZ', '["researcher","research_lead","observer"]'),
		('aud_seed_colleague_researcher_eight', 'researcher.eight@example.test', 'project', 'recgdpwEI5hF07bUZ', '["researcher","research_lead","observer"]'),
		('aud_seed_colleague_researcher_nine', 'researcher.nine@example.test', 'project', 'recgdpwEI5hF07bUZ', '["researcher","observer"]')
)
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
	audit_seed.audit_id,
	'auth.colleague_user.seeded_without_email',
	(SELECT id FROM auth_users WHERE lower(email) = lower('system.admin@example.test') LIMIT 1),
	CASE WHEN audit_seed.scope_type = 'team' THEN audit_seed.scope_id ELSE NULL END,
	'auth_users',
	u.id,
	'role.assign',
	'infra/cloudflare/migrations/0020_seed_colleague_auth_users.sql',
	'colleague-access-seed',
	'succeeded',
	0,
	'{"email":"' || audit_seed.email || '","scopeType":"' || audit_seed.scope_type || '","scopeId":"' || audit_seed.scope_id || '","roles":' || audit_seed.roles_json || ',"notification":"manual_contact_outside_researchops","login":"email_one_time_code_on_first_sign_in","testProject1LocalId":"d04ab32e-6756-408e-a649-6859dd0079f2"}'
FROM audit_seed
INNER JOIN auth_users u ON lower(u.email) = lower(audit_seed.email)
ON CONFLICT(id) DO NOTHING;
