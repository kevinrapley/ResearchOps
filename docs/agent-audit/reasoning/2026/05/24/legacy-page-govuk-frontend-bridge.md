# Legacy page GOV.UK Frontend bridge

- Date: 2026-05-24
- Repository: kevinrapley/ResearchOps
- Pull request: #262
- Branch: chore/govuk-frontend-integration
- Branch trace decision: trace required.

## Task

Address the broader preview defect where registered pages that still use the legacy committed shell were not receiving the generated GOV.UK Frontend CSS in the Cloudflare Pages preview.

## Evidence used

Preview screenshots showed that pages beyond account sign-in were affected. The project journals page displayed raw skip-link, list navigation and unstyled GOV.UK components.

The committed project journals page still used the legacy HTML shell, legacy GOV.UK clone stylesheets and no generated GOV.UK Frontend stylesheet. The route is registered in the visual walkthrough registry, but the Cloudflare Pages preview publishes the committed public directory rather than running the build normaliser before deploy.

## Decision

Do not add a new hidden edge or runtime normalisation layer.

Use a deployed-source bridge for legacy registered pages: make the existing legacy typography entry point import the generated GOV.UK Frontend stylesheet first. This gives stale committed pages the real GOV.UK Frontend base while the full route-by-route template migration continues.

## Changes made

- Updated public/css/govuk/govuk-typography.css to import /assets/govuk/govuk-frontend.css before its local compatibility rules.
- Updated tests/deploy-asset-paths.test.js to guard that the legacy typography entry point keeps loading the generated GOV.UK Frontend stylesheet.

## Files modified

- public/css/govuk/govuk-typography.css
- tests/deploy-asset-paths.test.js

## Validation evidence

On head 701de271b78035cf4ca24be680a772fa0fbe5c2c, these workflows passed: CI, Validate ResearchOps, Accessibility audit, qa-bdd, Release Gate, Format pull request, QA broken links, agent documentation Pages and bundle registry.

## Residual risk

This is a bridge, not the final architecture. Registered pages still committed with legacy shells should continue to be migrated onto the explicit GOV.UK Frontend template contract route by route. The preview should be visually rechecked after the latest Cloudflare Pages deployment completes.
