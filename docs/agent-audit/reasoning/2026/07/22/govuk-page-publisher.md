# GOV.UK page publisher implementation

## Run metadata

- Date: 2026-07-22
- Branch: `feature/govuk-page-publisher`
- Task: Implement the confirmed byte-preserving GOV.UK page publisher architecture.

## Branch-prefix trace decision

- `feature/` requires an auditable operational trace.
- This record contains repository evidence, implementation decisions, validation results and residual risks only.

## Operating model and bundle selection

Loaded operating-model sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/github-mutation-policy.md`

Selected canonical bundles:

- `github-diamond` — `.agent-operating-model/bundles/github/`
- `researchops-developer-control` — `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` — `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` — `.agent-operating-model/bundles/govuk-design-system/`

Skipped bundles:

- `cloudflare`
- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

## Precedence decisions

- GitHub Diamond governs branch validity, trace evidence, changed-file plausibility and validation reporting.
- ResearchOps Developer Control governs the repository-specific generated-page architecture and deployment-pair contract.
- Multi-Functional Team governs assurance framing for the public-sector product.
- GOV.UK Design System governs preservation of rendered GOV.UK markup and accessibility behaviour.
- No instruction conflicts were found.

## Evidence boundary and confirmed decisions

Repository evidence:

- The current publisher catalogue contains 64 generated pages.
- The post-build normaliser processes those 64 pages and two additional legacy pages.
- The global test helper recreates the Nunjucks environment and omits the production `fluxPageKey` context.

Confirmed implementation decisions:

- Preserve production HTML byte-for-byte.
- Return final post-normalised HTML through one publishing interface.
- Keep the existing catalogue content unchanged but internal.
- Use filesystem and in-memory output adapters.
- Render and validate every selected route before any output write.
- Replace the global filesystem monkeypatch and old implementation-shape tests.
- Keep committed generated HTML and enforce all-route byte parity.
- Defer Nunjucks migration of the sign-in and registration-request pages.

## Files created or modified

- 82 paths are changed: 61 test paths, 8 committed generated HTML files, 8 script paths, 3 documentation or trace paths, 1 workflow and `package.json`.
- Added the publisher modules under `scripts/govuk/page-publisher/`: public operation, internal catalogue, rendering pipeline, normaliser and catalogue validation.
- Added `scripts/govuk/govuk-page-filesystem-output.mjs`; reduced `scripts/govuk/render-govuk-pages.mjs` to the CLI adapter.
- Restricted `scripts/govuk/normalise-service-pages.mjs` to the two deferred legacy pages.
- Updated `.github/workflows/render-govuk-pages.yml` to invoke the canonical publishing command without importing the internal catalogue.
- Updated `docs/deployment/generated-html-policy.md` and `package.json` for the publishing seam and explicit tests.
- Deleted `tests/helpers/generated-govuk-page-source.mjs` and its filesystem monkeypatch; added `tests/helpers/published-govuk-pages.mjs`.
- Deleted the old helper implementation-shape test and added `tests/govuk-page-publisher.test.js` for public-interface, two-phase rejection and 64-page parity behavior.
- Updated affected route-state tests to request generated HTML explicitly through the in-memory publisher fixture.
- Regenerated eight committed pages. Seven changes expose formatting that the previous normaliser pipeline already produced; the tree-test page also picks up analytics markup already present in the current shared Nunjucks layout.

Files read during implementation included the operating-model sources listed above, the four selected canonical bundle prompt files, `package.json`, both original GOV.UK rendering scripts, the shared Nunjucks layout, the generated-page workflow, deployment policy, visual-walkthrough route configuration and affected generated-page tests.

## Validation

- `node --check` passed for every new publisher module.
- `npm run build:govuk-pages` passed repeatedly; the public diff hash was identical before and after a repeat build.
- `npm test -- --test-reporter=dot` passed, including all 64 final-HTML byte-parity comparisons.
- `npm run lint` passed. Repository-wide pre-existing warnings remain warnings and produced no lint errors.
- `npm run validate` passed, including operating-model validation and evals, bundle validation, trace validation and coverage, report/sourcebook validation, syntax checks, performance audit and route-state validation.
- `git diff --check` passed.
- No standalone `typecheck` script exists in `package.json`, so it could not be run.
- Browser E2E, Cucumber and visual-walkthrough suites were not run because this slice changes build architecture and test sourcing, not browser interaction; final HTML parity and the repository validation suite cover the changed seam.

## Issues and pivots

- Hiding the catalogue invalidated the workflow's template-to-output import. The workflow now runs the one public publishing command for every relevant change instead of depending on private descriptors.
- Final formatted HTML exposed assertions that depended on unformatted whitespace. Those assertions now test normalized visible content or structural markup.
- Repeat generation exposed existing committed-output drift in eight pages. The new parity contract makes that drift explicit and prevents it recurring.

## Residual risks

- `public/pages/account/sign-in/index.html` and `public/pages/team/registration-requests/index.html` remain static legacy pages outside the Nunjucks publisher. They are still normalized by the legacy command and should be migrated later.
- The workflow now republishes all 64 generated pages instead of selecting outputs from changed templates. This is simpler and preserves catalogue encapsulation, at the cost of additional CI work.
- The eight committed HTML diffs should be reviewed as generated-output synchronization, especially the tree-test analytics markup.
