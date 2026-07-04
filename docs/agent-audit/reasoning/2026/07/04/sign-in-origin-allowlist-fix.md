# Sign-In Origin Allowlist Fix Trace

Date: 2026-07-04
Branch: `fix/sign-in-origin`
Task: Fix the production sign-in error where `https://research-operations.com/pages/account/sign-in/` reported that the request origin was not allowed.

## Operating Model Bootstrap

- Loaded `AGENTS.md`.
- Loaded `.agent-operating-model/orchestration.xml`.
- Loaded `.agent-operating-model/bundle-registry.json`.
- Loaded `.agent-operating-model/task-signal-catalog.json`.
- Loaded `.agent-operating-model/selection-rules.json`.
- Loaded `.agent-operating-model/precedence-policy.md`.
- Loaded `.agent-operating-model/github-mutation-policy.md`.
- Loaded `.agent-operating-model/trace-policy.md`.
- Loaded `.agent-operating-model/trace-layers.md`.
- Verified selected bundle directories contain `prompt.spec.yaml` and `prompt.body.xml`.

## Selected Bundles

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/cloudflare/`
- `.agent-operating-model/bundles/govuk-design-system/`

Skipped:

- `.agent-operating-model/bundles/openai/`: no OpenAI API or model integration change.
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP protocol, tool or resource change.
- `.agent-operating-model/bundles/airtable-public-api/`: no Airtable API integration change.
- `.agent-operating-model/bundles/mural-public-api/`: no Mural API integration change.

## Branch Governance

- Initial operational repair was isolated on `hotfix/sign-in-origin` from `origin/main` to avoid mixing with existing local feature work.
- PR #465 was opened from `hotfix/sign-in-origin`.
- The user clarified the branch must use `fix/`.
- The local branch was renamed to `fix/sign-in-origin`.
- Trace is required because the final branch starts with `fix/`.
- PR #465 is superseded by the corrected `fix/` branch PR.

## Evidence

- Live preflight check against the production Worker returned `access-control-allow-origin: null` for `https://research-operations.com`.
- `infra/cloudflare/wrangler.toml` allowed `https://researchops.pages.dev`, the Worker origin and Sourcebook origin, but did not include the public ResearchOps custom domains.
- The sign-in page posts to `/api/auth/email/start`; Worker CORS and trusted mutation checks use `ALLOWED_ORIGINS` and custom origin helpers.

## Implementation Summary

- Added `https://research-operations.com`, `https://www.research-operations.com` and `https://govuk.research-operations.com` to production `ALLOWED_ORIGINS`.
- Added Worker runtime fallback for those public ResearchOps custom domains so sign-in preflight and mutation checks remain allowed if config drifts.
- Added service CORS fallback for the same custom domains.
- Added a regression test that checks the production config includes the public domains, the Worker allows those origins for sign-in preflight, and an unknown origin remains rejected.
- Addressed two GitHub Advanced Security review threads by replacing the test's dynamically constructed regular expression with exact string inclusion checks.

## Files Changed

- `infra/cloudflare/wrangler.toml`
- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/src/service/index.js`
- `tests/worker-cors-origin-policy.test.js`
- `docs/agent-audit/reasoning/2026/07/04/sign-in-origin-allowlist-fix.md`
- `docs/agent-audit/reasoning/2026/07/04/sign-in-origin-allowlist-fix.json`

## Validation

- `npm test -- tests/worker-cors-origin-policy.test.js` passed.
- `node tests/auth-sign-in-route-state.test.js` passed.
- `node tests/security-hardening-controls-route-state.test.js` passed.
- `npm run format:check` passed.
- `npm run lint` passed with existing warnings and no errors.
- `npm run trace:coverage -- --date 2026-07-04` passed.

## Residual Risk

- The live production site will continue to reject the custom domain until the corrected Worker is deployed.
- Full GitHub CI remains the merge gate.
