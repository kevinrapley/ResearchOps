import assert from 'node:assert/strict';
import fs from 'node:fs';

const accessSource = fs.readFileSync('infra/cloudflare/src/core/auth/access.js', 'utf8');
const workflowSource = fs.readFileSync('.github/workflows/bootstrap-d1-auth-runtime.yml', 'utf8');
const generatorSource = fs.readFileSync('scripts/auth-runtime-bootstrap.mjs', 'utf8');

function assertAccessLinksSeededUsersByEmail() {
	assert.match(accessSource, /async function findUserByEmail\(db, email\)/);
	assert.match(accessSource, /lower\(email\) = lower\(\?\)/);
	assert.match(accessSource, /async function linkAccessIdentityToUser\(db, user, payload\)/);
	assert.match(accessSource, /INSERT OR IGNORE INTO auth_identities/);
	assert.match(accessSource, /const seededUser = await findUserByEmail\(db, email\);/);
	assert.match(accessSource, /return linkAccessIdentityToUser\(db, seededUser, payload\);/);
	assert.match(accessSource, /const pendingUser = await createPendingUserForAccessPayload\(db, payload\);/);
}

function assertBootstrapWorkflowIsManualAndGuarded() {
	assert.match(workflowSource, /workflow_dispatch:/);
	assert.match(workflowSource, /confirm_database_name:/);
	assert.match(workflowSource, /confirm_operation:/);
	assert.match(workflowSource, /BOOTSTRAP_AUTH_RUNTIME/);
	assert.match(workflowSource, /admin_email:/);
	assert.match(workflowSource, /admin_display_name:/);
	assert.match(workflowSource, /assign_safeguarding_lead:/);
	assert.match(workflowSource, /node scripts\/auth-runtime-bootstrap\.mjs/);
	assert.match(workflowSource, /wrangler@\$\{WRANGLER_VERSION\} d1 execute/);
	assert.match(workflowSource, /--file "\$\{BOOTSTRAP_SQL\}"/);
	assert.match(workflowSource, /--file "\$\{VERIFY_SQL\}"/);
	assert.doesNotMatch(workflowSource, /pull_request:/);
	assert.doesNotMatch(workflowSource, /push:/);
}

function assertBootstrapGeneratorCreatesRequiredRecords() {
	assert.match(generatorSource, /ADMIN_EMAIL/);
	assert.match(generatorSource, /ADMIN_DISPLAY_NAME/);
	assert.match(generatorSource, /TEAM_ID/);
	assert.match(generatorSource, /TEAM_NAME/);
	assert.match(generatorSource, /ASSIGN_SAFEGUARDING_LEAD/);
	assert.match(generatorSource, /INSERT INTO auth_teams/);
	assert.match(generatorSource, /INSERT INTO auth_users/);
	assert.match(generatorSource, /INSERT INTO auth_team_memberships/);
	assert.match(generatorSource, /INSERT INTO auth_role_assignments/);
	assert.match(generatorSource, /role_team_admin/);
	assert.match(generatorSource, /role_safeguarding_lead/);
	assert.match(generatorSource, /INSERT INTO auth_audit_events/);
	assert.match(generatorSource, /auth\.runtime\.bootstrap/);
	assert.match(generatorSource, /ON CONFLICT\(email\) DO UPDATE/);
	assert.match(generatorSource, /ON CONFLICT\(user_id, team_id\) DO UPDATE/);
	assert.match(generatorSource, /ON CONFLICT\(user_id, role_id, scope_type, scope_id\) DO UPDATE/);
}

assertAccessLinksSeededUsersByEmail();
assertBootstrapWorkflowIsManualAndGuarded();
assertBootstrapGeneratorCreatesRequiredRecords();
