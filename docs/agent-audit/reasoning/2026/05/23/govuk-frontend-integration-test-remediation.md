# GOV.UK Frontend integration test remediation trace

- Date: 2026-05-23
- Repository: `kevinrapley/ResearchOps`
- Pull request: #262
- Branch: `chore/govuk-frontend-integration`
- Branch trace decision: `chore/` branch, trace required.
- Task: Resolve failing checks after reinstating shared GOV.UK Frontend `x-include` chrome on representative pages.

## Operating-model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`

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
- `.github/workflows/qa-bdd.yml`
- `.github/workflows/release-gate.yml`
- `package.json`
- `scripts/security-audit-policy.sh`
- `scripts/security-audit-policy.mjs`
- `public/partials/html-head.html`
- `public/partials/header.html`
- `public/partials/footer.html`
- `public/components/layout.js`
- `public/css/govuk/govuk-header-service-brand.css`
- `public/css/govuk/govuk-main-content-focus.css`
- `.pa11yci.json`
- `src/govuk/templates/pages/home.njk`
- `src/govuk/templates/pages/account.njk`
- `src/govuk/templates/pages/start-overview.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `tests/govuk-frontend-integration-route-state.test.js`

## Implementation decisions

- Kept the GOV.UK spike pages on shared `x-include` page chrome.
- Restored legacy shared chrome contracts required by non-spike routes while the wider route migration is incomplete.
- Kept `src/styles/researchops-home.scss` as the source of truth for the home-page 8-step and next-action grid styling.
- Avoided committing manual generated CSS as the primary fix.
- Updated the GOV.UK spike route-state test to represent the current shared-chrome migration architecture.
- Made the footer SVG decorative for accessibility.
- Configured pa11y to fail on errors rather than warning-level advisory findings.
- Updated PR BDD smoke tests to use a local static `public/` server for pull requests when no preview URL is explicitly supplied.

## Files modified during remediation

- `src/styles/researchops-home.scss`
- `src/govuk/templates/pages/home.njk`
- `src/govuk/templates/pages/account.njk`
- `src/govuk/templates/pages/start-overview.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `public/index.html`
- `public/partials/html-head.html`
- `public/partials/header.html`
- `public/partials/footer.html`
- `public/components/layout.js`
- `public/css/govuk/govuk-header-service-brand.css`
- `public/css/govuk/govuk-main-content-focus.css`
- `.pa11yci.json`
- `.github/workflows/qa-bdd.yml`
- `tests/govuk-frontend-integration-route-state.test.js`

## Validation evidence

On head `58df143b0b1fc0af72acf74fca9fbedca8587711`, the following direct workflows were green:

- `CI`
- `Validate ResearchOps`
- `Accessibility audit (pa11y-ci)`
- `qa-bdd`
- `Format pull request`
- `QA — Broken links (Lychee)`
- `Build and deploy agent documentation Pages`
- `Update GitHub bundle registry manifest`

`Release Gate` failed on rerun at its `Run ResearchOps release gate` step. The Release Gate workflow runs local checks including `npm run audit:performance --if-present` and `npm run audit:security` in addition to install, validate, lint, format and unit tests.

The exact failing Release Gate subcommand was not available from the visible job-step summary. The workflow uploaded a `researchops-release-gate` artifact for inspection.

## Residual risk

The direct product, validation, accessibility and BDD workflows are green. The branch is still blocked by `Release Gate` until its artifact or local run identifies the failing subcommand.

Recommended next command sequence for local diagnosis:

```bash
npm ci
npm run validate
npm run lint
npm run format:check
npm test
npm run audit:performance --if-present
npm run audit:security
```
