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
		('usr_seed_mansoor_mir', 'mansoor.mir@homeoffice.gov.uk', 'Mansoor Mir'),
		('usr_seed_lucy_branford_white', 'lucy.branford-white@digital.homeoffice.gov.uk', 'Lucy Branford-White'),
		('usr_seed_laurence_piercy', 'laurence.piercy@homeoffice.gov.uk', 'Laurence Piercy'),
		('usr_seed_amy_everett', 'amy.everett1@homeoffice.gov.uk', 'Amy Everett'),
		('usr_seed_rachael_sumner', 'rachael.sumner@homeoffice.gov.uk', 'Rachael Sumner'),
		('usr_seed_erin_bramwell', 'erin.bramwell@homeoffice.gov.uk', 'Erin Bramwell'),
		('usr_seed_helen_orlando', 'helen.orlando@homeoffice.gov.uk', 'Helen Orlando'),
		('usr_seed_andrew_warner', 'andrew.warner@homeoffice.gov.uk', 'Andrew Warner'),
		('usr_seed_andrew_barker', 'andrew.barker6@homeoffice.gov.uk', 'Andrew Barker'),
		('usr_seed_gill_woodlock', 'gillian.woodlock@homeoffice.gov.uk', 'Gill Woodlock'),
		('usr_seed_jenna_murison', 'jenna.murison@homeoffice.gov.uk', 'Jenna Murison')
)
INSERT INTO auth_users (id, email, display_name, account_status)
SELECT id, email, display_name, 'active'
FROM seed_users
WHERE NOT EXISTS (
	SELECT 1 FROM auth_users u WHERE lower(u.email) = lower(seed_users.email)
);

WITH seed_users(email, display_name) AS (
	VALUES
		('mansoor.mir@homeoffice.gov.uk', 'Mansoor Mir'),
		('lucy.branford-white@digital.homeoffice.gov.uk', 'Lucy Branford-White'),
		('laurence.piercy@homeoffice.gov.uk', 'Laurence Piercy'),
		('amy.everett1@homeoffice.gov.uk', 'Amy Everett'),
		('rachael.sumner@homeoffice.gov.uk', 'Rachael Sumner'),
		('erin.bramwell@homeoffice.gov.uk', 'Erin Bramwell'),
		('helen.orlando@homeoffice.gov.uk', 'Helen Orlando'),
		('andrew.warner@homeoffice.gov.uk', 'Andrew Warner'),
		('andrew.barker6@homeoffice.gov.uk', 'Andrew Barker'),
		('gillian.woodlock@homeoffice.gov.uk', 'Gill Woodlock'),
		('jenna.murison@homeoffice.gov.uk', 'Jenna Murison')
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
		('mansoor.mir@homeoffice.gov.uk', 'mbr_seed_mansoor_mir_researchops_core'),
		('lucy.branford-white@digital.homeoffice.gov.uk', 'mbr_seed_lucy_branford_white_researchops_core')
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
		('mansoor.mir@homeoffice.gov.uk', 'role_team_admin', 'team', 'team_researchops_core', 'asn_seed_mansoor_mir_team_admin_core', 'Colleague access seeded by Team Admin: team_admin for ResearchOps Core Team.'),
		('mansoor.mir@homeoffice.gov.uk', 'role_approver', 'team', 'team_researchops_core', 'asn_seed_mansoor_mir_approver_core', 'Colleague access seeded by Team Admin: approver for ResearchOps Core Team.'),
		('mansoor.mir@homeoffice.gov.uk', 'role_safeguarding_lead', 'team', 'team_researchops_core', 'asn_seed_mansoor_mir_safeguarding_lead_core', 'Colleague access seeded by Team Admin: safeguarding_lead for ResearchOps Core Team.'),
		('lucy.branford-white@digital.homeoffice.gov.uk', 'role_team_admin', 'team', 'team_researchops_core', 'asn_seed_lucy_branford_white_team_admin_core', 'Colleague access seeded by Team Admin: team_admin for ResearchOps Core Team.'),
		('lucy.branford-white@digital.homeoffice.gov.uk', 'role_approver', 'team', 'team_researchops_core', 'asn_seed_lucy_branford_white_approver_core', 'Colleague access seeded by Team Admin: approver for ResearchOps Core Team.'),
		('lucy.branford-white@digital.homeoffice.gov.uk', 'role_safeguarding_lead', 'team', 'team_researchops_core', 'asn_seed_lucy_branford_white_safeguarding_lead_core', 'Colleague access seeded by Team Admin: safeguarding_lead for ResearchOps Core Team.'),
		('laurence.piercy@homeoffice.gov.uk', 'role_research_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_laurence_piercy_research_lead_tp1', 'Colleague access seeded by Team Admin: research_lead for Test Project 1.'),
		('laurence.piercy@homeoffice.gov.uk', 'role_approver', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_laurence_piercy_approver_tp1', 'Colleague access seeded by Team Admin: approver for Test Project 1.'),
		('laurence.piercy@homeoffice.gov.uk', 'role_safeguarding_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_laurence_piercy_safeguarding_lead_tp1', 'Colleague access seeded by Team Admin: safeguarding_lead for Test Project 1.'),
		('amy.everett1@homeoffice.gov.uk', 'role_research_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_amy_everett_research_lead_tp1', 'Colleague access seeded by Team Admin: research_lead for Test Project 1.'),
		('amy.everett1@homeoffice.gov.uk', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_amy_everett_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('amy.everett1@homeoffice.gov.uk', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_amy_everett_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.'),
		('rachael.sumner@homeoffice.gov.uk', 'role_research_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_rachael_sumner_research_lead_tp1', 'Colleague access seeded by Team Admin: research_lead for Test Project 1.'),
		('rachael.sumner@homeoffice.gov.uk', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_rachael_sumner_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('rachael.sumner@homeoffice.gov.uk', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_rachael_sumner_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.'),
		('erin.bramwell@homeoffice.gov.uk', 'role_research_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_erin_bramwell_research_lead_tp1', 'Colleague access seeded by Team Admin: research_lead for Test Project 1.'),
		('erin.bramwell@homeoffice.gov.uk', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_erin_bramwell_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('erin.bramwell@homeoffice.gov.uk', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_erin_bramwell_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.'),
		('erin.bramwell@homeoffice.gov.uk', 'role_approver', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_erin_bramwell_approver_tp1', 'Colleague access seeded by Team Admin: approver for Test Project 1.'),
		('erin.bramwell@homeoffice.gov.uk', 'role_safeguarding_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_erin_bramwell_safeguarding_lead_tp1', 'Colleague access seeded by Team Admin: safeguarding_lead for Test Project 1.'),
		('helen.orlando@homeoffice.gov.uk', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_helen_orlando_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('helen.orlando@homeoffice.gov.uk', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_helen_orlando_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.'),
		('andrew.warner@homeoffice.gov.uk', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_andrew_warner_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('andrew.warner@homeoffice.gov.uk', 'role_research_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_andrew_warner_research_lead_tp1', 'Colleague access seeded by Team Admin: research_lead for Test Project 1.'),
		('andrew.warner@homeoffice.gov.uk', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_andrew_warner_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.'),
		('andrew.barker6@homeoffice.gov.uk', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_andrew_barker_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('andrew.barker6@homeoffice.gov.uk', 'role_research_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_andrew_barker_research_lead_tp1', 'Colleague access seeded by Team Admin: research_lead for Test Project 1.'),
		('andrew.barker6@homeoffice.gov.uk', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_andrew_barker_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.'),
		('gillian.woodlock@homeoffice.gov.uk', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_gill_woodlock_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('gillian.woodlock@homeoffice.gov.uk', 'role_research_lead', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_gill_woodlock_research_lead_tp1', 'Colleague access seeded by Team Admin: research_lead for Test Project 1.'),
		('gillian.woodlock@homeoffice.gov.uk', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_gill_woodlock_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.'),
		('jenna.murison@homeoffice.gov.uk', 'role_researcher', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_jenna_murison_researcher_tp1', 'Colleague access seeded by Team Admin: researcher for Test Project 1.'),
		('jenna.murison@homeoffice.gov.uk', 'role_observer', 'project', 'recgdpwEI5hF07bUZ', 'asn_seed_jenna_murison_observer_tp1', 'Colleague access seeded by Team Admin: observer for Test Project 1.')
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
	(SELECT id FROM auth_users WHERE lower(email) = lower('digikev.kevin.rapley@gmail.com') LIMIT 1),
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
		('aud_seed_colleague_mansoor_mir', 'mansoor.mir@homeoffice.gov.uk', 'team', 'team_researchops_core', '["team_admin","approver","safeguarding_lead"]'),
		('aud_seed_colleague_lucy_branford_white', 'lucy.branford-white@digital.homeoffice.gov.uk', 'team', 'team_researchops_core', '["team_admin","approver","safeguarding_lead"]'),
		('aud_seed_colleague_laurence_piercy', 'laurence.piercy@homeoffice.gov.uk', 'project', 'recgdpwEI5hF07bUZ', '["research_lead","approver","safeguarding_lead"]'),
		('aud_seed_colleague_amy_everett', 'amy.everett1@homeoffice.gov.uk', 'project', 'recgdpwEI5hF07bUZ', '["research_lead","researcher","observer"]'),
		('aud_seed_colleague_rachael_sumner', 'rachael.sumner@homeoffice.gov.uk', 'project', 'recgdpwEI5hF07bUZ', '["research_lead","researcher","observer"]'),
		('aud_seed_colleague_erin_bramwell', 'erin.bramwell@homeoffice.gov.uk', 'project', 'recgdpwEI5hF07bUZ', '["research_lead","researcher","observer","approver","safeguarding_lead"]'),
		('aud_seed_colleague_helen_orlando', 'helen.orlando@homeoffice.gov.uk', 'project', 'recgdpwEI5hF07bUZ', '["researcher","observer"]'),
		('aud_seed_colleague_andrew_warner', 'andrew.warner@homeoffice.gov.uk', 'project', 'recgdpwEI5hF07bUZ', '["researcher","research_lead","observer"]'),
		('aud_seed_colleague_andrew_barker', 'andrew.barker6@homeoffice.gov.uk', 'project', 'recgdpwEI5hF07bUZ', '["researcher","research_lead","observer"]'),
		('aud_seed_colleague_gill_woodlock', 'gillian.woodlock@homeoffice.gov.uk', 'project', 'recgdpwEI5hF07bUZ', '["researcher","research_lead","observer"]'),
		('aud_seed_colleague_jenna_murison', 'jenna.murison@homeoffice.gov.uk', 'project', 'recgdpwEI5hF07bUZ', '["researcher","observer"]')
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
	(SELECT id FROM auth_users WHERE lower(email) = lower('digikev.kevin.rapley@gmail.com') LIMIT 1),
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
