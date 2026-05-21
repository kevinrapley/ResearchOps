The repository is not ready for release.

The release has some supporting evidence. CI is passing, dependency review is passing, an SBOM is present, and provenance evidence exists.

There are two blocking gaps.

Code scanning status is unknown. Unknown release evidence must not be treated as passed.

Rollback evidence is missing. A release should have a clear rollback or recovery note before it is approved.

The release judgement is `not_ready`.

Required next actions:

1. Confirm code scanning or equivalent assurance status.
2. Add rollback evidence to the release checklist.
3. Re-run the release gate after both gaps are closed.

Evidence used:

- `release-checklist.md`
- `sbom.cdx.json`
- `metadata-provenance.yaml`
- `.github/workflows/release-gate.yml`
- `.github/workflows/dependency-review.yml`

The agent should not recommend a release until these gaps are resolved.
