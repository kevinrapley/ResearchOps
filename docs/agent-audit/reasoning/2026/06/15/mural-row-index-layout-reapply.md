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

## Residual risk

No live Mural mutation was performed from this session; coverage is via
mocked Mural API responses. Row-index placement assumes the journal Mural
matches the fixed template grid (true for template duplicates).
