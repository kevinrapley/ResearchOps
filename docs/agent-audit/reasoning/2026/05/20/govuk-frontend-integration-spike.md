# GOV.UK Frontend integration spike trace

- Branch: `chore/govuk-frontend-integration`
- Task: Convert PR #261 to draft and create a spike branch for proper GOV.UK Frontend integration.
- Branch trace decision: `chore/` branch, trace required.

## Decision

PR #261 has been converted to draft and retained as evidence.

A new spike branch has been created from `main` to explore official GOV.UK Frontend integration rather than continuing to patch the custom GOV.UK imitation layer.

## Files added

- `docs/spikes/govuk-frontend-integration.md`

## Rationale

The existing styling route uses GOV.UK-like class names and custom stylesheets. It does not use GOV.UK Frontend as the source of truth for CSS, JavaScript, assets or Nunjucks components.

The spike will assess an official integration path using the npm package, Dart Sass, generated public assets, GOV.UK Frontend JavaScript initialisation and Nunjucks exploration.

## Next step

Create a draft PR for the spike branch and use it to scope dependency, build and representative-page proof work.
