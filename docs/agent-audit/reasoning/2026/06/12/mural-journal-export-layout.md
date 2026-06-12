# Agent trace — Mural journal export layout and idempotency

**Date:** 2026-06-12  
**Trace type:** operational audit trace  
**Branch:** `feature/mural-journal-export-layout`  
**Related work:** Reflexive Journals — Mural integration

## Evidence boundary

This trace records repository evidence, selected operating-model bundles, implementation scope, files changed, validation run and residual risk.

It does not expose private chain-of-thought.

## Operating-model bootstrap

Loaded repository-local sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/github-mutation-policy.md`

Selected bundles:

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`
- `.agent-operating-model/bundles/mural-public-api/`

Skipped bundles:

- `.agent-operating-model/bundles/openai/` — no OpenAI API, model, retrieval or evaluation change.
- `.agent-operating-model/bundles/mcp-agent-tooling/` — no MCP protocol or tool contract change.
- `.agent-operating-model/bundles/airtable-public-api/` — Airtable-backed mapping persistence was left in place but no Airtable API contract was changed.

Selection rationale:

- GitHub governance is in scope because this work creates a feature branch and PR.
- ResearchOps Developer Control is in scope because this changes the ResearchOps journal-to-Mural integration.
- Multi-functional Team is in scope because the flow affects a public-sector user researcher journey.
- GOV.UK Design System is in scope because the ResearchOps UI reports Mural sync state and user-facing outcomes.
- Cloudflare is in scope because the Mural sync runs through the Cloudflare Worker service layer.
- Mural Public API is in scope because the implementation uses Mural widget and tag endpoints.

## Mural API contract evidence

Loaded endpoint contracts:

- `contracts/endpoints/getmuralwidgets.yaml` — `GET /murals/{muralId}/widgets`, minimum scope `murals:read`.
- `contracts/endpoints/getmuraltags.yaml` — `GET /murals/{muralId}/tags`, minimum scope `murals:read`.
- `contracts/endpoints/updatestickynote.yaml` — `PATCH /murals/{muralId}/widgets/sticky-note/{widgetId}`, minimum scope `murals:write`.
- `contracts/endpoints/createstickynote.yaml` — `POST /murals/{muralId}/widgets/sticky-note`, minimum scope `murals:write`.
- `contracts/endpoints/createmuraltag.yaml` — `POST /murals/{muralId}/tags`, minimum scope `murals:write`.

## Task summary

Fix the Reflexive Journal Mural export so journal entries land correctly on the linked Mural board and the ResearchOps UI reports the outcome accurately.

Required behaviour:

- Use the first sticky note in each column as the template for the earliest entry in that column.
- Preserve the existing Raspberry category tag and Snowberry project tag already present on the Mural template sticky.
- Create only additional user-created ResearchOps tags as Mural Mint tags.
- Create subsequent entries by copying the template style and placing each sticky directly below the previous entry with a one-grid gap.
- Process entries by column group in order: Perceptions, Procedures, Decisions, Introspections.
- Do not overwrite or duplicate entries that already exist in Mural.
- Report already-present entries as preserved rather than as failed or newly added.

## Implementation summary

- Tightened column-header detection so category/project tags on white sticky-note template cards no longer cause those cards to be mistaken for purple column headers.
- Selected real white sticky-note template cards under each category heading, preferring blank or placeholder cards.
- Added update behaviour for the first blank template sticky in a column using the sticky-note update endpoint.
- Kept create behaviour for later entries using the sticky-note create endpoint and placement below the latest synced item.
- Added exact body/category matching alongside D1 mapping annotations so existing Mural items are treated as already synced even when the hidden journal-entry mapping is absent from the live widget payload.
- Added `preserved: true` outcomes for existing entries so reruns do not overwrite or duplicate user-visible Mural content.
- Changed tag composition so category/project tags are carried forward from the template sticky rather than recreated by ResearchOps.
- Added an internal `researchOpsUserTags` hint so the safe-tags wrapper only creates additional user-authored ResearchOps tags as Mint tags.
- Stripped the internal `researchOpsUserTags` hint before Mural write requests reach the public API.
- Corrected the follow-up live-board failure where Mural returned purple column labels as sticky-note widgets: exact category-label text plus wide geometry now identifies those widgets as headers, so they are not patched as journal entries.
- Corrected the tag write path so sticky-note create/update calls write the sticky content first, then apply known Mural tag ids to the resulting widget. ResearchOps user-created tags are created as Mint tags; template category/project tags are only reused when already present on the board.
- Addressed Codex review thread `PRRT_kwDOP3Td2M6JDoxV`: body-only existing-widget matching now uses a claimed-widget set during status and hydrate passes so one Mural widget cannot satisfy more than one distinct journal entry id.
- Corrected the later live-board failure where decorative purple title/header notes were treated as reusable entry cards: template selection and existing-card matching now require white content-card geometry, while a filled white card can still anchor later placements when a category header is unreadable.
- Added polluted-board recovery: widgets without explicit content-card dimensions or positioned above the resolved content-card row no longer count as synced, and stale synced widgets outside the content flow are deleted after the correct white card is updated or created.
- Corrected manual-card recognition: existing white cards in the correct Mural column can now be recognised by journal-entry body text even when they do not carry the internal `journal-entry:*` marker. The matcher reads common Mural text fields including `plainText`, `htmlText`, `content`, nested `properties` and nested `data` fields, normalises rich text and whitespace, and permits high-confidence long text containment.
- Corrected the follow-up live status failure where the UI still reported `0 of 36`: the Mural widget list helper now follows the public API `next` pagination cursor so manually-created cards on later widget pages are included in the status scan. The visible-text extractor also handles nested Mural text payloads, for example `{ text: { plainText: "..." } }`, rather than converting those objects to `[object Object]`.
- Corrected the later deployed status failure where Test Project 1 pages opened with the legacy Airtable id `recgdpwEI5hFO7bUZ` could miss a board mapping registered under the canonical id `recgdpwEI5hF07bUZ`: board resolution now checks all known Test Project 1 identifiers across Airtable, D1 and KV mappings before falling back to the environment default board.
- Made the Mural board resolver compatible with the D1 `mural_boards.project` mapping shape used by the Airtable mirror, as well as the newer `project_record_id` / `local_project_id` shape, so status checks do not silently fall through to the wrong board source.
- Corrected the compact journal page Mural status script so `*.pages.dev` previews call same-origin `/api/mural/journal-sync` through the Pages proxy, rather than bypassing the preview Worker and calling the production `rops-api` Worker directly.
- Corrected the repeated live status failure where manually-created cards still reported as `0 of 36`: the shared Mural widget client now requests `limit=100` from the first widget-list page, follows wrapped pagination cursors such as `pagination.next`, and the active safe-tags wrapper has direct status regression coverage for manually-created cards without internal `journal-entry:*` markers.
- Corrected the subsequent live status failure after hard refresh: the journal sync now enriches Mural list results with `GET /murals/{muralId}/widgets/{widgetId}` for sticky-like widgets when the list response lacks visible body text, so manually-created cards can be matched by body text even when the list endpoint only returns ids, tags and geometry.
- Corrected the live failure where no entries could be added to Mural: every sticky-note create fallback still carried the undocumented `shape` property (plus `width`/`height`/`style`/`stackingOrder`), so when the live API rejected undocumented body properties all create attempts failed. Create attempts now degrade to the documented contract — styled payload first, then without `shape`, then `x`/`y`/`text`/`backgroundColor`, then `x`/`y`/`text` only.
- Carried `tags` and the internal `researchOpsUserTags` hint on every create fallback attempt so Mint tag creation and post-write tag application still happen when the styled payload is rejected.
- Corrected post-write tag application to use the documented `PATCH /murals/{muralId}/widgets/sticky-note/{widgetId}` route first, with the generic widget route retained only as a fallback.
- Corrected replacement-sticky creation to stop sending tag text values in the create body; confirmed tag ids are now applied to the replacement widget after creation.
- Merged Mural widget-list pages into the safe-tags widget cache instead of overwriting the cache with each page, so replacement-sticky fallbacks can find source widgets from any page.
- Cached the board tag list for the duration of one sync request so hydrate runs no longer re-fetch `GET /murals/{muralId}/tags` for every write attempt.
- Stopped later entries inheriting earlier entries' Mint tags: once a column template is no longer a blank placeholder, only its category and project-name tags are carried forward to new cards.
- Corrected the live `category-column-not-found` failure: widget tags returned as Mural tag ids are now resolved to tag texts via `GET /murals/{muralId}/tags` before column/template matching, and widget detail enrichment now triggers when list text fields are present but empty rather than only when they are absent.
- Fixed `muralIdFromUrl` in the safe-tags wrapper so widget-list reads with query strings (always sent as `?limit=100`) are recognised; previously the D1 journal-entry annotation and widget cache silently never ran in production.
- Deduplicated widget text fragments so normalised text plus `htmlText` no longer double the body, which broke exact short-body matching and exact header-label detection.
- Added status and hydrate diagnostics (resolved widget counts, text/tag visibility, per-column layout detection, positional widget sample) and embedded a board visibility summary in the `category-column-not-found` outcome so live failures are self-describing.
- Updated both Mural sync UI entry points to report already-present entries as left unchanged.
- Added runtime coverage for first-template update, second-entry creation below the first, existing-entry preservation, sticky-note column headers, and post-write tag application.
- Updated the layout runtime test so two distinct journal entries with the same Perceptions body still produce two sticky writes, purple decorative tagged cards are ignored as templates, stale mapped top widgets are deleted during repair, and three manually-created Perceptions cards without internal markers are counted as 3 synced and 0 pending with no writes even when those cards are returned on a second Mural widget page and use nested text fields.
- Added board-registry regression coverage proving that a page opened with the legacy Test Project 1 id resolves board mappings stored under the canonical Test Project 1 id in both D1 and Airtable.

## Files changed

- `infra/cloudflare/src/service/mural-journal-sync-layout.js`
- `infra/cloudflare/src/lib/mural.js`
- `infra/cloudflare/src/service/internals/mural-board-registry.js`
- `infra/cloudflare/src/service/mural-journal-sync-safe-tags.js`
- `public/js/journal-mural-sync-compact.js`
- `public/js/journal-tabs.js`
- `tests/mural-journal-sync-route-state.test.js`
- `tests/mural-journal-sync-layout-runtime.test.js`
- `tests/mural-journal-sync-safe-tags-runtime.test.js`
- `tests/mural-airtable-board-registry.test.js`
- `docs/agent-audit/reasoning/2026/06/12/mural-journal-export-layout.md`
- `docs/agent-audit/reasoning/2026/06/12/mural-journal-export-layout.json`

## Validation run

```bash
node tests/mural-journal-sync-route-state.test.js
node tests/mural-journal-sync-layout-runtime.test.js
node tests/mural-journal-sync-safe-tags-runtime.test.js
node tests/journals-route-state.test.js
node tests/journal-tabs-api-origin-route-state.test.js
node tests/mural-airtable-board-registry.test.js
node --check infra/cloudflare/src/service/mural-journal-sync-layout.js
node --check infra/cloudflare/src/service/mural-journal-sync-safe-tags.js
node --check tests/mural-journal-sync-safe-tags-runtime.test.js
node --check public/js/journal-mural-sync-compact.js
node --check public/js/journal-tabs.js
node tests/mural-service-split-route-state.test.js
node tests/mural-ui-route-state.test.js
node tests/pages-config-mural-return-route-state.test.js
npm run format:check
npm test
npm run lint
npm run validate
npm run trace:coverage -- --date 2026-06-12
```

Validation results:

- Focused route-state test passed.
- Journal route-state and journal API-origin tests passed, including the compact page same-origin Pages preview API routing guard.
- Focused layout runtime test passed, including duplicate-body, purple decorative-card, stale-widget repair, paginated widget loading, nested Mural text payloads, and manual-card recognition regression coverage.
- Focused safe-tags runtime test passed, including manual-card status recognition through the active safe-tags wrapper, first-page `limit=100` pagination coverage, widget-detail enrichment when the list response omits sticky-note body text, and a strict-contract Mural regression where the API rejects undocumented sticky-note body properties and the sync still lands both entries with tags applied by id.
- Mural board-registry test passed, including legacy Test Project 1 id resolution to canonical D1 and Airtable board mappings.
- JavaScript syntax checks passed.
- Related Mural service, UI, return-route and board-registry tests passed.
- Format check passed after applying Prettier to the new runtime test.
- Full test suite passed: 217 tests.
- Lint passed: 0 errors, 258 existing warnings after routing resolver warnings through the service logger.
- Repository validation passed.
- Trace coverage passed for `feature/mural-journal-export-layout`.

## Residual risk

No live Mural board mutation was performed from the local Codex session. The implementation is covered with mocked Mural API responses and static route-state assertions against the Mural endpoint contracts.

The safe-tags wrapper applies existing Mural tags by id when the Mural tags list returns them. If a template carries a tag name that Mural does not report as an existing board tag, the wrapper will avoid creating that template tag as Mint; new cards will omit that missing template tag rather than mis-colouring it.
