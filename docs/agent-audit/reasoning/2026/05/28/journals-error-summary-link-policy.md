# Journals error summary link policy trace

## Run metadata

- Date: 2026-05-28
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/journals-error-summary-link-policy`
- Trace requirement: required by `fix/` branch policy
- Trace layer: operational

## Task summary

Bring `main` into line with the preview deployment behaviour for the journals page feedback model.

## Problem

After PR #293 was merged, `main` contains newer feedback runtime behaviour, but the journals Nunjucks source still renders the default page-level journal error summary with `href: '#content'`. That causes page-level journal errors to be anchor-rendered when only the retrieval field validation error should be linked.

## Intended behaviour

- General journals page errors are plain text in the page-level GOV.UK error summary.
- `Enter a term to search.` is the only linked error summary item.
- The linked retrieval validation error targets `#retrieval-q` and is paired with the inline field-level GOV.UK error state.
- Rendered static HTML must match the Nunjucks source so Cloudflare Pages targets converge.

## Files expected to change

- `src/govuk/templates/pages/projects-journals.njk`
- `public/pages/projects/journals/index.html`
- `tests/journals-route-state.test.js`
- trace files for this branch

## Validation plan

- Open a PR to `main`.
- Let Render GOV.UK pages regenerate static HTML.
- Verify all GitHub Actions pass before reporting readiness.
