# Flux tracker session-dimension signals

## Task summary

Extend the consented ResearchOps tracker so Flux can calculate all 20 demo-model indicators per pseudonymous session without collecting text, labels, account identifiers or authentication-field activity.

## Branch and controls

- Branch: `feature/flux-session-dimensions` (audit trace required).
- Applied bundles: GitHub Diamond, ResearchOps Developer Control and Multi-Functional Team.
- Precedence: privacy and data minimisation constrained the implementation; only safe event categories were added.

## Decisions and evidence

- The module records paste, undo and shortcut categories, field revisit counts, help disclosure, validation transition, submit attempt and rapid-click events.
- It exports only neutral structural keys and bounded count/timing metadata.
- Email, telephone, password and one-time-code inputs remain excluded.
- The versioned `1.2.0` module points at the hardened implementation so deployment can bypass cached tracker assets.

## Validation

- `npm run build` — passed.
- `npm test` — passed after the complete build generated the required stylesheet.
- `npm run validate` — passed.
- `npm run format:check` — passed.
- `npm run trace:coverage -- --date 2026-07-11` — passed.

## Residual risk

Flux session dimensions are service-improvement heuristics. They must not support automated decisions or person-level judgement; golden-corpus, data-protection and accessibility assurance remain open.
