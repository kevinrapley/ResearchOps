import assert from 'node:assert/strict';
import fs from 'node:fs';

const signInPage = fs.readFileSync('public/pages/account/sign-in/index.html', 'utf8');
const signInScript = fs.readFileSync('public/js/auth-sign-in-page.js', 'utf8');
const accountScript = fs.readFileSync('public/js/auth-account-page.js', 'utf8');
const worker = fs.readFileSync('infra/cloudflare/src/worker.js', 'utf8');
const access = fs.readFileSync('infra/cloudflare/src/core/auth/access.js', 'utf8');
const accessScoped = fs.readFileSync('infra/cloudflare/src/core/auth/access-scoped.js', 'utf8');
const passwordless = fs.readFileSync('infra/cloudflare/src/core/auth/passwordless.js', 'utf8');
const routePermissions = fs.readFileSync('infra/cloudflare/src/core/auth/route-permissions.js', 'utf8');
const authFoundationMigration = fs.readFileSync('infra/cloudflare/migrations/0001_auth_foundation.sql', 'utf8');
const identityRouteMigration = fs.readFileSync('infra/cloudflare/migrations/0004_auth_identity_route.sql', 'utf8');
const authFoundationTest = fs.readFileSync('tests/auth-foundation-route-state.test.js', 'utf8');
const signInRouteTest = fs.readFileSync('tests/auth-sign-in-route-state.test.js', 'utf8');
const seedRunbook = fs.readFileSync('docs/product/26/05/30/auth-story-1-d1-alpha-user-seed-runbook.md', 'utf8');

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

function sourceBlock(source, startText, endText) {
	const start = source.indexOf(startText);
	const end = source.indexOf(endText, start + startText.length);
	assert.notEqual(start, -1, `Expected block start: ${startText}`);
	assert.notEqual(end, -1, `Expected block end: ${endText}`);
	return source.slice(start, end);
}

function assertAC2IdentityProviderEstablishesIdentity() {
	includes(signInPage, 'data-start-route="/api/auth/email/start"', 'sign-in page');
	includes(signInPage, 'data-verify-route="/api/auth/email/verify"', 'sign-in page');
	includes(signInScript, "fetchJson(route, {", 'sign-in script');
	includes(signInScript, "credentials: 'include'", 'sign-in script');
	includes(passwordless, "const PROVIDER = 'researchops_email';", 'passwordless auth service');
	includes(passwordless, 'function ensureIdentity(db, user, email)', 'passwordless auth service');
	includes(passwordless, 'INSERT OR IGNORE INTO auth_identities', 'passwordless auth service');
	includes(passwordless, 'resolvePasswordlessSessionContext', 'passwordless auth service');
	includes(worker, 'apiPath.startsWith("/api/auth/email/")', 'Worker');
	includes(worker, 'apiPath === "/api/me/identity"', 'Worker');
}

function assertAC3StableInternalUserIdIsResolved() {
	includes(authFoundationMigration, 'CREATE TABLE IF NOT EXISTS auth_users', 'auth foundation migration');
	includes(authFoundationMigration, 'id TEXT PRIMARY KEY', 'auth foundation migration');
	includes(authFoundationMigration, 'CREATE TABLE IF NOT EXISTS auth_identities', 'auth foundation migration');
	includes(authFoundationMigration, 'user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE', 'auth foundation migration');
	includes(authFoundationMigration, 'UNIQUE (provider, provider_subject)', 'auth foundation migration');
	includes(passwordless, 'SELECT s.id AS session_id, u.id, u.email, u.display_name, u.account_status', 'passwordless session resolver');
	includes(passwordless, 'FROM auth_sessions s INNER JOIN auth_users u ON u.id = s.user_id', 'passwordless session resolver');
	includes(accessScoped, 'id: context.user.id', 'identity-only response');
	includes(seedRunbook, '<USER_ID>', 'D1 seed runbook');
	includes(seedRunbook, '<IDENTITY_ID>', 'D1 seed runbook');
}

function assertAC4FirstTimeKnownUserCanBeCreatedOrMatchedSafely() {
	includes(passwordless, 'async function userForEmail(db, email)', 'passwordless user resolution');
	includes(passwordless, 'SELECT id, email, display_name, account_status FROM auth_users WHERE lower(email) = lower(?) LIMIT 1', 'passwordless user resolution');
	includes(passwordless, "INSERT INTO auth_users (id, email, display_name, account_status) VALUES (?, ?, ?, 'pending')", 'passwordless user resolution');
	includes(passwordless, 'await ensureIdentity(db, user, challenge.email);', 'passwordless verification');
	includes(seedRunbook, '"accountStatus": "active"', 'D1 seed runbook');
	includes(seedRunbook, 'team membership', 'D1 seed runbook');
	includes(seedRunbook, 'role assignment', 'D1 seed runbook');
	includes(seedRunbook, 'permission exception', 'D1 seed runbook');
}

function assertAC5IdentityRouteReturnsSignedInIdentityOnly() {
	includes(accessScoped, "apiPath === '/api/me/identity'", 'scoped access handler');
	includes(accessScoped, 'provider: context.provider', 'identity-only response');
	includes(accessScoped, 'user: identityUserFor(context)', 'identity-only response');
	includes(accessScoped, 'function identityUserFor(context)', 'identity-only response');
	includes(accessScoped, 'displayName: context.user.displayName', 'identity-only response');
	includes(accessScoped, 'accountStatus: context.user.accountStatus', 'identity-only response');

	const identityBlock = sourceBlock(accessScoped, "apiPath === '/api/me/identity'", "apiPath === '/api/me/permissions'");
	excludes(identityBlock, 'activeTeam', 'identity-only route block');
	excludes(identityBlock, 'roles', 'identity-only route block');
	excludes(identityBlock, 'permissions', 'identity-only route block');
	excludes(identityBlock, 'teamMemberships', 'identity-only route block');
	excludes(identityBlock, 'memberTeams', 'identity-only route block');
	excludes(identityBlock, 'session', 'identity-only route block');
	excludes(identityBlock, 'token', 'identity-only route block');
}

function assertAC6SignedOutIdentityRequestsFailSafely() {
	includes(authFoundationTest, 'assertMeIdentityRouteFailsClosedWithoutAccessToken', 'auth foundation route-state test');
	includes(authFoundationTest, 'https://worker.test/api/me/identity', 'auth foundation route-state test');
	includes(authFoundationTest, 'assert.equal(response.status, 401)', 'auth foundation route-state test');
	includes(authFoundationTest, 'assert.equal(payload.error, "authentication_required")', 'auth foundation route-state test');
	includes(access, 'authentication_required', 'base access resolver');
	includes(access, 'Sign in is required to use this part of ResearchOps.', 'base access resolver');
}

function assertAC7FailedSignInAvoidsAccountEnumeration() {
	includes(passwordless, "throw new AuthFlowError(400, 'code_invalid', 'The code is not valid.')", 'passwordless verification');
	includes(passwordless, "throw new AuthFlowError(400, 'code_expired', 'The code is no longer valid.')", 'passwordless verification');
	includes(passwordless, "throw new AuthFlowError(429, 'code_attempts_exceeded', 'Too many incorrect codes. Request a new sign-in code.')", 'passwordless verification');
	excludes(passwordless, 'account does not exist', 'passwordless auth service');
	excludes(passwordless, 'email does not exist', 'passwordless auth service');
	excludes(passwordless, 'unknown email', 'passwordless auth service');
	excludes(passwordless, 'user not found', 'passwordless auth service');
}

function assertAC8SignOutIsAvailableAndUnderstandable() {
	includes(accountScript, "logout: document.getElementById('account-logout')", 'account page script');
	includes(accountScript, "await fetchJson('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });", 'account page script');
	includes(accountScript, 'location.assign(CONFIG.SIGN_IN_URL)', 'account page script');
	includes(passwordless, 'async function logout(request, env)', 'passwordless auth service');
	includes(passwordless, "UPDATE auth_sessions SET session_status = 'revoked'", 'passwordless auth service');
	includes(passwordless, "'set-cookie': sessionCookie(request, '', 0)", 'passwordless auth service');
	includes(worker, 'apiPath === "/api/auth/logout"', 'Worker');
}

function assertAC9AuthEventsAreSeparateFromApplicationAuditEvents() {
	includes(authFoundationMigration, 'CREATE TABLE IF NOT EXISTS auth_events', 'auth foundation migration');
	includes(authFoundationMigration, 'CREATE TABLE IF NOT EXISTS auth_audit_events', 'auth foundation migration');
	includes(passwordless, 'async function authEvent(db, request, type, metadata = {})', 'passwordless auth service');
	includes(passwordless, 'INSERT INTO auth_events', 'passwordless auth service');
	includes(passwordless, 'auth.email_code.requested', 'passwordless auth service');
	includes(passwordless, 'auth.email_code.failed', 'passwordless auth service');
	includes(passwordless, 'auth.email_code.locked', 'passwordless auth service');
	includes(passwordless, 'auth.sign_in.succeeded', 'passwordless auth service');
	excludes(passwordless, 'INSERT INTO auth_audit_events', 'passwordless auth service');
}

function assertAC10SignInJourneyIsAccessible() {
	includes(signInPage, 'aria-live="polite"', 'sign-in page');
	includes(signInPage, 'aria-busy="false"', 'sign-in page');
	includes(signInPage, 'aria-labelledby="sign-in-status-title"', 'sign-in page');
	includes(signInPage, '<label class="govuk-label govuk-label--m" for="sign-in-email">Email address</label>', 'sign-in page');
	includes(signInPage, 'aria-describedby="sign-in-email-hint"', 'sign-in page');
	includes(signInPage, '<label class="govuk-label govuk-label--m" for="sign-in-code">Security code</label>', 'sign-in page');
	includes(signInPage, 'aria-describedby="sign-in-code-hint"', 'sign-in page');
	includes(signInPage, 'autocomplete="one-time-code"', 'sign-in page');
	includes(signInScript, 'dom.emailInput?.focus()', 'sign-in script');
	includes(signInScript, 'dom.codeInput?.focus()', 'sign-in script');
}

function assertAC11NoCustomPasswordSystemIsIntroduced() {
	excludes(signInPage, 'type="password"', 'sign-in page');
	excludes(signInPage, 'name="password"', 'sign-in page');
	excludes(signInScript, 'localStorage', 'sign-in script');
	excludes(signInScript, 'sessionStorage', 'sign-in script');
	includes(passwordless, 'RESEARCHOPS_AUTH_SECRET', 'passwordless auth service');
	includes(passwordless, 'code_hash', 'passwordless auth service');
	includes(passwordless, 'session_token_hash', 'passwordless auth service');
}

function assertAC12ServerSideIdentityValidationIsCoveredByTests() {
	includes(authFoundationTest, 'assertMeIdentityRouteFailsClosedWithoutAccessToken', 'auth foundation route-state test');
	includes(authFoundationTest, 'assertIdentityOnlyRouteKeepsAuthorisationStateOutOfPrimaryResponse', 'auth foundation route-state test');
	includes(signInRouteTest, 'assertProtectedProjectsRouteRedirectsSignedOutUsersToSignIn', 'sign-in route-state test');
	includes(routePermissions, 'export async function assertRoutePermission(request, env, context)', 'route permissions service');
	includes(accessScoped, 'await assertRoutePermission(request, env, context)', 'scoped access handler');
	includes(identityRouteMigration, '/api/me/identity', 'identity route forward migration');
}

assertAC2IdentityProviderEstablishesIdentity();
assertAC3StableInternalUserIdIsResolved();
assertAC4FirstTimeKnownUserCanBeCreatedOrMatchedSafely();
assertAC5IdentityRouteReturnsSignedInIdentityOnly();
assertAC6SignedOutIdentityRequestsFailSafely();
assertAC7FailedSignInAvoidsAccountEnumeration();
assertAC8SignOutIsAvailableAndUnderstandable();
assertAC9AuthEventsAreSeparateFromApplicationAuditEvents();
assertAC10SignInJourneyIsAccessible();
assertAC11NoCustomPasswordSystemIsIntroduced();
assertAC12ServerSideIdentityValidationIsCoveredByTests();
