# Local LEDS PR 437 seed trace

Date: 2026-06-30
Branch: `feature/res-8-study-evidence-summary`

## Task

Seed the local `recLEDSResearch01` database with realistic studies and study outputs so PR #437, `feature/res-9-source-linked-candidate-drafting`, can be tested locally.

## Trace decision

The active branch prefix `feature/` requires an auditable trace for repository-affecting work. The seed itself was applied only to local files under `/Users/kevin.rapley/.hermes/`; no Airtable, GitHub, Cloudflare remote D1 or production data was changed.

## Operating model

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
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`, added after local D1-style API and storage behaviour was confirmed

Skipped bundles:

- `govuk-design-system`: no repository UI markup or CSS was edited in this checkout.
- `airtable-public-api`: no Airtable API or remote records were changed.
- `mural-public-api`, `openai-platform`, `mcp-agent-tooling`: not in scope.

## Files read

- `AGENTS.md`
- `.agent-operating-model/*` operating-model files listed above
- selected bundle `prompt.spec.yaml` and `prompt.body.xml` files
- `public/js/synthesize-page.js`
- `public/js/repository-static/candidate.js`
- `public/js/repository-static/shared.js`
- `public/js/repository-static-page.js`
- `infra/cloudflare/src/service/synthesis.js`
- `infra/cloudflare/src/service/repository.js`
- `src/govuk/templates/pages/repository-static.njk`
- PR #437 metadata and diff via `gh pr view 437` and `gh pr diff 437`
- `/Users/kevin.rapley/.hermes/scripts/serve_research_operations.py`
- `/Users/kevin.rapley/.hermes/data/research-operations-local.sqlite3` schema

## Work done

- Backed up the local database to `/Users/kevin.rapley/.hermes/data/research-operations-local.sqlite3.bak-20260630-232544`.
- Backed up the local helper script to `/Users/kevin.rapley/.hermes/scripts/serve_research_operations.py.bak-20260630-232544`.
- Added local SQLite-backed synthesis tables for evidence, clusters and themes.
- Added local SQLite-backed repository candidate submission storage.
- Seeded `recLEDSResearch01` with 3 LEDS studies.
- Seeded `recLEDSOpsNeeds01` with 4 evidence notes, 2 synthesis clusters and 2 synthesis themes.
- Extended the local HTTPS helper to serve:
  - `/api/synthesis/evidence`
  - `/api/synthesis`
  - `/api/synthesis/clusters`
  - `/api/synthesis/themes`
  - `/api/repository`
  - `/api/repository/artefacts`
- Let the local helper restart on `127.0.0.1:8443`.

## Seeded study outputs

- Study: `recLEDSOpsNeeds01` - LEDS operational search and record confidence study
- Evidence: `evLEDSOps001`, `evLEDSOps002`, `evLEDSOps003`, `evLEDSOps004`
- Clusters: `clusterLEDSConfidenceSignals`, `clusterLEDSDecisionTrail`
- Themes: `themeLEDSConfidenceSignals`, `themeLEDSReusableDecisionTrail`

## Validation

- `python3 -m py_compile /Users/kevin.rapley/.hermes/scripts/serve_research_operations.py`: passed.
- SQLite counts confirmed 3 LEDS studies, 4 evidence rows, 2 cluster rows and 2 theme rows.
- `https://research-operations/api/studies?project=recLEDSResearch01`: returned the 3 LEDS studies.
- `https://research-operations/api/synthesis/evidence?sid=recLEDSOpsNeeds01&pid=recLEDSResearch01`: returned 4 evidence records.
- `https://research-operations/api/synthesis?sid=recLEDSOpsNeeds01&pid=recLEDSResearch01`: returned 2 clusters and 2 themes.
- `https://research-operations/api/repository?limit=1`: returned repository filter options and an empty candidate queue.
- Browser smoke check loaded `/pages/study/synthesis/?pid=recLEDSResearch01&sid=recLEDSOpsNeeds01` with 4 evidence cards, 2 clusters, 2 themes and 2 Submit to repository links.
- Browser end-to-end check opened a candidate link, verified source prefill, submitted a candidate successfully, then the validation candidate was deleted so the queue is clean.

## Residual risk

The local helper script lives outside this repository checkout under `/Users/kevin.rapley/.hermes/scripts/`. If another local automation overwrites or restarts it from an older copy, the SQLite seed rows will remain present but the local `/api/synthesis` and `/api/repository` endpoint additions may need to be restored from the timestamped backup.
