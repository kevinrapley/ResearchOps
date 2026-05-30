-- ResearchOps identity-only route permission
-- Date: 2026-05-30
-- Scope: declare GET /api/me/identity for D1 databases that already applied 0001_auth_foundation.sql.

INSERT OR IGNORE INTO auth_route_permissions (
  id,
  method,
  route_pattern,
  required_permissions_json,
  auth_required,
  implementation_status
)
VALUES (
  'route_api_me_identity_get',
  'GET',
  '/api/me/identity',
  '[]',
  1,
  'implemented'
);
