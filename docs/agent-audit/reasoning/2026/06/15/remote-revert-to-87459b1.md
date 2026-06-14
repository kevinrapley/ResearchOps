# Remote-only revert to 87459b1 with dated trace

Promotion status: direct GitHub Git Data API audit trace.

Created at: 2026-06-14T23:07:22.154Z.

## Task summary

Revert the remote PR branch `feature/mural-journal-export-layout` back to commit `87459b1fbba36836d504ecec979811f28a6859a0` without resetting or rewriting the local checkout, while adding the required 15 June 2026 agent trace files.

## Run metadata

- Repository: `kevinrapley/ResearchOps`
- Branch: `feature/mural-journal-export-layout`
- Parent remote head before mutation: `6b226410cfb2e40b9ef3309dd87abe3781f0d78b`
- Requested baseline commit: `87459b1fbba36836d504ecec979811f28a6859a0`
- Requested baseline tree: `589c2658c6ef5ebbbf27f15a1f8f8b7f70e3cc82`
- Trace date: 2026-06-15

## Operating model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`

## Bundles selected

- `github-diamond` — `.agent-operating-model/bundles/github/`
- `researchops-developer-control` — `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` — `.agent-operating-model/bundles/multi-functional-team/`
- `cloudflare` — `.agent-operating-model/bundles/cloudflare/`
- `mural-public-api` — `.agent-operating-model/bundles/mural-public-api/`

## Bundles skipped

- `govuk-design-system`
- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`

## Precedence decision

GitHub mutation policy governs the remote-only branch mutation; branch remains feature/ so a dated trace is included.

## Mutation strategy

GitHub Git Data API: create blobs, create tree from requested baseline tree, create commit with current remote head as parent, update ref force=false.

## Local checkout boundary

No local checkout reset, no local branch update, no working-tree edits.

## Files created on the remote tree

- `docs/agent-audit/reasoning/2026/06/15/remote-revert-to-87459b1.md`
- `docs/agent-audit/reasoning/2026/06/15/remote-revert-to-87459b1.json`

## Validation planned

- Verify remote ref updated to the new commit.
- Verify net diff from 87459b1 to new remote commit contains only the 2026-06-15 trace files.
- Verify local working tree remains clean and local branch is not reset.

## Residual risks

- This intentionally removes all branch content added after 87459b1 from the remote branch tree, except the required 2026-06-15 audit trace files.
- No local test run is meaningful for the newly created remote tree unless fetched or checked out; user explicitly requested remote-only mutation.
