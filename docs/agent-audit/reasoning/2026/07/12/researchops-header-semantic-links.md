# ResearchOps header semantic links

Promotion status: promoted from validated raw trace.

Source trace: `.agent-traces/raw/atrace-20260712-researchops-header-semantic-links.jsonl`.

Promoted at: 2026-07-12T21:22:58.876Z.

## Task summary

Prevent unlabelled ResearchOps header interactions in Flux and address the Codex review comment on PR 491.

## Run metadata

- Started: 2026-07-12T21:22:49.762Z
- Completed: 2026-07-12T21:22:49.769Z
- Event count: 55

## Bundles applied

- github-diamond
- researchops-developer-control
- multi-functional-team

## Files read

- AGENTS.md
- .agent-operating-model/orchestration.xml
- .agent-operating-model/bundle-registry.json
- .agent-operating-model/task-signal-catalog.json
- .agent-operating-model/selection-rules.json
- .agent-operating-model/bootstrap-checklist.md
- .agent-operating-model/precedence-policy.md
- .agent-operating-model/trace-policy.md
- .agent-operating-model/trace-layers.md
- .agent-operating-model/behavioural-evals.json
- .agent-operating-model/github-mutation-policy.md
- .agent-operating-model/bundles/github/prompt.spec.yaml
- .agent-operating-model/bundles/github/prompt.body.xml
- .agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml
- .agent-operating-model/bundles/researchops-developer-control/prompt.body.xml
- .agent-operating-model/bundles/multi-functional-team/prompt.spec.yaml
- .agent-operating-model/bundles/multi-functional-team/prompt.body.xml
- public/partials/header.html
- tests/auth-header-links-route-state.test.js
- scripts/agent-trace/trace-validator.mjs
- scripts/agent-trace/promote-trace.mjs
- docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.json

## Files created or modified

- public/partials/header.html
- tests/auth-header-links-route-state.test.js
- docs/agent-audit/reasoning/2026/07/12/researchops-header-semantic-links.md
- docs/agent-audit/reasoning/2026/07/12/researchops-header-semantic-links.json

## Validation attempted

- node --test tests/auth-header-links-route-state.test.js tests/flux-behaviour-tracker-route-state.test.js — exit 0
- npm run format:check — exit 0
- npm run trace:coverage — exit 0
- git diff --check — exit 0
- npm run validate — exit 0

## Issues and pivots

- Codex review comment discussion_r3567132535 identified that the original JSON could satisfy trace coverage without containing the complete promoted-trace evidence required by policy.
- Replace both hand-written audit artefacts with output generated from a validated, hash-chained raw trace.

## Validation warnings

None recorded.

## Event timeline

- - 2026-07-12T21:22:49.762Z — run.started: Label the remaining shared ResearchOps header links for Flux and remediate the valid Codex trace-evidence review comment on PR 491.
- - 2026-07-12T21:22:49.763Z — prompt.received: Prevent unlabelled ResearchOps header interactions in Flux and address the Codex review comment on PR 491.
- - 2026-07-12T21:22:49.763Z — file.read: AGENTS.md
- - 2026-07-12T21:22:49.764Z — file.read: .agent-operating-model/orchestration.xml
- - 2026-07-12T21:22:49.764Z — file.read: .agent-operating-model/bundle-registry.json
- - 2026-07-12T21:22:49.764Z — file.read: .agent-operating-model/task-signal-catalog.json
- - 2026-07-12T21:22:49.764Z — file.read: .agent-operating-model/selection-rules.json
- - 2026-07-12T21:22:49.764Z — file.read: .agent-operating-model/bootstrap-checklist.md
- - 2026-07-12T21:22:49.764Z — file.read: .agent-operating-model/precedence-policy.md
- - 2026-07-12T21:22:49.764Z — file.read: .agent-operating-model/trace-policy.md
- - 2026-07-12T21:22:49.764Z — file.read: .agent-operating-model/trace-layers.md
- - 2026-07-12T21:22:49.764Z — file.read: .agent-operating-model/behavioural-evals.json
- - 2026-07-12T21:22:49.764Z — file.read: .agent-operating-model/github-mutation-policy.md
- - 2026-07-12T21:22:49.765Z — file.read: .agent-operating-model/bundles/github/prompt.spec.yaml
- - 2026-07-12T21:22:49.765Z — file.read: .agent-operating-model/bundles/github/prompt.body.xml
- - 2026-07-12T21:22:49.765Z — file.read: .agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml
- - 2026-07-12T21:22:49.765Z — file.read: .agent-operating-model/bundles/researchops-developer-control/prompt.body.xml
- - 2026-07-12T21:22:49.765Z — file.read: .agent-operating-model/bundles/multi-functional-team/prompt.spec.yaml
- - 2026-07-12T21:22:49.765Z — file.read: .agent-operating-model/bundles/multi-functional-team/prompt.body.xml
- - 2026-07-12T21:22:49.765Z — file.read: public/partials/header.html
- - 2026-07-12T21:22:49.765Z — file.read: tests/auth-header-links-route-state.test.js
- - 2026-07-12T21:22:49.765Z — file.read: scripts/agent-trace/trace-validator.mjs
- - 2026-07-12T21:22:49.765Z — file.read: scripts/agent-trace/promote-trace.mjs
- - 2026-07-12T21:22:49.765Z — file.read: docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.json
- - 2026-07-12T21:22:49.765Z — bundle.loaded: .agent-operating-model/bundles/github/
- - 2026-07-12T21:22:49.766Z — bundle.applied: github-diamond
- - 2026-07-12T21:22:49.766Z — bundle.loaded: .agent-operating-model/bundles/researchops-developer-control/
- - 2026-07-12T21:22:49.766Z — bundle.applied: researchops-developer-control
- - 2026-07-12T21:22:49.766Z — bundle.loaded: .agent-operating-model/bundles/multi-functional-team/
- - 2026-07-12T21:22:49.766Z — bundle.applied: multi-functional-team
- - 2026-07-12T21:22:49.766Z — bundle.skipped: govuk-design-system
- - 2026-07-12T21:22:49.766Z — bundle.skipped: cloudflare
- - 2026-07-12T21:22:49.766Z — bundle.skipped: openai-platform
- - 2026-07-12T21:22:49.766Z — bundle.skipped: mcp-agent-tooling
- - 2026-07-12T21:22:49.767Z — bundle.skipped: airtable-public-api
- - 2026-07-12T21:22:49.767Z — bundle.skipped: mural-public-api
- - 2026-07-12T21:22:49.767Z — bundle.precedence_decided
- - 2026-07-12T21:22:49.767Z — bundle.precedence_decided
- - 2026-07-12T21:22:49.767Z — decision.recorded: Add stable Flux keys only to the previously unlabelled homepage/logo and skip links; preserve existing account and navigation keys.
- - 2026-07-12T21:22:49.767Z — issue.detected: Codex review comment discussion_r3567132535 identified that the original JSON could satisfy trace coverage without containing the complete promoted-trace evidence required by policy.
- - 2026-07-12T21:22:49.767Z — pivot.recorded: Replace both hand-written audit artefacts with output generated from a validated, hash-chained raw trace.
- - 2026-07-12T21:22:49.767Z — file.write.planned: docs/agent-audit/reasoning/2026/07/12/researchops-header-semantic-links.md
- - 2026-07-12T21:22:49.767Z — file.write.planned: docs/agent-audit/reasoning/2026/07/12/researchops-header-semantic-links.json
- - 2026-07-12T21:22:49.767Z — file.write.completed: public/partials/header.html
- - 2026-07-12T21:22:49.767Z — file.write.completed: tests/auth-header-links-route-state.test.js
- - 2026-07-12T21:22:49.767Z — file.write.completed: docs/agent-audit/reasoning/2026/07/12/researchops-header-semantic-links.md
- - 2026-07-12T21:22:49.768Z — file.write.completed: docs/agent-audit/reasoning/2026/07/12/researchops-header-semantic-links.json
- - 2026-07-12T21:22:49.768Z — command.completed: node --test tests/auth-header-links-route-state.test.js tests/flux-behaviour-tracker-route-state.test.js — exit 0
- - 2026-07-12T21:22:49.768Z — command.completed: npm run format:check — exit 0
- - 2026-07-12T21:22:49.768Z — command.completed: npm run trace:coverage — exit 0
- - 2026-07-12T21:22:49.768Z — command.completed: git diff --check — exit 0
- - 2026-07-12T21:22:49.768Z — command.completed: npm run validate — exit 0
- - 2026-07-12T21:22:49.768Z — validation.not_run: browser walkthrough
- - 2026-07-12T21:22:49.768Z — risk.recorded: Historical generic events remain immutable; the new semantic labels apply only to newly captured interactions after deployment.
- - 2026-07-12T21:22:49.769Z — run.completed
