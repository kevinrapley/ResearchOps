# Reporting Site Deploy Token Gate Trace

Date: 2026-07-01
Branch: `fix/reporting-site-deploy-token-gate`
Task: Fix the post-merge failure from PR #440 where the new `Deploy reporting site` workflow failed on `main`.

## Operating Model

Loaded files:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/github-mutation-policy.md`

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`

Skipped bundles:

- `govuk-design-system`
- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

Precedence decision: GitHub Diamond governs branch, trace, CI and PR handling. ResearchOps Developer Control governs repository workflow conventions. Multi-Functional Team frames the operational risk of a public reporting surface. Cloudflare governs the Pages deploy behaviour and credential boundary.

## Evidence

- Attached GitHub Actions log for the merged PR #440 commit showed `Deploy reporting site` failed during `wrangler pages deploy reports-site`.
- The same log showed `node scripts/validate-reports-site.mjs` passed and the local reporting artefact guard passed before the deploy step.
- Cloudflare returned authentication error `10000` for `GET /accounts/***/pages/projects/reopsreporting`.
- The workflow had a `push` trigger on `main`, so a credential-sensitive Pages deploy became an automatic post-merge status.

## Changes

- Keep `.github/workflows/deploy-reporting-site.yml` on `push` to `main`, but use that path for repository-side reporting-site validation only.
- Gate Wrangler version logging, `wrangler pages deploy`, and live timestamp verification behind `workflow_dispatch`.
- Update `tests/reporting-site-deploy-route-state.test.js` to assert that push validation and manual deployment are distinct.
- Update `docs/qa/visual-walkthrough.md` to document the manual deploy boundary.
- Add a `RECENT_LEARNINGS.md` entry so future deploy workflows do not make unproven external credentials a required push gate.

## Validation

Passed checks:

- `node --test tests/reporting-site-deploy-route-state.test.js`
- `node scripts/validate-reports-site.mjs`
- `npx prettier -c .github/workflows/deploy-reporting-site.yml tests/reporting-site-deploy-route-state.test.js docs/qa/visual-walkthrough.md RECENT_LEARNINGS.md docs/agent-audit/reasoning/2026/07/01/reporting-site-deploy-token-gate.md docs/agent-audit/reasoning/2026/07/01/reporting-site-deploy-token-gate.json`
- `npm run trace:coverage`
- `npm run validate`

## Risks And Limits

- This change restores normal `main` push validation but does not itself fix the Cloudflare token permission. A manual deploy will still fail until `CF_API_TOKEN` has the required Pages project permission for `reopsreporting`.
- The live reporting site may remain stale or wrong until a manual dispatch succeeds with a corrected token.
