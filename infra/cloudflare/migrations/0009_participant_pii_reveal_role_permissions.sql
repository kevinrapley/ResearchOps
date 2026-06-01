-- Participant PII reveal role permissions
-- Date: 2026-06-01
-- Scope: allow authorised lead/admin project roles to reveal participant contact details.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO auth_role_permissions (role_id, permission_code) VALUES
	('role_research_lead', 'participant.pii.view'),
	('role_research_lead', 'participant.pii.reveal'),
	('role_team_admin', 'participant.pii.view'),
	('role_team_admin', 'participant.pii.reveal');
