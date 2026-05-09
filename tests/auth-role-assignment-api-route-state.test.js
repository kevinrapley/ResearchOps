import assert from 'node:assert/strict';
import fs from 'node:fs';

const workerSource = fs.readFileSync('infra/cloudflare/src/worker.js', 'utf8');
const handlerSource = fs.readFileSync('infra/cloudflare/src/core/auth/role-assignments.js', 'utf8');
const migrationSource = fs.readFileSync('infra/cloudflare/migrations/0002_auth_role_assignment_route.sql', 'utf8');

function assertWorkerWiresRoleAssignmentRoute() {
	assert.match(workerSource, /handleRoleAssignmentsRoute/);
	assert.match(workerSource, /\.\/core\/auth\/role-assignments\.js/);
	assert.match(workerSource, /method === "POST" && apiPath === "\/api\/auth\/role-assignments"/);
}

function assertHandlerUsesAuthenticationAndRoutePermission() {
	assert.match(handlerSource, /resolveAuthenticatedContext/);
	assert.match(handlerSource, /assertRoutePermission/);
	assert.match(handlerSource, /routePermissionErrorResponse/);
	assert.match(handlerSource, /readJson\(request\)/);
}

function assertHandlerScopesAssignmentsToActiveTeam() {
	assert.match(handlerSource, /assertActiveTeam\(context\)/);
	assert.match(handlerSource, /scope_type = 'team'/);
	assert.match(handlerSource, /scope_id = \?/);
	assert.match(handlerSource, /readActiveMembership/);
	assert.match(handlerSource, /target_not_team_member/);
}

function assertHandlerRequiresTargetRoleAndReason() {
	assert.match(handlerSource, /targetUserId/);
	assert.match(handlerSource, /targetEmail/);
	assert.match(handlerSource, /roleKey/);
	assert.match(handlerSource, /requestedReason/);
	assert.match(handlerSource, /role_assignment_reason_required/);
	assert.match(handlerSource, /role_not_found/);
	assert.match(handlerSource, /target_user_not_found/);
}

function assertHandlerRejectsConflictingTargetIdentifiers() {
	assert.match(handlerSource, /async function readUserById/);
	assert.match(handlerSource, /async function readUserByEmail/);
	assert.match(handlerSource, /const userById = await readUserById\(db, targetUserId\);/);
	assert.match(handlerSource, /const userByEmail = await readUserByEmail\(db, targetEmail\);/);
	assert.match(handlerSource, /target_identifier_conflict/);
	assert.match(handlerSource, /targetUserId and targetEmail must resolve to the same user/);
}

function assertHandlerRequiresSensitiveRoleConfirmation() {
	assert.match(handlerSource, /sensitiveRoleConfirmation/);
	assert.match(handlerSource, /ASSIGN_SENSITIVE_ROLE/);
	assert.match(handlerSource, /sensitive_role_confirmation_required/);
	assert.match(handlerSource, /safeguardingConfirmation/);
	assert.match(handlerSource, /ASSIGN_SAFEGUARDING_LEAD/);
	assert.match(handlerSource, /safeguarding_role_confirmation_required/);
}

function assertHandlerWritesAssignmentAndAuditEventAtomically() {
	assert.match(handlerSource, /function prepareAssignmentStatement/);
	assert.match(handlerSource, /function prepareAuditStatement/);
	assert.match(handlerSource, /async function writeAssignmentWithAudit/);
	assert.match(handlerSource, /typeof db\.batch !== "function"/);
	assert.match(handlerSource, /role_assignment_transaction_unavailable/);
	assert.match(handlerSource, /await db\.batch\(\[assignmentStatement, auditStatement\]\);/);
	assert.match(handlerSource, /INSERT INTO auth_role_assignments/);
	assert.match(handlerSource, /ON CONFLICT\(user_id, role_id, scope_type, scope_id\) DO UPDATE/);
	assert.match(handlerSource, /INSERT INTO auth_audit_events/);
	assert.match(handlerSource, /auth\.role_assignment\.created/);
	assert.match(handlerSource, /permission_code/);
	assert.match(handlerSource, /role\.assign/);
}

function assertRouteStatusMigrationExists() {
	assert.match(migrationSource, /UPDATE auth_route_permissions/);
	assert.match(migrationSource, /implementation_status = 'implemented'/);
	assert.match(migrationSource, /method = 'POST'/);
	assert.match(migrationSource, /route_pattern = '\/api\/auth\/role-assignments'/);
	assert.match(migrationSource, /required_permissions_json = '\["role.assign"\]'/);
}

assertWorkerWiresRoleAssignmentRoute();
assertHandlerUsesAuthenticationAndRoutePermission();
assertHandlerScopesAssignmentsToActiveTeam();
assertHandlerRequiresTargetRoleAndReason();
assertHandlerRejectsConflictingTargetIdentifiers();
assertHandlerRequiresSensitiveRoleConfirmation();
assertHandlerWritesAssignmentAndAuditEventAtomically();
assertRouteStatusMigrationExists();
