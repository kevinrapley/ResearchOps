-- ResearchOps passwordless authentication session support
-- Date: 2026-05-11
-- Scope: app-led email-code login challenges, ResearchOps sessions and public auth route declarations.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS auth_login_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  challenge_status TEXT NOT NULL DEFAULT 'pending' CHECK (challenge_status IN ('pending', 'verified', 'expired', 'failed')),
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  attempts_remaining INTEGER NOT NULL DEFAULT 5,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  request_ip_hash TEXT,
  user_agent_family TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  session_status TEXT NOT NULL DEFAULT 'active' CHECK (session_status IN ('active', 'revoked', 'expired')),
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_login_challenges_email_status ON auth_login_challenges(email, challenge_status, expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, session_status, expires_at);

INSERT OR IGNORE INTO auth_route_permissions (id, method, route_pattern, required_permissions_json, auth_required, implementation_status) VALUES
  ('route_api_auth_email_start_post', 'POST', '/api/auth/email/start', '[]', 0, 'implemented'),
  ('route_api_auth_email_verify_post', 'POST', '/api/auth/email/verify', '[]', 0, 'implemented'),
  ('route_api_auth_logout_post', 'POST', '/api/auth/logout', '[]', 1, 'implemented');
