import assert from 'node:assert/strict';
import fs from 'node:fs';

const signInPage = fs.readFileSync('public/pages/account/sign-in/index.html', 'utf8');
const signInScript = fs.readFileSync('public/js/auth-sign-in-page.js', 'utf8');
const worker = fs.readFileSync('infra/cloudflare/src/worker.js', 'utf8');
const access = fs.readFileSync('infra/cloudflare/src/core/auth/access.js', 'utf8');
const passwordless = fs.readFileSync('infra/cloudflare/src/core/auth/passwordless.js', 'utf8');
const migration = fs.readFileSync('infra/cloudflare/migrations/0003_auth_passwordless_sessions.sql', 'utf8');

function assertSignInPageUsesGovukFrontendTemplate() {
	assert.match(signInPage, /<html class="govuk-template" lang="en">/);
	assert.match(signInPage, /<body class="govuk-template__body">/);
	assert.match(signInPage, /govuk-frontend-supported/);
	assert.match(signInPage, /href="\/assets\/govuk\/govuk-frontend\.css"/);
	assert.match(signInPage, /src="\/components\/layout\.js"/);
	assert.match(signInPage, /src="\/js\/govuk-frontend-init\.js"/);
	assert.match(signInPage, /<x-include src="\/partials\/header\.html" vars='\{"active":""\}'><\/x-include>/);
	assert.match(signInPage, /<x-include src="\/partials\/footer\.html"><\/x-include>/);
	assert.match(signInPage, /<main class="govuk-main-wrapper" id="main-content" role="main" tabindex="-1">/);
	assert.match(signInPage, /class="govuk-width-container"/);
	assert.equal(signInPage.includes('/css/govuk/govuk-page-chrome.css'), false);
	assert.equal(signInPage.includes('/css/govuk/govuk-frontend-v6.css'), false);
	assert.equal(signInPage.includes('/css/screen.css'), false);
	assert.equal(signInPage.includes('<noscript><a class="govuk-skip-link"'), false);
	assert.equal(signInPage.includes('vars=\'{"org":"Home Office Biometrics"'), false);
}

function assertSignInPageUsesResearchOpsPasswordlessJourney() {
	assert.match(signInPage, /<title>Sign in to ResearchOps - ResearchOps Demo Suite<\/title>/);
	assert.match(signInPage, /<h1 class="govuk-heading-xl">Sign in to ResearchOps<\/h1>/);
	assert.match(signInPage, /Use your work email address to continue\./);
	assert.match(signInPage, /We will send you a 6 digit code/);
	assert.match(signInPage, /id="email-code-start-form"/);
	assert.match(signInPage, /id="email-code-verify-form"/);
	assert.match(signInPage, /id="sign-in-email"/);
	assert.match(signInPage, /type="email"/);
	assert.match(signInPage, /id="sign-in-code"/);
	assert.match(signInPage, /autocomplete="one-time-code"/);
	assert.match(signInPage, /data-start-route="\/api\/auth\/email\/start"/);
	assert.match(signInPage, /data-verify-route="\/api\/auth\/email\/verify"/);
	assert.match(signInPage, /data-auth-route="\/api\/me"/);
	assert.match(signInPage, /data-account-destination="\/pages\/account\/"/);
	assert.equal(signInPage.includes('data-team-admin-destination'), false);
	assert.equal(signInPage.includes('id="signed-in-actions"'), false);
}

function assertSignInPageDoesNotExposeCloudflareToUser() {
	assert.equal(signInPage.includes('Cloudflare'), false);
	assert.equal(signInPage.includes('Cf-Access-Jwt-Assertion'), false);
	assert.equal(signInPage.includes('/api/auth/login'), false);
	assert.equal(signInScript.includes('ACCESS_LOGIN_URL'), false);
	assert.equal(signInScript.includes('Cloudflare'), false);
}

function assertSignInPageDoesNotCreatePasswordAuth() {
	assert.equal(signInPage.includes('type="password"'), false);
	assert.equal(signInPage.includes('name="password"'), false);
	assert.equal(signInPage.includes('Create password'), false);
	assert.equal(signInScript.includes('localStorage'), false);
	assert.equal(signInScript.includes('sessionStorage'), false);
}

function assertSignInScriptStartsAndVerifiesEmailCode() {
	assert.match(signInScript, /email-code-start-form/);
	assert.match(signInScript, /email-code-verify-form/);
	assert.match(signInScript, /submitStart/);
	assert.match(signInScript, /submitVerify/);
	assert.match(signInScript, /fetchJson\(route, \{/);
	assert.match(signInScript, /JSON\.stringify\(\{ email \}\)/);
	assert.match(signInScript, /challengeId: dom\.challengeInput\?\.value/);
	assert.match(signInScript, /code: dom\.codeInput\?\.value/);
	assert.match(signInScript, /credentials: 'include'/);
	assert.match(signInScript, /fetchJson\('\/api\/me'\)/);
}

function assertSignInScriptRedirectsAuthenticatedUsersToAccountDashboard() {
	assert.match(signInScript, /ACCOUNT_URL: '\/pages\/account\/'/);
	assert.match(signInScript, /function redirectToAccount\(\)/);
	assert.match(signInScript, /location\.assign\(CONFIG\.ACCOUNT_URL\)/);
	assert.match(signInScript, /redirectAlreadySignedInUser/);
	assert.match(signInScript, /response\.data\?\.authenticated/);
	assert.match(signInScript, /redirectToAccount\(\);/);
	assert.equal(signInScript.includes('showSignedInTeamAdmin'), false);
	assert.equal(signInScript.includes('TEAM_ADMIN_PERMISSION'), false);
}

function assertWorkerRoutesPasswordlessEndpoints() {
	assert.match(worker, /handlePasswordlessAuthRoute/);
	assert.match(worker, /\.\/core\/auth\/passwordless\.js/);
	assert.match(worker, /apiPath\.startsWith\("\/api\/auth\/email\/"\)/);
	assert.match(worker, /apiPath === "\/api\/auth\/logout"/);
}

function assertPasswordlessServerFlowExists() {
	assert.match(passwordless, /auth_login_challenges/);
	assert.match(passwordless, /auth_sessions/);
	assert.match(passwordless, /auth_identities/);
	assert.match(passwordless, /RESEARCHOPS_AUTH_SECRET/);
	assert.match(passwordless, /RESEARCHOPS_EMAIL_WEBHOOK_URL/);
	assert.match(passwordless, /RESEND_API_KEY/);
	assert.match(passwordless, /set-cookie/);
	assert.match(passwordless, /resolvePasswordlessSessionContext/);
	assert.match(passwordless, /provider: PROVIDER/);
}

function assertPasswordlessCodeAttemptLimitExists() {
	assert.match(passwordless, /function assertChallengeCanBeAttempted\(challenge\)/);
	assert.match(passwordless, /code_attempts_exceeded/);
	assert.match(passwordless, /Too many incorrect codes/);
	assert.match(passwordless, /function recordFailedAttempt\(db, request, challenge\)/);
	assert.match(passwordless, /challenge_status = 'locked'/);
	assert.match(passwordless, /auth\.email_code\.locked/);
	assert.match(passwordless, /attempts_remaining = \?/);
}

function assertPasswordlessRoleExpiryFiltersExist() {
	const roleExpiryFilters = passwordless.match(/ra\.expires_at IS NULL OR ra\.expires_at > strftime/g) || [];

	assert.match(passwordless, /ra\.expires_at IS NULL OR ra\.expires_at > strftime/);
	assert.ok(roleExpiryFilters.length >= 2);
	assert.match(passwordless, /MAX\(ra\.approved_at\) AS most_recent_role_approved_at/);
	assert.match(passwordless, /COALESCE\(most_recent_role_approved_at, most_recent_role_created_at, membership_created_at\) DESC/);
}

function assertAuthResolverPrefersResearchOpsSession() {
	assert.match(access, /resolvePasswordlessSessionContext/);
	assert.match(access, /const passwordlessContext = await resolvePasswordlessSessionContext\(request, env\);/);
	assert.match(access, /if \(passwordlessContext\) return passwordlessContext;/);
	assert.match(access, /const accessPayload = await validateAccessToken\(request, env\);/);
}

function assertPasswordlessMigrationExists() {
	assert.match(migration, /CREATE TABLE IF NOT EXISTS auth_login_challenges/);
	assert.match(migration, /CREATE TABLE IF NOT EXISTS auth_sessions/);
	assert.match(migration, /route_api_auth_email_start_post/);
	assert.match(migration, /route_api_auth_email_verify_post/);
	assert.match(migration, /route_api_auth_logout_post/);
}

assertSignInPageUsesGovukFrontendTemplate();
assertSignInPageUsesResearchOpsPasswordlessJourney();
assertSignInPageDoesNotExposeCloudflareToUser();
assertSignInPageDoesNotCreatePasswordAuth();
assertSignInScriptStartsAndVerifiesEmailCode();
assertSignInScriptRedirectsAuthenticatedUsersToAccountDashboard();
assertWorkerRoutesPasswordlessEndpoints();
assertPasswordlessServerFlowExists();
assertPasswordlessCodeAttemptLimitExists();
assertPasswordlessRoleExpiryFiltersExist();
assertAuthResolverPrefersResearchOpsSession();
assertPasswordlessMigrationExists();