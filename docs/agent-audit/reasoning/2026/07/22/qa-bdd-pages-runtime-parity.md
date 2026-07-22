# Align PR and main QA BDD runtime coverage

## Run metadata

- Date: 2026-07-22
- Branch: `fix/qa-bdd-pages-runtime-parity`
- Task: Prevent `qa-bdd` from passing against a raw static PR server and then failing against the Cloudflare Pages runtime after merge.

## Branch-prefix trace decision

- `fix/` requires an auditable trace.
- This record contains repository evidence, implementation decisions, validation results and residual risks only.

## Operating model and bundle selection

Loaded `AGENTS.md` and the canonical operating-model orchestration, registry, task signals, selection rules, bootstrap, precedence, trace, behavioural-eval and GitHub mutation policy sources under `.agent-operating-model/`.

Selected canonical bundles:

- `github-diamond` — `.agent-operating-model/bundles/github/`
- `researchops-developer-control` — `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` — `.agent-operating-model/bundles/multi-functional-team/`
- `cloudflare` — `.agent-operating-model/bundles/cloudflare/`

Skipped bundles: `govuk-design-system`, `openai-platform`, `mcp-agent-tooling`, `airtable-public-api` and `mural-public-api`.

## Reproduction and evidence

- PR #503 `qa-bdd` run `29912213595` used `BASE_URL=http://127.0.0.1:8080` from a Python static server and passed three scenarios. It completed at 10:31:41Z; the matching Cloudflare Pages deployment completed three seconds later at 10:31:44Z.
- The merged `main` push run `29919030214` used `https://researchops.pages.dev/`. Its protected Start-route navigation began before the matching Pages deployment completed and timed out after 30 seconds.
- A duplicate `workflow_run`, `29919200395`, ran the same deployed suite again and timed out on the same route during the post-deployment window.
- The live Start scenario subsequently passed unchanged, proving the reported failure was transient rather than a deterministic HTML regression.
- A deterministic workflow assertion failed because the PR workflow contained `Start local static site for PR smoke tests` and a `127.0.0.1:8080` fallback.
- Hosted immutable and branch preview URLs redirect anonymous clients through Cloudflare Access. They cannot replace the local PR target without separately provisioned service-token credentials.
- `wrangler pages dev public` successfully compiled `public/_worker.js`, exercised the protected Start-route redirect to the ResearchOps sign-in page, and passed the complete smoke suite.
- Codex review correctly identified that removing the delayed trigger left the immediate `main` push able to validate the previous production deployment. The valid finding was acknowledged with `+1` before remediation.

## Implementation decisions

- Replace Python static hosting with pinned Wrangler `4.113.0` Pages local development on PRs.
- Remove the immediate `main` push trigger and retain one delayed `workflow_run` only for a successful `QA • Playwright E2E` run whose head branch is `main`.
- Check out `github.event.workflow_run.head_sha` so the delayed deployed-site check uses the exact upstream commit rather than whichever revision is current when it starts.
- Retain direct PR and manual triggers. PR scope detection keeps workflow-only changes inside the gate.
- Preflight the home, sign-in and protected Start routes using bounded curl retries before Cucumber starts.
- Retry `page.goto` once only when Playwright reports a timeout or network transport error. HTTP responses, including failures, are not retried by the navigation helper.
- Record the repeatable trap in `RECENT_LEARNINGS.md`.

## Validation

- The pre-fix PR/main target-parity assertion failed as expected.
- The post-review workflow contract failed before remediation because the delayed trigger was absent and passed after the trigger and exact-SHA checkout were restored.
- `node --test --test-reporter=spec tests/qa-bdd-authenticated-walkthrough-route-state.test.js` passed all 14 tests after implementation.
- The exact workflow runtime command passed all 3 Cucumber scenarios and 11 steps against `wrangler pages dev public`.
- The original deployed-site command passed all 3 scenarios and 11 steps against `https://researchops.pages.dev/` after the fix.
- The GitHub Diamond standard workflow hardening validator passed with no warnings. `actionlint` is not installed in the local workspace.
- `npm run lint` passed with the repository warning baseline and no errors.
- `npm test -- --test-reporter=dot` and `npm run validate` passed.
- Targeted Prettier checks, trace validation, trace coverage and `git diff --check` passed.

## Changed-file plausibility

- Seven paths are changed: the QA workflow, its existing workflow contract, the shared navigation helper and caller, `RECENT_LEARNINGS.md`, and two required trace files.
- No application page, Worker route, binding, secret, Cloudflare Access policy or production configuration changed.

## Residual risks

- Cloudflare Access prevents anonymous PR CI from exercising hosted branch preview URLs.
- Local Wrangler Pages execution covers the advanced Pages Worker, redirects, headers and generated assets but not external DNS, Access or edge availability.
- The delayed successful-QA-Playwright run remains the deployed production smoke check. It will still fail when the bounded route-readiness and navigation retry budgets are exhausted.
- QA Playwright completion is the repository's existing post-CI chain rather than a formal Cloudflare Pages deployment-complete event; bounded route readiness remains the final deployment guard.
