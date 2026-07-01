# GOV.UK Render Workflow Static Template CI Fix

## Run Metadata

- Date: 2026-07-01
- Branch: `feature/res-9-source-linked-candidate-drafting`
- Trace decision: required because the branch starts with `feature/`
- Task summary: fix the failing `Render and commit static GOV.UK pages` workflow on PR #437.

## Operating Model

Loaded repository operating-model sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/github-mutation-policy.md`

Selected bundles:

- `github-diamond`: `.agent-operating-model/bundles/github/`
- `researchops-developer-control`: `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team`: `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system`: `.agent-operating-model/bundles/govuk-design-system/`

Skipped bundles:

- `cloudflare`: no Worker or Cloudflare runtime behaviour changed.
- `openai-platform`: no OpenAI API behaviour changed.
- `mcp-agent-tooling`: no MCP behaviour changed.
- `airtable-public-api`: no Airtable API behaviour changed.
- `mural-public-api`: no Mural API behaviour changed.

Precedence decision:

- GitHub Diamond governed the CI repair, validation evidence and branch trace.
- ResearchOps developer controls governed use of the canonical GOV.UK renderer.
- GOV.UK Design System remained relevant because the failing job protects generated GOV.UK page output.

## Failure

GitHub Actions failed in `.github/workflows/render-govuk-pages.yml` during `Determine changed GOV.UK page outputs` with:

```text
No GOV.UK renderer page registration found for: pages/repository-static.njk
```

The changed-template detector parsed `scripts/govuk/render-govuk-pages.mjs` with a regular expression that only recognised direct literal page registrations. It missed the `pages/repository-static.njk` registration because that template is expanded through `repositoryStaticPages.map(...)` and has multiple generated outputs.

## Files Changed

- `.github/workflows/render-govuk-pages.yml`
- `tests/govuk-pages-render-workflow-state.test.js`
- `docs/agent-audit/reasoning/2026/07/01/govuk-render-workflow-static-template-ci-fix.md`
- `docs/agent-audit/reasoning/2026/07/01/govuk-render-workflow-static-template-ci-fix.json`

## Implementation Notes

- Replaced the workflow's source-text regex with an import of the renderer's exported `govukPages` registry.
- Built a template-to-outputs map from the canonical renderer so one template can resolve to one or many generated paths.
- Sorted and de-duplicated changed outputs before passing them to the commit step.
- Updated the workflow route-state test so it requires the canonical registry approach and rejects the old regex detector.

## Validation

Commands run:

- Local simulation of the workflow changed-template detector with `pages/repository-static.njk` and `pages/study-synthesis.njk`.
- `npm run build:govuk-pages`
- `npm test -- tests/govuk-pages-render-workflow-state.test.js tests/synthesize-page-route-state.test.js tests/study-child-route-state.test.js tests/synthesis-api-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-breadcrumb-back-link-route-state.test.js`
- `npm run generated-css:check`

Results:

- The local detector simulation resolved all repository static page outputs plus `public/pages/study/synthesis/index.html`.
- GOV.UK page rendering passed.
- Six focused route-state tests passed.
- Generated CSS formatting check passed.

## Residual Risk

- The GitHub Actions job still needs to rerun on the pushed branch to confirm the hosted workflow environment matches the local simulation.
