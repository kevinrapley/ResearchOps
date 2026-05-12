-- Authentication registration request review queue
-- Date: 2026-05-12
-- Scope: store account registration requests for Team Admin review without
-- assigning any ResearchOps role during registration.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS auth_registration_requests (
	id TEXT PRIMARY KEY,
	user_id TEXT REFERENCES auth_users(id) ON DELETE SET NULL,
	email TEXT NOT NULL,
	normalised_email TEXT NOT NULL,
	display_name TEXT NOT NULL,
	requested_role_key TEXT NOT NULL,
	requested_role_label TEXT NOT NULL,
	team_or_service TEXT NOT NULL,
	requested_reason TEXT NOT NULL,
	request_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (request_status IN ('pending_review', 'reviewing', 'approved', 'rejected', 'withdrawn')),
	reviewed_by_user_id TEXT REFERENCES auth_users(id),
	reviewed_at TEXT,
	reviewer_note TEXT,
	submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_registration_requests_email_pending
	ON auth_registration_requests(normalised_email)
	WHERE request_status = 'pending_review';

CREATE INDEX IF NOT EXISTS idx_auth_registration_requests_status_submitted
	ON auth_registration_requests(request_status, submitted_at);

CREATE INDEX IF NOT EXISTS idx_auth_registration_requests_user
	ON auth_registration_requests(user_id, submitted_at);

INSERT OR IGNORE INTO auth_route_permissions (id, method, route_pattern, required_permissions_json, auth_required, implementation_status) VALUES
	('route_api_auth_registration_requests_post', 'POST', '/api/auth/registration-requests', '[]', 0, 'implemented'),
	('route_api_auth_registration_requests_get', 'GET', '/api/auth/registration-requests', '["role.assign"]', 1, 'implemented');
