# Domain brand routing

## Task summary

Move ResearchOps brand selection from a late query-string switch to a production-safe hostname model: `research-operations.com` serves the Home Office brand and `govuk.research-operations.com` serves the GOV.UK brand, avoiding a GOV.UK blue flash during page navigation.

## Run metadata

- Date: 2026-06-16
- Branch: `feature/domain-brand-routing`
- Trace required: yes, because `feature/` branches require an auditable trace.
- Repository: `kevinrapley/ResearchOps`

## Operating model loaded

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

## Bundles selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`

## Bundles skipped

- `.agent-operating-model/bundles/openai/`: no OpenAI API, model or AI route behaviour changed.
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP protocol or agent tooling changed.
- `.agent-operating-model/bundles/airtable-public-api/`: no Airtable API behaviour changed.
- `.agent-operating-model/bundles/mural-public-api/`: no Mural API behaviour changed.

## Precedence decisions

- GitHub Diamond governed branch naming, trace requirement, surgical mutation, changed-file review and validation evidence.
- ResearchOps Developer Control governed the existing Pages advanced Worker, static asset response wrapper and route-state test style.
- Multi-Functional Team governed public-sector service assurance and user-impact framing for production branding.
- GOV.UK Design System governed preservation of GOV.UK as a valid service brand and use of existing GOV.UK page chrome.
- Cloudflare governed the hostname-based Pages Worker implementation and response-header behaviour.

## Files read

- `README.md`
- `RECENT_LEARNINGS.md`
- `public/_worker.js`
- `public/js/brand-variant.js`
- `public/partials/header.html`
- `public/partials/html-head.html`
- `src/govuk/templates/layouts/researchops.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `tests/brand-variant-route-state.test.js`
- `tests/pages-advanced-worker-auth-route-state.test.js`
- `tests/govuk-page-chrome-navigation-route-state.test.js`
- `tests/auth-sign-in-route-state.test.js`

## Files created or modified

- `public/_worker.js`
- `public/js/brand-variant.js`
- `tests/pages-advanced-worker-auth-route-state.test.js`
- `tests/brand-variant-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/16/domain-brand-routing.md`
- `docs/agent-audit/reasoning/2026/06/16/domain-brand-routing.json`

## Decisions

- Added a hostname brand map to the Pages advanced Worker: `research-operations.com` and `www.research-operations.com` resolve to `home-office`; `govuk.research-operations.com` resolves to `govuk`.
- Kept `?brand=home-office` and `?brand=govuk` for non-production testing, but made known production hostnames authoritative so query strings and stored browser preferences cannot override them.
- Injected `data-researchops-brand`, a `researchops-brand` meta tag and Home Office brand styles into HTML responses before they reach the browser.
- Preserved the existing no-store HTML cache policy in `public/_worker.js`.
- Added route-state tests for the production apex host, the GOV.UK production subdomain and non-production query-string testing.

## Validation attempted

- `node --test tests/pages-advanced-worker-auth-route-state.test.js tests/brand-variant-route-state.test.js` passed.
- `npx prettier -c public/_worker.js public/js/brand-variant.js tests/pages-advanced-worker-auth-route-state.test.js tests/brand-variant-route-state.test.js` passed.

## Existing local changes

- The working tree already had edits in `infra/cloudflare/src/core/auth/passwordless.js`, `public/_worker.js` and `tests/pages-advanced-worker-auth-route-state.test.js` before this task started.
- The brand-routing work preserves and builds on the existing static HTML cache change in `public/_worker.js` and its route-state coverage.

## Residual risks

- Full `npm test` and `npm run validate` were not run during this pass.
- Production verification still needs a Cloudflare Pages deployment so the two custom hostnames can be checked against the live response headers and first paint.
