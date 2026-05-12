-- ResearchOps passwordless authentication locked challenge support
-- Date: 2026-05-12
-- Scope: rebuild auth_login_challenges so exhausted code attempts can be represented explicitly.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS auth_login_challenges_next (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  challenge_status TEXT NOT NULL DEFAULT 'pending' CHECK (challenge_status IN ('pending', 'verified', 'expired', 'failed', 'locked')),
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  attempts_remaining INTEGER NOT NULL DEFAULT 5,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  request_ip_hash TEXT,
  user_agent_family TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO auth_login_challenges_next (
  id,
  email,
  code_hash,
  challenge_status,
  delivery_status,
  attempts_remaining,
  expires_at,
  verified_at,
  request_ip_hash,
  user_agent_family,
  created_at
)
SELECT
  id,
  email,
  code_hash,
  challenge_status,
  delivery_status,
  attempts_remaining,
  expires_at,
  verified_at,
  request_ip_hash,
  user_agent_family,
  created_at
FROM auth_login_challenges;

DROP TABLE auth_login_challenges;
ALTER TABLE auth_login_challenges_next RENAME TO auth_login_challenges;

CREATE INDEX IF NOT EXISTS idx_auth_login_challenges_email_status ON auth_login_challenges(email, challenge_status, expires_at);

PRAGMA foreign_keys = ON;
