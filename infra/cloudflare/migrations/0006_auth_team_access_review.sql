-- ResearchOps team access review support
-- Date: 2026-05-31
-- Scope: allow Team Admins to approve or reject pending team access requests without assigning roles.

PRAGMA foreign_keys = ON;

ALTER TABLE auth_team_access_requests ADD COLUMN decision_reason TEXT;

INSERT OR IGNORE INTO auth_route_permissions (id, method, route_pattern, required_permissions_json, auth_required, implementation_status) VALUES
  ('route_api_team_access_requests_review_get', 'GET', '/api/team-access/requests/review', '[]', 1, 'implemented'),
  ('route_api_team_access_requests_approve_post', 'POST', '/api/team-access/requests/approve', '[]', 1, 'implemented'),
  ('route_api_team_access_requests_reject_post', 'POST', '/api/team-access/requests/reject', '[]', 1, 'implemented');
