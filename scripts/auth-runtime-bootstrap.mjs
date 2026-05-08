import fs from 'node:fs';

function fail(message) {
	console.error(message);
	process.exit(1);
}

function requireEnv(name) {
	const value = process.env[name]?.trim();
	if (!value) fail(`${name} is required`);
	return value;
}

function sql(value) {
	return `'${String(value).replaceAll("'", "''")}'`;
}

function stableSuffix(value, maxLength = 80) {
	return String(value)
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, maxLength);
}

const email = requireEnv('ADMIN_EMAIL').toLowerCase();
const displayName = requireEnv('ADMIN_DISPLAY_NAME');
const teamId = requireEnv('TEAM_ID');
const teamName = requireEnv('TEAM_NAME');
const assignSafeguardingLead = String(process.env.ASSIGN_SAFEGUARDING_LEAD || '').toLowerCase() === 'true';
const bootstrapSqlPath = process.env.BOOTSTRAP_SQL || 'auth-runtime-bootstrap.sql';
const verifySqlPath = process.env.VERIFY_SQL || 'auth-runtime-bootstrap-verify.sql';

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
	fail('ADMIN_EMAIL must be a valid email address');
}

if (!/^[A-Za-z0-9_-]{3,80}$/.test(teamId)) {
	fail('TEAM_ID must use only letters, numbers, underscores or hyphens and be 3 to 80 characters long');
}

if (displayName.length < 2 || displayName.length > 120) {
	fail('ADMIN_DISPLAY_NAME must be between 2 and 120 characters');
}

if (teamName.length < 2 || teamName.length > 120) {
	fail('TEAM_NAME must be between 2 and 120 characters');
}

const teamSuffix = stableSuffix(teamId, 60);
const userId = `usr_bootstrap_${stableSuffix(email, 80)}`;
const membershipId = `mem_bootstrap_${teamSuffix}`;
const teamAdminAssignmentId = `asn_bootstrap_team_admin_${teamSuffix}`;
const safeguardingAssignmentId = `asn_bootstrap_safeguarding_${teamSuffix}`;

const statements = [
	'PRAGMA foreign_keys = ON;',
	`INSERT INTO auth_teams (id, name, team_status) VALUES (${sql(teamId)}, ${sql(teamName)}, 'active') ON CONFLICT(id) DO UPDATE SET name = excluded.name, team_status = 'active', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`,
	`INSERT INTO auth_users (id, email, display_name, account_status) VALUES (${sql(userId)}, ${sql(email)}, ${sql(displayName)}, 'active') ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, account_status = 'active', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`,
	`INSERT INTO auth_team_memberships (id, user_id, team_id, membership_status) SELECT ${sql(membershipId)}, u.id, ${sql(teamId)}, 'active' FROM auth_users u WHERE lower(u.email) = lower(${sql(email)}) ON CONFLICT(user_id, team_id) DO UPDATE SET membership_status = 'active', removed_at = NULL;`,
	`INSERT INTO auth_role_assignments (id, user_id, role_id, scope_type, scope_id, assignment_status, requested_reason, approved_at) SELECT ${sql(teamAdminAssignmentId)}, u.id, 'role_team_admin', 'team', ${sql(teamId)}, 'active', 'Initial auth runtime bootstrap', strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM auth_users u WHERE lower(u.email) = lower(${sql(email)}) ON CONFLICT(user_id, role_id, scope_type, scope_id) DO UPDATE SET assignment_status = 'active', requested_reason = 'Initial auth runtime bootstrap', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`,
	`INSERT INTO auth_audit_events (id, event_type, actor_user_id, team_id, target_type, target_id, permission_code, outcome, metadata_json) SELECT 'audit_bootstrap_' || lower(hex(randomblob(16))), 'auth.runtime.bootstrap', u.id, ${sql(teamId)}, 'user', u.id, 'role.assign', 'succeeded', json_object('source', 'bootstrap-d1-auth-runtime.yml', 'team_id', ${sql(teamId)}, 'admin_email', ${sql(email)}) FROM auth_users u WHERE lower(u.email) = lower(${sql(email)});`,
];

if (assignSafeguardingLead) {
	statements.append?.();
	statements.push(
		`INSERT INTO auth_role_assignments (id, user_id, role_id, scope_type, scope_id, assignment_status, requested_reason, approved_at) SELECT ${sql(safeguardingAssignmentId)}, u.id, 'role_safeguarding_lead', 'team', ${sql(teamId)}, 'active', 'Explicit auth runtime bootstrap safeguarding lead assignment', strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM auth_users u WHERE lower(u.email) = lower(${sql(email)}) ON CONFLICT(user_id, role_id, scope_type, scope_id) DO UPDATE SET assignment_status = 'active', requested_reason = 'Explicit auth runtime bootstrap safeguarding lead assignment', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`,
	);
}

const verify = `SELECT u.email, u.account_status, t.id AS team_id, t.team_status, m.membership_status, group_concat(r.role_key, ',') AS roles
FROM auth_users u
JOIN auth_team_memberships m ON m.user_id = u.id
JOIN auth_teams t ON t.id = m.team_id
LEFT JOIN auth_role_assignments ra ON ra.user_id = u.id
	AND ra.scope_type = 'team'
	AND ra.scope_id = t.id
	AND ra.assignment_status = 'active'
LEFT JOIN auth_roles r ON r.id = ra.role_id
WHERE lower(u.email) = lower(${sql(email)})
	AND t.id = ${sql(teamId)}
GROUP BY u.email, u.account_status, t.id, t.team_status, m.membership_status;`;

fs.writeFileSync(bootstrapSqlPath, `${statements.join('\n')}\n`, 'utf8');
fs.writeFileSync(verifySqlPath, `${verify}\n`, 'utf8');

console.log(`Generated ${bootstrapSqlPath} and ${verifySqlPath}`);
