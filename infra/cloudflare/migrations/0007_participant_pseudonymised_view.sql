-- Participant pseudonymised view and contact reveal permissions
-- Date: 2026-05-31
-- Scope: Story 7 vertical slice. D1 remains the identity and authority layer;
-- Airtable remains the research data layer.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO auth_permissions (code, label, description, is_sensitive, is_reserved) VALUES
  ('participant.record.view', 'View pseudonymised participant records', 'Can view participant records with contact details and directly identifying fields removed by default.', 0, 0);

INSERT OR IGNORE INTO auth_role_permissions (role_id, permission_code) VALUES
  ('role_researcher', 'participant.record.view'),
  ('role_research_lead', 'participant.record.view'),
  ('role_approver', 'participant.record.view'),
  ('role_team_admin', 'participant.record.view');

INSERT OR IGNORE INTO auth_route_permissions (id, method, route_pattern, required_permissions_json, auth_required, implementation_status) VALUES
  ('route_api_participants_get', 'GET', '/api/participants', '["participant.record.view"]', 1, 'implemented'),
  ('route_api_participants_contact_get', 'GET', '/api/participants/contact', '["participant.pii.reveal"]', 1, 'implemented');
