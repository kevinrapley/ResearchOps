# QA BDD Worker auth secret deploy trace

Date: 2026-06-16
Branch: `fix/qa-bdd-auth-secret-deploy`
Task: Fix the manual `qa-bdd` walkthrough failure where deployed protected-page sign-in rejected the QA BDD auth code.

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
- `.agent-operating-model/bundles/cloudflare/`

## Evidence

- Manual GitHub Actions run `27648926080` for `qa-bdd` reached deployed pages and captured most walkthrough states.
- The only walkthrough failures were `repository/default/desktop` and `repository/default/mobile`.
- Both failed at QA BDD sign-in verify with HTTP 400, which means the deployed Worker did not accept the code sent by the walkthrough job.
- The `qa-bdd` workflow already passes `RESEARCHOPS_QA_BDD_AUTH_CODE` to the walkthrough step.
- The production Worker deploy workflow did not pass `RESEARCHOPS_QA_BDD_AUTH_CODE` to Cloudflare.

## Changes

- Added `RESEARCHOPS_QA_BDD_AUTH_CODE` to production Worker deploy secret checks and Wrangler action secret uploads.
- Added the same secret wiring to the shared preview Worker deploy path in `.github/workflows/deploy-worker.yml`.
- Added the same secret to the passwordless preview Worker secret bulk upload.
- Added an early passwordless preview Worker secret check so missing `RESEARCHOPS_QA_BDD_AUTH_CODE` fails before deploy.
- Enabled the QA BDD auth allow-list vars in `infra/cloudflare/wrangler.passwordless-preview.toml` without storing the secret code in source.
- Added route-state tests so deploy workflow secret wiring and preview Worker QA auth vars remain covered.

## Validation

- `node --test tests/qa-bdd-authenticated-walkthrough-route-state.test.js` passed.
- `npx prettier -c .github/workflows/deploy-worker.yml .github/workflows/deploy-passwordless-preview-worker.yml infra/cloudflare/wrangler.passwordless-preview.toml tests/qa-bdd-authenticated-walkthrough-route-state.test.js` passed.
- `npm run trace:coverage` passed.

## Residual risk

The next production deploy must run before the manual walkthrough can benefit from this change. The GitHub Actions secret and Cloudflare Worker secret must remain the same six-digit code.
