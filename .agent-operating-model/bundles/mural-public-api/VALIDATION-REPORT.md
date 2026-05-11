# Validation Report — Mural Public API Bundle v1.0.0

Validation status: passed with queued incident-backfill work.

Last checked: 2026-05-11.

## Scope

This bundle governs Mural Public API integration work, including OAuth, workspaces, rooms, boards, widgets, sticky notes, tags, templates and related collaboration operations.

It applies when ResearchOps work touches Mural board creation, duplication, widget operations or journal synchronisation behaviour.

## Entrypoints checked

Checked entrypoints:

- `README.md`
- `CHANGELOG.md`
- `prompt.spec.yaml`
- `prompt.body.xml`
- `evals.yaml`
- `tests.regression.yaml`
- `tests.redteam.yaml`
- `variables.schema.json`
- `output.schema.json`
- `grade.schema.json`
- `registry-manifest.yaml`
- `endpoint-coverage.matrix.yaml`
- `endpoint-source.catalog.yaml`

## Structural checks

The bundle is data-rich, with substantial endpoint coverage and endpoint source catalogues.

The generated bundle manifest schema is present.

The changelog records active iteration.

## Evaluation coverage

Regression and red-team assets are present.

The endpoint coverage and source catalogues provide strong documentation depth.

## Known gaps

The main remaining work is incident backfill.

Future work should promote learned Mural integration failures into contracts, tests and doctrine. Priority areas are OAuth failure modes, 401 and 403 handling, room and workspace ambiguity, board duplication, widget positioning, tag behaviour, retry and backoff, and idempotency.

## Result

The bundle is suitable for current ResearchOps Mural integration use, with incident backfill queued as item 4.
