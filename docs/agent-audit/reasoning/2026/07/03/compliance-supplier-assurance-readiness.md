# Compliance Supplier Assurance Readiness

## Run metadata

- Date: 2026-07-03
- Branch: `feature/compliance-assurance-boundary`
- Base: existing PR #461 branch against `main`
- Trace decision: required because `feature/` branches require auditable traces for repository-affecting work.
- Task summary: add supplier assurance readiness evidence for Cloudflare, GitHub, Airtable, Mural, email provider and any AI services.

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
- `openai-platform` at `.agent-operating-model/bundles/openai/`
- `airtable-public-api` at `.agent-operating-model/bundles/airtable-public-api/`
- `mural-public-api` at `.agent-operating-model/bundles/mural-public-api/`

Skipped bundles:

- `mcp-agent-tooling` was not loaded as an implementation-control bundle because this change does not alter MCP protocol, tool contracts or agent-tooling runtime behaviour.

## Precedence decisions

- GitHub Diamond governed branch hygiene, trace requirement, generated-output coverage, changed-file plausibility and PR readiness.
- ResearchOps Developer Control governed repository placement, service-boundary wording and ResearchOps-specific integration evidence.
- Multi-Functional Team governed public-sector assurance, privacy, security, human accountability and non-claim wording.
- GOV.UK Design System governed the generated compliance readiness page content and evidence-page presentation.
- Cloudflare governed Cloudflare supplier/runtime references and the distinction between Cloudflare platform hosting and Workers AI usage.
- OpenAI Platform governed the boundary language for possible future external AI providers without asserting any OpenAI production integration.
- Airtable Public API governed Airtable as an integration dependency without expanding into implementation changes.
- Mural Public API governed Mural as a collaboration/OAuth integration dependency without expanding into implementation changes.

## Files read

- Existing compliance readiness data, templates, generated pages and route-state tests.
- Existing SOC 2 and ISO/IEC 27001 readiness evidence pack.
- Existing incident response evidence page pattern.
- `infra/cloudflare/src/core/auth/passwordless.js` to confirm the Resend sign-in email route.
- `infra/cloudflare/src/service/comms.js` to confirm the general communications provider is still a stub.
- `infra/cloudflare/src/service/ai-rewrite.js` to confirm the current AI dependency is Cloudflare Workers AI when configured.

## Files created

- `docs/compliance/soc2-iso27001-readiness/supplier-assurance/README.md`
- `docs/compliance/soc2-iso27001-readiness/supplier-assurance/supplier-assurance-register.md`
- `public/pages/compliance-readiness/supplier-assurance/register/index.html`
- `docs/agent-audit/reasoning/2026/07/03/compliance-supplier-assurance-readiness.md`
- `docs/agent-audit/reasoning/2026/07/03/compliance-supplier-assurance-readiness.json`

## Files modified

- `.github/workflows/render-govuk-pages.yml`
- `docs/compliance/soc2-iso27001-readiness/README.md`
- `docs/compliance/soc2-iso27001-readiness/evidence-index.md`
- `public/pages/compliance-readiness/index.html`
- `scripts/govuk/render-govuk-pages.mjs`
- `src/govuk/data/compliance-readiness.mjs`
- `src/govuk/templates/pages/compliance-evidence-document.njk`
- `src/govuk/templates/pages/compliance-readiness.njk`
- `tests/compliance-assurance-boundary.test.js`
- `tests/compliance-readiness-page-route-state.test.js`
- `tests/govuk-pages-render-workflow-state.test.js`
- `visual-walkthrough.config.mjs`

## Implementation decisions

- Added a supplier-assurance evidence folder rather than a single bullet so the work has an auditable source artefact.
- Added a visible GOV.UK supplier assurance register page linked from `/pages/compliance-readiness/`.
- Included Cloudflare, GitHub, Airtable, Mural, Resend, future communications provider, Cloudflare Workers AI and any future OpenAI or external AI provider.
- Marked supplier assurance as partially evidenced, not complete.
- Kept supplier approval, contract review, data-processing terms, locations, assurance evidence, review cadence and sign-off as the remaining gap.
- Generalised the compliance evidence page renderer so incident response and supplier assurance evidence pages share the same Nunjucks template, warning-text pattern and visual registry coverage.
- Updated the GOV.UK render workflow path filters so supplier-assurance Markdown changes trigger regenerated static pages.

## Validation evidence

- `npm run build:govuk-pages` passed and generated `/pages/compliance-readiness/supplier-assurance/register/`.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/compliance-assurance-boundary.test.js tests/compliance-readiness-page-route-state.test.js tests/compliance-incident-response-readiness.test.js tests/govuk-pages-render-workflow-state.test.js tests/visual-walkthrough-registry-coverage.test.js` passed: 23 tests, 23 pass.
- Live preview probe confirmed `/pages/compliance-readiness/` links to `/pages/compliance-readiness/supplier-assurance/register/`.
- Live preview probe confirmed the supplier assurance register page names Cloudflare, GitHub, Airtable, Mural, Resend, Cloudflare Workers AI and future external AI providers while keeping the register marked draft and not approved.

## Residual risks

- The supplier register still needs named owners, evidence references, review dates and formal approval decisions.
- Contract, data-processing, location, subprocessor, assurance-report and incident-notification evidence still needs review by Home Office service-owner, commercial, privacy and security roles.
- This branch still does not assert SOC 2 compliance or ISO/IEC 27001 certification.
