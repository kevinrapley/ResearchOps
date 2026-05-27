# Journals GOV.UK generated HTML ignore policy trace

## Run metadata

- Date: 2026-05-27
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/journals-govuk-template-shell`
- Pull request: #292
- Trace layer: operational addendum

## Task summary

Apply the Codex Option 1 direction for the GOV.UK rendered HTML workflow: align repository ignore policy with the decision to version rendered static HTML outputs.

## Problem

The branch had a dedicated workflow that renders GOV.UK Nunjucks templates and commits generated static HTML. The repository ignore policy still treated all of `public/` as ignored by default. That left an inconsistent posture: the workflow expected to commit generated HTML, while Git ignore policy blocked new generated public pages unless force-added.

## Files changed

- `.gitignore`
- `.prettierignore`
- `tests/govuk-pages-render-workflow-state.test.js`

## Decisions

- Kept `public/` ignored by default.
- Explicitly allowed `public/`, `public/index.html`, `public/pages/` and nested generated HTML output levels required by the current static page structure.
- Kept generated public HTML out of Prettier so versioning generated output does not trigger large formatting rewrites.
- Added contract coverage to ensure the render workflow, canonical renderer and rendered-output ignore policy stay aligned.

## Validation

On commit `8d152c752b870c423dbc5c435deb0f99e2e23866`, these GitHub Actions passed:

- Render GOV.UK pages
- Format pull request
- CI
- qa-bdd
- Accessibility audit (pa11y-ci)
- QA — Broken links (Lychee)
- Validate ResearchOps
- Release Gate
- Worker CI

## Residual risk

The ignore allow-list is explicit rather than a single recursive HTML glob because the connector blocked the broader glob update. The current allow-list covers the nested static HTML page structure used by ResearchOps routes.
