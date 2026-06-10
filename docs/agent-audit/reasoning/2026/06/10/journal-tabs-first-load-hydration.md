# Journal tabs first-load hydration trace

- Date: 2026-06-10
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/journal-tabs-first-load-hydration`
- Pull request: pending
- Trace layer: operational

## Task summary

Fix the Journal entries tab first-load race where the first page load can show stale non-GOV.UK journal entry markup, while changing tabs and returning to Journal entries shows the correct GOV.UK summary-card rendering.

## Operating model

Loaded the repository operating model before branch work and selected the repository, ResearchOps, multidisciplinary, GOV.UK and Cloudflare bundles.

## Files modified

- `public/components/journal-excerpts.js`
- `tests/journals-govuk-panel-rendering-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/10/journal-tabs-first-load-hydration.md`

## Implementation note

The old `journal-excerpts.js` component rendered journal entries independently on first load using obsolete custom classes. The main `journal-tabs.js` renderer used the correct GOV.UK summary-card path. The old component now becomes a retired compatibility module, so first load and tab-switch rendering use the same renderer.

## Validation status

CI polling required after PR creation.
