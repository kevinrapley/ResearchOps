import assert from 'node:assert/strict';
import fs from 'node:fs';

const workerSource = fs.readFileSync('infra/cloudflare/src/worker.js', 'utf8');
const handlerSource = fs.readFileSync('infra/cloudflare/src/core/auth/role-assignments-scoped.js', 'utf8');
const accessScopedSource = fs.readFileSync('infra/cloudflare/src/core/auth/access-scoped.js', 'utf8');
const migrationSource = fs.readFileSync('infra/cloudflare/migrations/0002_auth_role_assignment_route.sql', 'utf8');

function assertWorkerWiresScopedRoleAssignmentRoute() {
	assert.match(workerSource, /handleRoleAssignmentsRoute/);
	assert.match(workerSource, /\.\/core\/auth\/role-assignments-scoped\.js/);
	assert.doesNotMatch(workerSource, /\.\/core\/auth\/role-assignments\.js/);
	assert.match(workerSource, /method === "POST" && apiPath === "\/api\/auth\/role-assignments"/);
}

function assertHandlerUsesScopedAuthenticationAndRoutePermission() {
	assert.match(handlerSource, /\.\/access-scoped\.js/);
	assert.match(handlerSource, /resolveAuthenticatedContext/);
	assert.match(handlerSource, /assertRoutePermission/);
	assert.match(handlerSource, /routePermissionErrorResponse/);
	assert.match(handlerSource, /readJson\(request\)/);
}

function assertAccessContextSeparatesMembershipFromAdministration() {
	assert.match(accessScopedSource, /memberTeams/);
	assert.match(accessScopedSource, /manageableTeams/);
	assert.match(accessScopedSource, /roleAssignableTeams/);
	assert.match(accessScopedSource, /teams: manageableTeams/);
	assert.match(accessScopedSource, /async function listTeamsManagedByUser\(db, userId\)/);
	assert.match(accessScopedSource, /p\.code = 'role\.assign'/);
	assert.match(accessScopedSource, /async function isResearchOpsCoreTeamAdmin\(db, userId\)/);
	assert.match(accessScopedSource, /ResearchOps Core Team/);
	assert.match(accessScopedSource, /async function listAllActiveTeams\(db\)/);
}

function assertResearchOpsCoreTeamAdminIsTheOnlyGlobalAdministrationException() {
	assert.match(accessScopedSource, /r\.role_key = 'team_admin'/);
	assert.match(accessScopedSource, /t\.name = 'ResearchOps Core Team'/);
	assert.match(accessScopedSource, /const isCoreTeamAdmin = await isResearchOpsCoreTeamAdmin\(db, baseContext\?\.user\?\.id\)/);
	assert.match(accessScopedSource, /const manageableTeams = isCoreTeamAdmin \? await listAllActiveTeams\(db\) : await listTeamsManagedByUser\(db, baseContext\?\.user\?\.id\)/);
	assert.doesNotMatch(accessScopedSource, /user_researcher/);
	assert.doesNotMatch(accessScopedSource, /note_taker/);
}

function assertNoScenarioSpecificRoleCatalogueIsRequired() {
	assert.doesNotMatch(workerSource, /TEAM_SCOPED_ROLE_CATALOGUE_MIGRATION/);
	assert.doesNotMatch(handlerSource, /user_researcher/);
	assert.doesNotMatch(handlerSource, /note_taker/);
	assert.doesNotMatch(accessScopedSource, /user_researcher/);
	assert.doesNotMatch(accessScopedSource, /note_taker/);
}

function assertHandlerRequiresExplicitAssignableTeam() {
	assert.match(handlerSource, /function requestedTeamIdFor\(body, context\)/);
	assert.match(handlerSource, /body\.teamId/);
	assert.match(handlerSource, /active_team_required/);
	assert.match(handlerSource, /function manageableTeamsFor\(context\)/);
	assert.match(handlerSource, /context\.manageableTeams/);
	assert.match(handlerSource, /team_not_available/);
	assert.match(handlerSource, /async function canAssignRolesInTeam\(db, context, teamId\)/);
	assert.match(handlerSource, /context\.isResearchOpsCoreTeamAdmin/);
	assert.match(handlerSource, /p\.code = 'role\.assign'/);
	assert.match(handlerSource, /selected_team_role_assignment_forbidden/);
	assert.match(handlerSource, /async function resolveExistingAssignmentTeam\(db, context, body\)/);
	assert.match(handlerSource, /async function resolveAssignmentTeam\(db, request, context, body\)/);
	assert.doesNotMatch(handlerSource, /function assertActiveTeam\(context\)/);
}

function assertHandlerSupportsInlineTeamCreation() {
	assert.match(handlerSource, /const CREATE_TEAM_ACTION = 'create'/);
	assert.match(handlerSource, /requestedNewTeamNameFor/);
	assert.match(handlerSource, /new_team_name_required/);
	assert.match(handlerSource, /new_team_name_too_long/);
	assert.match(handlerSource, /function assertCanCreateTeam\(context\)/);
	assert.match(handlerSource, /permissions\.has\('team\.manage'\)/);
	assert.match(handlerSource, /permissions\.has\('role\.assign'\)/);
	assert.match(handlerSource, /team_creation_forbidden/);
	assert.match(handlerSource, /async function readActiveTeamByName\(db, teamName\)/);
	assert.match(handlerSource, /team_name_already_exists/);
	assert.match(handlerSource, /async function readTeamAdminRole\(db\)/);
	assert.match(handlerSource, /team_admin_role_unavailable/);
	assert.match(handlerSource, /function prepareCreateTeamStatement\(db, team\)/);
	assert.match(handlerSource, /INSERT INTO auth_teams/);
	assert.match(handlerSource, /prepareTeamCreationAuditStatement/);
	assert.match(handlerSource, /auth\.team\.created/);
}

function assertHandlerScopesAssignmentsToSelectedTeam() {
	assert.match(handlerSource, /const team = await resolveAssignmentTeam\(db, request, context, body\);/);
	assert.match(handlerSource, /scope_type = 'team'/);
	assert.match(handlerSource, /scope_id = \?/);
	assert.match(handlerSource, /readTeamMembership/);
	assert.match(handlerSource, /prepareMembershipStatement/);
	assert.match(handlerSource, /INSERT INTO auth_team_memberships/);
	assert.match(handlerSource, /ON CONFLICT\(user_id, team_id\) DO UPDATE SET/);
	assert.match(handlerSource, /membership_status = 'active'/);
	assert.match(handlerSource, /removed_at = NULL/);
	assert.doesNotMatch(handlerSource, /target_not_team_member/);
}

function assertHandlerActivatesPendingUserWhenAssigningRole() {
	assert.match(handlerSource, /prepareActivateUserStatement/);
	assert.match(handlerSource, /UPDATE auth_users/);
	assert.match(handlerSource, /SET account_status = 'active'/);
	assert.match(handlerSource, /WHERE id = \? AND account_status = 'pending'/);
	assert.match(handlerSource, /accountActivated/);
}

function assertHandlerRequiresTargetRoleTeamAndReason() {
	assert.match(handlerSource, /targetUserId/);
	assert.match(handlerSource, /targetEmail/);
	assert.match(handlerSource, /teamId/);
	assert.match(handlerSource, /newTeamName/);
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

function assertHandlerWritesMembershipAssignmentAndAuditEventAtomically() {
	assert.match(handlerSource, /function prepareMembershipStatement/);
	assert.match(handlerSource, /function prepareRoleAssignmentStatement/);
	assert.match(handlerSource, /function prepareAuditStatement/);
	assert.match(handlerSource, /async function writeAssignmentWithAudit/);
	assert.match(handlerSource, /typeof db\.batch !== 'function'/);
	assert.match(handlerSource, /role_assignment_transaction_unavailable/);
	assert.match(handlerSource, /await db\.batch\(statements\);/);
	assert.match(handlerSource, /team\.preAssignmentStatements/);
	assert.match(handlerSource, /INSERT INTO auth_team_memberships/);
	assert.match(handlerSource, /INSERT INTO auth_role_assignments/);
	assert.match(handlerSource, /ON CONFLICT\(user_id, role_id, scope_type, scope_id\) DO UPDATE/);
	assert.match(handlerSource, /INSERT INTO auth_audit_events/);
	assert.match(handlerSource, /auth\.role_assignment\.created/);
	assert.match(handlerSource, /permission_code/);
	assert.match(handlerSource, /role\.assign/);
	assert.match(handlerSource, /team_membership_activated/);
}

function assertHandlerReturnsSelectedTeam() {
	assert.match(handlerSource, /team: \{ id: result\.team\.id, name: result\.team\.name, created: result\.team\.created === true \}/);
	assert.match(handlerSource, /scopeId: result\.team\.id/);
}

function assertRouteStatusMigrationExists() {
	assert.match(migrationSource, /UPDATE auth_route_permissions/);
	assert.match(migrationSource, /implementation_status = 'implemented'/);
	assert.match(migrationSource, /method = 'POST'/);
	assert.match(migrationSource, /route_pattern = '\/api\/auth\/role-assignments'/);
	assert.match(migrationSource, /required_permissions_json = '\["role.assign"\]'/);
}

assertWorkerWiresScopedRoleAssignmentRoute();
assertHandlerUsesScopedAuthenticationAndRoutePermission();
assertAccessContextSeparatesMembershipFromAdministration();
assertResearchOpsCoreTeamAdminIsTheOnlyGlobalAdministrationException();
assertNoScenarioSpecificRoleCatalogueIsRequired();
assertHandlerRequiresExplicitAssignableTeam();
assertHandlerSupportsInlineTeamCreation();
assertHandlerScopesAssignmentsToSelectedTeam();
assertHandlerActivatesPendingUserWhenAssigningRole();
assertHandlerRequiresTargetRoleTeamAndReason();
assertHandlerRejectsConflictingTargetIdentifiers();
assertHandlerRequiresSensitiveRoleConfirmation();
assertHandlerWritesMembershipAssignmentAndAuditEventAtomically();
assertHandlerReturnsSelectedTeam();
assertRouteStatusMigrationExists();
