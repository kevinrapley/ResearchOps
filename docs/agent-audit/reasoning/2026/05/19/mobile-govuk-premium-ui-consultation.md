# Mobile GOV.UK premium UI consultation trace

- Branch: `fix/mobile-govuk-premium-ui`
- Task: Improve ResearchOps mobile UI against the GOV.UK mobile reference screenshot.
- Branch trace decision: `fix/` branch, trace required.

## Operating model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/github-mutation-policy.md`

## Selected bundles

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`
- `govuk-design-system`

## Files read

- `public/pages/account/index.html`
- `public/js/auth-account-page.js`
- `public/css/screen.css`
- `public/css/govuk/govuk-page-chrome.css`
- `public/css/govuk/govuk-header-service-brand.css`
- `public/partials/header.html`
- `tests/auth-account-dashboard-route-state.test.js`

## External design references consulted

- GOV.UK Design System header component
- GOV.UK Design System service navigation component
- GOV.UK Design System spacing guidance
- GOV.UK Design System type scale guidance

## Screenshot comparison

The GOV.UK mobile reference has stronger page discipline:

- header and navigation are edge-to-edge
- the blue masthead has confident but compact vertical rhythm
- the mobile menu button sits close to the masthead and feels deliberate
- content starts with consistent container padding
- typography is large but controlled
- sections feel arranged on a clear vertical grid
- primary actions are easy to scan and tap

The ResearchOps account mobile page had these issues:

- body margin created an inset, prototype-like frame around the whole application
- the GOV.UK logotype and ResearchOps service name were oversized together
- the header, service navigation and body spacing did not feel like one governed page chrome
- the account hero occupied too much vertical space before the main account information
- summary-list values were visually offset on mobile and felt less intentional
- action buttons were not composed as a premium mobile action stack

## GOV.UK specialist view

The mobile page should look like it comes from a GOV.UK service page rather than a responsive desktop prototype.

Recommendations:

- use edge-to-edge header, navigation and footer chrome on mobile
- keep the GOV.UK header compact
- preserve GOV.UK focus, button and navigation semantics
- use the GOV.UK spacing scale for mobile rhythm
- avoid creating new meanings for colour

## Interaction designer view

The account page has a clear user journey: identify account, confirm team and role, then take an action.

Recommendations:

- reduce pre-content chrome friction so the account state appears sooner
- keep the breadcrumb, but avoid excessive spacing before the h1
- make action buttons full-width on mobile so the tap targets read as a deliberate action set
- keep permission details secondary inside details disclosure
- keep the sign-out action visually separate from role-management actions

## Graphic designer view

The ResearchOps screenshot lacks the visual confidence of GOV.UK because it mixes oversized header branding with cramped internal layout.

Recommendations:

- reduce mobile header brand scale
- align content, summary lists and actions to the same mobile container grid
- strengthen white-space consistency between heading, body copy, section titles and controls
- avoid centred or indented summary-list values on mobile
- keep the footer text aligned to the same visual column as content

## Implementation summary

- Added `public/css/account-mobile-premium.css` for account-page mobile refinements.
- Added `body.rops-account-page` to allow page-scoped overrides without changing the whole application.
- Added account-specific structure classes to the account page.
- Reduced mobile header scale and made header, service navigation and footer edge-to-edge for the account page.
- Increased mobile content rhythm using GOV.UK-like spacing and type scale decisions.
- Made account action buttons full-width on mobile.
- Left the existing GOV.UK component semantics intact.
- Updated route-state tests to assert that the account page loads the premium mobile stylesheet and page-scoped classes.

## Residual risk

This is an account-page scoped improvement. Other ResearchOps pages may still need the same mobile chrome treatment.

If the design direction is accepted, the next step should be to promote the stable parts of `account-mobile-premium.css` into the shared page-chrome stylesheet and regression-test additional public routes.
