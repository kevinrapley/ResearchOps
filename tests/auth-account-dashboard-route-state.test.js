import assert from 'node:assert/strict';
import fs from 'node:fs';

const accountPage = fs.readFileSync('public/pages/account/index.html', 'utf8');
const accountScript = fs.readFileSync('public/js/auth-account-page.js', 'utf8');
const productRequirements = fs.readFileSync(
	'docs/product/26/05/08/authentication-role-selection-requirements-2026-05-08.md',
	'utf8',
);

function assertAccountPageExistsAsDashboard() {
	assert.match(accountPage, /<title>Your ResearchOps account - ResearchOps Demo Suite<\/title>/);
	assert.match(accountPage, /<h1 class="govuk-heading-xl" id="account-dashboard-title">Welcome\. Here is your account dashboard<\/h1>/);
	assert.match(accountPage, /id="account-dashboard"/);
	assert.match(accountPage, /id="account-user-value"/);
	assert.match(accountPage, /id="account-team-memberships"/);
	assert.match(accountPage, /Teams and roles/);
	assert.match(accountPage, /Your roles are scoped by team/);
	assert.doesNotMatch(accountPage, /id="account-team-value"/);
	assert.doesNotMatch(accountPage, /id="account-roles-value"/);
	assert.match(accountPage, /id="account-actions"/);
	assert.match(accountPage, /id="account-permissions"/);
	assert.match(accountPage, /id="account-logout"/);
}

function assertAccountPageDoesNotUseSuccessMessagePattern() {
	assert.equal(accountPage.includes('You are signed in'), false);
	assert.equal(accountPage.includes('Signed in successfully'), false);
	assert.equal(accountPage.includes('govuk-notification-banner--success'), false);
}

function assertAccountPageLoadsDashboardScript() {
	assert.match(accountPage, /\/js\/auth-account-page\.js\?v=account-dashboard-20260513-teams/);
}

function assertDashboardUsesPasswordlessApiAndAuthContext() {
	assert.match(accountScript, /function defaultApiOrigin\(\)/);
	assert.match(accountScript, /rops-api-passwordless-preview/);
	assert.match(accountScript, /fetchJson\('\/api\/me'\)/);
	assert.match(accountScript, /credentials: 'include'/);
	assert.match(accountScript, /location\.assign\(CONFIG\.SIGN_IN_URL\)/);
	assert.match(accountScript, /SIGN_IN_URL: '\/pages\/account\/sign-in\/'/);
}

function assertDashboardRendersAdaptiveTeamMembershipPresentation() {
	assert.match(accountScript, /teamMemberships\(context\)/);
	assert.match(accountScript, /renderTeamMemberships\(context\)/);
	assert.match(accountScript, /context\?\.teamMemberships \|\| context\?\.memberTeams/);
	assert.match(accountScript, /fallbackActiveTeamMembership\(context\)/);
	assert.match(accountScript, /context\?\.activeTeam\?\.id/);
	assert.match(accountScript, /roles: context\.roles \|\| \[\]/);
	assert.match(accountScript, /permissions: context\.permissions \|\| \[\]/);
	assert.match(accountScript, /function renderSingleTeamMembership\(team\)/);
	assert.match(accountScript, /function renderMultipleTeamMemberships\(memberships\)/);
	assert.match(accountScript, /govuk-summary-card/);
	assert.match(accountScript, /Your team/);
	assert.match(accountScript, /Your teams/);
	assert.match(accountScript, /You have different access in each team/);
	assert.match(accountScript, /Role or roles/);
	assert.match(accountScript, /No active role/);
	assert.match(accountScript, /Welcome, \$\{name\}\. Here is your account dashboard/);
	assert.match(accountScript, /context\?\.permissions/);
	assert.doesNotMatch(accountScript, /Team membership and role access/);
	assert.doesNotMatch(accountScript, /<table class="govuk-table">/);
	assert.doesNotMatch(accountScript, /<th scope="col" class="govuk-table__header">Permissions<\/th>/);
	assert.doesNotMatch(accountScript, /activeTeamLabel\(context\)/);
}

function assertDashboardSeparatesRolesFromCapabilities() {
	assert.match(accountScript, /function roleLabels\(team\)/);
	assert.match(accountScript, /labelList\(team\?\.roles, 'No active role'\)/);
	assert.match(accountScript, /renderPermissions\(context\)/);
	assert.doesNotMatch(accountScript, /labelList\(team\.permissions, 'No active permissions'\)/);
}

function assertDashboardExplainsResearchOpsCoreTeamAdmin() {
	assert.match(accountScript, /function isResearchOpsCoreTeam\(team\)/);
	assert.match(accountScript, /team\?\.id === 'team_researchops_core'/);
	assert.match(accountScript, /team\?\.name === 'ResearchOps Core Team'/);
	assert.match(accountScript, /function isResearchOpsCoreTeamAdmin\(team\)/);
	assert.match(accountScript, /hasRole\(team, 'team_admin'\)/);
	assert.match(accountScript, /You are a Team Admin in ResearchOps Core Team/);
	assert.match(accountScript, /manage roles across teams and create new teams/);
}

function assertDashboardActionsArePermissionBased() {
	assert.match(accountScript, /permission: 'role\.assign'/);
	assert.match(accountScript, /permission: 'governed\.approve'/);
	assert.match(accountScript, /permission: 'safeguarding\.view'/);
	assert.match(accountScript, /permission: 'audit\.view'/);
	assert.match(accountScript, /ACTIONS\.filter\(\(action\) => codes\.has\(action\.permission\)\)/);
	assert.equal(accountScript.includes("role.label === 'Team Admin'"), false);
	assert.equal(accountScript.includes("role.key === 'team_admin'"), false);
}

function assertDashboardSupportsLogout() {
	assert.match(accountScript, /fetchJson\('\/api\/auth\/logout'/);
	assert.match(accountScript, /method: 'POST'/);
	assert.match(accountScript, /location\.assign\(CONFIG\.SIGN_IN_URL\)/);
}

function assertProductRequirementsSupportPermissionBasedDashboard() {
	assert.match(productRequirements, /Users should know who they are signed in as and what team context is active/);
	assert.match(productRequirements, /Given a user belongs to multiple teams, then the active team is visible/);
	assert.match(productRequirements, /Given a role is active, then account settings show the role and main permissions/);
	assert.match(productRequirements, /Use permission checks like `governed\.approve` or `safeguarding\.view`/);
	assert.match(productRequirements, /Given a user signs out, then the local ResearchOps session is invalidated/);
}

assertAccountPageExistsAsDashboard();
assertAccountPageDoesNotUseSuccessMessagePattern();
assertAccountPageLoadsDashboardScript();
assertDashboardUsesPasswordlessApiAndAuthContext();
assertDashboardRendersAdaptiveTeamMembershipPresentation();
assertDashboardSeparatesRolesFromCapabilities();
assertDashboardExplainsResearchOpsCoreTeamAdmin();
assertDashboardActionsArePermissionBased();
assertDashboardSupportsLogout();
assertProductRequirementsSupportPermissionBasedDashboard();
