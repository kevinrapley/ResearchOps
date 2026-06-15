# Agent trace - Project create quoted Team ID fallback

**Date:** 2026-06-15
**Trace type:** operational audit trace
**Branch:** `fix/project-create-team-id-quoted-field`
**Trace required:** yes, because the branch starts with `fix/`

## Task

Fix the remaining Start a new research project create failure where Airtable
returns `Error 422: Unknown field name: "Team ID"` from the check-answers step.

## Branch Trace Decision

The branch is `fix/project-create-team-id-quoted-field`. Repository policy
allows `fix/` as a work-branch prefix and requires an auditable trace for
repository-affecting work on fix branches.

## Operating Model

Loaded repository operating-model sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/bundles/`

Selected bundle stack:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`
- `airtable-public-api` at `.agent-operating-model/bundles/airtable-public-api/`

Skipped conditional bundles:

- `openai-platform` - no OpenAI API, model or eval implementation was in scope.
- `mcp-agent-tooling` - no MCP tool, resource, prompt or consent work was in scope.
- `mural-public-api` - no Mural API or collaboration integration work was in scope.

Precedence decisions:

- GitHub Diamond governed branch naming, trace coverage, surgical mutation and PR readiness.
- ResearchOps Developer Control governed the project-create route contract.
- GOV.UK Design System governed the user-facing form flow context.
- Cloudflare governed Worker route behaviour and deployment evidence.
- Airtable Public API governed the record-create retry boundary.

No bundle conflicts were identified.

## Implementation

Updated `infra/cloudflare/src/service/project-record-routes.js` so project
creation uses a bounded fallback loop for configured team fields. If Airtable
reports an unknown team field, the route removes the named rejected field and
retries. If Airtable then rejects another configured team field, the route
removes that field too and retries again. Other Airtable errors still fail.

Updated `tests/projects-route-contract.test.js` to cover quoted Airtable unknown
field messages. The tests verify that:

- when only `Team ID` is rejected, the retry preserves `Team Name`
- when `Team ID` and then `Team Name` are both rejected, the route still returns
  `201` after retrying without configured team fields

## Files

Read:

- `infra/cloudflare/src/service/project-record-routes.js`
- `tests/projects-route-contract.test.js`
- operating-model files listed above
- selected bundle prompt specs and bodies

Modified:

- `infra/cloudflare/src/service/project-record-routes.js`
- `tests/projects-route-contract.test.js`

Created:

- `docs/agent-audit/reasoning/2026/06/15/project-create-team-id-quoted-field.md`
- `docs/agent-audit/reasoning/2026/06/15/project-create-team-id-quoted-field.json`

Pre-existing local changes were temporarily stashed before branching from
current `main` and are not part of this PR.

## Validation

Completed:

- `node tests/projects-route-contract.test.js` - passed.
- `npx prettier -c infra/cloudflare/src/service/project-record-routes.js tests/projects-route-contract.test.js` - passed.
- `git diff --check` - passed.

## Residual Risk

This is covered with Worker route mocks rather than a live Airtable write. The
retry is bounded by the configured team-field count so it cannot loop
indefinitely.
