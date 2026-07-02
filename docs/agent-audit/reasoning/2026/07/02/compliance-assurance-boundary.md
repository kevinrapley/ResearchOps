# Compliance Assurance Boundary

## Run metadata

- Date: 2026-07-02
- Branch: `feature/compliance-assurance-boundary`
- Base: `origin/main` after PR #460 merge commit `cd3a335d06f3ac36c9fde70e369f98040c6bd192`
- Trace decision: required because `feature/` branches require auditable traces for repository-affecting work.
- Task summary: define the compliance scope and system boundary as part of a broader SOC 2 and ISO/IEC 27001 readiness workstream.

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
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`
- `openai-platform` at `.agent-operating-model/bundles/openai/`
- `mcp-agent-tooling` at `.agent-operating-model/bundles/mcp-agent-tooling/`
- `airtable-public-api` at `.agent-operating-model/bundles/airtable-public-api/`
- `mural-public-api` at `.agent-operating-model/bundles/mural-public-api/`

Skipped bundle:

- `govuk-design-system`, because this change adds assurance documentation and tests rather than changing user-facing GOV.UK UI or interaction patterns.

## Precedence decisions

- GitHub Diamond governed branch naming, trace requirement, PR readiness and validation evidence.
- ResearchOps Developer Control governed service boundary, integration ownership and repository placement.
- Multi-Functional Team governed public-sector assurance, privacy, risk, human accountability and non-claim wording.
- Cloudflare, OpenAI, MCP, Airtable and Mural bundles informed the supplier and integration boundary without changing API contracts or runtime behaviour.

## Files read

- Existing operating-model files and selected bundle prompt files.
- `package.json`
- Existing hardening trace for PR #460: `docs/agent-audit/reasoning/2026/07/02/security-hardening-main.md`
- Existing route-state and trace tests used as style references.

## Files created

- `docs/compliance/soc2-iso27001-readiness/README.md`
- `docs/compliance/soc2-iso27001-readiness/scope-and-system-boundary.md`
- `docs/compliance/soc2-iso27001-readiness/evidence-index.md`
- `tests/compliance-assurance-boundary.test.js`
- `docs/agent-audit/reasoning/2026/07/02/compliance-assurance-boundary.md`
- `docs/agent-audit/reasoning/2026/07/02/compliance-assurance-boundary.json`

## Implementation decisions

- Created a broader readiness folder instead of a single narrow item document so future SOC 2 and ISO/IEC 27001 evidence can land under one workstream.
- Kept the wording to readiness and scope definition. The documents explicitly state they do not assert SOC 2 compliance or ISO/IEC 27001 certification.
- Included users, data classes, suppliers, integrations, control boundary, inherited controls and open decisions so security reviewers can challenge the proposed boundary.
- Added a test that protects the non-claim wording and verifies core privacy, supplier and evidence-gap content.

## Validation planned

- Focused compliance-assurance test.
- Formatting check.
- Lint.
- Trace coverage.
- Repository validation where runtime permits.

## Validation evidence

- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/compliance-assurance-boundary.test.js` passed: 4 tests, 4 pass.
- `npm run format:check` passed.
- `npm run lint` passed with existing warning-only lint debt.
- `npm run trace:coverage` passed and confirmed trace coverage for `feature/compliance-assurance-boundary`.
- `npm test` passed: 309 tests, 309 pass, 0 fail.
- `npm run validate` passed.

## Residual risks

- The scope still requires Home Office service owner, information asset owner, senior risk owner and security representative sign-off.
- This PR does not create the asset inventory, risk register, supplier assurance pack, SOC 2 criteria mapping or ISO/IEC 27001 Statement of Applicability.
- Formal compliance claims still require authorised assessment evidence outside this repository documentation.
