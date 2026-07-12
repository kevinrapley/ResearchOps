# ResearchOps hosted Flux boundary

## Task

Remove Flux product logic from ResearchOps while preserving behavioural capture through a versioned hosted Flux include and authored semantic attributes.

## Operating model

- Branch: `fix/flux-wpm-keyboard-autocomplete` (trace required).
- Selected: GitHub Diamond, ResearchOps Developer Control and Multi-Functional Team.
- Applied for the frontend boundary: GOV.UK Design System.
- Cloudflare rules apply to CSP and the eventual deployment; no binding or secret changed.
- Airtable was skipped: the loader matched the word “record”, but no Airtable API or data operation is in scope.
- No instruction conflicts were found. Repository and privacy controls took precedence over retaining the local implementation.

## Evidence and decisions

- Removed the local tracker, session engine, UK-English analyser, dictionary build and generated dictionary assets.
- Removed ResearchOps authentication-to-analytics API calls.
- Added one hosted Flux module include with endpoint and tenant attributes to canonical layouts and static shells.
- Retained authored page, navigation, form, field and control attributes; important journeys remain covered by source tests.
- Updated CSP to permit only the named Flux host for script and collection traffic.
- Flux Behaviour owns feature-parity regression tests and must deploy before this ResearchOps change.

## Validation

- `npm run build` — passed.
- `npm test` — all 359 tests passed.
- `npm run lint` — passed with the existing warning baseline.
- `npm run validate` — passed.
- Focused hosted-boundary route-state test — passed.
- Playwright authored-attribute audit — passed.
- Full repository validation is recorded in the pull request after execution.

## Residual risk

Cross-origin production loading and end-to-end event delivery require browser verification after both repositories deploy. No secret, binding or authenticated service behaviour changed.
