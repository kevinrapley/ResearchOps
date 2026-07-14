# Tree Test CI fix

## Run metadata

- Date: 2026-07-14
- Branch: `feature/tree-test-session`
- Task: Fix the failing PR tests for the Tree Test branch.

## Branch-prefix trace decision

- `feature/` requires an auditable operational trace.
- This record contains repository evidence, diagnosis and validation results only.

## Operating model and bundle selection

Loaded operating-model sources:

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

Selected canonical bundles:

- `github-diamond` — `.agent-operating-model/bundles/github/`
- `researchops-developer-control` — `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` — `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` — `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare` — `.agent-operating-model/bundles/cloudflare/`

Skipped bundles:

- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

## Diagnosis

- `gh pr checks 497` showed four failures: `Node 20`, `Node 22`, `Validate Cloudflare Workers`, and `Release gate`.
- Failed job logs showed the same underlying assertion in `tests/visual-walkthrough-registry-coverage.test.js`.
- The failing assertion was:
  - `Expected discoverable route /pages/study/tree-test/index.html to be registered or explicitly excluded.`
- `Release gate` was not an independent regression; it failed because it reruns `npm test`.

## Implementation

- Added `operationalPaths.studyTreeTest` to `visual-walkthrough.operational-fixtures.mjs`.
- Registered `/pages/study/tree-test/index.html` in `visual-walkthrough.config.mjs` as a Study walkthrough page with deterministic study/project context.
- Chose registration over exclusion because the route is a user-facing setup page in the canonical Study flow.

## Precedence decisions

- GitHub Diamond governed CI diagnosis through PR check logs, minimal change scope and required validation before pushing a fix.
- ResearchOps Developer Control governed the interpretation that the Tree Test setup page is part of the canonical Study route surface.
- GOV.UK Design System applied because the failing route is a generated Study UI page that should stay represented in walkthrough coverage.
- Cloudflare remained in scope because one failing job was the Worker validation workflow, although the fix itself was in the walkthrough registry rather than Worker runtime code.

## Files changed

- `visual-walkthrough.config.mjs`
- `visual-walkthrough.operational-fixtures.mjs`
- this trace and its JSON summary

## Validation

- `node --test tests/visual-walkthrough-registry-coverage.test.js` passed.
- `npm test` passed: 358 tests, 0 failures.

## Residual risks

- GitHub checks still need to rerun on the pushed fix commit before the PR status turns green remotely.
