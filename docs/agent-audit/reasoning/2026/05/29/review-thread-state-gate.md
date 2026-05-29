# Review thread state gate trace

## Run metadata

- Date: 2026-05-29
- Repository: `kevinrapley/ResearchOps`
- Branch: `chore/review-thread-state-gate`
- Trace requirement: required by `chore/` branch policy
- Trace layer: behavioural

## Task summary

Add a GitHub bundle operating procedure that prevents agents from acting on resolved or outdated Codex review threads and from duplicating work already completed by the user, Codex, GitHub Actions or another agent.

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
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/github/README.md`
- `scripts/agent-operating-model/load-operating-model.mjs`
- `scripts/agent-operating-model/run-behavioural-evals.mjs`

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

- The correct home is the GitHub Diamond bundle because the issue is pull-request review governance, not a domain-specific implementation concern.
- The rule should extend automated review comment handling rather than create a new specialist bundle.
- The procedure should preserve the current pull request head and avoid branch-ref movement unless explicitly requested or documented as recovery from a broken branch state.
- The rule should be backed by behavioural eval safeguards so it is testable.

## Files modified

- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/behavioural-evals.json`
- `scripts/agent-operating-model/load-operating-model.mjs`
- `scripts/agent-operating-model/run-behavioural-evals.mjs`
- `.agent-operating-model/bundles/github/README.md`
- `docs/agent-audit/reasoning/2026/05/29/review-thread-state-gate.md`
- `docs/agent-audit/reasoning/2026/05/29/review-thread-state-gate.json`

## Implementation summary

1. Added a `review_thread_state_gate` section to GitHub Diamond automated review comment handling.
2. Added a required output for review-thread state summaries.
3. Added refusal language for acting on resolved or outdated review threads.
4. Added a behavioural eval for review-thread state gating.
5. Added loader safeguards for review-thread state handling.
6. Added eval-runner mappings for review-thread failure modes.
7. Updated the GitHub bundle README automated review handling section.

## Validation plan

- Open a pull request to `main` from `chore/review-thread-state-gate`.
- Let CI, Release Gate, Validate ResearchOps and the GitHub bundle manifest workflow validate the change.
- Confirm the changed-file set is plausible for a GitHub bundle procedure change.
