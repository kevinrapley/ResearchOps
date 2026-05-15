# Trace — `fix/projects-team-scoped-access` preview follow-up (2026-05-15)

- Branch: `fix/projects-team-scoped-access`
- Trigger: branch-prefix
- Trace layer: operational
- Date: 2026-05-15

## Task

After the 2026-05-14 trigger broadening, the preview project dashboard at `fix-projects-team-scoped-acc.researchops.pages.dev` still reported `Could not load project.` with empty key information. Continue PR #252 to (a) confirm the workflow trigger is correct, (b) make the actual upstream failure visible in the UI, (c) restore trace coverage for 2026-05-15 so the deploy workflow's validate step passes.

## Operating-model loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`

## Bundles

Selected:

- `github-diamond` — branch / CI workflow change.
- `researchops-developer-control` — dashboard error UI and Worker deploy workflow.
- `multi-functional-team` — government product assurance default.
- `cloudflare` — Cloudflare Worker deployment workflow change.
- `govuk-design-system` — dashboard error region uses GOV.UK markup (`govuk-heading-m`, `govuk-body`, `govuk-link`, `role="alert"`, `aria-live`).

Skipped: `openai-platform`, `mcp-agent-tooling`, `airtable-public-api`, `mural-public-api`.

## Changes recorded by this trace

- `ecce6697` — `Show deploy source` step on `.github/workflows/deploy-passwordless-preview-worker.yml` printing `ref`, `sha`, `event`, `actor`, target Worker, plus a reminder that `workflow_dispatch` defaults to the dropdown branch. Re-triggered the auto-deploy.
- `d34d626d` — replaced the dashboard's generic `alert("Could not load project.")` with `renderProjectLoadError()`, a visible `role="alert"` region containing the technical detail, upstream HTTP status and requested project id, plus a `Back to projects` link. Errors thrown by `loadProject()` now carry `upstreamStatus` and `upstreamBody`. Console emits a single structured log entry. Pinned in `tests/project-dashboard-route-state.test.js`.
- Today (this commit) — added `docs/agent-audit/reasoning/2026/05/15/` trace artefacts so `npm run validate`'s `trace:coverage` check passes for work landing on 2026-05-15. The 2026-05-14 trace remains the record for yesterday's investigation.

## Investigation

Hypothesis: the workflow trigger fix is correct and the preview Worker is updating from this branch. The visible symptom on the live preview is still `Could not load project.` because the dashboard masked every failure path behind that single alert. Without the actual upstream error (HTTP status, error code, requested id) it is not possible from outside the browser to tell which class of failure remains.

Evidence:

- PR check runs for `cc17524`, `360b0367` and `ecce6697` all show `Deploy passwordless preview Worker` succeeded.
- Today's `workflow_dispatch` from `refs/heads/fix/projects-team-scoped-access` (commit `d34d626d`) is confirmed by the `Show deploy source` step output: `ref refs/heads/fix/projects-team-scoped-access`, `sha d34d626d99103591d6c3216fe1c4e77ca4956788`, `event workflow_dispatch`, `actor kevinrapley`.
- The deploy step did not reach `wrangler deploy` because `npm run validate` failed at `assert-trace-coverage`: `no trace directory found: docs/agent-audit/reasoning/2026/05/15`. Trace coverage is checked against UTC today.
- The dashboard JS originally caught every failure with a generic `window.alert`; `renderProjectLoadError` now writes the technical detail, upstream HTTP status and requested project id into the page.

Next step on the user's side: once `trace:coverage` passes and the workflow's deploy step lands the preview Worker for `d34d626d` or later, reload `/pages/project-dashboard/?id=...` and read the visible error region. The **Technical detail** and **Requested project id** pin the remaining cause to one of:

- `Missing project id param` — URL has no `?id=` parameter.
- `Project non-JSON (HTTP …)` — proxy / upstream returned an HTML error page.
- `Project JSON parse failed (HTTP …)` — body wasn't JSON.
- `Project not found` with HTTP 404 — the Worker rejected the id or `userCanSee` filtered the project out.
- `authentication_required` with HTTP 401 — session is not what we think.
- `permission_denied` with HTTP 403 — route declaration mismatch.
- `Internal error` with HTTP 500 — Airtable upstream threw.

## Validation

- `node --test tests/project-dashboard-route-state.test.js tests/projects-page-route-state.test.js tests/projects-route-contract.test.js` — pass.
- `npm test` — 148 / 148 pass.
- `npm run validate` — passed locally on 2026-05-14; the CI failure on 2026-05-15 is exactly the trace-coverage gap this trace remedies.
- `npx prettier -c` on changed files — clean.

Not run locally: `npm run lint` (sandbox lacks the `globals` package required by `eslint.config.js`; CI lint and prettier jobs cover this).

## Residual risk

- The remaining live preview failure is masked behind the previous alert. The `d34d626d` UI change is the diagnostic mechanism — the next preview load after this trace lands and the deploy workflow completes will surface the technical detail.
- `trace:coverage` is sensitive to UTC date rollover. Long-running PRs that span days need a trace for each day they touch the branch. This is a known property of the coverage script, not a defect of this PR.
- Only one preview Worker exists. Concurrent PRs that touch `infra/cloudflare/**` will race; the last push wins.

## Evidence boundary

- Repository evidence: `scripts/agent-trace/assert-trace-coverage.mjs` requires a `.json` file in `docs/agent-audit/reasoning/YYYY/MM/DD/` for today's UTC date when the branch prefix requires trace coverage. Today's deploy log shows the trace coverage failure. PR check runs confirm prior preview Worker deploys succeeded.
- Implementation decision: add today's trace under `2026/05/15` rather than backdating yesterday's trace so each day's work has its own audit record.
- Assumption: the dashboard error region (`d34d626d`) will surface the actual upstream failure on the next preview load. If it does not, the failure is in the fetch/network layer outside the dashboard JS and we will need network-panel evidence.
- Tool limitation: sandbox cannot reach the live preview; diagnosis remains structural.
- Validation result: all targeted Node tests, full test suite, validate (yesterday) and Prettier are clean. The 2026-05-15 trace-coverage failure is exactly the artefact this trace is being committed to remedy.
