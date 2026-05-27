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

## Files read

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/github-mutation-policy.md`
- `src/govuk/templates/pages/project-dashboard.njk`
- `tests/project-dashboard-route-state.test.js`

## Files created or modified

Created:

- `docs/agent-audit/reasoning/2026/05/27/project-dashboard-template.md`
- `docs/agent-audit/reasoning/2026/05/27/project-dashboard-template.json`

Modified:

- `src/govuk/templates/pages/project-dashboard.njk`
- `tests/project-dashboard-route-state.test.js`

## Validation attempted

- Compared `fix/project-dashboard-template` against `main` before opening the PR.
- Confirmed the implementation branch was one commit ahead of `main` before trace files were added.
- Confirmed there was no pre-existing open PR for `fix/project-dashboard-template`.
- Opened PR #291 into `main`.
- Investigated the initial failing route-state contract.
- Updated `tests/project-dashboard-route-state.test.js` so the rendered page contract matches the intended removal of the third Mural action.

## Validation results

On commit `b075e7ca20d40961df7f0b768796d8b53664b151`, these GitHub Actions passed:

- Format pull request
- Accessibility audit (pa11y-ci)
- CI
- Validate ResearchOps
- QA — Broken links (Lychee)
- qa-bdd
- Release Gate
- Worker CI

## Validation not run

No local npm, browser or template-render validation was run through the connector path. GitHub Actions were used as the validation source.

## Issues, pivots and residual risks

- The PR was opened before the required trace files were added. This trace corrects that branch-policy gap in the same PR.
- The first validation run failed because the route-state contract still expected the removed third Mural action. The test now requires the rendered page to match the intended two-action panel.
- The change is expected to be low risk because it is limited to one GOV.UK template and one matching route-state contract. It does not change JavaScript, API routes or data contracts.
