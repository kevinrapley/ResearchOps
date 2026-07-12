# Flux tracker schema-version fix

## Task summary

Restore ResearchOps behavioural-event delivery after production interactions began returning HTTP 400 from the Flux collector.

## Branch and controls

- Branch: `fix/flux-tracker-schema-version` (audit trace required).
- Applied bundles: GitHub Diamond, ResearchOps Developer Control, Multi-Functional Team and Cloudflare Developer Platform.
- Mode: repository fix.
- Precedence: repository safety and the published producer-consumer contract govern; the asset cache version does not redefine the event contract.

## Evidence and diagnosis

- Production ResearchOps loaded `/js/flux-researchops-tracker.1.2.0.js?v=1.2.1` and consent was granted.
- The tracker emitted `schema_version: '1.2.0'`.
- The Flux collector accepted event contract `1.1.0` and returned `400 {"ok":false,"error":"invalid_event"}` for the browser-shaped `1.2.0` payload.
- Production D1 contained no events from the reported visit, isolating the failure before storage.

## Implementation

- Pin emitted events to contract `1.1.0` while retaining the independently versioned `1.2.0` JavaScript asset.
- Advance the asset cache key to `v=1.2.2` across the canonical layout, shared partial, generated output and three static route shells.
- Change the route-state regression assertion so future asset-version changes cannot silently alter the event schema.
- Record the asset-versus-contract distinction in `RECENT_LEARNINGS.md`, the conformance matrix and the gap register.

## Validation

- Focused route-state test: failed before the implementation on the `schema_version` assertion, then passed after the fix.
- `npm run build`: passed and regenerated the committed GOV.UK page outputs.
- `npm run format:check`: passed.
- `npm run lint`: passed with the repository's existing warning baseline and no errors.
- `npm test`: passed, 358 tests.
- `npm run validate`: passed, including trace coverage and generated-output checks.
- Agent evidence validation passed; the recent-learnings grader scored 1.0.
- The generic code-confidence grader scored 0.65 because its implementation has no mapping for documentation or structured-evidence criteria, despite both artefacts being present. This is recorded as a tooling limitation rather than hidden.

## Residual risk

- The tracker still uses fire-and-forget delivery and does not surface non-2xx responses in its own UI. Browser developer tools expose failures, but collector-side delivery observability remains desirable.
- No tracking categories, identifiers or content fields changed; the existing consent and data-minimisation boundary remains intact.
