# Visual walkthrough registry coverage trace

- Branch: `fix/visual-walkthrough-registry-coverage`
- Task: Restore visual walkthrough route registry coverage after PR #252 CI recovery weakened the contract test.
- Branch trace decision: `fix/` branch, trace required.
- Operating model files loaded:
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
- Selected bundles:
  - `github-diamond`
  - `researchops-developer-control`
  - `multi-functional-team`
  - `govuk-design-system`
  - `cloudflare`
- Skipped bundles:
  - `openai-platform` — no OpenAI API or model change.
  - `mcp-agent-tooling` — no MCP tool contract change.
  - `airtable-public-api` — no Airtable API implementation change.
  - `mural-public-api` — no Mural API implementation change.
- Precedence decisions:
  - GitHub Diamond governed branch safety, trace requirement and PR discipline.
  - ResearchOps Developer Control governed route-state and visual walkthrough test contracts.
  - Multi-Functional Team governed public-sector assurance and evidence discipline.
  - GOV.UK Design System applied because public HTML routes and page coverage are in scope.
  - Cloudflare applied as a conditional runtime/routing context, but no Worker or Pages routing implementation was changed.

## Files read

- `visual-walkthrough.config.mjs`
- `visual-walkthrough.operational-fixtures.mjs`
- `visual-walkthrough.synthesis-fixtures.mjs`
- `visual-walkthrough.synthesis-states.mjs`
- `scripts/visual-walkthrough.mjs`
- `tests/study-child-route-state.test.js`
- `tests/study-page-route-state.test.js`
- `tests/synthesize-page-route-state.test.js`
- `public/pages/synthesize/index.html`
- PR #252 metadata and merge context

## Files changed

- `visual-walkthrough.config.mjs`
- `tests/visual-walkthrough-registry-coverage.test.js`
- `docs/agent-audit/reasoning/2026/05/19/visual-walkthrough-registry-coverage.md`
- `docs/agent-audit/reasoning/2026/05/19/visual-walkthrough-registry-coverage.json`

## Change summary

- Restored the visual walkthrough registry as a route coverage contract.
- Added a dedicated test proving every public HTML route is registered or explicitly excluded.
- Added explicit exclusion reasons for excluded routes.
- Registered `/pages/study/synthesis/index.html` as the canonical Study synthesis walkthrough route.
- Excluded `/pages/synthesize/index.html` from visual walkthrough coverage because it remains a legacy redirect bridge.
- Reworked Study walkthrough states to use canonical `id=rec...` Study routing for child-route coverage.

## Scope decision

The user confirmed this PR should stay contained and that removal of `public/pages/synthesize/` will be handled in a follow-up. The branch therefore excludes the legacy route from walkthrough coverage but does not delete the redirect bridge.

## Validation attempted

Validation was not executed locally in this ChatGPT environment. The change is covered by a new Node test intended to run under `npm test` in CI.

## Residual risks

- CI may require Prettier wrapping adjustments because files were edited through the GitHub API rather than a local formatter.
- Full removal of `public/pages/synthesize/` remains open for a follow-up PR because existing route-state bridge tests still assert compatibility behaviour.
