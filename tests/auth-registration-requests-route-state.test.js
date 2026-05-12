import assert from 'node:assert/strict';
import fs from 'node:fs';

const workerSource = fs.readFileSync('infra/cloudflare/src/worker.js', 'utf8');
const migrationSource = fs.readFileSync('infra/cloudflare/migrations/0004_auth_registration_requests.sql', 'utf8');
const routeSource = fs.readFileSync('infra/cloudflare/src/core/auth/registration-requests.js', 'utf8');
const registrationPageSource = fs.readFileSync('public/pages/account/register/index.html', 'utf8');
const registrationPageScript = fs.readFileSync('public/js/auth-registration-page.js', 'utf8');
const reviewPageSource = fs.readFileSync('public/pages/team/registration-requests/index.html', 'utf8');
const reviewPageScript = fs.readFileSync('public/js/auth-registration-requests-page.js', 'utf8');
const signInPageSource = fs.readFileSync('public/pages/account/sign-in/index.html', 'utf8');

function assertWorkerRoutesRegistrationRequests() {
	assert.match(workerSource, /import \{ handleRegistrationRequestsRoute \} from ['"]\.\/core\/auth\/registration-requests\.js['"];/);
	assert.match(workerSource, /apiPath === ['"]\/api\/auth\/registration-requests['"]/);
	assert.match(workerSource, /method === ['"]GET['"] \|\| method === ['"]POST['"]/);
}

function assertMigrationCreatesReviewQueueWithoutRoleAssignment() {
	assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS auth_registration_requests/);
	assert.match(migrationSource, /requested_role_key TEXT NOT NULL/);
	assert.match(migrationSource, /requested_role_label TEXT NOT NULL/);
	assert.match(migrationSource, /request_status TEXT NOT NULL DEFAULT 'pending_review'/);
	assert.match(migrationSource, /idx_auth_registration_requests_email_pending/);
	assert.match(migrationSource, /'POST', '\/api\/auth\/registration-requests', '\[\]', 0, 'implemented'/);
	assert.match(migrationSource, /'GET', '\/api\/auth\/registration-requests', '\["role\.assign"\]', 1, 'implemented'/);
	assert.doesNotMatch(migrationSource, /INSERT INTO auth_role_assignments/);
}

function assertRouteCapturesRequestedRoleOnly() {
	assert.match(routeSource, /requestedRoleKey/);
	assert.match(routeSource, /requested_role_key/);
	assert.match(routeSource, /requested_role_label/);
	assert.match(routeSource, /pending_review/);
	assert.match(routeSource, /auth\.registration_request\.created/);
	assert.doesNotMatch(routeSource, /INSERT INTO auth_role_assignments/);
	assert.doesNotMatch(routeSource, /UPDATE auth_role_assignments/);
	assert.doesNotMatch(routeSource, /assignment_status = 'active'/);
}

function assertRegistrationPageUsesReviewLanguage() {
	assert.match(registrationPageSource, /Request a ResearchOps account/);
	assert.match(registrationPageSource, /A Team Admin will review your request before any team access or role is added/);
	assert.match(registrationPageSource, /Selecting a role here does not give you that role/);
	assert.match(registrationPageSource, /A Team Admin will decide which role, if any, to assign/);
	assert.match(registrationPageSource, /Send request/);
}

function assertRegistrationErrorsAreUserFacing() {
	for (const message of [
		'Enter your full name.',
		'Enter your email address.',
		'Enter an email address in the correct format, like name@example.com.',
		'Enter the team or service you need access for.',
		'Select the role that best describes what you will do.',
		'Enter why you need access.',
		'Tell us a little more about why you need access.',
	]) {
		assert.match(registrationPageScript, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
	}

	for (const exposedTerm of [
		'Request body must be valid JSON',
		'roleKey',
		'targetUserId',
		'auth_role_assignments',
	]) {
		assert.doesNotMatch(registrationPageSource, new RegExp(exposedTerm));
	}
}

function assertTeamAdminCanReviewRequestsButMustAssignSeparately() {
	assert.match(reviewPageSource, /Review account requests/);
	assert.match(reviewPageSource, /A requested role is only information for review/);
	assert.match(reviewPageScript, /Assign a role to a team member/);
	assert.match(reviewPageScript, /\/pages\/team\/role-assignments\//);
	assert.doesNotMatch(reviewPageScript, /POST/);
	assert.doesNotMatch(reviewPageScript, /auth\/role-assignments/);
}

function assertSignInLinksToRegistrationRequest() {
	assert.match(signInPageSource, /If you need an account/);
	assert.match(signInPageSource, /\/pages\/account\/register\//);
	assert.match(signInPageSource, /A Team Admin will review your request before any team access or role is added/);
}

assertWorkerRoutesRegistrationRequests();
assertMigrationCreatesReviewQueueWithoutRoleAssignment();
assertRouteCapturesRequestedRoleOnly();
assertRegistrationPageUsesReviewLanguage();
assertRegistrationErrorsAreUserFacing();
assertTeamAdminCanReviewRequestsButMustAssignSeparately();
assertSignInLinksToRegistrationRequest();
