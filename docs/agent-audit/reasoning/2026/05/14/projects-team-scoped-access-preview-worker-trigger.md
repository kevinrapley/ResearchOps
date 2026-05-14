# Trace — `fix/projects-team-scoped-access` preview Worker trigger fix

- Branch: `fix/projects-team-scoped-access`
- Trigger: branch-prefix
- Trace layer: operational
- Date: 2026-05-14

## Task

The Pages preview at `fix-projects-team-scoped-acc.researchops.pages.dev` rendered the project dashboard with a `Could not load project.` alert and an empty key information panel. The user asked for continued work on PR #252 to find the cause.

## Operating-model loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`

## Bundles

Selected:

- `github-diamond` — repository / branch / CI workflow change.
- `researchops-developer-control` — platform implementation surface.
- `multi-functional-team` — government product assurance default.
- `cloudflare` — Cloudflare Worker deployment workflow change.

Skipped:

- `govuk-design-system`, `openai-platform`, `mcp-agent-tooling`, `airtable-public-api`, `mural-public-api` — out of scope for this fix.

## Precedence decisions

- GitHub Diamond governs branch hygiene and CI workflow change.
- ResearchOps Developer Control governs the platform's deployment surface, including the preview Worker that Pages function proxy depends on.
- Cloudflare governs the Wrangler deploy contract. The fix preserves `wrangler.passwordless-preview.toml`; only the GitHub Actions trigger changes.

## Investigation

Hypothesis: the Pages preview is up to date but the preview Worker is stale.

Evidence:

- `functions/api/[[path]].js` routes any `*.researchops.pages.dev` branch-preview host to `https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev`.
- `.github/workflows/deploy-passwordless-preview-worker.yml` had `push.branches: [ fix/team-admin-sign-in-journey ]`. PR #252 is on `fix/projects-team-scoped-access`, so this workflow never fires for the PR.
- PR check runs report Cloudflare Pages success for commit `cc17524` but no preview Worker deploy check.
- `RECENT_LEARNINGS.md` records the same class of regression for `deploy-worker.yml` on 2026-05-13 and prescribes `feature/**` and `fix/**` filters. The lesson was not applied to the passwordless preview workflow.

Alternatives ruled out:

- `AIRTABLE_TABLE_DETAILS` missing on the preview Worker — `wrangler.passwordless-preview.toml` declares it.
- CORS allow-list too narrow — `worker.js` permits `*.researchops.pages.dev` via `isResearchOpsPagesOrigin`.
- Client-side id mismatch between projects list and dashboard — covered by `tests/projects-route-contract.test.js` (`assertProjectReadResolvesAirtableRecordId`).

## Change

- Broadened `push.branches` in `.github/workflows/deploy-passwordless-preview-worker.yml` to the approved work-branch prefixes (`main`, `feature/**`, `chore/**`, `test/**`, `fix/**`, `perf/**`, `hotfix/**`).
- Added a route-state-style pin in `tests/project-dashboard-route-state.test.js` asserting the workflow's branch list and rejecting the single-branch hardcode.
- Generalised the 2026-05-13 lesson in `RECENT_LEARNINGS.md` so future preview Worker workflows accept the same prefix set.

## Validation

- `node --test tests/project-dashboard-route-state.test.js tests/projects-page-route-state.test.js tests/projects-route-contract.test.js` — all pass.
- `npm test` — 148 / 148 pass.
- `npm run validate` — passed.
- `npx prettier -c` on changed files — clean.

Not run locally:

- `npm run lint` — sandbox lacks the `globals` package required by `eslint.config.js`. CI lint and prettier jobs cover this.

## Residual risk

- Cloudflare Pages preview deploys via its own pipeline. The user must refresh the preview tab after both Pages and Worker deploys go green on the PR branch.
- Only one preview Worker exists (`rops-api-passwordless-preview`); concurrent PRs will race. Same constraint as `deploy-worker.yml`.
- No change to the `/api/projects` or `/api/projects/:id` contract. PR-level contract tests continue to pin behaviour.

## Evidence boundary

- Repository evidence: workflow YAML, Pages function proxy, RECENT_LEARNINGS, PR check runs.
- Implementation decision: lockstep with `.agent-operating-model/trace-policy.md` approved prefixes; co-pin the workflow with the dashboard route-state test.
- Assumption: `wrangler.passwordless-preview.toml` is the correct Worker config for the Pages-proxied preview surface.
- Tool limitation: sandbox could not probe the live preview Worker (`host_not_allowed`); diagnosis is structural.
- Validation result: targeted tests, validate and prettier all clean.
