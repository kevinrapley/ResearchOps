# Research repository front page integration notes

## Files added

This branch adds source and test files only. Generated HTML and generated CSS are build artefacts and are not committed.

- `src/govuk/data/repository-page.mjs`
- `src/govuk/templates/macros/repository.njk`
- `src/govuk/templates/pages/repository.njk`
- `src/govuk/templates/pages/repository-static.njk`
- `src/styles/repository.scss`
- `public/js/repository-page.js`
- `functions/api/repository/[[path]].js`
- `infra/cloudflare/src/service/repository.js`
- `infra/cloudflare/migrations/0014_research_repository.sql`
- `infra/cloudflare/migrations/0015_seed_research_repository.sql`
- `tests/repository-front-page-route-state.test.js`

## Build output

Cloudflare build runs the GOV.UK page renderer and Sass build. The output paths are still registered:

- Sass source: `src/styles/repository.scss`
- Generated CSS output: `public/css/repository.css`
- Nunjucks template: `src/govuk/templates/pages/repository.njk`
- Rendered HTML output: `public/pages/repository/index.html`
- Deeper rendered route outputs: `public/pages/repository/**/index.html`

Do not commit `public/css/repository.css` or `public/pages/repository/**/index.html` for this route. They should be produced by the build call.

## Existing file changes

### `scripts/govuk/render-govuk-pages.mjs`

The GOV.UK page renderer imports `repositoryPageContext`, registers `/pages/repository/`, and sets `activeNavigation` to `Research Repository`.

The renderer also maps `repositoryStaticPages` to source-owned deeper pages for:

- `/pages/repository/service-areas/`
- `/pages/repository/user-groups/`
- `/pages/repository/methods/`
- `/pages/repository/risks/`
- `/pages/repository/artefacts/?id=:id`
- `/pages/repository/artefacts/:id/`
- `/pages/repository/review/candidates/new/`
- `/pages/repository/review/candidates/`
- `/pages/repository/review/stale/`
- `/pages/repository/review/withdrawn/`

### `scripts/styles/generated-css-targets.mjs`

The generated CSS target list includes `src/styles/repository.scss` to `public/css/repository.css`.

### `public/partials/header.html`

The shared service navigation includes a `Research repository` item with `data-nav="Research Repository"`.

## Page structure

The repository front page uses macros for:

- repository hero
- same-row search using GOV.UK input and button macros

The page hydrates repository summary, filters, published artefacts and curator queues from `/api/repository`.

The content model keeps repository publication separate from raw research records. Draft studies, consent records, recruitment records, session notes and recordings are not part of the repository index.

## Data derivation

The static Nunjucks page does not invent repository numbers, filters or queue counts. Those panels are hydrated from the authenticated D1-backed `/api/repository` response.

- Repository summary is derived from aggregate D1 counts across `rops_repository_artefacts` and `rops_repository_artefact_tags`.
- Published artefacts are derived from `rops_repository_artefacts` rows where `status = 'published'`, `active = 1`, `pii_cleared = 1` and `consent_scope_confirmed = 1`.
- Filters are derived from D1 facet counts over `method`, `evidence_maturity`, `service_area` and `risk_area` for published, active, PII-cleared, consent-confirmed artefacts.
- Curator queues are derived from D1 workflow-status counts for candidate, due-review and withdrawn artefacts. They are only returned to users with `repository.curate` permission.

The API response includes a `derivation` object so client code and tests can identify the source and rule behind each derived panel.

## API backing

The repository API is available through both Cloudflare Worker routing and the Pages function route:

- `GET /api/repository`
- `GET /api/repository/artefacts`
- `GET /api/repository/artefacts/:id`

D1 is the primary store. The service reads only published, active, PII-cleared, consent-confirmed artefacts from `rops_repository_artefacts` and related tags from `rops_repository_artefact_tags`.

Repository result links point to the generated generic artefact page at `/pages/repository/artefacts/?id=:id`. That route loads the selected artefact from `/api/repository/artefacts/:id`, so seeded or Airtable-backed artefacts do not need one generated HTML file per artefact ID.

The Pages Function route restricts credentialed CORS to same-origin Pages requests or configured `ALLOWED_ORIGINS`. Arbitrary external origins receive `origin_not_allowed` without a credentialed allow-origin response.

The D1 seed migration adds realistic curated repository data for product review:

- 100 published artefacts across applications, casework, support, notifications and Research Operations
- method, maturity, service-area, user-group and risk facets
- linked recommendation tags so the summary metrics are meaningful
- 20 candidate records and 10 withdrawn records for curator queue counts
- only summarised, non-identifying evidence with PII clearance and consent-scope confirmation for published rows

Airtable is the fallback source when D1 is unavailable. The fallback uses the Airtable records API with page-size-limited pagination and maps public repository fields only. The fallback still applies the publication boundary before returning artefacts.

Curator queue counts are permission-aware. Users without `repository.curate` receive no queue counts.

## Suggested validation

Run:

```bash
npm run build:generated-css
npm run build:govuk-pages
npm test -- --ci
npm run validate
```

The route-state test checks source contracts and build registration. It does not read committed generated CSS or generated HTML for this route.
