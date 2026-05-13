import assert from 'node:assert/strict';
import fs from 'node:fs';

const workerSource = fs.readFileSync('infra/cloudflare/src/worker.js', 'utf8');
const migrationSource = fs.readFileSync('infra/cloudflare/migrations/0004_auth_registration_requests.sql', 'utf8');
const routeSource = fs.readFileSync('infra/cloudflare/src/core/auth/registration-requests.js', 'utf8');
const registrationPageSource = fs.readFileSync('public/pages/account/register/index.html', 'utf8');
const registrationPageScript = fs.readFileSync('public/js/auth-registration-page.js', 'utf8');
const registrationPageCss = fs.readFileSync('public/css/auth-registration.css', 'utf8');
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
	assert.ok(migrationSource.includes("'POST', '/api/auth/registration-requests', '[]', 0, 'implemented'"));
	assert.ok(migrationSource.includes("'GET', '/api/auth/registration-requests', '[\"role.assign\"]', 1, 'implemented'"));
	assert.doesNotMatch(migrationSource, /INSERT INTO auth_role_assignments/);
}

function assertRouteCapturesRequestedPurposeOnly() {
	assert.match(routeSource, /requestedRoleKey/);
	assert.match(routeSource, /requested_role_key/);
	assert.match(routeSource, /requested_role_label/);
	assert.match(routeSource, /pending_review/);
	assert.match(routeSource, /auth\.registration_request\.created/);
	assert.match(routeSource, /result\.created \? 201 : 200/);
	assert.doesNotMatch(routeSource, /INSERT INTO auth_role_assignments/);
	assert.doesNotMatch(routeSource, /UPDATE auth_role_assignments/);
	assert.doesNotMatch(routeSource, /assignment_status = 'active'/);
}

function assertRegistrationPageUsesReviewLanguage() {
	assert.ok(registrationPageSource.includes('Request a ResearchOps account'));
	assert.ok(registrationPageSource.includes('A team admin will review your request before any team access or role is added'));
	assert.ok(registrationPageSource.includes('Your answer about what you need to do does not give you access'));
	assert.ok(registrationPageSource.includes('What do you need to use ResearchOps for?'));
	assert.ok(registrationPageSource.includes('A team admin will review your request and decide what access you need'));
	assert.ok(registrationPageSource.includes('Check your answers before sending your request'));
	assert.ok(registrationPageSource.includes('Continue'));
	assert.ok(registrationPageSource.includes('Send request'));
	assert.doesNotMatch(registrationPageSource, /govuk-notification-banner/);
}

function assertRegistrationPageUsesSensibleFormWidthsAndRhythm() {
	assert.ok(registrationPageSource.includes('/css/auth-registration.css'));
	assert.ok(registrationPageSource.includes('account-registration-page__intro'));
	assert.ok(registrationPageSource.includes('account-registration-form'));
	for (const fieldId of ['display-name', 'registration-email', 'team-or-service', 'other-role']) {
		assert.match(registrationPageSource, new RegExp(`id=["']${fieldId}["'][^>]*govuk-!-width-two-thirds`));
		assert.match(registrationPageSource, new RegExp(`id=["']${fieldId}["'][^>]*account-registration-input`));
	}
	assert.match(registrationPageSource, /id=["']requested-reason["'][^>]*govuk-!-width-two-thirds/);
	assert.match(registrationPageCss, /account-registration-page__intro[\s\S]*margin-bottom:\s*30px/);
	assert.match(registrationPageCss, /account-registration-form[\s\S]*margin-top:\s*30px/);
	assert.match(registrationPageCss, /govuk-inset-text[\s\S]*border-left:\s*10px solid #b1b4b6/);
}

function assertRegistrationErrorsAreUserFacing() {
	for (const message of [
		'Enter your full name.',
		'Enter your email address.',
		'Enter an email address in the correct format, like name@example.com.',
		'Enter the team or service you need access for.',
		'Select what you need to use ResearchOps for.',
		'Enter what you need to use ResearchOps for.',
		'Enter why you need access.',
		'Tell us a little more about why you need access.',
	]) {
		assert.ok(registrationPageScript.includes(message));
	}

	for (const exposedTerm of [
		'Request body must be valid JSON',
		'targetUserId',
		'auth_role_assignments',
	]) {
		assert.doesNotMatch(registrationPageSource, new RegExp(exposedTerm));
	}
}

function assertCheckAnswersBehaviourExists() {
	assert.match(registrationPageScript, /function renderCheckAnswers/);
	assert.match(registrationPageScript, /function showCheckAnswers/);
	assert.match(registrationPageScript, /function sendRegistrationRequest/);
	assert.match(registrationPageScript, /Sending this request will not give you access/);
	assert.match(registrationPageScript, /A team admin will review it and decide what access you need/);
	assert.match(registrationPageScript, /govuk-panel--confirmation/);
}

function assertTeamAdminCanReviewRequestsButMustAssignSeparately() {
	assert.ok(reviewPageSource.includes('Review account requests'));
	assert.ok(reviewPageSource.includes('The information they give about what they need to do is for review only'));
	assert.ok(reviewPageScript.includes('What they need to use ResearchOps for'));
	assert.match(reviewPageScript, /Assign a role to a team member/);
	assert.match(reviewPageScript, /\/pages\/team\/role-assignments\//);
	assert.doesNotMatch(reviewPageScript, /method:\s*['"]POST['"]/);
	assert.doesNotMatch(reviewPageScript, /auth\/role-assignments/);
}

function assertSignInLinksToRegistrationRequest() {
	assert.match(signInPageSource, /If you need an account/);
	assert.match(signInPageSource, /\/pages\/account\/register\//);
	assert.match(signInPageSource, /A Team Admin will review your request before any team access or role is added/);
}

assertWorkerRoutesRegistrationRequests();
assertMigrationCreatesReviewQueueWithoutRoleAssignment();
assertRouteCapturesRequestedPurposeOnly();
assertRegistrationPageUsesReviewLanguage();
assertRegistrationPageUsesSensibleFormWidthsAndRhythm();
assertRegistrationErrorsAreUserFacing();
assertCheckAnswersBehaviourExists();
assertTeamAdminCanReviewRequestsButMustAssignSeparately();
assertSignInLinksToRegistrationRequest();
