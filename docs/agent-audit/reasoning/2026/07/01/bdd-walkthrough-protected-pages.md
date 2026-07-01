# BDD Walkthrough Protected Pages Trace

Date: 2026-07-01
Branch: `fix/bdd-walkthrough-protected-pages`
Task: Investigate the attached full BDD walkthrough failure logs and fix the walkthrough failure.

## Operating Model

Loaded files:

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
- `.agent-operating-model/github-mutation-policy.md`

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`

Skipped bundles:

- `govuk-design-system`
- `cloudflare`
- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

Precedence decision: GitHub Diamond governs branch, trace and validation handling. ResearchOps Developer Control governs the walkthrough implementation and test-contract update. Multi-Functional Team frames the reporting walkthrough as assurance evidence for a public-sector service.

## Evidence

- The attached `logs_77064295337.zip` showed the `bdd-smoke` job passed: `3 scenarios (3 passed)` and `11 steps (11 passed)`.
- The same archive showed the `walkthrough` job failed in `npm run qa:visual-walkthrough` with `Error: Visual walkthrough failed for 4 capture(s).`
- Two failures waited for stale text: `Concise rewrite (optional):`, while the current objectives assist component renders the `#apply-ai-obj-rewrite` control under the `Concise rewrite` heading.
- Two failures waited for `Assisted Digital Support Discovery` on `/pages/project-dashboard/?id=recVisualProject001`.
- A targeted Playwright reproduction against `https://researchops.pages.dev/` showed that project-dashboard redirected to `/pages/account/sign-in/?returnTo=...` before mocked project API routes could render the fixture.
- `public/_worker.js` protects `/pages/projects`, `/pages/project-dashboard` and `/pages/repository`; the visual walkthrough only used QA server auth for `repository`.

## Changes

- Updated `scripts/visual-walkthrough.mjs` so the remote visual walkthrough uses the QA BDD auth bypass for `projects`, `project-dashboard` and `repository`.
- Updated `visual-walkthrough.config.mjs` so the AI rewrite state waits for `#apply-ai-obj-rewrite` instead of stale copy.
- Updated `tests/qa-bdd-authenticated-walkthrough-route-state.test.js` to lock both behaviours into the route-state contract.

## Validation

Passed checks:

- Targeted Playwright check for the local static `step-2-ai-rewrite-shown` state: `ai-rewrite-state=ok`
- Static protected-page contract check: `protected-page-set=ok`
- `BASE_URL=https://researchops.pages.dev/ npm run qa:cucumber:ci`
- `npm run qa:cucumber:walkthrough`
- `node --test tests/qa-bdd-authenticated-walkthrough-route-state.test.js`
- `npx prettier -c scripts/visual-walkthrough.mjs visual-walkthrough.config.mjs tests/qa-bdd-authenticated-walkthrough-route-state.test.js`
- `git diff --check`

Validation note:

- `npm run qa:cucumber:ci` was first run without a local server or `BASE_URL` and failed with `net::ERR_CONNECTION_REFUSED` for `http://localhost:8788/`. The same suite passed when rerun against the deployed workflow base URL.

## Risks And Limits

- The remote authenticated project-dashboard path could not be fully verified locally because `RESEARCHOPS_QA_BDD_AUTH_CODE` was not available in the local secure env. The workflow already supplies that secret, and the code path now includes project-dashboard in the set that requests authenticated storage state.
- The fix assumes the Worker protection contract remains the three routes currently encoded in `public/_worker.js`: `/pages/projects`, `/pages/project-dashboard` and `/pages/repository`.
