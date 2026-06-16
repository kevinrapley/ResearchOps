# QA BDD manual walkthrough auth trace

Date: 2026-06-16
Branch: `fix/qa-bdd-repository-walkthrough`
Task: Fix the post-merge `qa-bdd` failure where the visual walkthrough ran on main and could not capture the protected repository front page.

## Operating model

Loaded repository operating-model sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/github-mutation-policy.md`

Selected bundles:

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`

The selected bundle directories had their registered `prompt.spec.yaml` and `prompt.body.xml` files.

## Evidence

- Main `qa-bdd` failed in the `walkthrough` job after PR #415 was merged.
- The failure happened on `repository/default` desktop and mobile captures.
- Live checks showed `/pages/repository/` and `/pages/repository/index.html` redirect to `/pages/account/sign-in/`.
- Other generated repository routes, such as `/pages/repository/service-areas/`, were reachable and already captured.
- Repository secrets currently list Cloudflare deploy secrets but no `RESEARCHOPS_QA_BDD_AUTH_CODE` secret.

## Changes

- Restricted the heavyweight visual walkthrough job to manual `workflow_dispatch` runs.
- Kept the smoke BDD path available for normal main and PR checks.
- Added QA auth secret wiring to the manual visual walkthrough step.
- Added server-side QA sign-in support in `scripts/visual-walkthrough.mjs` so protected pages can receive a real session cookie before navigation.
- Added the non-secret Cloudflare Worker vars `RESEARCHOPS_QA_BDD_AUTH_ENABLED=true` and `RESEARCHOPS_QA_BDD_AUTH_EMAILS=qa-bdd.walkthrough@example.gov.uk` to `infra/cloudflare/wrangler.toml`.
- Updated the repository front-page visual state to wait for the server-rendered repository shell.
- Added route-state tests for the manual-job boundary, secret wiring and protected-page sign-in helper.
- Updated `docs/qa/visual-walkthrough.md` to explain the required GitHub secret and deployed Worker QA bypass alignment.

## Validation

Attempted before the final fix:

- `BASE_URL=https://researchops.pages.dev/ npm run qa:visual-walkthrough` failed on the protected repository page because the live route redirected to sign-in.
- Targeted repository capture without QA auth failed for the same protected-route reason.

Completed after the fix:

- `node --test tests/qa-bdd-authenticated-walkthrough-route-state.test.js tests/visual-walkthrough-registry-coverage.test.js tests/main-qa-ci-route-state.test.js` passed.
- `npx prettier -c .github/workflows/qa-bdd.yml docs/qa/visual-walkthrough.md scripts/visual-walkthrough.mjs tests/qa-bdd-authenticated-walkthrough-route-state.test.js visual-walkthrough.config.mjs docs/agent-audit/reasoning/2026/06/16/qa-bdd-manual-walkthrough-auth-trace.md docs/agent-audit/reasoning/2026/06/16/qa-bdd-manual-walkthrough-auth-trace.json` passed.
- `npm run trace:coverage` passed.
- `npm run lint` passed with existing repository warnings and no errors.
- Follow-up check after adding the Cloudflare Worker non-secret vars: `node --test tests/qa-bdd-authenticated-walkthrough-route-state.test.js` passed.
- Follow-up formatting check: `npx prettier -c infra/cloudflare/wrangler.toml tests/qa-bdd-authenticated-walkthrough-route-state.test.js` passed.

GitHub Actions still needs to run on the PR to prove the normal main smoke path no longer runs the heavyweight walkthrough automatically.

## Residual risk

The manual walkthrough cannot capture protected deployed pages until `RESEARCHOPS_QA_BDD_AUTH_CODE` is configured as a GitHub Actions secret and matches the deployed Cloudflare Worker QA BDD bypass code for `qa-bdd.walkthrough@example.gov.uk`.
