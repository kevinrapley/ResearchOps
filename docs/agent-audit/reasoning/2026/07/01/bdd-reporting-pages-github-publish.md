# BDD Reporting Pages GitHub Publish Trace

Date: 2026-07-01
Branch: `fix/bdd-reporting-pages-github-publish`
Task: Fix the failed manual `qa-bdd` walkthrough run after PR #442 merged to `main`.

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
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`
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

Precedence decision: GitHub Diamond governs CI, branch, trace and pull-request behaviour. ResearchOps Developer Control governs the repository workflow contract. Multi-Functional Team frames public reporting-site operational risk. Cloudflare governs Pages deployment and credential boundaries.

## Evidence

- Manual `qa-bdd` run `28534365361` on `main` failed in the `walkthrough` job.
- The `bdd-smoke` job passed.
- The visual walkthrough completed, uploaded the `visual-walkthrough-site` artifact and committed `reports-site` back to `main` as `eec87a0b` with `startedAt` `2026-07-01T17:04:12.316Z`.
- The failing step was `Deploy visual walkthrough to Cloudflare Pages reporting site`.
- Wrangler returned Cloudflare authentication error `10000` for `GET /accounts/***/pages/projects/reopsreporting`.
- Cloudflare API inspection showed the `reopsreporting` Pages project exists, has aliases `reopsreporting.pages.dev` and `report.research-operations.com`, and received a successful GitHub-triggered production deployment after the report commit.
- Cloudflare API inspection also showed the Pages project build destination was still `public`, so the GitHub-triggered deployment served the ResearchOps app shell rather than `reports-site`.
- Live checks of `https://reopsreporting.pages.dev/` and `https://report.research-operations.com/` returned `<title>ResearchOps Demo Suite</title>` and did not contain `Run started:`.
- The Cloudflare Pages project was updated to use `reports-site` as the project root and `.` as the output directory.
- An ad hoc Cloudflare build then failed because current `main` lacks `reports-site/wrangler.toml`, so Cloudflare still found the parent `wrangler.toml` and rejected `pages_build_output_dir = "../public"` as outside the project root.
- After adding the generated `reports-site/wrangler.toml` locally, a direct Wrangler Pages upload from `reports-site` succeeded as deployment `c541ed60-3929-40e1-a4ca-929bd0b08f8f`.
- Live checks confirmed `https://reopsreporting.pages.dev/` and `https://report.research-operations.com/` show `Run started: 2026-07-01T17:04:12.316Z`.

## Changes

- Removed the redundant Wrangler direct-upload deployment from the manual `qa-bdd` walkthrough job.
- Kept report generation, artifact upload and `reports-site` persistence to `main`.
- Changed manual publish verification to wait for the Cloudflare Pages GitHub integration to publish the committed report and verify the live `Run started` timestamp.
- Extended the live verification polling window to 30 attempts.
- Added generated `reports-site/wrangler.toml` support to `scripts/render-reporting-review-site.mjs` so the reporting project has its own Pages config.
- Updated route-state tests to assert `qa-bdd` no longer depends on `CF_API_TOKEN` for reporting-site publication.
- Updated route-state and renderer tests to assert the committed and regenerated reporting artefacts have `pages_build_output_dir = "."`.
- Updated `docs/qa/visual-walkthrough.md` to document that Cloudflare Pages must publish `reports-site` through its GitHub integration.

## Validation

Validation to run before PR readiness:

- `node --test tests/reporting-site-deploy-route-state.test.js`
- `node --test tests/reporting-review-generation-model.test.js`
- `node scripts/validate-reports-site.mjs`
- `npx prettier -c .github/workflows/qa-bdd.yml scripts/render-reporting-review-site.mjs tests/reporting-site-deploy-route-state.test.js tests/reporting-review-generation-model.test.js docs/qa/visual-walkthrough.md reports-site/wrangler.toml docs/agent-audit/reasoning/2026/07/01/bdd-reporting-pages-github-publish.md docs/agent-audit/reasoning/2026/07/01/bdd-reporting-pages-github-publish.json`
- `npm run trace:coverage -- --date 2026-07-01`
- `npm run validate`
- Direct Cloudflare Pages upload from `reports-site` with Wrangler `4.34.0`: passed, deployment `c541ed60-3929-40e1-a4ca-929bd0b08f8f`
- Live reporting URL timestamp check for `reopsreporting.pages.dev` and `report.research-operations.com`: passed

## Risks And Limits

- The repository change prevents `qa-bdd` from failing on a missing or under-scoped Cloudflare Pages direct-upload token.
- The live Cloudflare Pages project has been changed to root `reports-site` and output `.`; this branch must merge so future GitHub-triggered Pages builds find `reports-site/wrangler.toml` on `main`.
- The separate manual `Deploy reporting site` workflow still uses Wrangler direct upload and will require a Cloudflare token with Pages edit/write permission if that manual path is kept.
