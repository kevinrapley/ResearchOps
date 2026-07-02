import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync('infra/cloudflare/src/worker.js', 'utf8');
const passwordless = fs.readFileSync('infra/cloudflare/src/core/auth/passwordless.js', 'utf8');
const access = fs.readFileSync('infra/cloudflare/src/core/auth/access.js', 'utf8');
const retention = fs.readFileSync('infra/cloudflare/src/service/retention.js', 'utf8');
const migration = fs.readFileSync('infra/cloudflare/migrations/0024_security_hardening_controls.sql', 'utf8');
const headers = fs.readFileSync('public/_headers', 'utf8');
const wrangler = fs.readFileSync('infra/cloudflare/wrangler.toml', 'utf8');
const securityWorkflow = fs.readFileSync('.github/workflows/security.yml', 'utf8');
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
}

function assertCsrfAndSecurityHeadersExist() {
	assert.match(worker, /function assertTrustedMutationRequest\(request, env\)/);
	assert.match(worker, /Sec-Fetch-Site/);
	assert.match(worker, /origin_not_allowed/);
	assert.match(worker, /X-ResearchOps-CSRF/);
	assert.match(worker, /Strict-Transport-Security/);
	assert.match(worker, /Content-Security-Policy/);
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
	assert.match(wrangler, /RESEARCHOPS_QA_BDD_AUTH_ENABLED = "false"/);
	assert.match(wrangler, /RESEARCHOPS_RETENTION_ENFORCEMENT_ENABLED = "false"/);
	assert.doesNotMatch(wrangler, /http:\/\/localhost:8080/);
	assert.match(wrangler, /crons = \["17 2 \* \* \*"\]/);
}

function assertSupplyChainEvidenceExists() {
	assert.match(securityWorkflow, /actions\/dependency-review-action@v5/);
	assert.match(securityWorkflow, /github\/codeql-action\/init@v4/);
	assert.match(securityWorkflow, /github\/codeql-action\/analyze@v4/);
	assert.match(releaseProvenance, /dependency-sbom\.cyclonedx\.json/);
	assert.match(releaseProvenance, /bomFormat: "CycloneDX"/);
	assert.match(githubSettings, /sbom_on_release: true/);
}

assertSensitiveWorkerRoutesUseRoutePermissions();
assertCsrfAndSecurityHeadersExist();
assertActiveAccountsAndRateLimitsExist();
assertAuditMetadataAvoidsRawEmail();
assertRetentionAndProductionConfigExist();
assertSupplyChainEvidenceExists();
