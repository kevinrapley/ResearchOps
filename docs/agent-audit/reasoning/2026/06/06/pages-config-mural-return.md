# Pages config and Mural return guard

## Task summary

Pin the Cloudflare Pages build Node version in the root Pages Wrangler configuration, remove the invalid absolute `/api/*` proxy redirect, and protect the Mural OAuth return-to-Pages behaviour with route-state coverage.

## Run metadata

- Date: 2026-06-06
- Branch: `fix/pages-config-mural-return`
- Trace required: yes, because `fix/` branches require an auditable trace.
- Repository: `kevinrapley/ResearchOps`

## Operating model loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/github-mutation-policy.md`

## Bundles selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/cloudflare/`
- `.agent-operating-model/bundles/mural-public-api/`

## Bundles skipped

- `.agent-operating-model/bundles/govuk-design-system/`: no GOV.UK page, component, content or accessibility implementation changed.
- `.agent-operating-model/bundles/openai/`: no OpenAI API, model or AI route behaviour changed.
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP tooling changed.
- `.agent-operating-model/bundles/airtable-public-api/`: no Airtable API behaviour changed.

## Precedence decisions

- GitHub Diamond governed branch naming, trace requirement, mutation discipline, PR scope and validation evidence.
- ResearchOps Developer Control governed existing Pages, Worker and route-state test conventions.
- Cloudflare governed Pages Wrangler configuration, `_redirects` handling and build environment alignment.
- Mural Public API governed OAuth callback risk framing and return-path protection.
- Multi-Functional Team governed user-impact framing because a broken OAuth return path can strand users outside the Pages journey.

## Files read

- `wrangler.toml`
- `public/_redirects`
- `functions/api/[[path]].js`
- `infra/cloudflare/wrangler.toml`
- `infra/cloudflare/src/service/internals/mural.js`
- `infra/cloudflare/src/lib/mural.js`
- `infra/cloudflare/src/core/router.js`
- `public/components/mural-integration.js`
- `tests/mural-ui-route-state.test.js`
- `tests/project-dashboard-route-state.test.js`

## Files created or modified

- `wrangler.toml`
- `public/_redirects`
- `tests/pages-config-mural-return-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/06/pages-config-mural-return.md`
- `docs/agent-audit/reasoning/2026/06/06/pages-config-mural-return.json`

## Decisions

- Added `NODE_VERSION = "20"` under `[vars]` in the root Pages `wrangler.toml`, because Cloudflare Pages reported that build environment variables are sourced from the root Wrangler configuration.
- Removed the invalid absolute `/api/*` proxy rule from `public/_redirects`, because Cloudflare rejects absolute 200 proxy redirects to external origins.
- Kept the Mural OAuth callback on the Worker via `MURAL_REDIRECT_URI`, because Mural must return the authorization code to the API Worker.
- Preserved the actual return-to-Pages protection by testing that `muralCallback` builds relative return paths against `env.PAGES_ORIGIN`.
- Added route-state coverage for the root Pages config, redirect contract, Worker Mural callback config, Worker Mural routes and callback return construction.

## Validation attempted

- Repository-local commands were not run in this environment.
- Added `tests/pages-config-mural-return-route-state.test.js` for CI to execute through the existing `npm test` path.
- The changed-file list was verified after edits and is scoped to Pages config, redirects, a route-state test and trace artefacts.

## Residual risks

- The Mural UI still uses the production Worker origin on `pages.dev` hosts unless an API-origin override is present. That behaviour was already present and is outside this small PR.
- Cloudflare Pages should be redeployed after merge to confirm that the build log reports Node 20 and no invalid redirect lines.
