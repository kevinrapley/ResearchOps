# Flux session inactivity boundary

## Task summary

Correct ResearchOps behavioural-session lifecycle after production activity more than seven hours apart was appended to one Flux journey.

## Branch and controls

- Branch: `fix/flux-session-inactivity` (audit trace required).
- Applied bundles: GitHub Diamond, ResearchOps Developer Control, Multi-Functional Team and Cloudflare Developer Platform.
- Skipped bundles: GOV.UK Design System, OpenAI Platform, MCP Agent Tooling, Airtable Public API and Mural Public API because their task signals were absent.
- Mode: repository fix.
- Precedence: privacy and data minimisation govern the identifier design; repository controls govern the test-first change and generated-output parity; Cloudflare controls distinguish D1 production evidence from local tests.

## Evidence and diagnosis

- A read-only production D1 query found 41 events under the journey started at 02:28 UTC, with its latest event at 09:42 UTC.
- The fresh events included semantic navigation, page, OTP milestone and form events, proving ingestion and the new attributes were working.
- The production collector CORS preflight returned HTTP 204 with `research-operations.com` allowed and `cache-control: no-store`.
- The tracker stored only `flux.behaviour.session_id` in `sessionStorage`; it had no inactivity timestamp or rollover rule.
- The Flux dashboard also returns `cache-control: no-store`, ruling out dashboard response caching as the cause.

## Implementation

- Define a 30-minute inactivity boundary using a content-free activity timestamp in tab-scoped storage.
- Refresh the activity timestamp for every captured event and retain the existing session identifier while activity remains inside the boundary.
- Create a new pseudonymous session identifier after the boundary while leaving the local visitor identifier unchanged.
- Replace legacy session identifiers that have no activity timestamp on the first captured interaction after deployment.
- Advance the tracker asset cache key to `v=1.2.4` in canonical source, static shells and generated pages.
- Keep the event schema, consent gate, sensitive-field exclusions and payload fields unchanged.

## Test-contract impact sweep

- Searched tracker storage keys, script URLs, generated page output, route-state assertions and instrumentation documentation.
- Added executable session lifecycle tests and updated the existing rendered-asset assertion.
- Rebuilt all GOV.UK pages and checked that unrelated generated whitespace was not retained in the diff.

## Validation

- The lifecycle test failed before implementation for both legacy migration and inactivity rollover.
- The same test passed after implementation: 2 tests passed.
- The focused lifecycle and rendered-route tests passed together: 3 assertions passed.
- `npm run build` passed and regenerated all canonical GOV.UK pages.
- `npm run format:check` passed.
- `npm run lint` passed with no errors and the existing warning baseline.
- `npm test` passed all 361 tests.
- `npm run validate` passed the repository contract, operating-model, trace, generated-output, route-state and performance checks.
- Agent evidence validation passed and the recent-learnings grader scored 1.0.
- The generic code-confidence grader scored 0.65 because its implementation did not map the present documentation and structured-evidence fields; this tooling limitation is recorded rather than hidden.

## Residual risk and rollback

- Historical `auto.*` event keys are immutable and cannot be enriched after collection.
- The first updated tracker event intentionally starts a new session for browsers carrying a legacy session without an activity timestamp.
- Post-deployment D1 verification should confirm a new returning session row after a controlled inactive visit.
- The generic confidence grader's evidence-field mapping remains an assurance-tooling limitation.
- Rollback is the prior tracker implementation and `v=1.2.3` asset reference, though that would restore the known never-expiring session defect.
