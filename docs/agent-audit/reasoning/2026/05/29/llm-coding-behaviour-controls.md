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

## Implementation plan

1. Add a new GitHub Diamond reference module for LLM coding behaviour.
2. Register the reference in the GitHub bundle prompt spec and prompt body.
3. Add ResearchOps Developer Control hooks for assumptions, simplicity, surgical changes and validation.
4. Add behavioural evals covering assumptions, simplicity, surgical edits and goal-driven validation.
5. Add trace artefacts for this branch.
6. Verify the PR changed-file list before reporting readiness.

## Validation plan

- Confirm edited XML files remain parse-valid.
- Confirm `.agent-operating-model/behavioural-evals.json` remains valid JSON.
- Inspect the PR diff and changed-file list.
- Leave full repository validation to CI because this change was made through GitHub connector tooling rather than a local checkout.
