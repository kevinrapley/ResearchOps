# Research repository front page integration notes

## Files added

This branch adds source and test files only. Generated HTML and generated CSS are build artefacts and are not committed.

- `src/govuk/data/repository-page.mjs`
- `src/govuk/templates/macros/repository.njk`
- `src/govuk/templates/pages/repository.njk`
- `src/styles/repository.scss`
- `public/js/repository-page.js`
- `functions/api/repository/[[path]].js`
- `infra/cloudflare/src/service/repository.js`
- `infra/cloudflare/migrations/0014_research_repository.sql`
- `tests/repository-front-page-route-state.test.js`

## Build output

Cloudflare build runs the GOV.UK page renderer and Sass build. The output paths are still registered:

- Sass source: `src/styles/repository.scss`
- Generated CSS output: `public/css/repository.css`
- Nunjucks template: `src/govuk/templates/pages/repository.njk`
- Rendered HTML output: `public/pages/repository/index.html`

Do not commit `public/css/repository.css` or `public/pages/repository/index.html` for this route. They should be produced by the build call.

## Existing file changes

### `scripts/govuk/render-govuk-pages.mjs`

The GOV.UK page renderer imports `repositoryPageContext`, registers `/pages/repository/`, and sets `activeNavigation` to `Research Repository`.

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

## Suggested validation

Run:

```bash
npm run build:generated-css
npm run build:govuk-pages
npm test -- --ci
```

The route-state test checks source contracts and build registration. It does not read committed generated CSS or generated HTML for this route.
