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
- Kept the passwordless preview Worker storage bindings on provisioned Cloudflare resources and removed stale preview origins/localhost from the checked-in allowlist.
- Updated the security workflow to run on relevant PR paths with Node 22 and aligned `package.json` engine metadata.
- Follow-up on PR review: Codex identified that the deploy route migration only inserted fresh rows and did not tighten an existing public `route_api_agent_pages_deploy_post` row. The migration now explicitly updates that route after the seed insert.
- Follow-up on CI: the passwordless preview Worker deployment failed because the replacement KV namespace ID and D1 database ID were not present in Cloudflare. The preview config now uses the previously provisioned KV and D1 bindings.
- Follow-up on secret separation: Mural OAuth state signing now prefers the dedicated `MURAL_OAUTH_STATE_SECRET`, the Worker config marks it required and deployment workflows pass it to production, preview and passwordless preview Workers.

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
- Follow-up focused tests passed for security hardening, QA BDD preview workflow/config and Mural UI route-state contracts.
- Follow-up `npm run format:check`, `npm run lint`, `npm run trace:coverage`, `npm test` and `npm run validate` passed after the Codex comment and preview deployment fixes.
- Follow-up focused secret-separation tests passed for security hardening and Mural route-state contracts.
- Live secret verification confirmed `MURAL_OAUTH_STATE_SECRET` and `RESEARCHOPS_AUTH_SECRET` are configured in GitHub repository secrets and both repo-backed Cloudflare Workers: `rops-api` and `rops-api-passwordless-preview`.

## Residual risks

- Passwordless preview storage remains on the provisioned KV and D1 bindings until separate preview resources are created and verified in Cloudflare.
- Production retention is enabled in configuration; operators should review first scheduled run output and data counts after deployment.
- Mural OAuth state now uses `MURAL_OAUTH_STATE_SECRET` when configured and keeps `RESEARCHOPS_AUTH_SECRET` as a compatibility fallback.
