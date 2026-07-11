# Flux tracker rendered-page remediation

## Task summary

Address the active Codex P1 review thread on merged ResearchOps PR #475: the versioned Flux tracker was referenced only from an unused partial and therefore was not loaded by normal rendered pages.

## Branch and controls

- Branch: `fix/flux-tracker-rendered-pages` (trace required).
- Applied bundles: GitHub Diamond, ResearchOps Developer Control and Multi-Functional Team.
- Precedence: repository safety and review-thread handling governed the work; ResearchOps rendering conventions governed the minimal implementation.

## Evidence and decisions

- The review thread was still unresolved and its finding was reproduced from the source layout and a generated account sign-in page.
- The tracker reference now belongs in `src/govuk/templates/layouts/researchops.njk`, which renders normal GOV.UK pages.
- All generated page outputs were rebuilt. The three committed page shells outside that renderer were updated directly.
- The tracker test now checks every rendered public HTML page, excluding only partials and the intentional local-storage clearing utility.

## Validation

- `npm run build` — passed.
- `npm test` — passed.
- `npm run validate` — passed.
- `npm run trace:coverage -- --date 2026-07-11` — passed.
- `npm test -- --ci` was attempted but is not valid for this repository's Node test command; Node rejected the unsupported `--ci` option. `npm test` is the executable equivalent and passed.

## Residual risk

The consent-gated tracker is now present on all rendered routes. Its production host gate and privacy controls remain exercised by the existing tracker regression suite; browser-network verification will follow the corrective PR merge and deployment.
