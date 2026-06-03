# Agent trace — Impact record workflow

**Date:** 2026-06-02  
**Branch:** `feature/impact-record-workflow`  
**Mode:** `rops-build`  
**Trace type:** operational audit trace

## Evidence boundary

This trace records repository work, implementation decisions, validation status and known constraints. It does not expose private chain-of-thought.

## Task

Implement the full production impact record workflow for `/pages/projects/outcomes/`, including UI, API, D1 persistence, product documentation, tests and trace.

The user specifically requested:

- field affordance and sensible GOV.UK widths;
- prettier impact record references such as `IMPCT-RCD-5f0907b5e5aa`;
- radio buttons for impact type, impact scale and status;
- richer guidance for baseline, target and actual through a contextual panel rather than longer hints;
- no empty table until at least one impact record exists;
- edit and delete controls;
- no separate Actions column;
- a paired table action row with one cell using `colspan="7"`;
- production-ready persistence through D1;
- product documentation and agent trace.

## Operating model and bundles applied

Selected bundles:

- GitHub Diamond
- ResearchOps Developer Control
- Multi-Functional Team
- GOV.UK Design System
- Cloudflare

Task signals:

- `repository-affecting-task`
- `government-product-assurance-default`
- `ui-or-content-change`
- `runtime-or-deployment-change`
- `d1-persistence-change`

## Decisions

### D1 as source of persistence

The impact workflow now uses D1 for create, list, update and soft delete. The impact internals module creates the table if needed and the PR includes an explicit migration at `infra/cloudflare/migrations/0010_impact_records.sql`.

### Soft delete

Delete operations set `deleted_at` rather than removing the row. Impact records are governance evidence, so a lifecycle field is safer than hard deletion.

### Two-row table action pattern

The table remains seven evidence columns wide. It does not add an Actions column.

Each impact record gets a data row followed immediately by an action row. The action row contains a single cell with `colspan="7"`, which contains Edit and Delete controls. Delete reveals inline confirmation before the API call runs.

### SCSS source of truth

`public/css/outcomes.css` is treated as generated output. The editable source is `src/styles/outcomes.scss`, and `package.json` now includes `build:outcomes` in the main build chain.

### Contextual field guidance

The contextual panel updates on field focus using `data-guidance-key`. Baseline, target and actual guidance is provided in the panel, not by adding long field hints.

## Files created

- `src/styles/outcomes.scss`
- `infra/cloudflare/migrations/0010_impact_records.sql`
- `tests/impact-records-d1-runtime.test.js`
- `docs/product/26/06/02/impact-record-workflow.md`
- `docs/agent-audit/reasoning/2026/06/02/impact-record-workflow.json`
- `docs/agent-audit/reasoning/2026/06/02/impact-record-workflow.md`

## Files modified

- `package.json`
- `src/govuk/templates/pages/projects-outcomes.njk`
- `public/js/outcomes-page.js`
- `public/components/impact-tracker.js`
- `public/css/outcomes.css`
- `infra/cloudflare/src/service/impact-internals.js`
- `infra/cloudflare/src/service/impact.js`
- `infra/cloudflare/src/service/index.js`
- `infra/cloudflare/src/core/router.js`
- `tests/outcomes-page-route-state.test.js`
- `tests/govuk-tables-summary-lists-application-route-state.test.js`

## Validation status

Local validation was not run in this connector-only session.

Recommended checks:

```sh
npm run build
node --test tests/outcomes-page-route-state.test.js
node --test tests/govuk-tables-summary-lists-application-route-state.test.js
node --test tests/impact-records-d1-runtime.test.js
npm test
npm run validate
```

## D1 migration

Migration file:

```text
infra/cloudflare/migrations/0010_impact_records.sql
```

Manual apply command:

```sh
npx --yes wrangler@4.90.0 d1 execute researchops-d1 \
  --remote \
  --config infra/cloudflare/wrangler.toml \
  --file infra/cloudflare/migrations/0010_impact_records.sql
```

Post-apply check:

```sh
npx --yes wrangler@4.90.0 d1 execute researchops-d1 \
  --remote \
  --config infra/cloudflare/wrangler.toml \
  --command "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'impact_records';"
```

## Known connector constraint

A dedicated D1 apply workflow was attempted but blocked by the connector safety layer because the workflow body included deployment secret wiring. The migration is included and documented instead.

## Residual risks before marking ready

- The GOV.UK render workflow must regenerate `public/pages/projects/outcomes/index.html` from the updated Nunjucks template.
- CI must confirm the new D1 runtime test and route-state tests.
- A branch preview should verify focus behaviour in the contextual guidance panel.
- A branch preview should verify create, edit and delete through `/api/impact` against a D1-backed environment.
