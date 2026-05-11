# Validation Report — GOV.UK Design System Bundle v1.0.0

Validation status: passed.

Last checked: 2026-05-11.

## Scope

This bundle governs GOV.UK Design System use, frontend component decisions, service content, accessibility, page composition, forms and interaction behaviour.

It applies when UI, content, frontend accessibility or GOV.UK pattern decisions are in scope.

## Entrypoints checked

Checked entrypoints:

- `README.md`
- `CHANGELOG.md`
- `prompt.spec.yaml`
- `prompt.body.xml`
- `evals.yaml`
- `tests.regression.yaml`
- `tests.redteam.yaml`
- `variables.schema.json`
- `output.schema.json`
- `grade.schema.json`
- `registry-manifest.yaml`

## Structural checks

The bundle has canonical prompt, spec, schema, regression, red-team and registry assets.

It is referenced by the operating-model registry and selected by UI, GOV.UK, content, form, component, HTML, CSS and accessibility task signals.

The repository also contains GOV.UK route-state tests and migration documentation that support practical application of the bundle.

## Evaluation coverage

Regression and red-team test assets are present.

Repository-level validation already checks GOV.UK component, form, table, summary-list, page-chrome, navigation, breadcrumb and back-link route-state contracts.

## Known gaps

This validation report does not attempt to exhaustively cross-check every Design System component page against the upstream GOV.UK Design System.

Future work should add source-catalog validation for GOV.UK Design System URLs if this bundle is expanded further.

## Result

The bundle is suitable for current ResearchOps GOV.UK frontend and accessibility work.
