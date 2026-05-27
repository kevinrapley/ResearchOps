# Project dashboard template trace

## Run metadata

- Date: 2026-05-27
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/project-dashboard-template`
- Pull request: #291
- Trace requirement: required by `fix/` branch policy
- Trace layer: operational

## Original task summary

Create a pull request for the existing branch `fix/project-dashboard-template`, where the project dashboard GOV.UK template was edited to include descriptive dashboard copy and remove an unnecessary third button from the Mural panel.

## Operating-model files loaded

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/github-mutation-policy.md`

## Canonical bundle directories selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`

## Bundles skipped

- `.agent-operating-model/bundles/cloudflare/` — no Worker, Pages routing, deployment or binding change was part of the user edit.
- `.agent-operating-model/bundles/mural-public-api/` — the change affected dashboard template copy and visible action count only; no Mural API behaviour changed.
- `.agent-operating-model/bundles/airtable-public-api/` — no Airtable schema, records or API calls changed.
- `.agent-operating-model/bundles/openai/` — no OpenAI API or model behaviour changed.
- `.agent-operating-model/bundles/mcp-agent-tooling/` — no MCP tooling change was in scope.

## Precedence decisions

- GitHub repository governance controlled branch, PR and trace handling.
- ResearchOps Developer Control governed the platform template context.
- GOV.UK Design System governed page-template content and action clarity.
- The GitHub mutation policy required checking the changed-file list before reporting readiness.

## Files read

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/github-mutation-policy.md`
- `src/govuk/templates/pages/project-dashboard.njk`

## Files created or modified

Created:

- `docs/agent-audit/reasoning/2026/05/27/project-dashboard-template.md`
- `docs/agent-audit/reasoning/2026/05/27/project-dashboard-template.json`

Already modified before this trace was added:

- `src/govuk/templates/pages/project-dashboard.njk`

## Validation attempted

- Compared `fix/project-dashboard-template` against `main` before opening the PR.
- Confirmed the implementation branch was one commit ahead of `main` before trace files were added.
- Confirmed the implementation diff was scoped to `src/govuk/templates/pages/project-dashboard.njk`.
- Confirmed there was no pre-existing open PR for `fix/project-dashboard-template`.
- Opened PR #291 into `main`.

## Validation not run

No local npm, browser or template-render validation was run through the connector path. GitHub Actions are the expected validation path after the PR is opened.

## Issues, pivots and residual risks

- The PR was opened before the required trace files were added. This trace corrects that branch-policy gap in the same PR.
- The change is expected to be low risk because it is limited to one GOV.UK template and does not change JavaScript, API routes or data contracts.
- Final readiness depends on GitHub Actions completing successfully for PR #291.
