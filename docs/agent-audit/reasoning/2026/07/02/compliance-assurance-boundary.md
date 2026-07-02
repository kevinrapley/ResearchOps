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
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`
- `openai-platform` at `.agent-operating-model/bundles/openai/`
- `mcp-agent-tooling` at `.agent-operating-model/bundles/mcp-agent-tooling/`
- `airtable-public-api` at `.agent-operating-model/bundles/airtable-public-api/`
- `mural-public-api` at `.agent-operating-model/bundles/mural-public-api/`

Skipped bundles: none. The follow-up page addition selected the GOV.UK Design System bundle because user-facing GOV.UK content and footer navigation changed.

## Precedence decisions

- GitHub Diamond governed branch naming, trace requirement, PR readiness and validation evidence.
- ResearchOps Developer Control governed service boundary, integration ownership and repository placement.
- Multi-Functional Team governed public-sector assurance, privacy, risk, human accountability and non-claim wording.
- GOV.UK Design System governed the rendered page structure, footer link placement and page-content patterns.
- Cloudflare, OpenAI, MCP, Airtable and Mural bundles informed the supplier and integration boundary without changing API contracts or runtime behaviour.

## Files read

- Existing operating-model files and selected bundle prompt files.
- `package.json`
- Existing hardening trace for PR #460: `docs/agent-audit/reasoning/2026/07/02/security-hardening-main.md`
- Existing route-state and trace tests used as style references.
- CI logs for PR #461 Node, release gate and Cloudflare Worker validation failures.

## Files created

- `docs/compliance/soc2-iso27001-readiness/README.md`
- `docs/compliance/soc2-iso27001-readiness/scope-and-system-boundary.md`
- `docs/compliance/soc2-iso27001-readiness/evidence-index.md`
- `src/govuk/data/compliance-readiness.mjs`
- `src/govuk/templates/pages/compliance-readiness.njk`
- `public/pages/compliance-readiness/index.html`
- `tests/compliance-assurance-boundary.test.js`
- `tests/compliance-readiness-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/07/02/compliance-assurance-boundary.md`
- `docs/agent-audit/reasoning/2026/07/02/compliance-assurance-boundary.json`

## Files modified

- `public/partials/footer.html`
- `scripts/govuk/render-govuk-pages.mjs`
- `.github/workflows/render-govuk-pages.yml`
- `tests/govuk-pages-render-workflow-state.test.js`
- `visual-walkthrough.config.mjs`
- `public/assets/govuk/govuk-frontend.css`
- `tests/govuk-generated-html-test-source-route-state.test.js`
- `tests/helpers/generated-govuk-page-source.mjs`
- `src/styles/govuk.scss`

## Implementation decisions

- Created a broader readiness folder instead of a single narrow item document so future SOC 2 and ISO/IEC 27001 evidence can land under one workstream.
- Kept the wording to readiness and scope definition. The documents explicitly state they do not assert SOC 2 compliance or ISO/IEC 27001 certification.
- Included users, data classes, suppliers, integrations, control boundary, inherited controls and open decisions so security reviewers can challenge the proposed boundary.
- Added a test that protects the non-claim wording and verifies core privacy, supplier and evidence-gap content.
- Added a GOV.UK-rendered compliance readiness page at `/pages/compliance-readiness/`.
- Kept the page out of the main service navigation and added a GOV.UK footer support link instead.
- Added a formal internal readiness control matrix mapped to SOC 2 Trust Services Criteria categories and ISO/IEC 27001:2022 Annex A controls.
- Updated the GOV.UK render workflow so changes to the compliance-readiness data module trigger static page rendering.
- Registered the footer-linked compliance readiness page in the visual walkthrough registry after CI showed the discoverable static route was neither covered nor explicitly excluded.
- Addressed browser review comments by keeping the compliance readiness page authored in Nunjucks, rendered through GOV.UK Frontend macros and styled through the GOV.UK Sass build.
- Switched the warning text to the official GOV.UK warning-text macro with HTML content so abbreviation markup renders inside the component.
- Added a shared Nunjucks abbreviation filter for SOC, TSC, ISO/IEC, DPIA, ROPA, SLOs and RTO/RPO.
- Replaced visible bullet lists in the SOC 2 TSC and ISO/IEC Annex A matrix columns with comma-separated reference spans.
- Added small GOV.UK text utility classes to the control matrix and a minimal Sass hook for top-aligned matrix cells and non-wrapping control references.
- Updated the generated GOV.UK page test helper so route-state tests render pages with the same shared abbreviation filter as the static renderer.

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
- Follow-up focused route-state tests passed for the GOV.UK compliance readiness page, footer-only link, render workflow, deploy assets and GOV.UK page chrome: 11 tests, 11 pass.
- Follow-up `npm run format:check` passed after the page addition.
- Follow-up `npm run lint` passed with existing warning-only lint debt.
- Follow-up `npm run trace:coverage` passed.
- Follow-up `npm test` passed: 313 tests, 313 pass, 0 fail.
- Follow-up `npm run validate` passed.
- CI fix `npm test -- tests/visual-walkthrough-registry-coverage.test.js` passed after registering the compliance readiness route in `visual-walkthrough.config.mjs`.
- CI fix `npm run format:check` passed.
- CI fix `npm run lint` passed with existing warning-only lint debt.
- CI fix `npm run trace:coverage` passed.
- CI fix `npm test` passed: 313 tests, 313 pass, 0 fail.
- CI fix `npm run validate` passed.
- Browser-comment fix `npm run build` passed and regenerated GOV.UK Sass output plus `public/pages/compliance-readiness/index.html`.
- Browser-comment fix focused route-state tests passed: 8 tests, 8 pass across compliance readiness, GOV.UK render workflow, visual walkthrough registry coverage and generated GOV.UK page helper coverage.
- Browser-comment fix markup probe confirmed the preview route returns HTTP 200, the GOV.UK warning component renders, requested abbreviation markup is present, 24 SOC 2 and ISO/IEC reference cells render, and none of those cells contain `ul` or `li` list markup.
- Browser-comment fix `npm run format:check` passed.
- Browser-comment fix `npm run lint` passed with existing warning-only lint debt.
- Browser-comment fix `npm test` passed: 314 tests, 314 pass, 0 fail.
- Browser-comment fix `npm run validate` passed.

## Residual risks

- The scope still requires Home Office service owner, information asset owner, senior risk owner and security representative sign-off.
- This PR does not create the asset inventory, risk register, supplier assurance pack, SOC 2 criteria mapping or ISO/IEC 27001 Statement of Applicability.
- Formal compliance claims still require authorised assessment evidence outside this repository documentation.
- The page uses category-level SOC 2 TSC mappings and selected ISO/IEC 27001 Annex A control references for readiness; final assessment needs assessor confirmation at criteria/control and evidence level.
