# Main QA BDD CI Fix Trace

Date: 2026-06-16
Branch: `fix/qa-bdd-main-ci`
Task: Fix the main-branch QA BDD and Playwright E2E failures after the authenticated walkthrough merge.

## Operating Model Bootstrap

- Loaded `AGENTS.md`.
- Loaded `.agent-operating-model/orchestration.xml`.
- Loaded `.agent-operating-model/bundle-registry.json`.
- Loaded `.agent-operating-model/task-signal-catalog.json`.
- Loaded `.agent-operating-model/selection-rules.json`.
- Loaded `.agent-operating-model/github-mutation-policy.md`.
- Loaded `.agent-operating-model/precedence-policy.md`.
- Verified selected bundle directories contain `prompt.spec.yaml` and `prompt.body.xml`.

## Selected Bundles

- `.agent-operating-model/bundles/github/` (`github-diamond`)
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`

Skipped:

- `govuk-design-system`: no UI implementation or content-pattern change beyond CI smoke route selection.
- `cloudflare`: no Cloudflare runtime or deployment code change.
- OpenAI, MCP agent tooling, Airtable public API and Mural public API were not involved.

## Failure Evidence

- Main push workflow `qa-bdd`, run `27645142118`, failed in `bdd-smoke`.
- Failing scenario: `Projects page loads`.
- Observed title: `Sign in to ResearchOps - ResearchOps Demo Suite`.
- Expected title: `/Projects/i`.
- Main workflow used deployed `BASE_URL=https://researchops.pages.dev/`, where the Projects route is inside the authenticated realm.
- Follow-on `QA • Playwright E2E`, run `27645201722`, failed because the workflow forced `npx playwright@1.56.1 test` while the repository lockfile installs Playwright `1.60.0`.
- Live reporting site check showed `https://reopsreporting.pages.dev/` serving the main ResearchOps demo homepage instead of the visual walkthrough report.
- The `qa-bdd` workflow only deployed `reports-site/` to the `reopsreporting` Cloudflare Pages project for manual `workflow_dispatch` runs, leaving main walkthrough runs unable to correct the reporting site after normal merges.

## Implementation Summary

- Replaced the default public BDD smoke scenario for `/pages/projects/index.html` with a public sign-in page check.
- Replaced the E2E smoke route for `/pages/projects/index.html` with `/pages/account/sign-in/index.html`.
- Updated `.github/workflows/qa-e2e.yml` to use the repository-installed Playwright binary through `npx playwright install --with-deps chromium` and `npm run test:e2e`.
- Updated `.github/workflows/qa-bdd.yml` so any completed main walkthrough run deploys and verifies `reports-site/` to `reopsreporting`, while manual runs can still opt out with `publish_reporting_site=false`.
- Updated `docs/qa/visual-walkthrough.md` to document the reporting deployment behaviour.
- Added `tests/main-qa-ci-route-state.test.js` to lock the CI contract.

## Validation Plan

- Focused route-state tests passed:
  - `node --test tests/main-qa-ci-route-state.test.js tests/qa-bdd-authenticated-walkthrough-route-state.test.js`
- Formatting check passed:
  - `npx prettier -c .github/workflows/qa-bdd.yml .github/workflows/qa-e2e.yml docs/qa/visual-walkthrough.md tests/e2e/smoke.spec.js tests/main-qa-ci-route-state.test.js docs/agent-audit/reasoning/2026/06/16/main-qa-bdd-ci-fix-trace.md docs/agent-audit/reasoning/2026/06/16/main-qa-bdd-ci-fix-trace.json`
- Trace coverage passed:
  - `npm run trace:coverage`
- Cucumber smoke passed against a local static server:
  - `BASE_URL=http://127.0.0.1:8792 npm run qa:cucumber:ci`
  - Result: 3 scenarios passed, 11 steps passed.
- Playwright E2E passed against the same local static server:
  - `BASE_URL=http://127.0.0.1:8792 npm run test:e2e`
  - Result: 4 tests passed.

## Residual Risk

- The deployed main smoke suite now checks only public pages. Authenticated page coverage remains in the dedicated walkthrough profile and visual walkthrough catalogue.
- `reopsreporting` will be corrected by the next successful main walkthrough run after this workflow change is merged, or by a manual workflow dispatch from a branch containing this fix.
- Local validation uses a static server; GitHub Actions will confirm the deployed main workflow behaviour after the fix PR is merged.
