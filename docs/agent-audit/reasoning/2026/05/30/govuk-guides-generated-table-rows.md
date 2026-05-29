# Agent trace — GOV.UK guide generated table rows

**Date:** 2026-05-30  
**Trace type:** operational audit trace  
**Branch:** `fix/govuk-guides-generated-table-rows`  
**Scope:** Discussion Guides generated table rows and fallback table skeleton

## Evidence boundary

This trace records repository evidence, implementation decisions, files read, files changed, validation expected and residual risk.

It does not expose private chain-of-thought.

## Original task summary

Handle Issue #110 by migrating generated Discussion Guides table rows in `public/components/guides/guides-page.js` to GOV.UK table classes.

## Operating model files loaded

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
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

## Selected bundles

Always-load bundles:

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`

Conditional bundles:

- `.agent-operating-model/bundles/govuk-design-system/` because the task changes GOV.UK table markup, page UI and accessibility-related table semantics.

Skipped bundles:

- `.agent-operating-model/bundles/cloudflare/`
- `.agent-operating-model/bundles/openai/`
- `.agent-operating-model/bundles/mcp-agent-tooling/`
- `.agent-operating-model/bundles/airtable-public-api/`
- `.agent-operating-model/bundles/mural-public-api/`

## Branch-prefix trace decision

The branch starts with `fix/`, so trace artefacts are required by the repository trace policy.

## Files inspected

- `public/components/guides/guides-page.js`
- Issue #110 body and acceptance notes

## Files changed

- `public/components/guides/guides-page.js`
- `docs/agent-audit/reasoning/2026/05/30/govuk-guides-generated-table-rows.md`
- `docs/agent-audit/reasoning/2026/05/30/govuk-guides-generated-table-rows.json`

## Implementation summary

The implementation updates the Discussion Guides fallback table skeleton and generated guide rows so they use GOV.UK table classes.

The change:

- changes the fallback table to `govuk-table`
- adds `govuk-table__head`, `govuk-table__body`, `govuk-table__row`, `govuk-table__header` and `govuk-table__cell`
- adds GOV.UK row and cell classes to loading, empty and error helper rows
- adds `govuk-table__row` to generated guide rows
- keeps the existing `link-like` Open button and `data-open` behaviour unchanged

## Validation expected

Automated checks to run in CI:

- `npm run validate`
- `npm run lint`

Manual checks:

- Open `/pages/study/guides/?pid=<known-project-id>&sid=<known-study-id>`.
- Confirm generated rows align under the correct columns.
- Confirm the Open guide action still opens the selected guide.
- Confirm loading, empty and error rows render correctly.
- Confirm editor, drawers and variables remain unchanged.

## Residual risk

Validation has not been run locally in this connector context. CI and manual browser checks remain the source of truth for readiness.
