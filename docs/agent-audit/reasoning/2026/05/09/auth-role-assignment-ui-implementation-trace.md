# Agent trace: auth role assignment UI implementation

Date: 2026-05-09

Branch: `feature/auth-role-assignment-ui`

Pull request: #220

Slice: `auth-role-assignment-ui`

Previous slice: authentication role assignment API, merged through PR #219.

## Purpose

A Team Admin account exists in live D1 and the role-assignment API has been merged into `main`.

This slice adds a Team Admin user interface for assigning D1-backed roles to existing active team members.

The page is:

```text
/pages/team/role-assignments/
```

## Implementation status

The first iteration proved the plumbing. It loaded `/api/me`, detected `role.assign` and submitted to `POST /api/auth/role-assignments`.

The second iteration reworked the page as a safer administrative journey rather than a diagnostic form.

The final PR #220 pass tightened the page against GOV.UK component conventions, removed the remaining project-level navigation, moved breadcrumbs before the main landmark, removed technical permission codes from the user-facing UI and locked those choices into route-state tests.

## Final validation status

The latest checked PR head was:

```text
1198b7aa51987ab0abe6a257eb7376c813d26b51
```

GitHub Actions for that head reported success for:

- Format pull request
- QA — Broken links (Lychee)
- Accessibility audit (pa11y-ci)
- Validate ResearchOps
- qa-bdd
- CI
- Release Gate
- Worker CI

## UI behaviour

The page loads the current authenticated context with:

```text
GET /api/me
```

It enables role assignment only when the current active team context includes:

```text
role.assign
```

If the user can assign roles, the page shows compact team scope instead of a prominent self-access panel:

```text
You are assigning roles in ResearchOps Core Team.
```

If the user cannot assign roles, the form is hidden and the page shows a blocking message.

The form submit action does not write to D1. It validates the inputs and shows a check-and-confirm panel.

The write only happens when the admin selects:

```text
Confirm and assign role
```

The final write uses:

```text
POST /api/auth/role-assignments
```

## Page implementation

Page:

```text
public/pages/team/role-assignments/index.html
```

The page includes:

- breadcrumb navigation before the main landmark
- compact team-scope panel
- team member email field
- user ID field inside a details component
- role radios with role descriptions
- role summary panel with plain-language abilities
- governed access-duration radios
- conditional day, month and year expiry date input
- audit reason textarea
- sensitive-role confirmation checkbox
- Safeguarding Lead confirmation checkbox
- error summary
- check-and-confirm summary list
- success and error result panels

## Design decision: top-level admin information architecture

The page is now treated as a top-level administration area for the ResearchOps installation.

The page uses breadcrumb navigation:

```text
Home > Team administration
```

The previous `Back to projects` link has been removed. No other back button or back link is shown.

The `Clear form` reset button has also been removed because clearing the whole form is not a primary user need and creates avoidable accidental-reset risk.

The breadcrumb is placed before:

```text
<main class="govuk-main-wrapper" id="main-content" role="main" tabindex="-1">
```

The route-state test now asserts this ordering so the page does not regress to breadcrumbs inside the main landmark.

## Design decision: remove self-access panel

The first iteration showed a large `Your current access` panel.

That was useful for proving authentication, but it made the page talk about the admin when the task is to assign access to another person.

The current page keeps the permission check but reduces the successful state to team scope.

This shifts the page from an authentication diagnostic to a role-assignment task.

## Design decision: email and user ID affordance

The email field is the primary path and uses a two-thirds width input.

The user ID field is treated as a secondary escape route and is hidden inside:

```text
Use a user ID instead
```

No user ID example is shown. The copy tells admins to use the user ID only when copied from ResearchOps.

The user ID field uses a half-width input.

This reflects the likely content length and reduces accidental use of internal identifiers.

## Design decision: role radios instead of select

The first iteration used a select.

The current page uses radios so all role choices and short descriptions are visible at the point of decision.

Roles shown:

- Observer
- Researcher
- Research Lead
- Approver
- Safeguarding Lead
- Team Admin

The selected role updates a visible role summary.

The summary now shows plain-language abilities only. It does not show technical permission codes such as `governed.create`, `governed.edit`, `safeguarding.view` or `team.manage`.

## Design decision: governed duration instead of arbitrary date-time

The first iteration used a free `datetime-local` input and helper text that said leaving it blank meant no expiry date.

That was misleading because the system is intended to govern role assignment through expiry policy.

The current page asks:

```text
How long should this role last?
```

The admin must choose one of:

- 30 days
- 60 days
- 90 days
- 180 days
- Until a specific date

No option is pre-selected.

If the admin chooses a specific date, the UI reveals day, month and year fields. It does not ask for time. The client treats expiry as the end of the selected day.

The client converts the chosen duration into `expiresAt` for the API request. The server remains authoritative.

## Design decision: GOV.UK component conformance pass

The final pass tightened the markup and styles around GOV.UK component conventions:

- breadcrumb navigation replaces the back link
- details component uses `govuk-details__summary` and `govuk-details__summary-text`
- role and duration choices use GOV.UK radio markup
- sensitive confirmations use GOV.UK-style warning text plus checkbox fieldsets
- the check-and-confirm state uses summary-list classes
- width utility classes are used for two-thirds and one-half input widths
- plain-language role abilities replace technical permission codes

## Client implementation

Client script:

```text
public/js/auth-role-assignment-page.js
```

The script:

- loads `/api/me`
- detects `role.assign`
- hides the form when role assignment is unavailable
- shows team scope when role assignment is available
- presents role metadata as plain-language abilities
- reveals sensitive-role confirmations only when needed
- reveals custom expiry date inputs only when `Until a specific date` is selected
- validates the form before the check-and-confirm panel
- prevents POST during ordinary form submit
- builds the GOV.UK summary-list review state
- sends the API request only from the confirm button
- shows success and error responses

## Styling

Stylesheet:

```text
public/css/auth-role-assignments.css
```

Current styling covers:

- compact team-scope panel
- blocked-access state
- two-thirds width email field
- half-width user ID field
- two-thirds width reason textarea
- GOV.UK details arrow affordance
- radio label and hint alignment
- GOV.UK-style date input sizing
- GOV.UK-style warning text
- checkbox confirmation blocks
- summary-list review state
- success and error result panels
- responsive full-width behaviour on small screens

## Request contract

The UI sends:

```text
targetEmail
targetUserId
roleKey
requestedReason
expiresAt
sensitiveRoleConfirmation
safeguardingConfirmation
```

The API remains authoritative.

If both target identifiers are supplied, the API requires them to resolve to the same user.

## Sensitive role controls

Sensitive roles require:

```text
sensitiveRoleConfirmation = ASSIGN_SENSITIVE_ROLE
```

The `safeguarding_lead` role additionally requires:

```text
safeguardingConfirmation = ASSIGN_SAFEGUARDING_LEAD
```

The UI shows these confirmations only when needed for the selected role.

## Validation

Route-state test:

```text
tests/auth-role-assignment-ui-route-state.test.js
```

The test now checks:

- page structure
- breadcrumb-based admin information architecture
- breadcrumb placement before the main landmark
- removal of back links
- removal of the clear form reset control
- removal of the self-access panel from the successful state
- team-scope messaging
- user ID details component without a user ID example
- role radios instead of select
- governed duration radios
- conditional custom date inputs
- use of `/api/me`
- use of `/api/auth/role-assignments`
- same-origin API calls by default
- `credentials: "include"`
- `role.assign` gate
- request contract fields
- client validation messages
- check-and-confirm before POST
- plain-language role abilities
- absence of technical permission codes in the UI
- GOV.UK warning text, checkbox and summary-list hooks
- stylesheet hooks for width affordance and review state

The test is wired into:

```text
scripts/validate.sh
```

## Visual walkthrough registry

The visual walkthrough registry was previously updated to include:

```text
/pages/team/role-assignments/index.html
```

The walkthrough state waits for:

```text
You are assigning roles in
```

rather than the removed first-iteration access message.

## Unit test failure fix

The first CI unit-test run failed in:

```text
tests/visual-walkthrough-registry.test.js
```

Failure:

```text
Expected visual walkthrough registry to include public route: /pages/team/role-assignments/index.html
```

Cause:

The new public page had been added, but the visual walkthrough registry had not been updated. The registry test discovers every public HTML page and requires each non-excluded route to have a registered walkthrough page entry.

Fix applied:

- added `teamRoleAssignments` to `operationalPaths`
- added deterministic Team Admin `/api/me` fixture data to `visual-walkthrough.operational-fixtures.mjs`
- added a route-specific `teamRoleAssignments` design-risk entry
- registered `team-role-assignments` in `visual-walkthrough.config.mjs`
- set its default state to use the deterministic Team Admin context

This makes the new route visible to the visual walkthrough system rather than bypassing the test.

## Feature preview API-origin fix

Manual testing on the Cloudflare Pages feature-branch preview showed the page loaded but the first iteration current access panel displayed:

```text
Could not confirm your team role access.
Load failed
```

Cause:

The client forced `pages.dev` origins to call the Worker origin directly:

```text
https://rops-api.digikev-kevin-rapley.workers.dev
```

That bypassed the Pages `_redirects` same-origin `/api/*` proxy. In the browser, the call could fail before returning a normal JSON API error because the page was making a cross-origin authenticated request from the Pages preview.

Fix applied:

The default API base is now same-origin:

```text
API_BASE = document.documentElement.dataset.apiOrigin || window.API_ORIGIN || ""
```

This means feature previews call:

```text
/api/me
/api/auth/role-assignments
```

on the same Pages preview origin, allowing `_redirects` to proxy to the Worker while keeping browser credentials and CORS behaviour aligned.

The route-state test asserts the client no longer hard-codes the Worker URL.

## Cloudflare Access runtime evidence

Manual retesting on the branch preview later confirmed:

```text
GET /api/me
```

returned:

```text
ok = true
authenticated = true
provider = cloudflare_access
active team = team_researchops_core
roles include Safeguarding Lead and Team Admin
permissions include role.assign
```

This evidence showed the page could detect the seeded Team Admin context once Cloudflare Access AUD and team-domain configuration were corrected outside this repository.

Raw personal identifiers are not committed in this trace.

## Final stabilisation pass

A final stabilisation pass was completed on PR #220.

It:

- moved breadcrumb navigation before the main landmark
- repaired the role-assignment page markup after a compacted intermediate edit
- removed a transient stray non-ASCII artefact introduced during editing
- asserted breadcrumb placement in the route-state test
- confirmed the PR was mergeable after the pass
- confirmed the latest checked CI set was green

## Product documentation

Product documentation lives at:

```text
docs/product/26/05/09/auth-role-assignment-ui-2026-05-09.md
```

## Boundary

This slice does not create a user search endpoint.

This slice does not create users.

This slice does not create team memberships.

This slice does not resolve the target user before the check-and-confirm panel.

This slice does not list all team members.

This slice does not add role removal.

This slice does not support permission exceptions.

This slice does not run the D1 route-status workflow.

## Required operational follow-up after merge

After merge and deployment, test the page with the seeded Team Admin account.

Recommended checks:

1. open `/pages/team/role-assignments/`
2. confirm the page shows active team scope
3. confirm the page hides the form for users without `role.assign`
4. choose a non-sensitive role and a governed duration
5. confirm the check-and-confirm panel appears before the write
6. assign a non-sensitive role to an existing active team member
7. confirm success output
8. confirm `auth_role_assignments` contains the role assignment
9. confirm `auth_audit_events` contains `auth.role_assignment.created`
10. attempt Safeguarding Lead without confirmations and confirm it is blocked
