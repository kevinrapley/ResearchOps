# QA BDD Authenticated Walkthrough Trace

Date: 2026-06-16
Branch: `fix/qa-bdd-authenticated-walkthrough`
Task: Fix the QA BDD walkthrough so it can capture sign-in, the 6-digit code state, and every authenticated page/screen state using deterministic authentication.

## Operating Model Bootstrap

- Loaded `AGENTS.md`.
- Loaded `.agent-operating-model/orchestration.xml`.
- Loaded `.agent-operating-model/bundle-registry.json`.
- Loaded `.agent-operating-model/task-signal-catalog.json`.
- Loaded `.agent-operating-model/selection-rules.json`.
- Loaded `.agent-operating-model/github-mutation-policy.md`.
- Loaded `.agent-operating-model/precedence-policy.md`.

## Selected Bundles

- `.agent-operating-model/bundles/github/` (`github-diamond`)
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`

Conditional bundle rationale:

- `govuk-design-system`: sign-in and page state capture touch user-facing page behaviour.
- `cloudflare`: passwordless authentication bypass is implemented inside the Worker authentication flow.

Bundles not selected:

- OpenAI, MCP agent tooling, Airtable public API, and Mural public API were not directly involved in the walkthrough/authentication fix.

## Sub-Agent Selection

`~/.codex/config.toml` was used to select six focused sub-agents:

- BranchGuard: branch policy, dirty-worktree, and remote state.
- TraceGuard: trace requirements and expected artifact shape.
- RuntimeDev: Worker/passwordless authentication design.
- TestDev: Cucumber and Playwright walkthrough coverage.
- RenderGuard: visual walkthrough output and generated report handling.
- ReviewGuard: PR readiness and validation checklist.

## Implementation Summary

- Added shared Playwright walkthrough helpers for local asset routing, deterministic API route registration, sign-in fixtures, and authenticated operational fixtures.
- Extended the visual walkthrough to capture sign-in as a signed-out page, including a state where the QA email is submitted and the 6-digit code form is displayed.
- Extended authenticated walkthrough capture to use deterministic local mocks and include participant-consent and synthesis state expansion.
- Added a Cucumber feature that captures the sign-in code state and then captures every registered authenticated page state.
- Added BDD support for deterministic app state, local asset routing, per-state screenshots, and a longer timeout for the full walkthrough pass.
- Added an environment-gated QA BDD passwordless bypass that only works when explicitly enabled and the email is allowlisted.
- Fixed participant consent same-origin API URL construction and missing-context handling so the walkthrough can capture the page without hanging.
- Added regression tests for the QA BDD walkthrough wiring, sign-in state, route mocking, QA auth bypass, and participant consent URL construction.

## Validation Evidence

- Focused Node tests passed:
  - `node --test tests/qa-bdd-authenticated-walkthrough-route-state.test.js tests/auth-sign-in-route-state.test.js tests/visual-walkthrough-registry-coverage.test.js tests/visual-walkthrough-role-assignment-route-state.test.js`
- Focused formatting check passed:
  - `npx prettier -c features/steps/common.steps.js features/support/timeouts.js features/support/world.js infra/cloudflare/src/core/auth/passwordless.js public/js/participant-consent-page.js scripts/visual-walkthrough.mjs scripts/walkthrough-playwright.mjs visual-walkthrough.config.mjs visual-walkthrough.operational-fixtures.mjs visual-walkthrough.participant-consent-fixtures.mjs tests/qa-bdd-authenticated-walkthrough-route-state.test.js docs/agent-audit/reasoning/2026/06/16/qa-bdd-authenticated-walkthrough-trace.md docs/agent-audit/reasoning/2026/06/16/qa-bdd-authenticated-walkthrough-trace.json`
- Visual walkthrough passed against local server:
  - `WALKTHROUGH_LOCAL_ASSETS=true BASE_URL=http://127.0.0.1:8789/ npm run qa:visual-walkthrough`
- Cucumber walkthrough passed against local server:
  - `BDD_CAPTURE_SCREENSHOTS=true BASE_URL=http://127.0.0.1:8789/ npx cucumber-js -p default --format progress`
  - Result: 5 scenarios passed, 18 steps passed.
- Trace coverage passed:
  - `npm run trace:coverage`

## Generated Artifact Policy

Validation generated `reports-site` screenshot and manifest changes. Those files were intentionally removed from the branch so the pull request contains source, tests, and trace artifacts only.

## Residual Risks

- The QA BDD passwordless bypass depends on runtime environment configuration and remains disabled unless `RESEARCHOPS_QA_BDD_AUTH_ENABLED=true`.
- Full repository validation was not used as a replacement for the targeted walkthrough validation; the PR validation summary records the exact focused checks run.
