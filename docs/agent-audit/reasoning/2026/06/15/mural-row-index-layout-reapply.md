# Agent trace — Re-apply row-index Mural card layout after branch revert

**Date:** 2026-06-15
**Trace type:** operational audit trace
**Branch:** `feature/mural-journal-export-layout`
**Related work:** Reflexive Journals — Mural integration

## Context

The branch had been reverted on the remote to commit `34fc6f72`
(see `remote-revert-to-34fc6f72.md`), dropping the deterministic card
grid. The board owner supplied a validated-working version of
`mural-journal-sync-layout.js` that places cards on the Reflexive Journal
template's fixed grid by row index, and asked for that layout to be used
together with the previously-correct tag handling.

## Change

- Adopted the supplied `mural-journal-sync-layout.js` wholesale. Card
  placement is deterministic via `placementForRow(layout, rowIndex)`:
  - x = `COLUMN_X[category]` — Perceptions 120, Procedures 456,
    Decisions 792, Introspections 1128.
  - width 288, height 168 (Mural's fixed sticky size).
  - y = `COLUMN_START_Y` (264) + `rowIndex` × `ROW_PITCH` (192).
  - `rowIndex` is the entry's position within its category in the sorted
    hydrate list, so placement does not depend on detecting the previous
    card — fixing the stacking regression where every card piled at the
    start row when a just-placed card was not re-matched.
- Retained the tag work:
  - Snowberry project-tag preservation and truncation
    (`templateCarryTags`, `tagMatchesProjectName`).
  - Server-side project-name resolution from D1 (`resolveProjectName`,
    `projectNameFromD1`), robust to the preview `/api/projects` 401.
  - Blank-template handling via marker-stripped text
    (`bodyTextWithoutEntryMarkers`, `isTemplatePlaceholder`).
  - Mint user-tag creation, tag preservation on PATCH, and restyle of
    pre-existing user tags in `mural-journal-sync-safe-tags.js`
    (unchanged — identical on both sides of the revert).
- Reconciled the remote revert by merging it while keeping the row-index
  layout and updated tests; kept the remote's `2026/06/15` revert trace.

## Constraints recorded

- The Mural public sticky-note create/update API accepts only
  `text`, `x`, `y`, `backgroundColor` — no width, height, or font size.
  Cards therefore cannot be resized and body text cannot be scaled to fit
  via the API; long entries overflow the fixed 168px card box. Scaling
  text to the card would require a different Mural widget type or manual
  sizing in Mural, outside this integration.

## Validation

```bash
node tests/mural-journal-sync-layout-runtime.test.js
node tests/mural-journal-sync-safe-tags-runtime.test.js
node tests/mural-journal-sync-route-state.test.js
npm test
npm run lint
npm run format:check
npm run validate
```

- Focused mural tests pass, asserting new cards land at x 120, width 288,
  and the second Perceptions card at y 456 (264 + 192).
- Full suite: 217 tests passing.
- Lint: 0 errors. Format: clean. Repository validation: passed.

## Follow-up: tag application via create-with-widgets

Live testing showed created cards landing untagged (only the pre-tagged
template kept its tags). A response-surfaced diagnostic (`tagSync`)
confirmed the cause: `PATCH /widgets/sticky-note/{id}` with a `tags`
array returns 200 but is a no-op — Mural's widget-update API does not
accept a `tags` field (it documents only `text`/`x`/`y`/`backgroundColor`),
so the previous tag-application path silently did nothing.

Mural's only mechanism to attach a tag to a widget is "create tag with
`widgets: [{ id }]`" (`POST /murals/{id}/tags`); there is no
add-existing-tag-to-widget endpoint, and widget update ignores tags.
Mural deduplicates tags by text within a mural, so re-posting an existing
tag text with a widgets array associates the existing tag rather than
creating a duplicate. The safe-tags wrapper now attaches every confirmed
tag (category, project, user) to each created/updated widget via
create-with-widgets, preserving colours: board category/project tags keep
their existing colour (Raspberry/Snowberry), user tags use Mint. The
old PATCH-based `applyTagsToWidget` and user-tag-only fallback were
removed. Runtime tests assert create-with-widgets associations (text +
widget id + colour) instead of the PATCH tag path.

## Residual risk

No live Mural mutation was performed from this session; coverage is via
mocked Mural API responses. Row-index placement assumes the journal Mural
matches the fixed template grid (true for template duplicates). Tag
association relies on Mural deduplicating tags by text; if it does not,
re-posting category/project tags could create duplicate tag definitions
(the `tagSync` diagnostic in the response surfaces the association calls
so this can be verified on a live sync).
