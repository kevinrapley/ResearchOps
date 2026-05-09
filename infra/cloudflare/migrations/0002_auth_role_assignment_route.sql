-- Authentication role-assignment API route activation
-- Date: 2026-05-09
-- Scope: mark POST /api/auth/role-assignments as implemented now the Worker route exists.

UPDATE auth_route_permissions
SET implementation_status = 'implemented'
WHERE method = 'POST'
	AND route_pattern = '/api/auth/role-assignments'
	AND required_permissions_json = '["role.assign"]';
