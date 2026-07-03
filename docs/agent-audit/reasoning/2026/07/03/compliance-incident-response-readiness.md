# Compliance Incident Response Readiness

## Run metadata

- Date: 2026-07-03
- Branch: `feature/compliance-assurance-boundary`
- Base: existing PR #461 branch against `main`
- Trace decision: required because `feature/` branches require auditable traces for repository-affecting work.
- Task summary: add incident response runbooks, breach handling process and test-evidence structure to the SOC 2 and ISO/IEC 27001 readiness workstream.

## Operating model evidence

- Loaded `AGENTS.md`.
- Loaded `.agent-operating-model/orchestration.xml`.
- Loaded `.agent-operating-model/bundle-registry.json`.
- Loaded `.agent-operating-model/task-signal-catalog.json`.
- Loaded `.agent-operating-model/selection-rules.json`.
- Loaded `.agent-operating-model/bootstrap-checklist.md`.
- Loaded `.agent-operating-model/precedence-policy.md`.
- Loaded `.agent-operating-model/trace-policy.md`.
- Loaded `.agent-operating-model/github-mutation-policy.md`.
- Loaded the Obsidian skill instructions because the user requested an Obsidian practitioner voice.
- Verified selected bundle directories contain `prompt.spec.yaml` and `prompt.body.xml`.

## Bundle selection

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`

Skipped bundles:

- `cloudflare`, `openai-platform`, `mcp-agent-tooling`, `airtable-public-api` and `mural-public-api` were not loaded as implementation-control bundles because this change does not alter runtime, provider API or integration behaviour.

## External reference evidence

- Checked official ICO personal data breach reporting guidance.
- Checked official ICO reporting-process audit guidance.

## Precedence decisions

- GitHub Diamond governed branch hygiene, trace requirement, test evidence and PR readiness.
- ResearchOps Developer Control governed repository placement and ResearchOps service-boundary wording.
- Multi-Functional Team governed public-sector assurance, privacy, security, human accountability and non-claim wording.
- GOV.UK Design System governed the generated compliance readiness page content and route-state checks.
- Obsidian skill usage was applied as practitioner voice only; no Obsidian vault files were changed.

## Files read

- Existing compliance readiness evidence pack.
- Existing compliance readiness page data and route-state tests.
- Official ICO pages on personal data breach reporting and reporting processes.

## Files created

- `docs/compliance/soc2-iso27001-readiness/incident-response/README.md`
- `docs/compliance/soc2-iso27001-readiness/incident-response/incident-response-runbooks.md`
- `docs/compliance/soc2-iso27001-readiness/incident-response/personal-data-breach-handling.md`
- `docs/compliance/soc2-iso27001-readiness/incident-response/incident-response-test-evidence.md`
- `tests/compliance-incident-response-readiness.test.js`
- `docs/agent-audit/reasoning/2026/07/03/compliance-incident-response-readiness.md`
- `docs/agent-audit/reasoning/2026/07/03/compliance-incident-response-readiness.json`

## Files modified

- `docs/compliance/soc2-iso27001-readiness/evidence-index.md`
- `src/govuk/data/compliance-readiness.mjs`
- `public/pages/compliance-readiness/index.html`
- `tests/compliance-assurance-boundary.test.js`
- `tests/compliance-readiness-page-route-state.test.js`

## Implementation decisions

- Added a service-specific incident response readiness folder rather than a single bullet so the work has auditable artefacts.
- Added runbooks for PII exposure, unauthorised access, leaked integration secrets, data corruption or failed retention, supplier incidents and service availability incidents.
- Added a personal data breach handling process grounded in ICO guidance and routed through Home Office privacy, security and ownership roles.
- Added an incident exercise record that is explicitly planned and not yet completed test evidence.
- Marked the incident response control as partially evidenced on the readiness page.
- Kept completed tabletop or simulated incident evidence as the remaining gap.
- Added route-state and documentation tests to prevent unsupported claims that the incident response process has already been exercised.
- Presented the incident response runbooks, personal data breach handling process and incident exercise record as generated GOV.UK pages linked from `/pages/compliance-readiness/`.
- Kept the Markdown documents as the source of truth and added a GOV.UK evidence-document template plus a small Markdown-to-GOV.UK renderer for this readiness evidence.
- Registered the new pages in the visual walkthrough configuration and render workflow inputs so the generated routes remain covered when documentation changes.
- Replaced generated-page URL checks that used regular expressions with plain string checks after CodeQL flagged the URL-hostname regex shape.
- Updated the compliance readiness page H1, page metadata, generated HTML, route-state test and visual walkthrough title to `SOC 2 and ISO/IEC 27001 readiness documentation`.
- Updated the Markdown-to-GOV.UK renderer so indented bullet items nested under numbered Markdown steps render inside the parent `<li>` rather than as separate top-level lists.
- Regenerated the personal data breach handling page so the decision route is one ordered GOV.UK list with nested unordered GOV.UK lists under each step.
- Reframed the third incident response evidence artefact as `Incident response test evidence` and moved its generated public route from `/pages/compliance-readiness/incident-response/incident-exercise-record/` to `/pages/compliance-readiness/incident-response/test-evidence/`.
- Renamed the source document to `incident-response-test-evidence.md` so the source, route and visible page label all describe the planned test-evidence structure.
- Kept the evidence wording explicit that this is planned and not completed test evidence until a tabletop or simulated incident has been run and signed off.

## Validation evidence

- `npm run build:govuk-pages` passed and regenerated the compliance readiness page.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/compliance-incident-response-readiness.test.js tests/compliance-assurance-boundary.test.js tests/compliance-readiness-page-route-state.test.js` passed: 15 tests, 15 pass.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/compliance-readiness-page-route-state.test.js tests/compliance-incident-response-readiness.test.js tests/govuk-pages-render-workflow-state.test.js tests/visual-walkthrough-registry-coverage.test.js` passed: 14 tests, 14 pass.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/compliance-incident-response-readiness.test.js && npm run format:check` passed after the CodeQL assertion adjustment.
- `npm run build:govuk-pages && node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/compliance-readiness-page-route-state.test.js tests/visual-walkthrough-registry-coverage.test.js` passed after the heading wording correction.
- `npm run build:govuk-pages && node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/compliance-incident-response-readiness.test.js` passed after the nested-list rendering fix.
- Live preview probe confirmed the personal data breach handling decision route renders as a single ordered list with nested unordered lists.
- Live preview probe confirmed the compliance readiness page shows service-specific runbooks, personal data breach handling process and completed incident response test evidence as the remaining gap.
- `npm run build:govuk-pages` passed after reframing the third incident response artefact as test evidence and regenerating `/pages/compliance-readiness/incident-response/test-evidence/`.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/compliance-readiness-page-route-state.test.js tests/compliance-incident-response-readiness.test.js tests/visual-walkthrough-registry-coverage.test.js tests/govuk-pages-render-workflow-state.test.js` passed: 15 tests, 15 pass.
- Live preview probes confirmed `/pages/compliance-readiness/` links to `/pages/compliance-readiness/incident-response/test-evidence/` and the test evidence page states `Exercise status: planned, not yet completed`.
- `npm run format:check` passed.
- `npm run trace:coverage` passed and confirmed trace coverage for `feature/compliance-assurance-boundary`.
- `npm run validate` passed.

## Residual risks

- The incident response process still needs Home Office service owner, information asset owner, senior risk owner, security and privacy review.
- The first tabletop or simulated incident exercise has not yet been run.
- This branch still does not assert SOC 2 compliance or ISO/IEC 27001 certification.
