# Security Hardening Main

## Run metadata

- Date: 2026-07-02
- Branch: `fix/security-hardening-main`
- Base: `origin/main`
- Trace decision: required because `fix/` branches require auditable traces for repository-affecting work.
- Task summary: apply the nine hardening fixes identified against `main` on a new branch ready for PR review.

## Operating model evidence

- Loaded `AGENTS.md`.
- Loaded `.agent-operating-model/orchestration.xml`.
- Loaded `.agent-operating-model/bundle-registry.json`.
- Loaded `.agent-operating-model/task-signal-catalog.json`.
- Loaded `.agent-operating-model/selection-rules.json`.
- Loaded `.agent-operating-model/bootstrap-checklist.md`.
- Loaded `.agent-operating-model/precedence-policy.md`.
- Loaded `.agent-operating-model/trace-policy.md`.
- Loaded `.agent-operating-model/trace-layers.md`.
- Loaded `.agent-operating-model/behavioural-evals.json`.
- Loaded `.agent-operating-model/github-mutation-policy.md`.

## Bundle selection

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`
- `mural-public-api` at `.agent-operating-model/bundles/mural-public-api/`

Skipped bundles: GOV.UK design system, OpenAI Platform, MCP Agent Tooling and Airtable Public API were not selected for this implementation pass because no UI/content, OpenAI, MCP or Airtable API contract behaviour was changed directly.

## Precedence decisions

- GitHub Diamond governed branch naming, trace coverage, validation evidence and PR readiness.
- ResearchOps Developer Control governed Worker route ownership, service boundaries, route permissions and platform-specific hardening.
- Multi-Functional Team governed PII, GDPR, audit, logging and government assurance posture.
- Cloudflare governed Workers, Pages, Wrangler configuration, bindings, observability and proxy behaviour.
- Mural Public API governed Mural OAuth/token boundaries and least-privilege integration posture.

## Implementation decisions

- Hardened the legacy Pages Function API proxy so it no longer reflects arbitrary credentialed origins, strips upstream CORS headers, adds CSRF confirmation to proxied mutations and returns generic upstream errors.
- Gated advanced Pages Worker diagnostics behind `RESEARCHOPS_PROXY_DIAGNOSTICS_ENABLED` and removed production upstream/source leakage by default.
- Enabled production retention enforcement in `wrangler.toml`.
- Reduced persistent production Worker logging by disabling invocation log persistence and lowering sampling.
- Bound Mural OAuth state and token storage to authenticated ResearchOps user IDs, signed OAuth state, removed anonymous token fallback use and routed Mural endpoints through Worker auth context.
- Required the deploy hook route to pass ResearchOps route permission checks for `deployment.trigger` while retaining the deploy hook bearer secret.
- Disabled `_diag/*` routes unless `RESEARCHOPS_DIAGNOSTICS_ENABLED=true`.
- Separated passwordless preview KV/D1 identifiers from production config and removed stale preview origins/localhost from the checked-in allowlist.
- Updated the security workflow to run on relevant PR paths with Node 22 and aligned `package.json` engine metadata.

## Validation plan

- Focused route/security tests covering proxy, diagnostic, Mural, deployment and config contracts.
- Formatting and lint checks.
- Trace coverage check for the `fix/` branch.
- Full validation where runtime permits.

## Validation evidence

- `npm run format:check` passed.
- `npm run lint` passed with existing warning-only lint debt.
- `npm run trace:coverage` passed.
- `npm run validate` passed.
- `npm test` passed: 305 tests, 305 pass, 0 fail.
- Focused hardening tests passed during implementation for proxy CORS/CSRF, diagnostics, deployment permission, Mural OAuth state/token ownership and production/preview configuration contracts.

## Residual risks

- The preview Worker config now references separate preview storage identifiers; those Cloudflare resources must exist before deploying that preview config.
- Production retention is enabled in configuration; operators should review first scheduled run output and data counts after deployment.
- Mural OAuth state depends on `RESEARCHOPS_AUTH_SECRET` or `MURAL_OAUTH_STATE_SECRET` being configured.
