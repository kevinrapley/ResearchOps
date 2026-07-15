# AI rewrite authentication feedback

- Run metadata
  - Date: 2026-07-15
  - Agent: Codex `/root`
  - Branch: `fix/ai-rewrite-auth-feedback`
  - Trace trigger: branch prefix `fix/` requires an auditable trace

- Original task summary
  - Investigate and fix the start-page AI rewrite showing `Suggestions are temporarily unavailable` on `https://research-operations.com/pages/start/`.

- Branch decision
  - Investigation began on the already-merged `feature/tree-test-session` branch.
  - Created `fix/ai-rewrite-auth-feedback` from current `origin/main` before implementation so the fix did not extend the completed Tree Test work.

- Operating-model files loaded
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

- Canonical bundles selected
  - `.agent-operating-model/bundles/github/`
  - `.agent-operating-model/bundles/researchops-developer-control/`
  - `.agent-operating-model/bundles/multi-functional-team/`
  - `.agent-operating-model/bundles/govuk-design-system/`
  - `.agent-operating-model/bundles/cloudflare/`

- Bundle verification
  - Verified and loaded the registered `prompt.spec.yaml` and `prompt.body.xml` for every selected bundle.

- Bundles skipped
  - `.agent-operating-model/bundles/openai/` because the endpoint uses Cloudflare Workers AI, not the OpenAI Platform.
  - `.agent-operating-model/bundles/mcp-agent-tooling/` because no MCP contract or tool changed.
  - `.agent-operating-model/bundles/airtable-public-api/` because the counters-only usage log path was not involved in the failure.
  - `.agent-operating-model/bundles/mural-public-api/` because no Mural integration was involved.

- Typed task signals and precedence
  - Signals: repository-affecting task, government product assurance, UI/content change, and Cloudflare runtime route with Workers AI.
  - GitHub Diamond governed branch and trace safety; ResearchOps Developer Control governed the route contract; GOV.UK Design System governed accessible status content; Cloudflare governed the Pages, Worker and Workers AI boundary.
  - No instruction conflicts were identified.

- Evidence from repository files and production probes
  - The production page loaded successfully, but an exact `POST /api/ai-rewrite?mode=description` returned `401 authentication_required` through both the Pages proxy and the production Worker.
  - `infra/cloudflare/src/worker.js` declares the route as authenticated and requires `research.content.manage`.
  - Git history showed commit `528efee4` added that security declaration on 2026-07-02.
  - Both start-page assist clients treated every non-2xx response as a service outage, so the visible message hid the real authentication requirement.
  - Workers AI was not reached and was not the failing component.

- Implementation decisions
  - Preserved the authenticated route and its permission requirement.
  - Added one shared status mapper so both description and objectives assistance use the same plain-English response.
  - Mapped `401` to `Sign in to use AI rewrite.` and `403` to `You do not have access to use AI rewrite.`.
  - Preserved `Suggestions are temporarily unavailable.` for other non-2xx responses.

- Files read
  - `README.md`
  - `RECENT_LEARNINGS.md`
  - `public/pages/start/index.html`
  - `public/_worker.js`
  - `functions/api/[[path]].js`
  - `public/js/start-description-assist.js`
  - `public/js/start-objectives-assist.js`
  - `public/pages/start/start-new-project.js`
  - `infra/cloudflare/src/worker.js`
  - `infra/cloudflare/src/core/router.js`
  - `infra/cloudflare/src/core/ai-rewrite.js`
  - `infra/cloudflare/src/core/ai-rewrite/http.js`
  - `infra/cloudflare/wrangler.toml`
  - `tests/start-page-route-state.test.js`
  - `tests/security-review-hardening-runtime.test.js`
  - prior AI rewrite and project-auth traces under `docs/agent-audit/reasoning/2026/06/`

- Files created or modified
  - Created `public/js/ai-rewrite-status.js`.
  - Modified `public/js/start-description-assist.js`.
  - Modified `public/js/start-objectives-assist.js`.
  - Created `tests/ai-rewrite-auth-feedback.test.js`.
  - Modified `tests/start-page-route-state.test.js`.
  - Created this Markdown trace and its JSON summary.

- Validation attempted
  - Production `curl` reproduction against the Pages proxy and production Worker: both returned `401 authentication_required` before the fix.
  - TDD red/green cycles for the `401` and `403` status messages.
  - Focused 15-test AI rewrite and start-page suite: passed.
  - `npx prettier -c` for all changed JavaScript and test files: passed after formatting the new unit test.
  - `npx eslint` for all changed JavaScript and test files: no errors; two pre-existing `no-console` warnings in `start-description-assist.js`.
  - `npm run lint`: passed with 0 errors; the repository reported 237 existing warnings.
  - `npm run build`: passed; unrelated generated HTML rewrites produced by the renderer were removed from this scoped change.
  - `npm test`: 365 tests passed, 0 failed.
  - Local Playwright verification with mocked API responses:
    - Step 1 `401` at 1280×900 and 390×844 displayed the sign-in message with no horizontal overflow.
    - Step 2 `403` displayed the access message.

- Validation not run
  - No live deployment was performed, so the production site continues to show the old generic message until this branch is deployed.

- Test-contract impact sweep
  - Checked both start-page assist clients, their shared endpoint/status strings, start-page route-state coverage, AI rewrite fallback/origin coverage, and the full repository test suite.
  - No generated HTML or CSS change was required because the existing `aria-live` status elements render the new text.

- Issues, pivots, and residual risks
  - The initial symptom looked like AI unavailability; the tight production probe isolated authentication before model execution.
  - Residual risk: an expired signed-in session also receives the sign-in message, which is accurate but does not automatically redirect or preserve the in-progress form through reauthentication.
