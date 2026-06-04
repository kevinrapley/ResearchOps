# Agent trace — Test-contract impact sweep learning

**Date:** 2026-06-04  
**Branch:** `chore/test-contract-impact-sweep-learning`  
**Trace type:** operational audit trace  
**Task:** Record the post-PR #345 learning that migration and contract-bearing work requires a proactive test-contract impact sweep.

## Evidence boundary

This trace records observable repository files, tool actions, implementation decisions, validation status and residual risk. It does not expose private chain-of-thought.

## Operating model loaded

Loaded files:

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`

Selected bundles:

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`

Skipped bundles:

- `govuk-design-system`
- `cloudflare`
- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

The GOV.UK Design System bundle was not selected because this branch changes repository governance and GitHub operating behaviour, not a frontend implementation.

## Files inspected

- `RECENT_LEARNINGS.md`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/github/references/`

## Implementation decisions

### Generalised beyond GOV.UK

The new rule is intentionally not GOV.UK-specific. It applies to any repository change that may alter a test-observed or user-observed contract, including migrations, refactors, generated-output changes, route changes, component changes, workflow changes, asset-pipeline changes and data-shape changes.

### First-class GitHub Diamond rule

The GitHub Diamond bundle was updated from `2.9.4` to `2.9.5` and now loads `references/test-contract-impact-sweep.xml` as an always-loaded reference. The prompt body records the proactive test-contract sweep in the mandatory sequence and required outputs.

### Recent learning

`RECENT_LEARNINGS.md` now records the reusable lesson from PR #345: do not wait for CI to reveal one stale assertion at a time when a change predictably invalidates old contract terms.

## Files modified

- `RECENT_LEARNINGS.md`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/github/references/test-contract-impact-sweep.xml`
- `docs/agent-audit/reasoning/2026/06/04/test-contract-impact-sweep-learning.md`
- `docs/agent-audit/reasoning/2026/06/04/test-contract-impact-sweep-learning.json`

## Validation status

Connector verification completed:

- Confirmed the branch starts from the merge commit for PR #345.
- Confirmed the changed-file list is limited to governance, learning and trace files.
- Confirmed the GitHub Diamond prompt spec now references the new always-loaded test-contract sweep file.
- Confirmed `RECENT_LEARNINGS.md` contains the new 2026-06-04 learning entry.

Required CI and local follow-up checks:

```sh
npm run agent:model:validate
npm run agent:bundles:validate
npm run agent:bundle-versions:validate
npm run trace:coverage
npm run validate
```

## Residual risk

The PR should not be considered complete until normal checks pass on the branch head.
