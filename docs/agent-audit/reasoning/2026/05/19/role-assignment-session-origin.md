# Role assignment session origin trace

- Branch: `fix/role-assignment-session-origin-clean`
- Task: Fix Team Admin role assignment page showing sign-in required for an authenticated Team Admin account.
- Branch trace decision: `fix/` branch, trace required.

## Operating model files loaded

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`

## Selected bundles

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`
- `govuk-design-system`
- `cloudflare`
- `airtable-public-api`

## Skipped bundles

- `openai-platform` — no OpenAI API or model integration change.
- `mcp-agent-tooling` — no MCP tool consent or server/tool contract change.
- `mural-public-api` — no Mural API implementation change.

## Files read

- `docs/product/26/05/09/auth-role-assignment-ui-2026-05-09.md`
- `public/js/auth-role-assignment-page.js`
- `public/js/auth-account-page.js`
- `public/js/auth-sign-in-page.js`
- `public/pages/team/role-assignments/index.html`
- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/src/core/auth/access-scoped.js`
- `infra/cloudflare/src/core/auth/access.js`
- `infra/cloudflare/src/core/auth/passwordless.js`
- `tests/auth-role-assignment-ui-route-state.test.js`

## Root cause

The role-assignment page used Worker-origin fallback routing for `/api/me` on Pages hosts when no explicit API origin was configured.

That meant an authenticated browser session on the ResearchOps Pages origin could call the external Worker origin rather than the same-origin `/api/*` route path. The passwordless session cookie is first-party to the active site origin, so the role-assignment page could show `You cannot assign roles` and `Sign in is required to use this part of ResearchOps` even when the user had the Team Admin role in the active team.

## Change summary

- Updated `public/js/auth-role-assignment-page.js` so `defaultApiOrigin()` falls back to `location.origin` when no explicit API origin is configured.
- Disabled external fallback API origin selection for this authenticated role-assignment flow.
- Updated `apiBaseCandidates()` to use the resolved same-origin API base and only include fallback origins if fallback routing is explicitly enabled.

## Intended user outcome

A signed-in Team Admin, including `digikev.kevin.rapley@gmail.com` in the ResearchOps Core Team, should load the role-assignment page with their active authenticated `/api/me` context and see the role assignment form rather than the sign-in required error.

## Implementation method

The clean repair branch was created from current `main`, after the earlier PR branch produced an invalid partial-tree diff. This branch intentionally contains only the role assignment script change and the required trace files.

## Validation

Local validation was not executed in this ChatGPT environment. CI should run after the PR is opened.

## Residual risks

- The fix assumes same-origin `/api/*` routing is available for Pages deployments and previews.
- If an environment deliberately requires a configured external API origin, it must provide `data-api-origin` or `window.API_ORIGIN` explicitly.
