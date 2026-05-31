# Agent trace — Render team access review page

**Date:** 2026-05-31  
**Trace type:** operational audit trace  
**Branch:** `fix/render-team-access-review-page`  
**Related work:** Story 4 — Team Admin reviews team access requests

## Evidence boundary

This trace records repository evidence, implementation scope, files changed, validation expected and residual risk.

It does not expose private chain-of-thought.

## Task summary

Fix the missing generated static HTML route for the Story 4 team access review page and harden the GOV.UK render workflow so future new generated pages are detected.

`public/pages/team/access-requests/index.html` was expected to exist as the rendered output from `src/govuk/templates/pages/team-access-requests.njk`, but it was absent after PR #317 merged.

## Root cause

`scripts/govuk/render-govuk-pages.mjs` already creates missing output directories using recursive directory creation before writing generated HTML.

The render workflow detection step used `git diff --quiet -- public/index.html public/pages`, which checks tracked-file differences but does not detect brand-new untracked generated files.

A new Nunjucks template can therefore generate a new `public/pages/.../index.html` file during CI, but the workflow may still conclude that rendered pages are already committed.

## Operating model context

This is a repository-affecting `fix/` branch.

Trace coverage is required.

## Files inspected

- `src/govuk/templates/layouts/researchops.njk`
- `src/govuk/templates/pages/team-access-requests.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `.github/workflows/render-govuk-pages.yml`
- `tests/auth-team-access-review-route-state.test.js`
- `public/pages/account/team-access/index.html`

## Files changed

- `.github/workflows/render-govuk-pages.yml`
- `public/pages/team/access-requests/index.html`
- `tests/auth-team-access-review-route-state.test.js`
- `docs/agent-audit/reasoning/2026/05/31/render-team-access-review-page.md`
- `docs/agent-audit/reasoning/2026/05/31/render-team-access-review-page.json`

## Implementation summary

The branch adds the missing generated static HTML route:

`public/pages/team/access-requests/index.html`

The generated page corresponds to the Nunjucks source route:

`src/govuk/templates/pages/team-access-requests.njk`

The renderer registration already exists in:

`scripts/govuk/render-govuk-pages.mjs`

The workflow now detects generated output using:

`git status --short -- public/index.html public/pages`

This captures both tracked changes and brand-new untracked generated HTML files.

The workflow now stages generated output before creating the patch used across the branch rebase step.

The route-state test now reads the generated HTML route directly and checks that it contains the expected title, shell, loading state, empty state, pending requests container and review-page controller script.

## Future behaviour

When a new Nunjucks page is registered in `scripts/govuk/render-govuk-pages.mjs`, the render process should:

1. create any missing `public/pages/.../` directory structure,
2. write the generated `index.html`,
3. detect the new generated file,
4. commit it back to the PR branch from the render workflow.

## Scope controls

This branch does not change:

- Worker API behaviour
- D1 migrations
- account-page behaviour
- approval or rejection logic
- role assignment
- permission assignment

## Validation expected

Run:

```bash
npm run validate
npm run lint
npm test -- --ci
```

The GOV.UK render workflow should also pass and confirm that the generated route is consistent with the Nunjucks source.

## Residual risk

Validation has not been run in this connector context.

If the renderer normalises whitespace or macro output differently, CI may commit a small generated-page adjustment. The route-state test should still prevent the generated file from disappearing again.
