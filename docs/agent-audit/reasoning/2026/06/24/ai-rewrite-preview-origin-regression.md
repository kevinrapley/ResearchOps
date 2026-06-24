# AI Rewrite Preview Origin Regression

## Run metadata

- Date: 2026-06-24
- Branch: `fix/ai-rewrite-preview-origin`
- Task: Investigate and fix a regression where Step 1 `/pages/start/` AI rewrite reports that suggestions are temporarily unavailable and the AI review/rewrite area has degraded presentation.
- Trace decision: Trace required because the branch starts with `fix/` and the work changed repository files.
- Corrected branch behaviour: investigation started on `feature/edit-project-objectives-markdown`, but this was an existing-behaviour regression. The work was moved to `fix/ai-rewrite-preview-origin` before commit, push and PR creation.

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

- `public/pages/start/index.html`
- `public/js/start-description-assist.js`
- `public/js/start-objectives-assist.js`
- `infra/cloudflare/src/core/ai-rewrite.js`
- `infra/cloudflare/src/core/ai-rewrite/http.js`
- `infra/cloudflare/src/core/ai-rewrite/config.js`
- `infra/cloudflare/src/core/ai-rewrite/testing.js`
- `infra/cloudflare/src/core/router.js`
- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/wrangler.toml`
- `public/js/copilot-suggester.js`
- `src/styles/start.scss`
- `public/css/start.css`
- `tests/ai-rewrite-split-route-state.test.js`
- `tests/start-page-route-state.test.js`
- `tests/start-project-step-1-defaults-route-state.test.js`

## Root cause

The Step 1 client showed `Suggestions are temporarily unavailable.` whenever `/api/ai-rewrite` returned a non-OK response. A tight handler-level reproduction showed that a ResearchOps Pages branch preview origin, for example `https://feature-edit-project-objectives-markdown.researchops.pages.dev`, received `403 {"error":"Origin not allowed"}`.

The wider Worker CORS layer already accepts `researchops.pages.dev` and `*.researchops.pages.dev`, but the AI rewrite handler had a separate literal `ALLOWED_ORIGINS` check. That stricter local check blocked branch preview pages before the Workers AI call could run.

A follow-up reproduction showed the first fix was too narrow. The same local AI rewrite handler still rejected the production custom domains `https://research-operations.com`, `https://www.research-operations.com` and `https://govuk.research-operations.com`, which would also produce the same temporarily unavailable UI message.

The degraded visual presentation had a separate cause. The suggestion renderer already emitted structured classes for local suggestions, AI analysis and rewritten copy, but the Start page stylesheet only styled the outer assist container. The detailed panel styling existed only as implementation notes in `public/js/copilot-suggester.js`, so the rendered suggestions fell back to raw list-like browser presentation.

A further GOV.UK conformance review found that the Start route stylesheet overrode the GOV.UK textarea component with `font: inherit`. In the rendered page this allowed the description textarea to fall back to a non-GOV.UK browser/form font. The suggestion and AI rewrite renderers also emitted plain custom markup for headings, status text, severity labels and the rewrite preview instead of GOV.UK body, list, tag, inset text and section-break classes.

## Files changed

- `infra/cloudflare/src/core/ai-rewrite/http.js`
- `infra/cloudflare/src/core/ai-rewrite.js`
- `src/styles/start.scss`
- `public/css/start.css`
- `src/govuk/templates/pages/start.njk`
- `public/pages/start/index.html`
- `public/js/copilot-suggester.js`
- `public/js/start-description-assist.js`
- `public/js/start-objectives-assist.js`
- `tests/ai-rewrite-origin-policy.test.js`
- `tests/start-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/24/ai-rewrite-preview-origin-regression.md`
- `docs/agent-audit/reasoning/2026/06/24/ai-rewrite-preview-origin-regression.json`

## Implementation

- Added a shared `isAllowedOrigin` helper for the AI rewrite endpoint.
- Aligned the AI rewrite endpoint with the existing ResearchOps Pages preview policy.
- Updated AI rewrite CORS headers to echo accepted preview origins.
- Added a regression test proving branch preview origins can call the Step 1 description rewrite path.
- Extended the AI rewrite origin policy to accept the production custom ResearchOps domains.
- Added rejection coverage for an untrusted origin.
- Restored Start page styling for local suggestions, AI analysis suggestions, AI summary text and rewritten description output.
- Added route-state assertions that the generated Start stylesheet contains the suggestion and rewrite panel classes.
- Removed the Start route textarea font override so `govuk-textarea` keeps the GOV.UK font stack and component styling.
- Replaced custom suggestion severity badges with GOV.UK tag classes.
- Replaced custom AI summary and rewrite presentation with GOV.UK inset text, section break, heading, body text and secondary button classes.
- Replaced mono/muted AI status text with `govuk-body-s` status text.
- Added route-state assertions for the GOV.UK AI renderer classes and for preventing `font: inherit` from returning to the Start stylesheet.

## Validation

- `node --test tests/ai-rewrite-origin-policy.test.js`
  - Failed before the fix with `403 !== 200`.
  - Passed after the fix.
- `node --test tests/ai-rewrite-origin-policy.test.js tests/start-page-route-state.test.js tests/ai-rewrite-split-route-state.test.js tests/start-project-step-1-defaults-route-state.test.js`
  - Passed after the follow-up fix: 8 tests.
- Direct AI rewrite handler reproduction
  - Accepted `https://research-operations.com`, `https://www.research-operations.com`, `https://govuk.research-operations.com` and a ResearchOps Pages branch preview origin.
  - Rejected `https://evil.example` with `403`.
- Playwright visual verification against a local static Start page with the AI rewrite response mocked
  - Desktop screenshot: `/tmp/researchops-start-ai-desktop.png`
  - Mobile screenshot: `/tmp/researchops-start-ai-mobile.png`
  - Verified the suggestion grids, AI summary and rewrite block render with non-zero layout, no horizontal overflow, and responsive one-column/two-column behaviour.
- Playwright GOV.UK conformance visual verification against a local static Start page with the AI rewrite response mocked
  - Desktop screenshot: `/tmp/researchops-start-govuk-ai-desktop.png`
  - Mobile screenshot: `/tmp/researchops-start-govuk-ai-mobile.png`
  - Verified the textarea, local suggestion heading, AI severity tag and rewrite block computed to `"GDS Transport", arial, sans-serif` at desktop and mobile sizes.
  - Verified GOV.UK tag and inset-text classes rendered, status text used `govuk-body-s start-assist-status`, and there was no horizontal overflow.
- `node --test tests/start-page-route-state.test.js tests/ai-rewrite-origin-policy.test.js tests/ai-rewrite-split-route-state.test.js tests/start-project-step-1-defaults-route-state.test.js`
  - Passed after the GOV.UK conformance pass: 8 tests.
- `npx prettier -c --ignore-unknown src/govuk/templates/pages/start.njk src/styles/start.scss public/css/start.css public/js/copilot-suggester.js public/js/start-description-assist.js public/js/start-objectives-assist.js public/pages/start/index.html tests/start-page-route-state.test.js`
  - Passed.
- `npx eslint public/js/copilot-suggester.js public/js/start-description-assist.js public/js/start-objectives-assist.js tests/start-page-route-state.test.js`
  - Passed with no errors.
  - Reported 2 pre-existing `no-console` warnings in `public/js/start-description-assist.js`.
- `git diff --check`
  - Passed.
- `npx eslint infra/cloudflare/src/core/ai-rewrite.js infra/cloudflare/src/core/ai-rewrite/http.js tests/ai-rewrite-origin-policy.test.js tests/start-page-route-state.test.js`
  - Passed with no errors.
  - Reported 3 pre-existing `no-console` warnings in `infra/cloudflare/src/core/ai-rewrite.js`.
- `npx prettier -c infra/cloudflare/src/core/ai-rewrite/http.js src/styles/start.scss public/css/start.css tests/ai-rewrite-origin-policy.test.js tests/start-page-route-state.test.js docs/agent-audit/reasoning/2026/06/24/ai-rewrite-preview-origin-regression.md docs/agent-audit/reasoning/2026/06/24/ai-rewrite-preview-origin-regression.json`
  - Initially failed on `tests/ai-rewrite-origin-policy.test.js`.
  - Passed after formatting that test file with Prettier and after the follow-up styling/origin changes.
- `node -e "JSON.parse(require('fs').readFileSync('docs/agent-audit/reasoning/2026/06/24/ai-rewrite-preview-origin-regression.json','utf8')); console.log('json ok')"`
  - Passed.

## Residual risk

- This fix addresses preview-origin rejection. If a deployed Worker environment is missing the `AI` binding, the endpoint will still return `AI_UNAVAILABLE` and the UI will show the same generic message.
