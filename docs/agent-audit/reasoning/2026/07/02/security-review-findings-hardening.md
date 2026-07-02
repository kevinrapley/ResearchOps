# Security Review Findings Hardening

## Run metadata

- Date: 2026-07-02
- Branch: `fix/security-review-findings-hardening`
- Trace decision: required because `fix/` branches require auditable traces for repository-affecting work.
- Task summary: fix the remaining security review findings on a new branch and open a pull request for review.

## Operating model evidence

- Loaded `AGENTS.md` from the repository prompt.
- Loaded the repository operating-model files required by `AGENTS.md`, including orchestration, bundle registry, task signal catalog, selection rules, precedence policy, trace policy, trace layers, behavioural evals, bootstrap checklist and GitHub mutation policy.
- Ran `npm run agent:model -- "Fix repository security review findings: fallback API permission gates, cross-site cookie CSRF, preview origin hardening, provider error leakage, API error sanitisation, CSP inline script hardening, and seeded PII reduction."`.
- Verified selected bundle prompt files existed for the relevant always-load and conditional bundles.

## Bundle selection

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`
- `airtable-public-api` at `.agent-operating-model/bundles/airtable-public-api/`
- `mural-public-api` at `.agent-operating-model/bundles/mural-public-api/`

`mural-public-api` was loaded because the route permission declarations include existing Mural API endpoints. No Mural request, OAuth, scope, or response contract behaviour was changed.

## Precedence decisions

- GitHub Diamond governed branch naming, PR readiness, trace coverage and validation evidence.
- ResearchOps Developer Control governed Cloudflare Worker route boundaries, D1 migration posture and ResearchOps-specific API behaviour.
- Multi-Functional Team governed public-sector security, PII and GDPR assurance framing.
- Cloudflare governed Worker request handling, CORS, security headers and Pages proxy behaviour.
- GOV.UK Design System applied to static page delivery and frontend compatibility while tightening CSP.
- Airtable and Mural bundles were treated as integration boundary checks; this branch only changed access gates and seeded/test data, not third-party API contracts.

## Implementation decisions

- Tightened Pages origin handling so `researchops.pages.dev` is allowed exactly and preview wildcard origins require `RESEARCHOPS_ALLOW_PAGES_PREVIEW_ORIGINS=true`.
- Added Worker CSRF protection for cookie-authenticated state-changing API requests, with the Pages proxy adding `x-researchops-csrf: pages-proxy` for proxied mutations.
- Added permission declarations and runtime permission checks for legacy fallback API routes, including project, research content, Mural and integration endpoints.
- Required authentication for project CSV export routes and kept health/diagnostic public routes explicitly narrow.
- Added nonce-based CSP handling for static HTML in the Pages Worker and removed `script-src 'unsafe-inline'` from static header policy.
- Sanitised provider email delivery failures and API 5xx responses so internal details are logged but not returned to users.
- Reduced seeded/test PII by replacing named people and Home Office email addresses with synthetic names and `example.test` addresses.
- Added D1 migration `0025_security_review_route_permissions.sql` and updated migration ordering documentation.

## Codex review follow-up

- Thread: `PRRT_kwDOP3Td2M6N17F-` on `infra/cloudflare/src/worker.js`.
- Classification: valid. The branch-preview Worker deployment rewrote `ALLOWED_ORIGINS` but did not enable `RESEARCHOPS_ALLOW_PAGES_PREVIEW_ORIGINS`, so preview POST/PATCH/DELETE requests from branch Pages origins could fail origin checks.
- Disposition: added a thumbs-up reaction, set `RESEARCHOPS_ALLOW_PAGES_PREVIEW_ORIGINS = "false"` in production Worker config, rewrote it to `"true"` in the preview deployment workflow, and added route-state assertions for the preview deployment contract.

## Files created

- `infra/cloudflare/migrations/0025_security_review_route_permissions.sql`
- `tests/security-review-hardening-runtime.test.js`
- `docs/agent-audit/reasoning/2026/07/02/security-review-findings-hardening.md`
- `docs/agent-audit/reasoning/2026/07/02/security-review-findings-hardening.json`

## Validation evidence

- Personal-data scan for the targeted real names and Home Office email domains: passed with no matches.
- `npm run format:check`: passed.
- Focused security and route contract test run: passed, 21 tests and 0 failures.
- Codex review follow-up targeted test run: passed, 18 tests and 0 failures.
- `npx prettier -c .github/workflows/deploy-worker.yml infra/cloudflare/wrangler.toml tests/qa-bdd-authenticated-walkthrough-route-state.test.js`: passed.
- `npm run lint`: passed with warnings only.
- `npm test`: passed, 302 tests and 0 failures.
- `npm run trace:coverage`: passed.
- `npm run validate`: passed.

## Residual risks

- CSP still permits inline styles for current frontend compatibility.
- The CSRF header is a server-side same-site confirmation gate, not a per-session synchronizer token.
- Preview Pages wildcard origins remain available behind an explicit environment flag for preview operations.
