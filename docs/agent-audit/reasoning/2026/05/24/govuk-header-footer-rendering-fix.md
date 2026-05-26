# GOV.UK header and footer rendering fix

- Date: 2026-05-24
- Repository: `kevinrapley/ResearchOps`
- Pull request: #262
- Branch: `chore/govuk-frontend-integration`
- Branch trace decision: `chore/` branch, trace required.
- Task: Fix preview rendering defects in the shared GOV.UK header wordmark and shared GOV.UK footer containment.

## Operating-model files loaded

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`

## Bundles selected

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`
- `govuk-design-system`

## User evidence

The preview screenshots showed that the header GOV.UK SVG wordmark was not rendering correctly. They also showed the shared footer behaving correctly on the account sign-in page but escaping the intended layout on other pages.

## Implementation decisions

- Replaced the brittle header SVG text wordmark with a shared header structure using a crown SVG and plain `GOV.UK` wordmark text.
- Kept the service name as `ResearchOps Demo Suite` in `govuk-header__product-name`.
- Added a single accessible label to the service home link: `GOV.UK ResearchOps Demo Suite home`.
- Removed the old `word-spacing: -6px` wordmark workaround from the header support stylesheet.
- Added explicit support styles for `researchops-header__logotype`, `researchops-header__crown`, and `researchops-header__wordmark`.
- Added `govuk-width-container` to the shared footer container so the footer is constrained consistently across pages.
- Updated route-state tests to prevent regression to SVG `<text>GOV.UK</text>` and to require `govuk-width-container govuk-footer__container`.

## Files modified

- `public/partials/header.html`
- `public/partials/footer.html`
- `public/css/govuk/govuk-header-service-brand.css`
- `tests/govuk-frontend-integration-route-state.test.js`
- `tests/govuk-page-chrome-navigation-route-state.test.js`

## Validation evidence

On head `985092bde5bcbf43a5527e9cb752429e314f3956`, the following workflows passed:

- `CI`
- `Validate ResearchOps`
- `Accessibility audit (pa11y-ci)`
- `qa-bdd`
- `Release Gate`
- `Format pull request`
- `QA — Broken links (Lychee)`
- `Build and deploy agent documentation Pages`
- `Update GitHub bundle registry manifest`

## Residual risk

The preview should be visually rechecked after the latest Cloudflare Pages deployment completes. The local and CI route-state checks confirm the shared partial contract, but they do not replace a final browser check against the deployed preview.
