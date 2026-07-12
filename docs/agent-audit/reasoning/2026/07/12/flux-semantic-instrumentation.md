# Flux semantic instrumentation

## Task summary

Replace weak positional ResearchOps journey labels with controlled semantic page and control attributes, and represent OTP request and verification outcomes without capturing authentication input.

## Branch and controls

- Branch: `feature/flux-rich-semantic-telemetry`.
- Applied bundles: GitHub Diamond, ResearchOps Developer Control, Multi-Functional Team, GOV.UK Design System and Cloudflare Developer Platform.
- Method: test-driven implementation with source and generated-output parity.

## Decisions

- Use type-first keys such as `page.account.sign-in`, `tab.journal.analysis`, `button.analysis.code-retrieval` and `field.analysis.code-retrieval`.
- Never derive semantic meaning from visible text, values, record IDs, project IDs, URLs or query parameters.
- Keep email and one-time-code inputs excluded and explicitly mark them sensitive.
- Emit OTP requested, succeeded and failed as consent-gated, allow-listed `trust` milestones with the neutral `auth.otp` key.
- Retain generic positional fallback rather than inventing meaning for unannotated controls.

## Implementation

- Page identity is generated for every GOV.UK output and emitted on the body.
- Shared header navigation, account controls, the project-area navigation menu, project dashboard links, journal tabs, analysis actions, forms and fields now carry controlled semantic attributes.
- The tracker consumes declared page, key and role attributes and exposes the constrained milestone API.
- Flux narratives distinguish page visits, named control use, actual typing, zero-character focus, form submission, validation error and OTP outcomes.
- The tracker cache key advances to `v=1.2.3` without changing event schema `1.1.0`.

## Validation

- Focused tests failed before implementation and passed afterward.
- `npm run build` regenerated canonical GOV.UK output.
- `npm test` passed all 359 tests.
- `npm run lint` passed with the repository's existing warning baseline and no errors.
- `npm run validate` passed the complete governed validation pipeline.
- Desktop 1440×900 and mobile 375×812 browser checks found no horizontal overflow.
- Browser exercise emitted semantic page, tab, button and field keys; a zero-character blur emitted zero key presses and value length.
- Typing six digits into the explicitly sensitive OTP input emitted no input event.
- The constrained API emitted requested and succeeded milestones and rejected an unlisted action/key attempt.
- Browser verification found every shared service-navigation key and captured a `link.project-area.stakeholders` click as a schema-valid `nav` event.

## Residual risk

- Unannotated controls still use intentionally generic positional keys until their canonical template gains a reviewed semantic attribute.
- Delivery remains fire-and-forget and requires collector-side observability work.
