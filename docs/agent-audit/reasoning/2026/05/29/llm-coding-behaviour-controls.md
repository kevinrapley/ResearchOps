# LLM coding behaviour controls trace

## Run metadata

- Date: 2026-05-29
- Repository: `kevinrapley/ResearchOps`
- Branch: `chore/llm-coding-behaviour-controls`
- Trace requirement: required by `chore/` branch policy
- Trace layer: behavioural

## Task summary

Add cross-cutting behavioural guidelines for LLM coding work to the ResearchOps agent operating model.

## Operating-model sources loaded

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/README.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/implementation-workflow.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/developer-control-contract.xml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.body.xml`

## Selected bundles

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`

## Conditional bundles skipped

- `govuk-design-system`: no UI, content pattern or accessibility implementation change.
- `cloudflare`: no Cloudflare runtime, deployment or binding change.
- `openai-platform`: no OpenAI API implementation change.
- `mcp-agent-tooling`: no MCP protocol or tooling implementation change.
- `airtable-public-api`: no Airtable API implementation change.
- `mural-public-api`: no Mural API implementation change.

## Assumptions and decisions

- The user wrote `.agents-operating-model/*`, but the repository source of truth is `.agent-operating-model/`.
- The behavioural guidelines should be always-on for repository-affecting coding work.
- The GitHub Diamond bundle is the correct primary home because it governs repository safety, branch discipline, pull requests, CI and mutation behaviour.
- ResearchOps Developer Control should only receive a light hook, avoiding duplicated doctrine across bundles.
- Behavioural evals are needed so the new behaviour is executable and regressions are visible.

## Files modified

- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/bundles/github/CHANGELOG.md`
- `.agent-operating-model/bundles/github/README.md`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/references/llm-coding-behaviour.xml`
- `.agent-operating-model/bundles/github/registry-manifest.yaml`
- `.agent-operating-model/bundles/researchops-developer-control/references/developer-control-contract.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/implementation-workflow.xml`
- `RECENT_LEARNINGS.md`
- `docs/agent-audit/reasoning/2026/05/29/llm-coding-behaviour-controls.json`
- `docs/agent-audit/reasoning/2026/05/29/llm-coding-behaviour-controls.md`
- `scripts/agent-operating-model/load-operating-model.mjs`
- `scripts/agent-operating-model/run-behavioural-evals.mjs`

## Implementation summary

1. Added a new GitHub Diamond reference module for LLM coding behaviour.
2. Registered the reference in the GitHub bundle prompt spec and prompt body.
3. Added ResearchOps Developer Control hooks for assumptions, simplicity, surgical changes and validation.
4. Added behavioural evals covering assumptions, simplicity, surgical edits and goal-driven validation.
5. Taught the operating-model loader and behavioural eval runner to support the new coding behaviour safeguards.
6. Regenerated the GitHub bundle registry manifest after bundle file changes.
7. Updated the GitHub bundle README current release text to version 2.9.4.
8. Updated this trace to record the complete changed-file set.

## Validation evidence

- CI passed on current head `27d6dc0aaf18447a337399e9b43cc1c1e6dc6caf`.
- Validate ResearchOps passed on current head `27d6dc0aaf18447a337399e9b43cc1c1e6dc6caf`.
- Worker CI passed on current head `27d6dc0aaf18447a337399e9b43cc1c1e6dc6caf`.
- Release Gate passed on current head `27d6dc0aaf18447a337399e9b43cc1c1e6dc6caf`.
- Update GitHub bundle registry manifest passed on current head `27d6dc0aaf18447a337399e9b43cc1c1e6dc6caf`.
