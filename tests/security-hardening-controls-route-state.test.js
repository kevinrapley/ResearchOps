import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync('infra/cloudflare/src/worker.js', 'utf8');
const passwordless = fs.readFileSync('infra/cloudflare/src/core/auth/passwordless.js', 'utf8');
const access = fs.readFileSync('infra/cloudflare/src/core/auth/access.js', 'utf8');
const router = fs.readFileSync('infra/cloudflare/src/core/router.js', 'utf8');
const retention = fs.readFileSync('infra/cloudflare/src/service/retention.js', 'utf8');
const migration = fs.readFileSync('infra/cloudflare/migrations/0024_security_hardening_controls.sql', 'utf8');
const routeClosureMigration = fs.readFileSync('infra/cloudflare/migrations/0025_security_review_route_permissions.sql', 'utf8');
const headers = fs.readFileSync('public/_headers', 'utf8');
const wrangler = fs.readFileSync('infra/cloudflare/wrangler.toml', 'utf8');
const previewWrangler = fs.readFileSync('infra/cloudflare/wrangler.passwordless-preview.toml', 'utf8');
const securityWorkflow = fs.readFileSync('.github/workflows/security.yml', 'utf8');
const deployWorkerWorkflow = fs.readFileSync('.github/workflows/deploy-worker.yml', 'utf8');
const passwordlessPreviewWorkflow = fs.readFileSync('.github/workflows/deploy-passwordless-preview-worker.yml', 'utf8');
const releaseProvenance = fs.readFileSync('scripts/release-provenance.mjs', 'utf8');
const githubSettings = fs.readFileSync('github-settings.yaml', 'utf8');

function assertSensitiveWorkerRoutesUseRoutePermissions() {
	assert.match(worker, /const RESEARCH_DATA_AUTH_PERMISSIONS = \[/);
	assert.match(worker, /const RESEARCH_DATA_ROUTE_PERMISSIONS = \[/);
	assert.match(worker, /async function assertResearchDataRoutePermission\(request, env, apiPath\)/);
	assert.match(worker, /await assertResearchDataRoutePermission\(request, env, apiPath\);/);
	assert.match(worker, /"\/api\/studies\/:id"/);
	assert.match(worker, /"\/api\/synthesis\/clusters\/:id"/);
	assert.match(worker, /"\/api\/consent-forms\/:id\/publish"/);
	assert.match(worker, /"\/api\/participant-consent\/:id"/);
	assert.match(migration, /route_api_studies_post/);
	assert.match(migration, /route_api_participant_consent_patch/);
	assert.match(routeClosureMigration, /route_api_session_notes_get/);
	assert.match(routeClosureMigration, /route_api_mural_journal_sync_post/);
	assert.match(routeClosureMigration, /UPDATE auth_route_permissions/);
	assert.match(routeClosureMigration, /WHERE id = 'route_api_agent_pages_deploy_post'/);
}

function assertCsrfAndSecurityHeadersExist() {
	assert.match(worker, /function assertTrustedMutationRequest\(request, env, apiPath = ""\)/);
	assert.match(worker, /Sec-Fetch-Site/);
	assert.match(worker, /origin_not_allowed/);
	assert.match(worker, /csrf_header_required/);
	assert.match(worker, /hasPasswordlessSessionCookie\(request\)/);
	assert.match(worker, /X-ResearchOps-CSRF/);
	assert.match(worker, /assertFallbackApiRoutePermission\(request, env, apiPath\)/);
	assert.match(worker, /"\/api\/session-notes"/);
	assert.match(worker, /\["deployment\.trigger", "Trigger deployments"/);
	assert.match(worker, /"\/api\/agent-pages\/deploy", "\[\\"deployment\.trigger\\"\]", 1/);
	assert.match(router, /function constantTimeEqual\(a, b\)/);
	assert.doesNotMatch(router, /cloudflare: safeSlice\(deployBody, 2000\)/);
	assert.match(worker, /Strict-Transport-Security/);
	assert.match(worker, /Content-Security-Policy/);
	assert.doesNotMatch(headers, /script-src 'self' 'unsafe-inline'/);
	assert.match(headers, /Referrer-Policy: strict-origin-when-cross-origin/);
	assert.match(headers, /Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\), usb=\(\)/);
	assert.match(headers, /X-Frame-Options: DENY/);
	assert.match(headers, /Strict-Transport-Security: max-age=31536000; includeSubDomains/);
	assert.match(headers, /frame-ancestors 'none'/);
}

function assertActiveAccountsAndRateLimitsExist() {
	assert.match(passwordless, /CREATE TABLE IF NOT EXISTS auth_rate_limits/);
	assert.match(passwordless, /EMAIL_CODE_START_LIMIT = 5/);
	assert.match(passwordless, /EMAIL_CODE_VERIFY_LIMIT = 10/);
	assert.match(passwordless, /account_not_active/);
	assert.match(passwordless, /AND u\.account_status = 'active'/);
	assert.match(passwordless, /auth\.sign_in\.blocked_inactive_account/);
	assert.match(access, /account_not_active/);
	assert.match(migration, /CREATE TABLE IF NOT EXISTS auth_rate_limits/);
}

function assertAuditMetadataAvoidsRawEmail() {
	assert.match(passwordless, /const emailHash = await hash\(env, 'email', email\)/);
	assert.match(passwordless, /auth\.email_code\.requested', \{ emailHash, challengeId, deliveryProvider \}/);
	assert.doesNotMatch(passwordless, /auth\.sign_in\.succeeded', \{ userId: user\.id, email:/);
	assert.doesNotMatch(passwordless, /auth\.email_code\.failed', \{\s*email:/);
}

function assertRetentionAndProductionConfigExist() {
	assert.match(retention, /export async function enforceRetention\(env, options = \{\}\)/);
	assert.match(retention, /RESEARCHOPS_RETENTION_ENFORCEMENT_ENABLED/);
	assert.match(retention, /DELETE FROM rops_participant_consent_cache/);
	assert.match(retention, /DELETE FROM rops_session_notes/);
	assert.match(worker, /async scheduled\(event, env, ctx\)/);
	assert.match(worker, /enforceRetention\(env/);
	assert.match(worker, /function diagnosticsEnabled\(env = \{\}\)/);
	assert.match(router, /RESEARCHOPS_DIAGNOSTICS_ENABLED/);
	assert.match(wrangler, /RESEARCHOPS_QA_BDD_AUTH_ENABLED = "false"/);
	assert.match(wrangler, /"MURAL_OAUTH_STATE_SECRET"/);
	assert.doesNotMatch(wrangler, /RESEARCHOPS_QA_BDD_AUTH_EMAILS/);
	assert.match(wrangler, /RESEARCHOPS_RETENTION_ENFORCEMENT_ENABLED = "true"/);
	assert.doesNotMatch(wrangler, /http:\/\/localhost:8080/);
	assert.match(wrangler, /head_sampling_rate = 0\.1/);
	assert.match(wrangler, /invocation_logs = false/);
	assert.match(wrangler, /persist = false/);
	assert.match(wrangler, /crons = \["17 2 \* \* \*"\]/);
	assert.doesNotMatch(previewWrangler, /http:\/\/localhost:8080/);
	assert.match(previewWrangler, /id         = "8e2d88969b9e4be694868931bdba92f2"/);
	assert.match(previewWrangler, /database_id = "48b35a2e-52e8-4bc0-a8cf-88a7a1536f04"/);
	assert.doesNotMatch(previewWrangler, /d4b97a36-8b4f-4b73-9a9f-0f22d92f62d5/);
	assert.match(deployWorkerWorkflow, /MURAL_OAUTH_STATE_SECRET: \$\{\{ secrets\.MURAL_OAUTH_STATE_SECRET \}\}/);
	assert.match(deployWorkerWorkflow, /MURAL_OAUTH_STATE_SECRET\n/);
	assert.match(passwordlessPreviewWorkflow, /MURAL_OAUTH_STATE_SECRET: \$\{\{ secrets\.MURAL_OAUTH_STATE_SECRET \}\}/);
	assert.match(passwordlessPreviewWorkflow, /"MURAL_OAUTH_STATE_SECRET"/);
}

function assertSupplyChainEvidenceExists() {
	assert.match(securityWorkflow, /pull_request:/);
	assert.match(securityWorkflow, /node-version: "22"/);
	assert.doesNotMatch(securityWorkflow, /actions\/dependency-review-action/);
	assert.doesNotMatch(securityWorkflow, /github\/codeql-action\//);
	assert.match(releaseProvenance, /dependency-sbom\.cyclonedx\.json/);
	assert.match(releaseProvenance, /bomFormat: "CycloneDX"/);
	assert.match(githubSettings, /code_scanning: true/);
	assert.match(githubSettings, /dependency_review: true/);
	assert.match(githubSettings, /sbom_on_release: true/);
}

assertSensitiveWorkerRoutesUseRoutePermissions();
assertCsrfAndSecurityHeadersExist();
assertActiveAccountsAndRateLimitsExist();
assertAuditMetadataAvoidsRawEmail();
assertRetentionAndProductionConfigExist();
assertSupplyChainEvidenceExists();
