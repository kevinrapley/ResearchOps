import assert from 'node:assert/strict';
import fs from 'node:fs';

const accountPage = fs.readFileSync('public/pages/account/index.html', 'utf8');
const accountTemplate = fs.readFileSync('src/govuk/templates/pages/account.njk', 'utf8');
const accountScript = fs.readFileSync('public/js/auth-account-page.js', 'utf8');
const productRequirements = fs.readFileSync(
	'docs/product/26/05/08/authentication-role-selection-requirements-2026-05-08.md',
	'utf8',
);
const story2Plan = fs.readFileSync('docs/product/26/05/30/auth-story-2-account-access-summary.md', 'utf8');

function assertAccountPageExistsAsDashboard() {
	assert.match(accountPage, /<title>Your ResearchOps account - ResearchOps Demo Suite<\/title>/);
	assert.match(accountPage, /<h1 class="govuk-heading-xl" id="account-dashboard-title">Your ResearchOps account<\/h1>/);
	assert.match(accountPage, /Check who you are signed in as, which teams you belong to and what you can do\./);
	assert.match(accountPage, /id="account-dashboard"/);
	assert.match(accountPage, /id="account-identity-title">Your account/);
	assert.match(accountPage, /id="account-user-value"/);
	assert.match(accountPage, /id="account-email-value"/);
	assert.match(accountPage, /id="account-status-value"/);
	assert.match(accountPage, /aria-label="Account summary"/);
	assert.match(accountPage, /id="account-current-team-section" hidden/);
	assert.match(accountPage, /id="account-current-team-value"/);
	assert.match(accountPage, /id="account-team-memberships"/);
	assert.match(accountPage, /Your teams and roles/);
	assert.match(accountPage, /You may have different roles and access in each team/);
	assert.match(accountPage, /id="account-team-access-requests-section" hidden/);
	assert.match(accountPage, /id="account-team-access-requests"/);
	assert.match(accountPage, /Team access requests/);
	assert.match(accountPage, /Requests shown here are awaiting approval/);
	assert.doesNotMatch(accountPage, /id="account-team-value"/);
	assert.doesNotMatch(accountPage, /id="account-roles-value"/);
	assert.doesNotMatch(accountPage, /<h2 class="govuk-heading-m" id="account-summary-title">Account summary<\/h2>/);
	assert.match(accountPage, /id="account-actions-section" hidden/);
	assert.match(accountPage, /id="account-actions"/);
	assert.doesNotMatch(accountPage, /id="account-no-actions"/);
	assert.match(accountPage, /id="account-permissions-details" hidden/);
	assert.match(accountPage, /View technical permission details/);
	assert.match(accountPage, /task-based access summary above/);
	assert.match(accountPage, /id="account-permissions"/);
	assert.match(accountPage, /id="account-logout"/);
}

function assertAccountTemplateMatchesGeneratedTeamAccessRequestSection() {
	assert.match(accountTemplate, /id="account-team-access-requests-section" hidden/);
	assert.match(accountTemplate, /id="account-team-access-requests"/);
	assert.match(accountTemplate, /Team access requests/);
	assert.match(accountTemplate, /Requests shown here are awaiting approval/);
	assert.match(accountTemplate, /team-access-request-20260530/);
}

function assertAccountPageDoesNotUseSuccessMessagePattern() {
	assert.equal(accountPage.includes('You are signed in'), false);
	assert.equal(accountPage.includes('Signed in successfully'), false);
	assert.equal(accountPage.includes('govuk-notification-banner--success'), false);
}

function assertAccountPageLoadsDashboardScript() {
	assert.match(accountPage, /\/js\/auth-account-page\.js\?v=team-access-request-20260530/);
}

function assertDashboardUsesSameOriginApiAndAuthContext() {
	assert.match(accountScript, /function defaultApiOrigin\(\)/);
	assert.match(accountScript, /return location\.origin/);
	assert.match(accountScript, /const API_ORIGIN = document\.documentElement\?\.dataset\?\.apiOrigin \|\| window\.API_ORIGIN \|\| defaultApiOrigin\(\)/);
	assert.match(accountScript, /fetchJson\('\/api\/me'\)/);
	assert.match(accountScript, /credentials: 'include'/);
	assert.match(accountScript, /location\.assign\(CONFIG\.SIGN_IN_URL\)/);
	assert.match(accountScript, /SIGN_IN_URL: '\/pages\/account\/sign-in\/'/);
	assert.doesNotMatch(accountScript, /rops-api-passwordless-preview/);
	assert.doesNotMatch(accountScript, /rops-api\.digikev-kevin-rapley\.workers\.dev/);
}

function assertDashboardRendersAccountIdentity() {
	assert.match(accountScript, /email: document\.getElementById\('account-email-value'\)/);
	assert.match(accountScript, /accountStatus: document\.getElementById\('account-status-value'\)/);
	assert.match(accountScript, /function formatAccountStatus\(value\)/);
	assert.match(accountScript, /if \(dom\.user\) dom\.user\.textContent = displayName\(context\)/);
	assert.match(accountScript, /if \(dom\.email\) dom\.email\.textContent = context\?\.user\?\.email \|\| 'Not available'/);
	assert.match(accountScript, /if \(dom\.accountStatus\) dom\.accountStatus\.textContent = formatAccountStatus\(context\?\.user\?\.accountStatus\)/);
	assert.doesNotMatch(accountScript, /session_token/);
	assert.doesNotMatch(accountScript, /providerSubject/);
	assert.doesNotMatch(accountScript, /Cf-Access-Jwt-Assertion/);
}

function assertDashboardRendersAdaptiveTeamMembershipPresentation() {
	assert.match(accountScript, /teamMemberships\(context\)/);
	assert.match(accountScript, /renderTeamMemberships\(context\)/);
	assert.match(accountScript, /context\?\.teamMemberships \|\| context\?\.memberTeams/);
	assert.match(accountScript, /fallbackActiveTeamMembership\(context\)/);
	assert.match(accountScript, /context\?\.activeTeam\?\.id/);
	assert.match(accountScript, /roles: context\.roles \|\| \[\]/);
	assert.match(accountScript, /permissions: context\.permissions \|\| \[\]/);
	assert.match(accountScript, /function renderTeamMembership\(team\)/);
	assert.match(accountScript, /govuk-summary-card/);
	assert.match(accountScript, /Current team/);
	assert.match(accountScript, /Role or roles/);
	assert.match(accountScript, /No active role/);
	assert.match(accountScript, /What this lets you do/);
	assert.match(accountScript, /No active access summary for this team/);
	assert.match(accountScript, /function renderNoTeamState\(\)/);
	assert.match(accountScript, /Request access to a team before using team-scoped ResearchOps features/);
	assert.match(accountScript, /href="\$\{CONFIG\.TEAM_ACCESS_URL\}">Request access to a team/);
	assert.match(accountScript, /dom\.title\) dom\.title\.textContent = 'Your ResearchOps account'/);
	assert.doesNotMatch(accountScript, /Team membership and role access/);
	assert.doesNotMatch(accountScript, /activeTeamLabel\(context\)/);
}

function assertDashboardRendersTeamAccessRequestsSeparately() {
	assert.match(accountScript, /TEAM_ACCESS_URL: '\/pages\/account\/team-access\/'/);
	assert.match(accountScript, /teamAccessRequestsSection: document\.getElementById\('account-team-access-requests-section'\)/);
	assert.match(accountScript, /teamAccessRequests: document\.getElementById\('account-team-access-requests'\)/);
	assert.match(accountScript, /function renderTeamAccessRequest\(request\)/);
	assert.match(accountScript, /Awaiting approval/);
	assert.match(accountScript, /This request does not give access to team records yet/);
	assert.match(accountScript, /data-cancel-team-access-request/);
	assert.match(accountScript, /function renderTeamAccessRequests\(requests = \[\]\)/);
	assert.match(accountScript, /setVisible\(dom\.teamAccessRequestsSection, false\)/);
	assert.match(accountScript, /setVisible\(dom\.teamAccessRequestsSection, true\)/);
	assert.match(accountScript, /async function loadTeamAccessRequests\(\)/);
	assert.match(accountScript, /fetchJson\('\/api\/team-access\/requests'\)/);
	assert.match(accountScript, /async function cancelTeamAccessRequest\(requestId\)/);
	assert.match(accountScript, /fetchJson\('\/api\/team-access\/requests\/cancel'/);
	assert.match(accountScript, /renderDashboard\(response\.data, requests\)/);
}

function assertDashboardRendersCurrentTeamContextWithoutHidingMemberships() {
	assert.match(accountScript, /function renderCurrentTeam\(context, memberships\)/);
	assert.match(accountScript, /const currentTeam = memberships\.find\(\(team\) => team\.current\) \|\| context\?\.activeTeam \|\| null/);
	assert.match(accountScript, /dom\.currentTeam\.textContent = currentTeam\.name \|\| currentTeam\.id/);
	assert.match(accountScript, /setVisible\(dom\.currentTeamSection, true\)/);
	assert.match(accountScript, /renderCurrentTeam\(context, memberships\)/);
	assert.match(accountScript, /renderTeamMemberships\(context\)/);
}

function assertDashboardSeparatesRolesFromCapabilities() {
	assert.match(accountScript, /function roleLabels\(team\)/);
	assert.match(accountScript, /labelList\(team\?\.roles, 'No active role'\)/);
	assert.match(accountScript, /function capabilityLabel\(permission\)/);
	assert.match(accountScript, /return permission\?\.label \|\| permission\?\.description \|\| ''/);
	assert.match(accountScript, /function capabilityItems\(permissions = \[\]\)/);
	assert.match(accountScript, /renderCapabilityList\(team\)/);
	assert.doesNotMatch(accountScript, /item\.code \|\| item\.key/);
	assert.doesNotMatch(accountScript, /labelList\(team\.permissions, 'No active permissions'\)/);
	assert.doesNotMatch(accountScript, /No active permissions for the current team context/);
}

function assertDashboardExplainsSensitiveAccessProportionately() {
	assert.match(accountScript, /capability\.sensitive/);
	assert.match(accountScript, /Sensitive access/);
	assert.doesNotMatch(accountScript, /dangerous permission/);
	assert.doesNotMatch(accountScript, /high risk permission/);
}

function assertDashboardExplainsResearchOpsCoreTeamAdmin() {
	assert.match(accountScript, /function isResearchOpsCoreTeam\(team\)/);
	assert.match(accountScript, /team\?\.id === 'team_researchops_core'/);
	assert.match(accountScript, /team\?\.name === 'ResearchOps Core Team'/);
	assert.match(accountScript, /function isResearchOpsCoreTeamAdmin\(team\)/);
	assert.match(accountScript, /hasRole\(team, 'team_admin'\)/);
	assert.match(accountScript, /function hasResearchOpsCoreTeamAdmin\(memberships\)/);
	assert.match(accountScript, /You are a Team Admin in ResearchOps Core Team/);
	assert.match(accountScript, /manage roles across teams and create new teams/);
}

function assertDashboardActionsArePermissionBasedAndHiddenWhenUnavailable() {
	assert.match(accountScript, /permission: 'role\.assign'/);
	assert.match(accountScript, /permission: 'governed\.approve'/);
	assert.match(accountScript, /permission: 'safeguarding\.view'/);
	assert.match(accountScript, /permission: 'audit\.view'/);
	assert.match(accountScript, /function allowedActions\(context\)/);
	assert.match(accountScript, /ACTIONS\.filter\(\(action\) => codes\.has\(action\.permission\)\)/);
	assert.match(accountScript, /setVisible\(dom\.actionsSection, actions\.length > 0\)/);
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
	assert.match(productRequirements, /The system should support scoped roles/);
	assert.match(productRequirements, /Use plain language descriptions/);
	assert.match(productRequirements, /Roles should map to permissions/);
	assert.match(productRequirements, /Client-side hiding is convenience, not security/);
}

function assertStory2ScopeIsAccountSummaryOnly() {
	assert.match(story2Plan, /Story 2 should make access understandable/);
	assert.match(story2Plan, /It should not make access changeable/);
	assert.match(story2Plan, /switching active team/);
	assert.match(story2Plan, /requesting a role/);
	assert.match(story2Plan, /approving role requests/);
}

assertAccountPageExistsAsDashboard();
assertAccountTemplateMatchesGeneratedTeamAccessRequestSection();
assertAccountPageDoesNotUseSuccessMessagePattern();
assertAccountPageLoadsDashboardScript();
assertDashboardUsesSameOriginApiAndAuthContext();
assertDashboardRendersAccountIdentity();
assertDashboardRendersAdaptiveTeamMembershipPresentation();
assertDashboardRendersTeamAccessRequestsSeparately();
assertDashboardRendersCurrentTeamContextWithoutHidingMemberships();
assertDashboardSeparatesRolesFromCapabilities();
assertDashboardExplainsSensitiveAccessProportionately();
assertDashboardExplainsResearchOpsCoreTeamAdmin();
assertDashboardActionsArePermissionBasedAndHiddenWhenUnavailable();
assertDashboardSupportsLogout();
assertProductRequirementsSupportPermissionBasedDashboard();
assertStory2ScopeIsAccountSummaryOnly();
