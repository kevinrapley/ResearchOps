# Security Hardening Pre-Review

## Run metadata

- Date: 2026-07-02
- Branch: `fix/security-hardening-pre-review`
- Trace decision: required because `fix/` branches require auditable traces for repository-affecting work.
- Task summary: implement security hardening before Home Office security review, covering permission gates, CSRF/origin controls, active-account enforcement, rate limiting, headers, production configuration, supply-chain evidence, retention, and reduced audit/log PII.

## Operating model evidence

- Loaded `AGENTS.md` from the repository prompt.
- Ran `npm run agent:model -- "complete security hardening before Home Office security review: permission gates CSRF account status rate limiting security headers production config supply chain retention audit PII"`.
- Verified selected bundle prompt files existed for:
  - `.agent-operating-model/bundles/github/`
  - `.agent-operating-model/bundles/researchops-developer-control/`
  - `.agent-operating-model/bundles/multi-functional-team/`
  - `.agent-operating-model/bundles/cloudflare/`
- Read `.agent-operating-model/precedence-policy.md`.
- Read `.agent-operating-model/trace-policy.md`.

## Bundle selection

- Selected:
  - `github-diamond`
  - `researchops-developer-control`
  - `multi-functional-team`
  - `cloudflare`
- Conditional bundles skipped by the model command:
  - `govuk-design-system`
  - `openai-platform`
  - `mcp-agent-tooling`
  - `airtable-public-api`
  - `mural-public-api`
- Cloudflare runtime guidance was still applied from repository `AGENTS.md` because the changed service is a Cloudflare Worker.

## Precedence decisions

- GitHub Diamond governed branch naming, trace requirement, validation evidence, and PR readiness.
- ResearchOps Developer Control governed the Worker/service boundaries and D1 migration approach.
- Multi-Functional Team governed the security and PII/GDPR assurance framing.
- Cloudflare governed the preview Worker deployment configuration follow-up.
- No instruction conflicts were identified.

## Files read

- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/src/core/auth/passwordless.js`
- `infra/cloudflare/src/core/auth/access.js`
- `infra/cloudflare/src/service/session-notes.js`
- `infra/cloudflare/src/service/participant-consent.js`
- `infra/cloudflare/src/service/participants.js`
- `infra/cloudflare/migrations/0023_session_consent_and_notes.sql`
- `infra/cloudflare/migrations/0008_seed_test_project_1_participants.sql`
- `public/_headers`
- `infra/cloudflare/wrangler.toml`
- `.github/workflows/security.yml`
- `.github/workflows/deploy-worker.yml`
- `github-settings.yaml`
- `scripts/release-provenance.mjs`
- Relevant route-state tests under `tests/`

## Files modified

- `.github/workflows/security.yml`
- `.github/workflows/deploy-worker.yml`
- `docs/deployment/d1-migration-ordering.md`
- `github-settings.yaml`
- `infra/cloudflare/src/core/auth/access.js`
- `infra/cloudflare/src/core/auth/passwordless.js`
- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/wrangler.toml`
- `public/_headers`
- `scripts/release-provenance.mjs`
- `tests/auth-sign-in-route-state.test.js`
- `tests/qa-bdd-authenticated-walkthrough-route-state.test.js`

## Files created

- `infra/cloudflare/migrations/0024_security_hardening_controls.sql`
- `infra/cloudflare/src/service/retention.js`
- `tests/security-hardening-controls-route-state.test.js`
- `docs/agent-audit/reasoning/2026/07/02/security-hardening-pre-review.md`
- `docs/agent-audit/reasoning/2026/07/02/security-hardening-pre-review.json`

## Implementation decisions

- Added shared research-data route permission declarations for studies, synthesis, consent forms, participant consent, and project diagnostics.
- Added Worker-level origin and `Sec-Fetch-Site` checks for mutating requests.
- Added API and Pages security headers, including CSP, HSTS, frame denial, referrer policy, and permissions policy.
- Blocked passwordless and Cloudflare Access session use for non-active accounts.
- Added D1-backed rate limiting for passwordless start and verify actions.
- Replaced raw email values in auth audit metadata with keyed hashes.
- Added a scheduled, disabled-by-default D1 retention enforcement service that anonymises old participant contact data and deletes expired participant consent and session notes.
- Tightened production Worker defaults by disabling QA BDD auth bypass and removing localhost from `ALLOWED_ORIGINS`.
- Added release SBOM generation and retained intended repository settings for code scanning and dependency review. Code scanning remains repository-level evidence through GitHub code scanning/default setup.
- Updated preview Worker config generation after Codex review so preview deployments explicitly re-enable QA BDD auth and rewrite the full allowed-origin setting from the current production allowlist.

## Validation attempted

- `node --check infra/cloudflare/src/worker.js`
- `node --check infra/cloudflare/src/core/auth/passwordless.js`
- `node --check infra/cloudflare/src/core/auth/access.js`
- `node --check infra/cloudflare/src/service/retention.js`
- `npm test -- tests/security-hardening-controls-route-state.test.js tests/auth-sign-in-route-state.test.js tests/qa-bdd-authenticated-walkthrough-route-state.test.js tests/auth-route-permissions.test.js`
- `node scripts/release-provenance.mjs --output-dir artifacts/release-provenance-test`
- `npm run agent:model:validate`
- `npm run format:check`
- `npm run lint`
- `npm test`
- `npm test -- tests/qa-bdd-authenticated-walkthrough-route-state.test.js tests/security-hardening-controls-route-state.test.js`
- `npm run trace:coverage`
- `npm run validate`

## Validation results

- Syntax checks passed.
- Focused security tests passed.
- Release provenance generator wrote SBOM/provenance artefacts to the test output directory.
- Operating model validation passed.
- Format check passed.
- Lint passed with existing repository warnings and no errors.
- Full Node test suite passed: 297 tests, 0 failures.
- Focused preview deploy and security route-state tests passed after addressing Codex review comments.
- Trace coverage and repository validation passed after the preview deploy workflow update.

## Issues and pivots

- The first full test run failed because the D1 migration ordering document still identified `0024` as next. The document was updated to state that `0025` follows `0024_security_hardening_controls.sql`, and the failing test then passed.
- An existing QA BDD test expected production config to enable the bypass. It was updated to reflect the hardened production default while leaving preview config expectations intact.
- The first PR run showed that GitHub CodeQL default setup is enabled for the repository, so an added advanced CodeQL workflow could not upload SARIF. The explicit CodeQL job was removed and repo-level `code_scanning: true` evidence retained.
- The next PR run showed that GitHub dependency review is unsupported until the dependency graph is enabled for the repository. The explicit dependency-review job was removed and repo-level `dependency_review: true` intended-setting evidence retained.
- Codex review identified that the preview deploy workflow inherited the new production QA-auth-disabled default and still tried to rewrite an old `ALLOWED_ORIGINS` string containing localhost. The preview generator now performs explicit regex replacements for those preview-only values and fails if the expected settings are missing.

## Residual risks

- Retention enforcement remains disabled by default and must be enabled deliberately through Worker configuration after operational approval.
- Security headers include `'unsafe-inline'` for current frontend compatibility; a future hardening pass should move inline scripts/styles behind nonces or external bundles before tightening CSP further.
- Workflow action SHA pinning is still not implemented in this branch.
- CodeQL coverage depends on GitHub default setup rather than this workflow while default setup remains enabled.
- Dependency review enforcement depends on enabling GitHub dependency graph for the repository before adding the dependency review workflow back.
