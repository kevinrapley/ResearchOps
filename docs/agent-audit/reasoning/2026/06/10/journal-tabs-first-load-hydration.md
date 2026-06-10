# Journal tabs first-load hydration trace

- Date: 2026-06-10
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/journal-tabs-test-contract`
- Pull request: #389
- Trace layer: operational

## Task summary

Fix the Journal entries tab first-load race where the first page load could show stale non-GOV.UK journal entry markup, while changing tabs and returning to Journal entries showed the correct GOV.UK summary-card rendering. Also fix the Analysis timeline so it reads seeded D1 journal entries instead of returning an empty timeline when Airtable is unavailable or empty.

## Operating model

Loaded the repository operating model before branch work and selected the repository, ResearchOps, multidisciplinary, GOV.UK and Cloudflare bundles.

## Files modified

- `public/components/journal-excerpts.js`
- `infra/cloudflare/src/service/reflection/analysis.js`
- `tests/journals-route-state.test.js`
- `tests/journals-govuk-panel-rendering-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/10/journal-tabs-first-load-hydration.md`
- `docs/agent-audit/reasoning/2026/06/10/journal-tabs-first-load-hydration.json`

## Implementation note

The old `journal-excerpts.js` component rendered journal entries independently on first load using obsolete custom classes. The main `journal-tabs.js` renderer used the correct GOV.UK summary-card path. The old component now becomes a retired compatibility module, so first load and tab-switch rendering use the same renderer.

The Analysis timeline service now reads `journal_entries` from D1 first and falls back to Airtable only when D1 has no matching entries. It supports canonical and legacy Test Project 1 IDs, and matches both `project` and `local_project_id`, so the timeline can display the seeded D1 journal entries.

## Validation status

CI polling required after latest branch commits.
