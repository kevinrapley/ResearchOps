-- ResearchOps team access request support
-- Date: 2026-05-30
-- Scope: allow signed-in users to request team access without granting membership, roles or permissions.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS auth_team_access_requests (
  id TEXT PRIMARY KEY,
  requester_user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES auth_teams(id) ON DELETE SET NULL,
  submitted_team_reference TEXT NOT NULL,
  normalised_team_reference TEXT NOT NULL,
  request_message TEXT,
  request_status TEXT NOT NULL DEFAULT 'pending' CHECK (request_status IN ('pending', 'cancelled', 'approved', 'rejected')),
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  cancelled_at TEXT,
  decided_at TEXT,
  decided_by_user_id TEXT REFERENCES auth_users(id)
);

CREATE INDEX IF NOT EXISTS idx_auth_team_access_requests_requester_status
  ON auth_team_access_requests(requester_user_id, request_status, requested_at);

CREATE INDEX IF NOT EXISTS idx_auth_team_access_requests_team_status
  ON auth_team_access_requests(team_id, request_status, requested_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_team_access_requests_pending_reference
  ON auth_team_access_requests(requester_user_id, normalised_team_reference)
  WHERE request_status = 'pending';

INSERT OR IGNORE INTO auth_route_permissions (id, method, route_pattern, required_permissions_json, auth_required, implementation_status) VALUES
  ('route_api_team_access_requests_get', 'GET', '/api/team-access/requests', '[]', 1, 'implemented'),
  ('route_api_team_access_requests_post', 'POST', '/api/team-access/requests', '[]', 1, 'implemented'),
  ('route_api_team_access_requests_cancel_post', 'POST', '/api/team-access/requests/:id/cancel', '[]', 1, 'implemented');
