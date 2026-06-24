# AI Rewrite Production Unavailable

## Run metadata

- Date: 2026-06-24
- Branch: `fix/ai-rewrite-production-unavailable`
- Task: Fix the production `/api/ai-rewrite` path after PR #428 reached `main` but Step 1 still showed `Suggestions are temporarily unavailable`.
- Trace decision: Trace required because the branch starts with `fix/` and the work changed repository files.

## Operating model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/github-mutation-policy.md`

## Selected bundles

- `github-diamond`: `.agent-operating-model/bundles/github/`
- `researchops-developer-control`: `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team`: `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system`: `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare`: `.agent-operating-model/bundles/cloudflare/`

## Bundles skipped

- `openai-platform`: the active endpoint uses Cloudflare Workers AI, not the OpenAI API.
- `mcp-agent-tooling`: no MCP protocol or tool contract was changed.
- `airtable-public-api`: no Airtable API behaviour was changed.
- `mural-public-api`: no Mural API behaviour was changed.

## Files read

- `infra/cloudflare/src/core/ai-rewrite.js`
- `infra/cloudflare/src/core/ai-rewrite/config.js`
- `infra/cloudflare/src/core/ai-rewrite/prompts.js`
- `infra/cloudflare/src/core/ai-rewrite/testing.js`
- `infra/cloudflare/src/core/ai-rewrite/text.js`
- `infra/cloudflare/src/core/ai-rewrite/http.js`
- `infra/cloudflare/wrangler.toml`
- `.github/workflows/deploy-worker.yml`
- `.github/workflows/worker-ci.yml`
- `deployment-toolchain.yaml`
- `docs/deployment/wrangler-toolchain.md`
- `public/js/start-description-assist.js`
- `public/js/start-objectives-assist.js`
- `tests/ai-rewrite-origin-policy.test.js`
- `tests/ai-rewrite-split-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/24/ai-rewrite-preview-origin-regression.md`
- `docs/agent-audit/reasoning/2026/06/24/ai-rewrite-preview-origin-regression.json`

## Production evidence

- `https://research-operations.com/api/ai-rewrite?mode=description` returned `503` with `{"error":"AI_UNAVAILABLE","message":"The AI service is temporarily unavailable."}`.
- The response headers showed `x-researchops-worker-branch: main`, `x-researchops-worker-sha: afb13173d115e03c24b11ae48fa5eb1860d647e7`, `x-researchops-api-proxy: pages-advanced-worker` and the expected upstream Worker URL.
- `https://researchops.pages.dev/api/ai-rewrite?mode=description` returned the same `503`.
- The evidence confirms PR #428 fixed the origin/proxy problem, but the upstream Worker still failed at the Workers AI runtime call.

## Root cause

The AI rewrite service returned `503 AI_UNAVAILABLE` whenever `env.AI.run(...)` threw. That left the Start page with no structured response to render, so the UI could only show `Suggestions are temporarily unavailable`.

The previous PR fixed the request routing and allowed origins. This branch fixes the remaining service-resilience gap: a missing Workers AI binding, a thrown Workers AI call, or invalid model output should not make the feature blank.

## Files changed

- `infra/cloudflare/src/core/ai-rewrite.js`
- `infra/cloudflare/src/core/ai-rewrite/fallback.js`
- `public/js/start-description-assist.js`
- `public/js/start-objectives-assist.js`
- `tests/ai-rewrite-ai-fallback.test.js`
- `tests/ai-rewrite-split-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/24/ai-rewrite-production-unavailable.md`
- `docs/agent-audit/reasoning/2026/06/24/ai-rewrite-production-unavailable.json`

## Implementation

- Added a deterministic server-side review and rewrite fallback for the AI rewrite route.
- Returned fallback output with HTTP `200` when the Workers AI binding is missing.
- Returned fallback output with HTTP `200` when `env.AI.run(...)` throws.
- Returned fallback output with HTTP `200` when model output cannot be parsed into the expected JSON shape.
- Removed the old bracketed placeholder fallback from the live response path.
- Marked fallback responses with `flags.ai_unavailable: true`.
- Updated Step 1 and Step 2 panels to use `Review summary:` instead of `AI summary:`.
- Updated the status text to say `Done. Rule-based suggestions shown.` when the server flags fallback output.

## PR amendment

- Removed the duplicated Suggestions / Bias & Inclusion grid from the AI rewrite panel.
- Kept the local Suggestions / Bias & Inclusion grid as the single scoring surface.
- Changed the Description rewrite prompt and fallback output to use markdown syntax in the `rewrite` field.
- Rendered `div.rewrite-block.govuk-body` from sanitized markdown HTML.
- Changed the replace action to write the raw markdown `rewrite` value into the textarea instead of copying text from the preview.
- Updated the local scorer to recognise markdown `Scope`, `Research questions` and `Deliverables` headings.
- Removed unused `ai-sugg-*` Start route styles.

## Validation

- `node --test tests/ai-rewrite-ai-fallback.test.js tests/ai-rewrite-origin-policy.test.js tests/ai-rewrite-split-route-state.test.js`
  - Passed: 9 tests.
- Local response-shape check with a missing `AI` binding
  - Returned `200`, `flags.ai_unavailable: true`, 3 suggestions and a rewrite beginning with `Research focus:`.
- `npx prettier -c infra/cloudflare/src/core/ai-rewrite.js infra/cloudflare/src/core/ai-rewrite/fallback.js public/js/start-description-assist.js public/js/start-objectives-assist.js tests/ai-rewrite-ai-fallback.test.js tests/ai-rewrite-split-route-state.test.js`
  - Passed.
- `npx eslint infra/cloudflare/src/core/ai-rewrite.js infra/cloudflare/src/core/ai-rewrite/fallback.js public/js/start-description-assist.js public/js/start-objectives-assist.js tests/ai-rewrite-ai-fallback.test.js tests/ai-rewrite-split-route-state.test.js`
  - Passed with no errors.
  - Reported `no-console` warnings from audit logging in `infra/cloudflare/src/core/ai-rewrite.js` and existing client diagnostics in `public/js/start-description-assist.js`.
- `git diff --check`
  - Passed.
- `node --test tests/ai-rewrite-ai-fallback.test.js tests/ai-rewrite-origin-policy.test.js tests/ai-rewrite-split-route-state.test.js tests/start-page-route-state.test.js`
  - Passed after the PR amendment: 10 tests.
- Local browser flow with mocked `/api/ai-rewrite`
  - Confirmed the AI panel rendered zero `.ai-sugg-grid` elements.
  - Confirmed markdown rendered as a heading in `.rewrite-block`.
  - Confirmed `Replace description with rewrite` wrote markdown syntax into `#p_desc`.
  - Confirmed the local scorer rerendered to `No suggestions found.` and `No bias findings.` after replacement.

## Residual risk

- This keeps the user-facing feature useful during Workers AI failures, but it does not diagnose why production Workers AI returned an error. Production Worker logs should still be reviewed for `ai.run.fail` around the failed requests.
