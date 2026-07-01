# ReOps Reporting Static Site Trace

Date: 2026-07-01
Branch: `fix/reopsreporting-static-site`
Task: Fix `https://reopsreporting.pages.dev/` serving the GOV.UK-branded ResearchOps service instead of the committed static `reports-site/` walkthrough.

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
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`

Skipped bundles:

- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

Precedence decision: GitHub Diamond governed branch, trace, PR and validation discipline. ResearchOps Developer Control governed repository patterns. Multi-Functional Team governed public-service assurance framing. GOV.UK Design System was relevant only to distinguishing the wrong GOV.UK-branded app shell from the static reporting site. Cloudflare governed Pages deployment behaviour.

## Evidence

- Current branch began on `main`; work moved to approved branch `fix/reopsreporting-static-site`.
- Live `https://reopsreporting.pages.dev/` returned HTTP 200 with `x-researchops-brand: govuk`, `<html class="govuk-template">`, and `<title>ResearchOps Demo Suite</title>`.
- `reports-site/index.html` contains `<title>ResearchOps application visual walkthrough</title>` and static walkthrough content.
- Root `wrangler.toml` intentionally keeps `pages_build_output_dir = "public"` for the main ResearchOps Pages app.
- Existing `qa-bdd` deployment of `reports-site/` only runs on manual dispatch when `publish_reporting_site` is true.

## Changes

- Added `.github/workflows/deploy-reporting-site.yml` to validate and deploy the committed `reports-site/` directory to the `reopsreporting` Pages project after every `main` push and on manual dispatch.
- Added a pre-deploy guard that rejects the GOV.UK service app shell markers before publishing.
- Added `tests/reporting-site-deploy-route-state.test.js` to pin the reporting deployment source, project name, verification check and distinction between `public/` and `reports-site/`.
- Updated `docs/qa/visual-walkthrough.md` to document the dedicated reporting-site deployment.

## Validation

Initial result:

- `node --test tests/reporting-site-deploy-route-state.test.js tests/reporting-review-generation-model.test.js tests/cloudflare-pages-output-dir.test.js` failed because the new ES module test used the test runner global without importing `node:test`.
- A follow-up run failed because the static report legitimately contains `ResearchOps Demo Suite` inside captured acceptance criteria. The pre-deploy guard was narrowed to reject the public app `<title>` instead.

Passed checks:

- `node --test tests/reporting-site-deploy-route-state.test.js tests/reporting-review-generation-model.test.js tests/cloudflare-pages-output-dir.test.js`
- `node scripts/validate-reports-site.mjs`
- `npx prettier -c .github/workflows/deploy-reporting-site.yml tests/reporting-site-deploy-route-state.test.js docs/qa/visual-walkthrough.md docs/agent-audit/reasoning/2026/07/01/reopsreporting-static-site.md docs/agent-audit/reasoning/2026/07/01/reopsreporting-static-site.json`
- `npm run trace:coverage`
- `npm run validate`

Deployment check:

- `npx --yes wrangler@4.34.0 pages deploy reports-site --project-name=reopsreporting --branch=main --commit-hash=$(git rev-parse HEAD) --commit-message="Restore reporting site static reports-site"` failed locally because Wrangler requires `CLOUDFLARE_API_TOKEN` in this non-interactive environment.

## Risks And Limits

- This repository change ensures GitHub Actions deploys the static reporting artefact. If the Cloudflare Pages project still has a dashboard Git integration that publishes `public/`, Cloudflare-side settings should also be corrected or disabled to avoid competing deployments.
- Local work cannot prove the production deploy until the PR is merged and the workflow has access to `CF_API_TOKEN` and `CF_ACCOUNT_ID`.
