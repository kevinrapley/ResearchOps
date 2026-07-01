# Agent trace - Local project dashboard study seed

Date: 2026-06-28
Branch: `fix/remove-home-phase-banner-border`

## Task

Seed the local `https://research-operations/pages/project-dashboard/?id=recdMo80h1QaNQCBk` database on this computer only with realistic study examples and no placeholder titles or copy.

## Trace Decision

The branch prefix `fix/` requires an auditable trace for repository-affecting work. The seed itself was applied only to the local SQLite database at `/Users/kevin.rapley/.hermes/data/research-operations-local.sqlite3`; no live Airtable, Cloudflare or remote database was changed.

## Operating Model

Loaded:

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

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`, selected after local storage/API behaviour was confirmed as Cloudflare-style D1/local API work

Skipped bundles:

- `govuk-design-system`: no repository UI markup or style change was made.
- `airtable-public-api`: no Airtable API or remote records were changed.
- `mural-public-api`, `openai-platform`, `mcp-agent-tooling`: not in scope.

## Work Done

- Inspected the active local HTTPS helper process for `https://research-operations`.
- Confirmed project data was served from local SQLite.
- Backed up the local database to `/Users/kevin.rapley/.hermes/data/research-operations-local.sqlite3.bak-20260628-0058`.
- Added a local-only `project_studies` table and seeded four realistic Third Country National Discovery study examples.
- Updated the local helper script at `/Users/kevin.rapley/.hermes/scripts/serve_research_operations.py` so `/api/studies` and `/api/participants` return local JSON needed by the dashboard.
- Restarted the local HTTPS helper on `127.0.0.1:8443`.

Seeded study titles:

- ECRIS-TCN result review prototype testing
- Matching confidence review for third country national records
- As-is workflow mapping for UK and EU conviction data exchange
- TCN conviction data request walkthroughs with operational teams

## Validation

- `python3 -m py_compile /Users/kevin.rapley/.hermes/scripts/serve_research_operations.py`
- SQLite query confirmed four `project_studies` rows for `recdMo80h1QaNQCBk`.
- `https://research-operations/api/studies?project=recdMo80h1QaNQCBk` returned the four local study records.
- `https://research-operations/api/participants?study=recTCNPrototype04` returned an empty local participant list without error.
- Browser verification with Playwright checked desktop `1366x900` and mobile `390x844`; all four study titles rendered, no study error was shown, and no mobile horizontal overflow was detected.

## Residual Risk

The local helper script lives outside this repository checkout under `/Users/kevin.rapley/.hermes/scripts/`. If another local automation overwrites that helper, the SQLite rows will remain present but the `/api/studies` local endpoint may need to be restored.
