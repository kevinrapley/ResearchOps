# Projects page critical evaluation

Route: `/pages/projects/`

Status: completed for the focused GOV.UK structure and recovery-state hardening pass.

## Evaluation summary

The Projects page was operationally useful but under-structured. It listed records, but it did not yet explain the page purpose, expose a static page structure, provide a no-JavaScript fallback, or give resilient empty and error states.

The page also contained a faulty empty-state link. From the Projects route, `./pages/start/` can resolve to the wrong nested path. The corrected route is `/pages/start/`.

## Team review

### Service owner

The page needed to behave as a project workbench, not only a rendered list. The implemented change adds clearer page purpose and a primary action to start a research project.

Residual risk: the page still needs later filtering or sorting if the number of projects grows.

### Senior user researcher

The page needed to support common researcher questions: which project is available, what state is it in, and where do I continue work?

The implemented change keeps project cards and dashboard links, but adds a clearer framing section and explicit project-list section.

Residual risk: user research is still needed around project-finding tasks across phase, ownership and recency.

### Interaction designer

The page needed a clearer hierarchy. The implemented change introduces a page intro, a project-list section heading, loading state, empty state, and error state.

Residual risk: the repeated project-title link and dashboard button should be reviewed once real project volumes are known.

### Content designer

The page needed explicit service language. The implemented change explains that projects hold studies, participants, sessions, notes, evidence, insights and recommendations.

The empty and error states now give a safe next action instead of leaving the user with only a technical failure.

### Accessibility specialist

The page needed stronger structural and state accessibility. The implemented change adds a static skip link fallback, `main-content`, `govuk-main-wrapper`, a labelled project-list region, `aria-busy`, a no-JavaScript fallback, and explicit status or alert semantics for empty and error states.

Residual risk: this should still be checked with keyboard navigation and screen reader smoke testing once deployed.

### GOV.UK specialist

The page needed to match the GOV.UK-style page chrome used on the Home and Start pages. The implemented change adds the GOV.UK structural wrapping and fallback navigation pattern used elsewhere in the prototype.

The page now follows the service navigation and phase banner conventions already established in the ResearchOps prototype.

### Front-end engineer

The page already had sensible defensive data handling. The implemented change hardens rendering around load state, empty state and total failure state, and protects the corrected start-project route with a route-state test.

Residual risk: the API origin configuration remains environment-coupled and should be centralised in a future infrastructure pass.

### Delivery manager

This was kept as a contained hardening pass. The branch changes page structure, client rendering states, styles and route-state tests. It does not change the reporting site.

## Implemented changes

- Added GOV.UK page-chrome stylesheet to the Projects page.
- Added static no-JavaScript skip link, service navigation, phase banner and footer fallback.
- Replaced the thin `<main class="govuk-body">` wrapper with `govuk-main-wrapper`, `govuk-width-container`, `main-content` and focused tabindex support.
- Added page-intro content and a primary “Start a research project” action.
- Added a labelled project-list section.
- Added a visible loading state and `aria-busy` handling.
- Added empty-state and error-state rendering.
- Fixed the start-project link from `./pages/start/` to `/pages/start/`.
- Changed project card subheadings to maintain a cleaner heading hierarchy under the page section.
- Expanded route-state tests to protect the structural wrapping, corrected link, no-JavaScript fallback, empty state and error state.

## Recommended next iteration

Add visual walkthrough states for loaded, empty, fallback and failure conditions. Then add source-derived acceptance criteria for the Projects page if the reporting evidence model needs the same treatment as Home and Start.
