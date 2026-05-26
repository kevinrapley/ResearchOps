# Project Dashboard Pages API proxy timeout

## Run metadata

- Date: 2026-05-26
- Branch: `chore/govuk-frontend-integration`
- Pull request: #262
- Starting head: `f8f4b08d6715967846c53e8d9e8d2c3a79db8e1d`
- Trace trigger: `chore/` branch prefix requires an auditable trace.

## Task summary

The Cloudflare Pages preview for `/pages/project-dashboard/` continued to show the browser loading after the earlier route-level fix. The user rejected an `x-include` fallback direction because shared `x-include` page chrome had been stable before this route migration. The task was to fix the runtime path that could leave the preview route waiting.

## Operating-model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/trace-policy.md`

## Selected bundles

- `github-diamond` from `.agent-operating-model/bundles/github/`
- `researchops-developer-control` from `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` from `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` from `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare` from `.agent-operating-model/bundles/cloudflare/`
- `mural-public-api` from `.agent-operating-model/bundles/mural-public-api/`

## Bundles skipped

- `openai-platform`: no OpenAI API, model, retrieval, structured output, eval or AI runtime change was in scope.
- `mcp-agent-tooling`: no MCP server, MCP client, tool contract or resource exposure change was in scope.
- `airtable-public-api`: no Airtable schema, formula, record mutation or attachment contract was changed.

## Precedence decisions

- GitHub Diamond governed the repository branch, PR and trace obligations.
- ResearchOps Developer Control governed route and service-boundary diagnosis.
- GOV.UK Design System governed the decision not to add fallback page chrome that could hide a service route failure.
- Cloudflare governed the Pages Function and Worker proxy path.
- Mural API was relevant because the previous fix had focused on Mural activity, but no Mural API contract was changed in this fix.

## Evidence read

- `functions/api/[[path]].js`
- `public/js/project-dashboard.js`
- `public/components/layout.js`
- `public/components/mural-integration.js`
- `public/components/project-dashboard-mural-state.js`
- `public/pages/project-dashboard/index.html`
- `tests/project-dashboard-route-state.test.js`
- `tests/mural-ui-route-state.test.js`
- `package.json`
- `.prettierignore`

## Diagnosis

The Project Dashboard controller already used finite client-side `fetchWithTimeout` calls for `/api/projects/:id` and `/api/studies`. The route, however, calls same-origin `/api/*` from the Cloudflare Pages preview. Those requests are handled first by the Pages Function proxy at `functions/api/[[path]].js`, which then forwards to the preview Worker.

Before this change, the Pages Function proxy used a plain upstream `fetch()` without an explicit timeout. A slow or stalled preview Worker call could therefore keep the proxy path unresolved from the preview route's perspective. That was a better failure candidate than `x-include`, because the page chrome loader already emits loaded or error events and the user reported `x-include` had been stable until this route issue.

## Changes made

- Added bounded upstream timeout handling to `functions/api/[[path]].js`.
- Added configurable timeout clamping through `API_PROXY_TIMEOUT_MS` or `RESEARCHOPS_API_PROXY_TIMEOUT_MS`.
- Added proxy diagnostics through `x-researchops-api-proxy-timeout-ms` and `x-researchops-api-upstream` headers.
- Added a `504` `api_proxy_timeout` JSON response when the upstream Worker does not respond within the configured timeout.
- Updated the generic proxy error message from sign-in-specific wording to API-service wording.
- Added `tests/pages-api-proxy-timeout-route-state.test.js` to guard the proxy timeout and to guard against fixing the issue by adding `x-include` fallback chrome.

## Files created or modified

- Modified: `functions/api/[[path]].js`
- Created: `tests/pages-api-proxy-timeout-route-state.test.js`
- Created: `docs/agent-audit/reasoning/2026/05/26/project-dashboard-pages-api-proxy-timeout.md`
- Created: `docs/agent-audit/reasoning/2026/05/26/project-dashboard-pages-api-proxy-timeout.json`

## Validation attempted

No local validation was run in this ChatGPT environment. The repository CI is expected to run after the branch push. The new test is a Node `--test` route-state assertion and should be included by the repository `npm test` script.

## Validation not run

- `npm test`: not run locally in this tool session.
- `npm run format:check`: not run locally in this tool session.
- `npm run lint`: not run locally in this tool session.
- Cloudflare preview visual check: not run locally in this tool session.

## Residual risks

- If the browser still loads after this change, the pending request should now be visible as either a finite `504 api_proxy_timeout` response or a different non-API request. That would narrow the next fix.
- This change does not prove the preview Worker itself is healthy. It prevents the Pages Function proxy from hiding a slow or stalled upstream Worker call.
- A final visual check is still required on the Cloudflare Pages branch preview after deployment.
