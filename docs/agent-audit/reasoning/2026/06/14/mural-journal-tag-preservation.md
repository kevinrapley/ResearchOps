# Agent trace — Mural journal export tag preservation and Mint restyle

**Date:** 2026-06-14  
**Trace type:** operational audit trace  
**Branch:** `feature/mural-journal-export-layout`  
**Related work:** Reflexive Journals — Mural integration (follow-up to the 2026-06-12 layout fix)

## Evidence boundary

This trace records repository evidence, implementation scope, files changed, validation run and residual risk for the follow-up fixes made on 2026-06-14. It extends the earlier trace at `docs/agent-audit/reasoning/2026/06/12/mural-journal-export-layout.md`.

It does not expose private chain-of-thought.

## Operating-model bootstrap

Loaded repository-local sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/trace-policy.md`

Selected bundles:

- `.agent-operating-model/bundles/researchops-developer-control/` — changes the ResearchOps journal-to-Mural integration.
- `.agent-operating-model/bundles/cloudflare/` — the Mural sync runs through the Cloudflare Worker service layer.
- `.agent-operating-model/bundles/mural-public-api/` — the implementation uses Mural widget and tag endpoints.
- `.agent-operating-model/bundles/multi-functional-team/` — the flow affects a public-sector user researcher journey.

## Mural API contract evidence

- `contracts/endpoints/getmuraltags.yaml` — `GET /murals/{muralId}/tags`, minimum scope `murals:read`.
- `contracts/endpoints/createmuraltag.yaml` — `POST /murals/{muralId}/tags`, minimum scope `murals:write`.
- `contracts/endpoints/updatetagbyid.yaml` — `PATCH /murals/{muralId}/tags/{tagId}`, minimum scope `murals:write`.
- `contracts/endpoints/updatestickynote.yaml` — `PATCH /murals/{muralId}/widgets/sticky-note/{widgetId}`, minimum scope `murals:write`.

## Task summary

Two defects were reported against the deployed preview after the 2026-06-12 layout fix:

1. Synced journal cards were losing the board's Snowberry project tag ("Test Project 1").
2. User-created ResearchOps tags were not rendering with Mural's Mint background and border colour.

The browser console also showed `401 authentication_required` from `project-context.js` when loading `/api/projects/:id`, so project-route hydration was failing on the preview.

## Root cause

- **Snowberry tag loss.** The server only carries the board's project tag onto a card when the client-sent `projectName` text-matches the tag. When project-route hydration fails in the browser, `main[data-project-name]` is never populated, so the client falls back to sending the project id (or an unrelated heading). The project-name tag filter then dropped the Snowberry tag from new cards. Separately, the Mural widget `PATCH` replaces the entire tag set, so applying a tag list that lacked the project tag actively stripped Snowberry from a patched template sticky.
- **Tags not Mint.** The safe-tags wrapper only applied the Mint style at tag creation. User tags that already existed on the board from earlier sync attempts were reused as-is with their original (default) style and never restyled.

## Implementation summary

- Resolved the project name server-side from the D1 `projects` and `rops_projects_cache` records, checking all known Test Project 1 id aliases (canonical, legacy and local). The client-sent name is retained only as a fallback. Project names longer than Mural's 25-character tag limit match their truncated board tag.
- Made widget tag application merge the tags already present on the target widget (resolved by id or text, including widget tag objects whose ids are absent from the board tag list), so a `PATCH` can no longer strip the Raspberry category or Snowberry project tag from an existing sticky.
- Restyled user-authored ResearchOps tags that already exist on the board with non-Mint styling to the Mint contract via `PATCH /murals/{muralId}/tags/{tagId}`. Board-curated category and project tags are never restyled. The in-request tag cache is updated after a successful restyle so the same tag is not re-patched on every subsequent write.
- Aligned the compact journal Mural sync payload (`journal-mural-sync-compact.js`) with the journal tabs payload so both prefer the hydrated `main[data-project-name]` value before falling back to the page heading or project id.
- Added runtime coverage: a hydrate request that only carries the project id still carries the Snowberry tag onto new cards (via D1 name resolution); and a pre-existing default-styled user tag is restyled to Mint rather than recreated while the project tag survives tag application even when the board tag list omits it.

## Follow-up: blank cards counted as synced (status over-count)

After deploying this branch's preview Worker, the journals page reported `6 of 36` entries on Mural when only `3` were actually present — the three empty column templates (Procedures, Decisions, Introspections) were each counted as a synced entry, which also disabled the "Add entries" button and blocked the repair path.

Root cause: `canonicalExistingWidget` treated a column card as a synced entry when the card carried that entry's `journal-entry:<id>` marker, without checking that the card actually held entry text. The marker is injected onto live widgets from the D1 `mural_journal_entry_widgets` mapping table, so a stale or incorrect mapping pointing an entry at the blank column template made the empty card count as synced. The body-text match path already rejected blank cards; only the marker path bypassed that check.

Fix: `canonicalExistingWidget` now requires the candidate widget to have non-empty canonical body text before it can match by marker or by body. Real synced cards always contain the entry text (the first-entry flow patches the template with it), so they still count; blank templates stop counting and remain available for the first-entry update. This corrects both the status count and the hydrate idempotency check, so pending entries are created instead of being skipped as already-synced.

Added runtime coverage: a blank column template carrying a stale `journal-entry:` marker is reported as pending (not synced) by the status endpoint.
- Added this trace artefact dated 2026-06-14 to satisfy the feature-branch trace-coverage gate, which keys required traces to the CI run date.

## Files changed

- `infra/cloudflare/src/service/mural-journal-sync-layout.js`
- `infra/cloudflare/src/service/mural-journal-sync-safe-tags.js`
- `public/js/journal-mural-sync-compact.js`
- `tests/mural-journal-sync-layout-runtime.test.js`
- `tests/mural-journal-sync-safe-tags-runtime.test.js`
- `docs/agent-audit/reasoning/2026/06/12/mural-journal-export-layout.md`
- `docs/agent-audit/reasoning/2026/06/12/mural-journal-export-layout.json`
- `docs/agent-audit/reasoning/2026/06/14/mural-journal-tag-preservation.md`
- `docs/agent-audit/reasoning/2026/06/14/mural-journal-tag-preservation.json`

## Validation run

```bash
node --check infra/cloudflare/src/service/mural-journal-sync-layout.js
node --check infra/cloudflare/src/service/mural-journal-sync-safe-tags.js
node --check public/js/journal-mural-sync-compact.js
node tests/mural-journal-sync-layout-runtime.test.js
node tests/mural-journal-sync-safe-tags-runtime.test.js
node tests/mural-journal-sync-route-state.test.js
npm run format:check
npm test
npm run lint
npm run validate
```

Validation results:

- JavaScript syntax checks passed.
- Focused layout and safe-tags runtime tests passed, including the new project-name resolution and Mint-restyle/tag-preservation regression coverage.
- Format check passed.
- Full test suite passed: 217 tests.
- Lint passed: 0 errors, 258 existing warnings.
- Repository validation passed once a 2026-06-14 trace directory existed.

## Residual risk

No live Mural board mutation was performed from this session. The implementation is covered with mocked Mural API responses.

Mural does not publicly document its built-in tag preset colour values. The Mint constants in `mural-journal-sync-safe-tags.js` (`#DDF7E8FF` background, `#98DDB8FF` border, `#0B0C0CFF` text) are the single place to adjust if the workspace's built-in Mint preset differs.

The trace-coverage gate keys the required trace directory to the CI run date (UTC). A CI re-run on a later calendar day will require a trace directory for that day; this is existing repository behaviour, not introduced by this change.
