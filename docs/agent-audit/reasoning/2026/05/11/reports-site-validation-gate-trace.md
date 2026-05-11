# Agent trace: Reporting site validation gate

Date: 2026-05-11

Branch: `test/reports-site-validation-gate`

Pull request: #235

## Note

Retrospective trace created from commit evidence after merge. No live `[reasoning]` session was captured for this PR.

## Request interpreted

The reporting site was generated and committed but had no integrity check proving coherence between `index.html`, `manifest.json`, and the screenshot files. Add a dedicated validation gate.

Required outcomes:

- validator confirms `reports-site/index.html` and `manifest.json` both exist and `manifest.json` is valid JSON
- validator checks `manifest.pageCount`, `stateCount`, and `captureCount` match actual content
- failed captures (no screenshot) are permitted; successful captures must reference a screenshot file
- screenshot paths are relative and do not contain `..`
- every screenshot file under `reports-site/screenshots/` is referenced by the manifest
- every manifest screenshot is referenced by `index.html`
- profile capture counts are balanced when `failureCount` is 0
- validator wired into `npm test`

## Evidence checked

Repository files checked from commit evidence:

- `package.json`
- `reports-site/manifest.json`
- `reports-site/index.html`
- `reports-site/screenshots/` directory

## Implementation applied

`scripts/validate-reports-site.mjs` added with the following checks:

- existence and JSON validity of `index.html` and `manifest.json`
- `manifest.pageCount`, `stateCount`, `captureCount` match actual content
- failed-capture semantics: failed captures permitted, successful captures must have a screenshot file
- path traversal guard: screenshot paths must be relative and must not contain `..`
- bidirectional check: every screenshot file referenced by manifest, every manifest screenshot referenced by `index.html`
- profile capture balance when `failureCount` is 0

`tests/reports-site-validation.test.js` added with hard assertions against the current committed corpus:

- 22 pages, 39 states, 78 captures, 78 screenshots
- profiles: `desktop`, `mobile`
- regression test for failed-capture semantics: 1 failed state, 1 failed capture, `failureCount: 1`, no screenshot

`package.json` updated: `reports:validate` script added and wired into `npm test`.

## Key decisions

Hard assertion counts match the current committed corpus exactly. Any deviation from the committed state will fail the gate, prompting a deliberate count update.

Path traversal guard added as a security boundary: screenshot references cannot escape the `reports-site/` directory.

Integration with `scripts/validate.sh` deferred to a follow-up PR.

## Commits recorded

```text
b2d781d Validate reporting site manifest and screenshots
b54a5e0 Format reporting site validation test
a20b6f0 Fix failed capture validation semantics
33fba47 Test failed capture report validation
df18efb Format reports site validation regression test
006c737 Merge pull request #235
```

## Validation recorded

- 22 assertions pass covering page count, state count, capture count, screenshot count, profile balance, and failed-capture semantics
- All CI checks passed at merge: Format PR, Validate ResearchOps, qa-bdd, QA Broken links (Lychee), Accessibility audit (pa11y-ci), CI, Worker CI, Release Gate

## Known gaps deferred

- `reports:validate` not yet wired into `scripts/validate.sh`

## Current status at trace write

PR #235 merged. Merge commit: `006c737`.
