# Migrate legacy GOV.UK pages to Nunjucks

## Run metadata

- Date: 2026-07-22
- Branch: `feature/migrate-legacy-govuk-pages`
- Task: Migrate the sign-in and registration-request pages to Nunjucks and fold them into the GOV.UK page publisher and catalogue.

## Branch-prefix trace decision

- `feature/` requires an auditable operational trace.
- This record contains repository evidence, implementation decisions, validation results and residual risks only.

## Operating model and bundle selection

Loaded the repository operating model from `AGENTS.md` and `.agent-operating-model/`, including orchestration, registry, task signals, selection rules, precedence, trace and GitHub mutation policy sources.

Selected canonical bundles:

- `github-diamond` — `.agent-operating-model/bundles/github/`
- `researchops-developer-control` — `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` — `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` — `.agent-operating-model/bundles/govuk-design-system/`

Skipped bundles: `cloudflare`, `openai-platform`, `mcp-agent-tooling`, `airtable-public-api` and `mural-public-api`.

## Evidence and decisions

- `public/pages/account/sign-in/index.html` and `public/pages/team/registration-requests/index.html` were the only GOV.UK service pages outside the Nunjucks catalogue.
- `scripts/govuk/normalise-service-pages.mjs` existed solely to post-normalise those two files after the canonical publisher ran.
- The publisher already exposes the deep `publishGovukPages` interface, returns final post-normalised HTML and validates that every top-level page template is registered.
- The smallest complete migration is therefore two page templates, two catalogue entries and deletion of the redundant legacy normalisation command.
- Existing route-state tests now request these pages through the in-memory publisher adapter. No parallel legacy tests were added.
- The sign-in page retains its established `page.account.sign-in` Flux page key through catalogue context while the renderer continues to derive keys for other pages.
- Both pages use the shared ResearchOps layout and GOV.UK breadcrumbs macro. The sign-in form keeps the existing email-field width and the explicit width-10 security-code input; this task changes page ownership rather than form design.

## Test-contract impact sweep

Updated contracts that encoded the legacy implementation:

- sign-in and authentication-story route-state tests
- registration-request route-state tests
- GOV.UK service-page coverage
- publisher route count and committed-output byte parity
- render workflow path assertions and package scripts
- governance evidence in `gap-register.yaml`

Searches confirmed there are no remaining executable references to `normalise-service-pages.mjs`, `postbuild:govuk-pages` or `build:service-pages` outside historical audit traces.

## Validation

- Targeted publisher, workflow, sign-in, registration-request, authentication-story, GOV.UK frontend and Flux route-state tests passed: 10 tests.
- `npm run build:govuk-pages` passed and generated both migrated committed outputs through the publisher.
- Desktop browser verification passed at 1440 × 1200 for the sign-in code-request transition and a populated registration-request review state.
- Mobile browser verification passed at 412 × 915 with long names, email addresses, service names and request reasons; there was no horizontal overflow or button overlap.
- `npm test -- --test-reporter=dot` passed.
- `npm run lint` passed with the repository's existing warning baseline and no errors.
- `npm run validate` passed, including a repeat build, operating-model validation, behavioural evals, trace validation and coverage, report and sourcebook checks, syntax checks, performance audit and route-state validation.
- Repeated publisher builds changed only the two intended generated outputs; all other generated pages remained byte-stable.
- `git diff --check` passed.

## Changed-file plausibility

- 18 paths are changed: 2 Nunjucks templates, 2 generated outputs, 2 publisher modules, 5 test files plus the workflow test, package scripts, the render workflow, governance evidence, deletion of the legacy normaliser and 2 trace files.
- The generated output changes are limited to the two routes requested for migration.

## Residual risks

- The committed HTML diffs are larger than the source change because publisher output is consistently formatted and now includes shared layout assets, cache keys and semantic breadcrumbs.
- The registration-request page intentionally drops legacy one-off stylesheets, duplicate skip-link fallback and bespoke footer variables in favour of the shared ResearchOps page layout.
