# Flux semantic interactive coverage

## Task summary

Keep Flux fallback journey events visible while ensuring ResearchOps supplies strong semantic context for links and interactive elements across static and dynamically rendered interfaces.

## Decisions

- Retain the existing `auto.*` fallback as the final defensive path; do not hide or rewrite historical fallback events.
- Write `data-flux-key` and `data-flux-role` onto current controls before consent capture and observe newly inserted controls.
- Prefer explicit reviewed keys on important journeys, including objective editing and participant actions.
- Derive missing purpose only from controlled structural attributes and destination paths without query strings; never use visible text, accessible names, entered values or record identifiers.
- Use only allow-listed action values, map contact protocols to fixed purposes, and derive route scope from the controlled page key.
- Keep grouped options distinct with allow-listed controlled values or sanitised structural IDs, give search-result disclosures explicit non-PII ordinals, and let truly contextless controls reach the retained positional fallback instead of inventing a generic semantic purpose.
- Exclude focus-management and display-only `tabindex` targets. Custom interactive controls must declare an interactive role.

## Implementation

- The versioned ResearchOps tracker annotates links, buttons, fields, forms and details controls and watches DOM insertions with `MutationObserver`.
- Dynamic project description, objective editing, objective textarea and participant actions have explicit semantic attributes.
- Previously generic help/details controls have explicit purpose-led attributes.
- The tracker cache key advances to `v=1.2.6` without changing event schema `1.1.0`.

## Validation

- Focused tracker, semantic markup, focus narrative and session lifecycle tests passed.
- A Chromium audit loaded every committed rendered page and found no missing semantic key/role attributes, `auto.*` keys or generic `.control`, `.field` or `.form` endings.
- A Chromium mutation test verified that controls inserted after page load receive purpose-led keys and roles while `<main tabindex="-1">` remains excluded.
- `npm test` passed all 371 repository tests after three Codex review remediation rounds.
- `npm run lint` completed with zero errors and the existing warning baseline.
- `npm run validate` passed the governed repository contract, trace, generated-output, route-state and performance gates.
- Codex review regressions cover PII-safe contact links, distinct allow-listed actions and non-project page scopes; both Chromium coverage tests pass after remediation.
- Second-pass regressions cover distinct panel actions, checkbox/radio options, explicit search-result disclosures and the no-generic-key fallback boundary.
- Third-pass regressions prove GOV.UK initialization attributes cannot outrank service purpose, confirm search-result ordinals interpolate to valid keys, and record every selected operating-model bundle in the audit trace.

## Residual risk

- The fallback remains reachable for an unforeseen malformed control, as requested; it is not expected on the audited ResearchOps DOM.
- Historical fallback events retain their original labels because their missing purpose cannot be reconstructed safely after capture.
