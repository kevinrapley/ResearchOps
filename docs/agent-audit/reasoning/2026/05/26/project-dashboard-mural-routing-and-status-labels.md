# Project Dashboard Mural routing and status label fix

## Run metadata

- Date: 2026-05-26
- Branch: `chore/govuk-frontend-integration`
- Pull request: #262
- Starting visual evidence: Project Dashboard rendered with header/footer, but Mural OAuth returned to the production Worker and project status tags showed inaccurate default text.
- Trace trigger: `chore/` branch prefix requires an auditable trace.

## Task summary

The Project Dashboard now rendered, but three regressions remained:

1. The Mural connect button sent the user through the production Worker callback, which returned `missing_secret` for `MURAL_CLIENT_SECRET`.
2. The dashboard status strip showed `Service stage not recorded` and `Project stage not recorded` even though the summary list showed loaded values.
3. The Mural idle state said `Mural not checked`, which made Mural sound like a required automated check rather than an optional visual journaling integration.

## Operating-model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`

## Selected bundles

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`
- `govuk-design-system`
- `cloudflare`
- `airtable-public-api`
- `mural-public-api`

## Evidence read

- `public/components/mural-integration.js` on `main`
- `public/components/mural-integration.js` on `chore/govuk-frontend-integration`
- `public/js/project-dashboard.js` on `main`
- `public/js/project-dashboard.js` on `chore/govuk-frontend-integration`
- `src/govuk/templates/pages/project-dashboard.njk`
- `infra/cloudflare/wrangler.toml`
- `infra/cloudflare/wrangler.passwordless-preview.toml`
- `.github/workflows/deploy-worker.yml`
- `tests/mural-ui-route-state.test.js`
- `tests/project-dashboard-route-state.test.js`

## Diagnosis

The Project Dashboard Mural client still used the old `pages.dev` default that pointed directly at the production Worker. On the PR branch preview, that meant `Connect Mural` bypassed the same-origin Pages API proxy and sent OAuth to `https://rops-api.digikev-kevin-rapley.workers.dev`. The callback therefore landed on the production Worker rather than the passwordless preview Worker.

The status-strip labels were separate. The loaded project data populated the summary-list rows, but the status-strip tags were static defaults. The controller did not update `#project-service-stage-tag` and `#project-stage-tag` after project load.

The Mural idle state was also misleading. Since Mural is optional, the initial state should describe optional availability rather than imply that a required check has not happened.

## Changes made

- Restored same-origin Mural API routing in `public/components/mural-integration.js`.
- Removed the production Worker fallback from the Mural client.
- Added an `apiUrl()` helper for `/api/mural/*` calls.
- Updated the Mural idle state to `Mural optional`, `Connect if needed`, and `Create or open manually`.
- Kept Mural API calls user-initiated only.
- Added `hasMuralConnectedReturn()` to show connected state after OAuth returns with `mural=connected`.
- Broadened Project Dashboard field aliases for service stage and project stage.
- Added `setTagText()` and populated the status-strip tags from loaded project data.
- Updated Nunjucks defaults from `not recorded` wording to loading/optional wording.
- Updated `infra/cloudflare/wrangler.passwordless-preview.toml` to align the checked-in preview origin with the active PR preview.
- Updated route-state tests to guard same-origin Mural routing and status-label mapping.

## Files modified

- `public/components/mural-integration.js`
- `public/js/project-dashboard.js`
- `src/govuk/templates/pages/project-dashboard.njk`
- `infra/cloudflare/wrangler.passwordless-preview.toml`
- `tests/mural-ui-route-state.test.js`
- `tests/project-dashboard-route-state.test.js`

## Deployment-contract gap found

`.github/workflows/deploy-worker.yml` still needs a follow-up change. The workflow currently deploys preview Workers for `feature/**` and `fix/**`, but not `chore/**`, `test/**`, `perf/**`, or `hotfix/**`. It also does not pass `MURAL_CLIENT_SECRET` into the Wrangler deploy secret list. That means source fixes may not refresh the preview Worker on this branch, and OAuth token exchange can still fail if the target Worker does not have the Mural client secret.

An attempted workflow update was blocked by the tool layer. This trace records the gap explicitly so it is not lost.

## Validation attempted

No local validation was run in this ChatGPT environment.

## Validation not run

- `npm test`
- `npm run format:check`
- `npm run lint`
- Cloudflare Pages preview visual check
- Worker deployment workflow validation

## Follow-up checks

After the latest Pages deployment, check `Connect Mural` again. The expected redirect path should go through the same-origin Pages `/api/mural/auth` route and then use the passwordless preview Worker callback. If the callback still returns `missing_secret`, the remaining issue is a Worker secret/deployment configuration problem rather than the dashboard route client.
