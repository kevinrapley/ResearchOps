import assert from 'node:assert/strict';
import fs from 'node:fs';

const workerSource = fs.readFileSync('infra/cloudflare/src/worker.js', 'utf8');
const deployWorkerSource = fs.readFileSync('.github/workflows/deploy-worker.yml', 'utf8');
const migrationSource = fs.readFileSync('infra/cloudflare/migrations/0005_auth_registration_requests.sql', 'utf8');
const previewDaaSCorrectionSource = fs.readFileSync(
	'infra/cloudflare/migrations/preview/0002_correct_research_operations_user_daas_team.sql',
	'utf8',
);
const routeSource = fs.readFileSync('infra/cloudflare/src/core/auth/registration-requests.js', 'utf8');
const registrationPageSource = fs.readFileSync('public/pages/account/register/index.html', 'utf8');
const registrationPageScript = fs.readFileSync('public/js/auth-registration-page.js', 'utf8');
const registrationPageCss = fs.readFileSync('public/css/auth-registration.css', 'utf8');
const reviewPageSource = fs.readFileSync('public/pages/team/registration-requests/index.html', 'utf8');
const reviewPageScript = fs.readFileSync('public/js/auth-registration-requests-page.js', 'utf8');
const signInPageSource = fs.readFileSync('public/pages/account/sign-in/index.html', 'utf8');

function elementForId(source, fieldId) {
	const match = source.match(new RegExp(`<[^>]+id=["']${fieldId}["'][^>]*>`));
	assert.ok(match, `Expected element with id ${fieldId}`);
	return match[0];
}

function assertElementHasClasses(source, fieldId, classes) {
	const element = elementForId(source, fieldId);
	for (const className of classes) {
		assert.ok(element.includes(className), `Expected ${fieldId} to include ${className}`);
	}
}

function assertWorkerRoutesRegistrationRequests() {
	assert.match(workerSource, /import \{ handleRegistrationRequestsRoute \} from ['"]\.\/core\/auth\/registration-requests\.js['"];/);
	assert.match(workerSource, /apiPath === ['"]\/api\/auth\/registration-requests['"]/);
	assert.match(workerSource, /method === ['"]GET['"] \|\| method === ['"]POST['"]/);
}

function assertWorkerAllowsResearchOpsPreviewOrigins() {
	assert.match(workerSource, /function isResearchOpsPagesOrigin/);
	assert.match(workerSource, /hostname === "researchops\.pages\.dev" \|\| hostname\.endsWith\("\.researchops\.pages\.dev"\)/);
	assert.match(workerSource, /if \(isResearchOpsPagesOrigin\(origin\)\) return origin/);
}

function assertDeployWorkflowAppliesRegistrationMigrationToPreviewAndProduction() {
	assert.match(deployWorkerSource, /branches: \[ main, "feature\/\*\*", "fix\/\*\*" \]/);
	assert.match(deployWorkerSource, /REGISTRATION_REQUESTS_MIGRATION: "infra\/cloudflare\/migrations\/0005_auth_registration_requests\.sql"/);
	assert.match(deployWorkerSource, /PREVIEW_RESEARCH_OPERATIONS_DAAS_CORRECTION: "infra\/cloudflare\/migrations\/preview\/0002_correct_research_operations_user_daas_team\.sql"/);
	assert.match(deployWorkerSource, /deploy-production:/);
	assert.match(deployWorkerSource, /deploy-preview:/);
	assert.match(deployWorkerSource, /WRANGLER_PREVIEW_CONFIG: "infra\/cloudflare\/wrangler\.preview\.toml"/);
	assert.match(deployWorkerSource, /D1_PREVIEW_DATABASE_NAME: "researchops-d1-preview"/);
	assert.match(deployWorkerSource, /CF_PREVIEW_D1_DATABASE_ID/);
	assert.match(deployWorkerSource, /database_name = \"researchops-d1-preview\"/);
	assert.match(deployWorkerSource, /CF_PREVIEW_D1_DATABASE_ID/);
	assert.match(deployWorkerSource, /d1 execute "\$\{D1_PREVIEW_DATABASE_NAME\}"/);
	assert.match(deployWorkerSource, /--file "\$\{PREVIEW_RESEARCH_OPERATIONS_DAAS_CORRECTION\}"/);
	assert.match(deployWorkerSource, /deploy --config wrangler\.preview\.toml/);
	assert.doesNotMatch(deployWorkerSource, /deploy-production:[\s\S]*PREVIEW_RESEARCH_OPERATIONS_DAAS_CORRECTION/);
	assert.doesNotMatch(deployWorkerSource, /deploy-preview:[\s\S]*d1 execute "\$\{D1_DATABASE_NAME\}"[\s\S]*--remote/);
}

function assertPreviewDaaSCorrectionIsPreviewOnlyAndScoped() {
	assert.match(previewDaaSCorrectionSource, /Preview-only data correction/);
	assert.match(previewDaaSCorrectionSource, /kevin\.rapley@research-operations\.com/);
	assert.match(previewDaaSCorrectionSource, /INSERT INTO auth_teams/);
	assert.match(previewDaaSCorrectionSource, /'DaaS'/);
	assert.match(previewDaaSCorrectionSource, /INSERT INTO auth_team_memberships/);
	assert.match(previewDaaSCorrectionSource, /assignment_kevin_research_operations_observer_daas/);
	assert.match(previewDaaSCorrectionSource, /'role_observer'/);
	assert.match(previewDaaSCorrectionSource, /assignment_status = 'revoked'/);
	assert.match(previewDaaSCorrectionSource, /scope_id = 'team_researchops_core'/);
	assert.match(previewDaaSCorrectionSource, /auth\.preview_data\.corrected/);
	assert.doesNotMatch(previewDaaSCorrectionSource, /digikev\.kevin\.rapley@gmail\.com'\)[\s\S]*assignment_status = 'revoked'/);
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
		assertElementHasClasses(registrationPageSource, fieldId, ['govuk-!-width-two-thirds', 'account-registration-input']);
	}
	assertElementHasClasses(registrationPageSource, 'requested-reason', ['govuk-!-width-two-thirds']);
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
	assert.match(registrationPageScript, /function handleCheckAnswerChange/);
	assert.match(registrationPageScript, /data-change-target/);
	assert.match(registrationPageScript, /showForm\(link\.dataset\.changeTarget \|\| ''\)/);
	assert.match(registrationPageScript, /Sending this request will not give you access/);
	assert.match(registrationPageScript, /A team admin will review it and decide what access you need/);
	assert.match(registrationPageScript, /govuk-panel--confirmation/);
	assert.doesNotMatch(elementForId(registrationPageSource, 'registration-check-answers'), /tabindex=/);
	assert.doesNotMatch(registrationPageScript, /registration-check-answers-title'\)\?\.focus/);
}

function assertRegistrationUsesPreviewSafeApiRouting() {
	assert.match(registrationPageScript, /const FALLBACK_API_ORIGINS/);
	assert.match(registrationPageScript, /function apiBaseCandidates/);
	assert.match(registrationPageScript, /shouldUseFallbackApiOrigin/);
	assert.match(registrationPageScript, /location\.hostname\.endsWith\('pages\.dev'\)/);
	assert.match(registrationPageScript, /rops-api-passwordless-preview/);
	assert.match(registrationPageScript, /rops-api\.digikev-kevin-rapley\.workers\.dev/);
	assert.match(reviewPageScript, /function apiBaseCandidates/);
	assert.match(reviewPageScript, /shouldUseFallbackApiOrigin/);
	assert.match(reviewPageScript, /rops-api-passwordless-preview/);
}

function assertTeamAdminCanReviewRequestsBeforeAssigningRole() {
	assert.ok(reviewPageSource.includes('Review account requests'));
	assert.ok(reviewPageSource.includes('The information they give about what they need to do is for review only'));
	assert.ok(reviewPageScript.includes('What they need to use ResearchOps for'));
	assert.match(reviewPageScript, /function roleAssignmentHref/);
	assert.match(reviewPageScript, /targetEmail/);
	assert.match(reviewPageScript, /requestedReason/);
	assert.match(reviewPageScript, /Account request:/);
	assert.match(reviewPageScript, /ResearchOps will add them when you assign the role/);
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
assertWorkerAllowsResearchOpsPreviewOrigins();
assertDeployWorkflowAppliesRegistrationMigrationToPreviewAndProduction();
assertPreviewDaaSCorrectionIsPreviewOnlyAndScoped();
assertMigrationCreatesReviewQueueWithoutRoleAssignment();
assertRouteCapturesRequestedPurposeOnly();
assertRegistrationPageUsesReviewLanguage();
assertRegistrationPageUsesSensibleFormWidthsAndRhythm();
assertRegistrationErrorsAreUserFacing();
assertCheckAnswersBehaviourExists();
assertRegistrationUsesPreviewSafeApiRouting();
assertTeamAdminCanReviewRequestsBeforeAssigningRole();
assertSignInLinksToRegistrationRequest();
