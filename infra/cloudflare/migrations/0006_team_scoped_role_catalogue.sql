-- Team-scoped role catalogue
-- Date: 2026-05-13
-- Scope: make the access model explicit for users who belong to many teams.
-- Roles and permissions are evaluated in the selected team scope only.
-- Team Admin in ResearchOps Core Team is treated by the application as global
-- team administration authority.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO auth_permissions (code, label, description, is_sensitive, is_reserved) VALUES
  ('research.project.create', 'Create research projects', 'Can create research projects in the selected team.', 0, 0),
  ('research.session.manage', 'Manage research sessions', 'Can create and manage research sessions in the selected team.', 0, 0),
  ('research.session.note.create', 'Take research session notes', 'Can take notes in research sessions in the selected team.', 0, 0),
  ('team.manage.global', 'Manage all teams', 'Can administer teams across ResearchOps when granted through ResearchOps Core Team.', 1, 0),
  ('role.assign.global', 'Assign roles across teams', 'Can assign roles across ResearchOps teams when granted through ResearchOps Core Team.', 1, 0);

INSERT OR IGNORE INTO auth_roles (id, role_key, label, description, is_sensitive, approval_required, default_expiry_days) VALUES
  ('role_user_researcher', 'user_researcher', 'User Researcher', 'Can carry out user research activity in the selected team.', 1, 1, 180),
  ('role_note_taker', 'note_taker', 'Note taker', 'Can take notes in research sessions in the selected team.', 0, 0, 90);

INSERT OR IGNORE INTO auth_role_permissions (role_id, permission_code) VALUES
  ('role_user_researcher', 'participant.pii.view'),
  ('role_user_researcher', 'governed.create'),
  ('role_user_researcher', 'governed.edit'),
  ('role_user_researcher', 'research.project.create'),
  ('role_user_researcher', 'research.session.manage'),
  ('role_user_researcher', 'research.session.note.create'),
  ('role_note_taker', 'research.session.note.create');
