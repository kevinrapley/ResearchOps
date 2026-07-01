# Report site row gap and closed grouping evidence

Date: 2026-07-01
Branch: `fix/report-site-row-gap-details-closed`

## Task

Follow up the reporting site two-column layout so row gaps remain visible between report rows and group-level evidence details labelled "What this grouping should support" are closed by default.

## Trace decision

The active branch prefix `fix/` requires an auditable trace for repository-affecting work.

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
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`

Skipped bundles:

- `cloudflare`: no Worker, binding, Pages deployment or Cloudflare API change.
- `openai-platform`: no OpenAI API integration changed.
- `mcp-agent-tooling`: no MCP tooling changed.
- `airtable-public-api`: no Airtable API implementation changed.
- `mural-public-api`: no Mural API implementation changed.

## Files modified

- `scripts/render-reporting-review-site.mjs`
- `scripts/visual-walkthrough.mjs`
- `tests/reporting-review-generation-model.test.js`
- `reports-site/index.html`
- `docs/agent-audit/reasoning/2026/07/01/report-site-row-gap-details-closed.md`
- `docs/agent-audit/reasoning/2026/07/01/report-site-row-gap-details-closed.json`

## Work done

- Added vertical margins to two-column page-grid blocks and standalone multi-state page cards so rows retain a visible gap.
- Removed the `open` attribute from group-level review evidence details so "What this grouping should support" is closed by default.
- Regenerated `reports-site/index.html`.
- Added regression assertions for grid spacing, multi-step spacing and closed grouping details.

## Validation

- `node --test tests/reporting-review-generation-model.test.js tests/reports-site-validation.test.js tests/reporting-site-deploy-route-state.test.js`: passed.
- `node scripts/validate-reports-site.mjs`: passed.
- DOM structure check for grid margins, multi-step margins and closed grouping details: passed.
- Browser screenshot capture of `reports-site/index.html` at 1440px: passed.
- `npm run lint -- --quiet`: passed with existing ESLint flat-config warnings about `eslint-env` comments.
- `npm run validate`: passed.

## Residual risk

- The change updates static report layout only; screenshots were not recaptured.
