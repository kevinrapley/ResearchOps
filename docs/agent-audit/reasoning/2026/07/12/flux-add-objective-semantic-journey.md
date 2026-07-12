# Flux Add Objective semantic journey

## Task summary

Replace generated Add Objective control labels with stable, privacy-safe service purpose and distinguish automatic focus, keyboard entry and focus exit.

## Branch and controls

- Branch: `fix/flux-objective-journey-context`, stacked on `fix/flux-session-inactivity`.
- Applied bundles: GitHub Diamond, ResearchOps Developer Control, Multi-Functional Team, GOV.UK Design System and Cloudflare.
- Privacy boundary: metadata-only interaction context; no textarea content or authenticated identity.

## Evidence and diagnosis

- The canonical textarea had no `data-flux-*` attributes, so the tracker generated `auto.textarea.textarea.38`.
- Programmatic focus occurs when the Add Objective panel opens.
- The tracker stored only a global last pointer type and reused it on blur, making keyboard typing appear to use a mouse.
- Flux stores structured event metadata alongside prose, allowing safe read-time narrative improvements without changing historical rows.

## Implementation

- Added stable keys to the Add Objective toggle, form, textarea, Save and Cancel controls.
- Marked the deliberately programmatically focused textarea with `data-flux-autofocus="true"`.
- Added bounded focus-origin events and limited blur exit method to a pointer or Tab event in the previous second.
- Advanced the tracker cache key to `v=1.2.5` across canonical sources and rendered pages.
- Kept the event schema at the collector-compatible `1.1.0` and captured no content.

## Validation

- Semantic-template and focus-event tests failed before implementation.
- Six focused tracker, session, route and rendered-page assertions passed after implementation.
- The generated project dashboard contains all five semantic keys and the automatic-focus marker.
- `npm run build`, all 362 tests, formatting, lint and repository validation passed.

## Residual risk

- Lower-priority uninstrumented controls may still produce explicitly generic fallback keys.
- Production verification follows deployment after the stacked session-lifecycle pull request.
