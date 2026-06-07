# Research repository front page integration notes

## Files added

This branch adds these source, generated and test files:

- `src/govuk/data/repository-page.mjs`
- `src/govuk/templates/macros/repository.njk`
- `src/govuk/templates/pages/repository.njk`
- `src/styles/repository.scss`
- `public/css/repository.css`
- `tests/repository-front-page-route-state.test.js`

## Existing file changes

### `scripts/govuk/render-govuk-pages.mjs`

The GOV.UK page renderer imports `repositoryPageContext`, registers `/pages/repository/`, and sets `activeNavigation` to `Research Repository`.

### `scripts/styles/generated-css-targets.mjs`

The generated CSS target list now includes `src/styles/repository.scss` to `public/css/repository.css`.

### `public/partials/header.html`

The shared service navigation now includes a `Research repository` item with `data-nav="Research Repository"`.

## Page structure

The repository front page uses macros for:

- repository hero and assurance panel
- search
- repository metrics
- browse cards
- artefact list
- filter panel
- publication gates
- curator queue table
- team decision cards

The content model keeps repository publication separate from raw research records. It states that draft studies, consent records, recruitment records, session notes and recordings are not part of the repository index.

## Suggested validation

Run:

```bash
npm run build:generated-css
npm run build:govuk-pages
npm test -- --ci
```

If the branch modifies generated CSS or generated HTML, also run:

```bash
npm run format:check
npm run generated-css:check
```
