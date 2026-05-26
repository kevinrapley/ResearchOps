# Project Dashboard D1-first load and Mural OAuth diagnosis

## Run metadata

- Date: 2026-05-26
- Branch: `chore/govuk-frontend-integration`
- Pull request: #262
- Trigger: follow-up visual test after Project Dashboard rendered with stale status tags and Mural OAuth redirect failure.

## User-observed defects

1. The dashboard summary rows showed project values such as `Discovery` and `Planning research`, but the status-strip tags still showed `Service stage not recorded` and `Project stage not recorded`.
2. Mural showed `Something went wrong` with `The redirect URL is invalid`, meaning Mural rejected the `redirect_uri` before returning to ResearchOps.

## Operating model sources loaded

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

- `infra/cloudflare/src/service/project-record-routes.js`
- `functions/api/[[path]].js`
- `public/js/project-dashboard.js`
- `src/govuk/templates/pages/project-dashboard.njk`
- `public/pages/project-dashboard/index.html`
- `public/components/mural-integration.js`
- `infra/cloudflare/wrangler.toml`
- `infra/cloudflare/wrangler.passwordless-preview.toml`
- `.github/workflows/deploy-passwordless-preview-worker.yml`
- `tests/project-dashboard-route-state.test.js`

## Diagnosis

The Project Dashboard had two separate freshness paths.

The controller source had been corrected to populate the status-strip tags after loading project data, but the generated public HTML and script URLs still carried old cache-busting strings. This meant the preview could continue serving an older controller and older default labels.

The single-record API route still reads Airtable before D1. The list route, however, already reads D1 first and falls back to Airtable. To meet the immediate dashboard requirement without rewriting the long backend route file, the dashboard controller now loads the project from the D1-first list endpoint first, then falls back to `/api/projects/:id` only when the D1-first list cannot provide the matching project.

The Mural error is not the earlier callback `missing_secret` response. It happens before the callback. Mural is rejecting the `redirect_uri` value advertised by ResearchOps. The checked-in preview Worker config advertises `https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev/api/mural/callback`. That URI must be present in the Mural app's allow-list. If it is not allow-listed, no repository-only code change can make Mural accept it. The durable options are either to add this preview callback URI to the Mural app configuration or to use a callback URI that is already registered and make sure that target Worker has the Mural OAuth secret configured.

## Changes made

- Updated `public/js/project-dashboard.js` to try `/api/projects?limit=200` first. That route is D1-first, with Airtable as secondary fallback.
- Kept `/api/projects/:id` as a secondary fallback for the dashboard.
- Bumped the Project Dashboard script cache token in `src/govuk/templates/pages/project-dashboard.njk` to `project-dashboard-d1-first-20260526`.
- Bumped the Mural integration cache token to `project-dashboard-mural-optional-20260526`.
- Updated `.github/workflows/deploy-passwordless-preview-worker.yml` so the preview Worker secret upload includes `MURAL_CLIENT_SECRET`.
- Added `tests/project-dashboard-d1-first-load.test.js` to guard the D1-first dashboard load path, cache-busting token and preview Worker secret inclusion.

## Known limitation

The generated `public/pages/project-dashboard/index.html` still needs regeneration from the Nunjucks template. A direct full-file update was blocked by the tool layer. The normal `npm run build` path should regenerate it from `src/govuk/templates/pages/project-dashboard.njk`; if Cloudflare Pages deploys committed public files without running the build, the stale default labels and stale script URL will remain until that generated file is refreshed.

## Mural OAuth follow-up required

For the Mural `redirect_uri` error, one of these must happen outside the page controller:

1. Add `https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev/api/mural/callback` to the Mural app's allowed redirect URL list; or
2. Configure the preview Worker to advertise the already-registered production callback URI and ensure that production callback Worker has the Mural OAuth secret.

The preview Worker secret upload has been corrected. The Mural app allow-list or callback strategy remains the deciding factor for the `redirect_uri` rejection.

## Validation not run locally

- `npm test`
- `npm run format:check`
- `npm run lint`
- Cloudflare Pages visual check
- Mural OAuth end-to-end check
