# Compliance Privacy Data Protection Readiness

## Run metadata

- Date: 2026-07-03
- Branch: `feature/compliance-assurance-boundary`
- Base: existing PR #461 branch against `main`
- Trace decision: required because `feature/` branches require auditable traces for repository-affecting work.
- Task summary: add DPIA, data map, records of processing and lawful-basis readiness documentation to the SOC 2 and ISO/IEC 27001 readiness workstream.

## Operating model evidence

- Loaded `AGENTS.md`.
- Loaded `.agent-operating-model/orchestration.xml`.
- Loaded `.agent-operating-model/bundle-registry.json`.
- Loaded `.agent-operating-model/task-signal-catalog.json`.
- Loaded `.agent-operating-model/selection-rules.json`.
- Loaded `.agent-operating-model/bootstrap-checklist.md`.
- Loaded `.agent-operating-model/precedence-policy.md`.
- Loaded `.agent-operating-model/trace-policy.md`.
- Loaded `.agent-operating-model/trace-layers.md`.
- Loaded `.agent-operating-model/github-mutation-policy.md`.
- Verified selected bundle directories contain `prompt.spec.yaml` and `prompt.body.xml`.

## Bundle selection

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`

Skipped bundles:

- `cloudflare`, `openai-platform`, `mcp-agent-tooling`, `airtable-public-api` and `mural-public-api` were not loaded as implementation-control bundles because this change does not alter runtime, provider API or integration behaviour.

## Precedence decisions

- GitHub Diamond governed branch hygiene, trace requirement, generated-output coverage, changed-file plausibility and PR readiness.
- ResearchOps Developer Control governed repository placement, service-boundary wording and ResearchOps-specific privacy evidence.
- Multi-Functional Team governed public-sector privacy, legal, security, human accountability and non-claim wording.
- GOV.UK Design System governed the generated compliance readiness page content, warning text and route-state checks.

## Files read

- Existing compliance readiness data, templates, generated pages and route-state tests.
- Existing SOC 2 and ISO/IEC 27001 readiness evidence pack.
- Existing incident response and supplier assurance evidence page patterns.
- GOV.UK render workflow and generated-page route tests.

## Files created

- `docs/compliance/soc2-iso27001-readiness/privacy-and-data-protection/README.md`
- `docs/compliance/soc2-iso27001-readiness/privacy-and-data-protection/dpia-data-map-ropa-lawful-basis.md`
- `public/pages/compliance-readiness/privacy-and-data-protection/dpia-data-map-ropa-lawful-basis/index.html`
- `docs/agent-audit/reasoning/2026/07/03/compliance-privacy-data-protection-readiness.md`
- `docs/agent-audit/reasoning/2026/07/03/compliance-privacy-data-protection-readiness.json`

## Files modified

- `.github/workflows/render-govuk-pages.yml`
- `docs/compliance/soc2-iso27001-readiness/README.md`
- `docs/compliance/soc2-iso27001-readiness/evidence-index.md`
- `public/pages/compliance-readiness/index.html`
- `src/govuk/data/compliance-readiness.mjs`
- `src/govuk/templates/pages/compliance-readiness.njk`
- `tests/compliance-assurance-boundary.test.js`
- `tests/compliance-readiness-page-route-state.test.js`
- `tests/govuk-pages-render-workflow-state.test.js`

## Implementation decisions

- Added a privacy and data protection evidence folder rather than changing only the remaining-gap bullet.
- Added a visible GOV.UK evidence page linked from `/pages/compliance-readiness/`.
- Defined the draft DPIA screening triggers, data map, ROPA fields and lawful-basis decisions that need Home Office confirmation.
- Marked DPIA and GDPR records as partially evidenced, not complete.
- Kept DPIA screening approval, ROPA reference, lawful basis, data sharing, processor/subprocessor positions, retention rules and special-category handling as remaining gaps.
- Updated the GOV.UK render workflow path filters so privacy-and-data-protection Markdown changes trigger regenerated static pages.
- Added route-state and evidence-pack tests to prevent unsupported claims that the DPIA, ROPA or lawful-basis position is approved.

## Validation evidence

- `npm run build:govuk-pages` passed and generated `/pages/compliance-readiness/privacy-and-data-protection/dpia-data-map-ropa-lawful-basis/`.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/compliance-assurance-boundary.test.js tests/compliance-readiness-page-route-state.test.js tests/govuk-pages-render-workflow-state.test.js tests/visual-walkthrough-registry-coverage.test.js` passed: 19 tests, 19 pass.
- Rendered-page probe confirmed `/pages/compliance-readiness/` links to `/pages/compliance-readiness/privacy-and-data-protection/dpia-data-map-ropa-lawful-basis/`.
- Rendered-page probe confirmed the privacy evidence page states that the DPIA, ROPA, data map and lawful-basis position are readiness evidence, not approved evidence.
- `npm run lint` passed with existing warnings only.
- `npm run format:check` passed.
- `npm run trace:coverage` passed and confirmed trace coverage for `feature/compliance-assurance-boundary`.
- `npm run validate` passed.

## Residual risks

- The DPIA screening decision still needs the authorised Home Office privacy route.
- The ROPA entry, lawful-basis decisions, data map owner, data-sharing positions, processor/subprocessor positions and retention rules still need formal approval.
- This branch still does not assert SOC 2 compliance, ISO/IEC 27001 certification, DPIA approval, ROPA completion or GDPR compliance.
