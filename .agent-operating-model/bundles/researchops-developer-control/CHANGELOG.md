# Changelog

## 1.13.0

- added `references/researchops-performance-rules.xml`
- added doctrine for periodic performance audits using `docs/performance/initial-load-audit.md`
- added CSS ownership rules distinguishing global, shared-pattern, route-specific, and obsolete selectors
- clarified that performance work must not replace global CSS contracts
- added Cloudflare Pages caching rules for `public/_headers`, static assets, and `/pages/*` no-store handling
- added deferred shared layout module guidance
- added validation guidance requiring `npm run validate` after failed coding updates, failed connector writes, CI failures, or route-state test failures
- added `templates/performance-audit-update-template.xml`
- added `templates/route-css-split-template.xml`
- added performance-specific evals and regression tests
- strengthened grader checks for CSS ownership, cache headers, audit documentation, validation discipline, and manual visual validation

## 1.12.1

- added explicit governance for regression and contract tests that are blocked by Prettier despite being useful validation evidence
- updated `references/quality-gates.xml` so regression and contract tests must execute in validation or CI even when narrowly excluded from Prettier
- updated `references/researchops-repository-conventions.xml` with `tests/*-contract.test.js`, `tests/*-regression.test.js`, and `tests/*-route-state.test.js` naming guidance
- updated `references/researchops-ci-governance-pack.xml` and `references/researchops-contract-test-pack.xml` with narrowly scoped `.prettierignore` rules for explicit assertion layout, fixture readability, generated/static contract structure, and grep-style route-state checks
- clarified that Prettier exclusions must not weaken ESLint, syntax, validation, or test execution coverage, and must not be used for production code or ordinary unit tests merely to make CI pass

## 1.12.0

- added `references/researchops-metadata-provenance-pack.xml`
- added `references/researchops-ethics-pack.xml`
- added `references/researchops-pr-and-logging-governance-pack.xml`
- added `roles/ethics.xml`
- added `templates/metadata-provenance-template.xml`
- added `templates/ethics-impact-template.xml`
- added governance example artefacts for metadata/provenance, ethics impact, and PR/logging governance
- updated the bundle to describe the live repo using the current JavaScript service-module, service-internals, Worker, router, and Pages proxy split
- strengthened core rules, quality gates, platform context, CI governance, conformance summary, grader rules, schemas, evals, and tests for metadata, ethics, QA, PR, and logging governance

## 1.11.1

- repaired `README.md` so the release-history summary covers every version from `1.0.0` through `1.11.0`
- repaired `CHANGELOG.md` so each historical version is present once, in order, with the correct change set
- corrected the previous README misattribution for `1.11.0`
- normalised current bundle metadata to `1.11.1`

## 1.11.0

- added `references/researchops-fixture-index-validation-pack.xml`
- added `examples/conformance/fixture-index-validation.sample.json`
- added `examples/conformance/fixture-index-validation.workflow.yaml`
- extended the contract-test pack so fixture-path existence and route-catalog example reachability are treated as required conformance checks
- extended the CI-governance and conformance-summary packs with fixture-index validation guidance and reporting
- extended the examples index, schemas, grader, evals, regression tests, and red-team tests for RG-07 discipline

## 1.10.0

- added `references/researchops-conformance-summary-pack.xml`
- added `templates/conformance-summary-template.xml`
- added `examples/conformance/conformance-summary.sample.json`
- added `examples/conformance/conformance-summary.workflow.yaml`
- extended the CI-governance pack so CI can emit a conformance summary artifact
- added reporting requirements for matrix coverage, gap status, and repository-convention compliance

## 1.9.0

- added `references/researchops-joined-proxy-worker-tests.xml`
- added `examples/conformance/proxy-worker-joined-tests.sample.json`
- added `examples/conformance/proxy-worker-tests.workflow.yaml`
- extended the contract-test pack and CI-governance pack so joined proxy-to-worker checks run in CI before downstream E2E
- added joined-test coverage for ping, health, guides list, and one mutate route

## 1.8.0

- added `references/researchops-page-contract-packs.xml`
- added `templates/page-contract-pack-template.xml`
- added page-contract examples for projects index, start-project flow, project dashboard, study overview, sessions workspace, search/analysis, and analysis/synthesis
- extended design-pattern, conformance, contract-test, schema, grader, eval, and example-index layers so page contracts can be treated as first-class artifacts

## 1.7.0

- added `references/researchops-route-availability-policy.xml`
- added `examples/conformance/route-availability-tests.sample.json`
- added `examples/conformance/route-available.response.json`
- added `examples/conformance/route-conditionally-unavailable.response.json`
- kept service-dependent single-record routes in `implemented-conditional-verified` state where full direct-route verification would overstate the current runtime
- required explicit route-availability tests that distinguish available, conditionally unavailable, and absent-extension routes

## 1.6.0

- added `references/researchops-single-record-route-policy.xml`
- added `examples/conformance/single-record-route-status.yaml`
- added `examples/conformance/single-record-absence-tests.sample.json`
- added `examples/conformance/route-absent.response.json`
- added `examples/sessions/get.response.json`
- extended route-shape fixtures, fixture maps, schemas, grader rules, evals, regression tests, and red-team tests so canonical single-record routes are either verified or explicitly absent by policy

## 1.5.0

- added `contracts/route-shape-fixture.schema.json`
- added `examples/conformance/contract-fixture-map.yaml`
- added `examples/conformance/contract-tests.runner-spec.yaml`
- added `examples/conformance/contract-tests.package-scripts.json`
- added `examples/conformance/contract-tests.workflow.yaml`
- extended the contract-test and CI-governance packs so canonical route-shape fixtures are validated in CI before E2E
- established `npm run test:contracts` as the named contract-test gate

## 1.4.0

- added `modes/rops-conformance.xml`
- added `references/researchops-conformance-matrix.xml`
- added `references/researchops-gap-register.xml`
- added `references/researchops-contract-test-pack.xml`
- added `references/researchops-ci-governance-pack.xml`
- added `templates/conformance-matrix-template.xml`
- added `templates/gap-register-template.xml`
- added `templates/contract-test-spec-template.xml`
- added `templates/ci-governance-template.xml`
- added `examples/conformance/` sample packs for matrix, gaps, contract tests, and CI governance
- extended schemas, grader rules, evals, regression tests, and red-team tests for repo-conformance work

## 1.3.0

- added `references/researchops-example-payloads.xml`
- added `templates/endpoint-example-template.xml`
- added bundled request and response fixture packs for diagnostics, projects, studies, participants, sessions, session notes, guides, journals, analysis, and Mural
- extended the endpoint catalog so canonical routes can reference concrete example files
- strengthened schemas, grader rules, evals, regression tests, and red-team tests for payload fidelity

## 1.2.0

- added `references/researchops-endpoint-catalog.xml`
- added `references/researchops-repository-conventions.xml`
- added `templates/service-module-contract-template.xml`
- added `templates/repository-convention-template.xml`
- deepened the platform context so the bundle aligns with the current repo shape and live route families
- extended schemas, grader rules, evals, regression tests, and red-team tests for concrete service and repository-contract work

## 1.1.0

- added always-loaded doctrine for Airtable API, Mural API, Cloudflare development, GOV.UK Design System, and ResearchOps design patterns
- added `modes/rops-patterns.xml`
- added `roles/metrics.xml` and `roles/user-research.xml` to match documented triggers
- added `templates/adapter-contract-template.xml`
- added `templates/design-pattern-spec-template.xml`
- strengthened core rules, implementation workflow, integration contracts, quality gates, output schema, grader rules, evals, regression tests, and red-team tests

## 1.0.0

- initial ResearchOps developer-control prompt bundle
