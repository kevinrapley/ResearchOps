# Compliance Availability Monitoring Readiness

## Run metadata

- Date: 2026-07-03
- Branch: `feature/compliance-assurance-boundary`
- Base: existing PR #461 branch against `main`
- Trace decision: required because `feature/` branches require auditable traces for repository-affecting work.
- Task summary: add backup, restore, availability and monitoring readiness evidence to the SOC 2 and ISO/IEC 27001 readiness workstream.

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
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`

Skipped bundles:

- `openai-platform`, `mcp-agent-tooling`, `airtable-public-api` and `mural-public-api` were not loaded as implementation-control bundles because this change does not alter AI, MCP, Airtable or Mural runtime/API behaviour.

## Cloudflare reference evidence

- Loaded `.agent-operating-model/bundles/cloudflare/references/storage-and-state.xml`.
- Loaded `.agent-operating-model/bundles/cloudflare/references/pages-and-deployment.xml`.
- Loaded `.agent-operating-model/bundles/cloudflare/references/testing-and-observability.xml`.
- Loaded `.agent-operating-model/bundles/cloudflare/references/deployment-versions-and-triggers.xml`.

## Precedence decisions

- GitHub Diamond governed branch hygiene, trace requirement, generated-output coverage, changed-file plausibility and PR readiness.
- ResearchOps Developer Control governed repository placement, service-boundary wording and ResearchOps-specific evidence.
- Multi-Functional Team governed public-sector service-owner, security, operations and human-accountability framing.
- GOV.UK Design System governed the generated compliance readiness page content and route-state checks.
- Cloudflare governed Cloudflare deployment, storage, observability, testing and deployment-evidence wording. The evidence avoids claiming production validation, backup completion or restore success without runtime evidence.

## Files read

- Existing compliance readiness data, templates, generated pages and route-state tests.
- Existing SOC 2 and ISO/IEC 27001 readiness evidence pack.
- Existing incident response, supplier assurance and privacy evidence page patterns.
- `wrangler.toml`
- `infra/cloudflare/wrangler.toml`
- `.github/workflows/deploy-worker.yml`
- `release-evidence.yaml`
- GOV.UK render workflow and generated-page route tests.

## Files created

- `docs/compliance/soc2-iso27001-readiness/availability-and-monitoring/README.md`
- `docs/compliance/soc2-iso27001-readiness/availability-and-monitoring/backup-restore-availability-monitoring.md`
- `public/pages/compliance-readiness/availability-and-monitoring/backup-restore-availability-monitoring/index.html`
- `docs/agent-audit/reasoning/2026/07/03/compliance-availability-monitoring-readiness.md`
- `docs/agent-audit/reasoning/2026/07/03/compliance-availability-monitoring-readiness.json`

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

- Added an availability and monitoring evidence folder rather than only changing the remaining-gap bullet.
- Added a visible GOV.UK evidence page linked from `/pages/compliance-readiness/`.
- Recorded current evidence for Cloudflare Pages output, Worker configuration, D1, KV, observability logs, scheduled retention, deployment workflows, validation gates and release evidence.
- Marked business continuity and availability as partially evidenced, not complete.
- Kept availability scope, SLOs, RTO/RPO, backup schedule, restore tests, monitoring thresholds and operations sign-off as remaining gaps.
- Updated the GOV.UK render workflow path filters so availability-and-monitoring Markdown changes trigger regenerated static pages.
- Added route-state and evidence-pack tests to prevent unsupported claims that restore testing, availability approval or monitoring assurance is complete.

## Validation evidence

- `npm run build:govuk-pages` passed and generated `/pages/compliance-readiness/availability-and-monitoring/backup-restore-availability-monitoring/`.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/compliance-assurance-boundary.test.js tests/compliance-readiness-page-route-state.test.js tests/govuk-pages-render-workflow-state.test.js tests/visual-walkthrough-registry-coverage.test.js` passed: 21 tests, 21 pass.
- Rendered-page probe confirmed `/pages/compliance-readiness/` links to `/pages/compliance-readiness/availability-and-monitoring/backup-restore-availability-monitoring/`.
- Rendered-page probe confirmed the evidence page states that backups, restore testing, availability commitments and monitoring are readiness evidence, not approved evidence.
- `npm run format:check` passed.
- `npm run lint` passed with existing warnings and no errors.
- `npm run trace:coverage` passed for `feature/compliance-assurance-boundary`.
- `npm run validate` passed, including generated GOV.UK pages, operating-model validation, trace coverage, route-state checks and repository validation.

## Residual risks

- The service owner still needs to decide whether Availability is in SOC 2 scope.
- SLOs, RTO/RPO, backup schedule, restore tests, log retention, alert thresholds, escalation routes and monitoring review cadence still need formal approval.
- This branch still does not assert SOC 2 compliance, ISO/IEC 27001 certification, completed disaster recovery, completed restore testing or approved monitoring assurance.
