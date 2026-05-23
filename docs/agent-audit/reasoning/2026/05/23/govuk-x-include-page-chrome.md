# GOV.UK x-include page chrome trace

- Date: 2026-05-23
- Repository: `kevinrapley/ResearchOps`
- Pull request: #262
- Branch: `chore/govuk-frontend-integration`
- Branch trace decision: `chore/` branch, trace required.
- Task: Reinstate `x-include` for the GOV.UK Frontend header and footer on the representative spike pages, and move the GOV.UK Frontend header/footer markup into the shared partials.

## Operating-model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`

## Bundles selected

- `github-diamond` from `.agent-operating-model/bundles/github/`
- `researchops-developer-control` from `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` from `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` from `.agent-operating-model/bundles/govuk-design-system/`

## Bundles skipped

- `cloudflare`
- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

## Signals

- `repository-affecting-task`
- `government-product-assurance-default`
- `ui-or-content-change`

## Files read

- `docs/design-system/govuk-compliance-audit.md`
- `docs/spikes/govuk-frontend-integration.md`
- `public/partials/header.html`
- `public/partials/footer.html`
- `public/components/layout.js`
- `public/js/govuk-frontend-init.js`
- `src/govuk/templates/layouts/researchops.njk`
- `src/govuk/templates/pages/home.njk`
- `src/govuk/templates/pages/account.njk`
- `src/govuk/templates/pages/start-overview.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `tests/govuk-frontend-integration-route-state.test.js`

## Implementation decisions

The generated GOV.UK spike pages now use shared page chrome through `x-include` rather than hardcoding the GOV.UK header and footer in each representative page.

A GOV.UK-specific include loader was added at `public/components/govuk-layout.js` so the representative pages can use `x-include` without loading the older shared include script that injects the legacy `/css/govuk/govuk-frontend-v6.css` clone stylesheet.

The GOV.UK header, service navigation and phase banner were centralised in `public/partials/header.html`.

The GOV.UK footer was centralised in `public/partials/footer.html`.

The source Nunjucks layout now uses the shared partials, so `build:govuk-pages` preserves the x-include contract.

## Files created or modified

- `public/components/govuk-layout.js`
- `public/partials/header.html`
- `public/partials/footer.html`
- `src/govuk/templates/layouts/researchops.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `public/index.html`
- `public/pages/account/index.html`
- `public/pages/start/overview/index.html`
- `tests/govuk-frontend-integration-route-state.test.js`
- `docs/agent-audit/reasoning/2026/05/23/govuk-x-include-page-chrome.md`
- `docs/agent-audit/reasoning/2026/05/23/govuk-x-include-page-chrome.json`

## Validation attempted

No local automated validation was run in this environment.

The route-state test was updated to assert the new contract:

- representative pages load `/components/govuk-layout.js`
- representative pages include `/partials/header.html` and `/partials/footer.html`
- representative pages do not hardcode `<header class="govuk-header">` or `<footer class="govuk-footer">`
- the GOV.UK-specific loader does not reference `govuk-frontend-v6.css`

## Residual risks

The footer partial is centralised using GOV.UK footer classes and structure, but it is not byte-for-byte macro output from `govukFooter`. Browser validation should confirm the visual output after `x-include` render and GOV.UK Frontend initialisation.

Automated validation should be run before promoting the draft PR.
