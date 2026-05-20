# GOV.UK mobile system styles trace

- Branch: `fix/govuk-mobile-system-styles`
- Task: Replace the discarded account-page-only mobile styling approach with global GOV.UK Design System aligned mobile styling.
- Branch trace decision: `fix/` branch, trace required.

## Operating model files loaded

- `README.md`
- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/references/govuk-design-system-reference.xml`
- `.agent-operating-model/bundles/govuk-design-system/references/govuk-components-reference.xml`

## Selected bundles

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`
- `govuk-design-system`

## Rejected approach

PR #260 is closed and superseded.

The rejected approach added an account-page-specific mobile stylesheet and page-specific class hooks. That was inconsistent with the operating model because the problem was shared GOV.UK page chrome and responsive behaviour, not a single account-page component issue.

## GOV.UK specialist view

Use the existing GOV.UK-aligned stylesheet ownership model. Do not create a separate mobile-only stylesheet.

Shared mobile page chrome belongs in `public/css/govuk/govuk-page-chrome.css`. Shared responsive typography belongs in `public/css/govuk/govuk-typography.css`. Header brand alignment belongs in `public/css/govuk/govuk-header-service-brand.css`.

## Interaction designer view

The mobile interaction pattern should preserve GOV.UK service navigation behaviour:

- no custom boxed menu button
- a link-like `Menu` toggle with GOV.UK focus treatment
- collapsed navigation controlled by the existing service navigation script
- active state visible in the mobile list
- full-width content container rhythm across all pages that use the shared header

## Graphic designer view

The mobile page should feel like GOV.UK rather than an inset desktop prototype:

- remove the mobile body frame caused by the global body margin
- keep the GOV.UK logotype visible and unclipped
- keep the ResearchOps product name on one line on normal mobile widths
- use GOV.UK mobile heading scale and vertical rhythm
- align the footer to the same mobile column as the page content

## Implementation summary

- Updated `public/css/govuk/govuk-page-chrome.css` with mobile-only media-query refinements.
- Updated `public/css/govuk/govuk-header-service-brand.css` with mobile-only brand alignment that preserves the GOV.UK logotype and keeps the product name on one line.
- Updated `public/css/govuk/govuk-typography.css` with GOV.UK-style mobile heading and lead-body scale.
- Added `tests/govuk-mobile-page-chrome-route-state.test.js` to prevent reintroducing account-page mobile stylesheets or boxed mobile menu styling.

## Non-goals

- No account-page-specific stylesheet.
- No account-page-specific class hooks.
- No separate mobile stylesheet.
- No changes to page templates solely to improve one screenshot.

## Validation

Local validation was not executed in this ChatGPT environment. CI should run formatting, node tests, accessibility and release validation.
