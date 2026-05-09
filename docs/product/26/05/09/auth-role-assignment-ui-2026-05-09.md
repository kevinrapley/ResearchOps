# Authentication role assignment UI

Date: 2026-05-09

## Purpose

A Team Admin account now exists in live D1. The role-assignment API has been merged into `main`, but applying roles through raw endpoint calls is not a usable operating model.

This slice adds a Team Admin UI for assigning D1-backed roles to existing team members.

The page is:

```text
/pages/team/role-assignments/
```

## User need

As a Team Admin, I need to assign a role to an existing team member, so that role changes can be made through a governed interface rather than manual SQL or ad hoc API calls.

## Second iteration design changes

The second iteration changes the page from an authentication diagnostic plus form into a safer administrative task flow.

The prominent “Your current access” panel has been removed from the successful state. The page still checks `/api/me`, but it now only shows a compact team-scope statement when the user can assign roles.

The default successful state says which team the admin is managing:

```text
You are assigning roles in ResearchOps Core Team.
```

If the user cannot assign roles, the page shows a blocking message instead of the form.

## Implemented page

The page contains:

- compact team-scope panel
- team member email field
- user ID field hidden inside a details component
- role radios with role descriptions
- role summary panel with permission codes
- governed access-duration radios
- conditional date input for a specific expiry date
- audit reason textarea
- sensitive-role confirmation checkbox
- Safeguarding Lead confirmation checkbox
- GOV.UK-style error summary
- check-and-confirm panel
- success and error result panels

## Runtime behaviour

The page checks the signed-in user's current access by calling:

```text
GET /api/me
```

The client enables the form only when the active team context includes:

```text
role.assign
```

The form submit action does not immediately write to D1. It validates the form and shows a check-and-confirm panel first.

The write only happens when the admin selects:

```text
Confirm and assign role
```

The page then submits to:

```text
POST /api/auth/role-assignments
```

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

The API accepts either `targetEmail` or `targetUserId`. If both are sent, the API requires both to resolve to the same user.

## Team member fields

The email field is the primary target identifier and uses a two-thirds width.

The user ID field is hidden inside a details component labelled:

```text
Use a user ID instead
```

This keeps the normal path focused on the human-readable sign-in email address while preserving an escape route for known user IDs.

The user ID field uses a half-width input because user IDs are shorter and more structured than email addresses.

## Role selection

The role selector is now a set of radios rather than a select.

This makes every available role visible at the point of decision and allows each role to carry a short description.

The first UI supports assigning the seeded D1 roles:

- Observer
- Researcher
- Research Lead
- Approver
- Safeguarding Lead
- Team Admin

The UI shows the selected role description and permission codes before confirmation.

## Access duration

The first iteration used an arbitrary date-time field and helper text that implied no expiry date.

That was incorrect for a governed role-assignment model. The second iteration asks:

```text
How long should this role last?
```

The admin must choose one of:

- 30 days
- 60 days
- 90 days
- 180 days
- Until a specific date

The standard maximum is described as 180 days. No duration is pre-selected.

If the admin chooses a specific date, the page reveals a GOV.UK-style day, month and year date input. The UI treats the expiry as the end of the selected day, rather than asking for an arbitrary time.

The client converts the selected duration or date into `expiresAt` for the API request. The server remains authoritative.

## Sensitive role controls

For sensitive roles, the user must tick:

```text
I confirm this sensitive role assignment is intentional.
```

This sends:

```text
sensitiveRoleConfirmation = ASSIGN_SENSITIVE_ROLE
```

For `safeguarding_lead`, the user must also tick:

```text
I confirm Safeguarding Lead access is required.
```

This sends:

```text
safeguardingConfirmation = ASSIGN_SAFEGUARDING_LEAD
```

## Validation

The client validates before showing the check-and-confirm panel:

- at least one target identifier exists
- role is selected
- access duration is selected
- custom expiry date is real when used
- requested reason is at least 12 characters
- sensitive confirmation is present for sensitive roles
- safeguarding confirmation is present for Safeguarding Lead

The server remains authoritative.

## Accessibility and GOV.UK pattern use

The page uses:

- `govuk-error-summary`
- form groups with labels, hints and error messages
- radios for single-choice role and duration decisions
- details component affordance for the secondary user ID path
- GOV.UK-style date input for specific expiry dates
- fieldsets for sensitive confirmations
- visible role summary before confirmation
- check-and-confirm panel before POST
- `aria-live` regions for team-scope and result messages
- `aria-busy` while checking current access

## Boundary

This slice does not create a user search endpoint.

This slice does not create users.

This slice does not create team memberships.

This slice does not resolve the target user before the check-and-confirm panel.

This slice does not list all team members.

This slice does not add role removal.

This slice does not support permission exceptions.

This slice does not replace the D1 route-status workflow. The route declaration still needs the operational workflow if live D1 has not already been marked implemented.

## Files

```text
public/pages/team/role-assignments/index.html
public/js/auth-role-assignment-page.js
public/css/auth-role-assignments.css
tests/auth-role-assignment-ui-route-state.test.js
```

## Operational follow-up

After merge and deployment, verify the page with the seeded Team Admin account.

Recommended checks:

1. open `/pages/team/role-assignments/`
2. confirm the page shows the active team scope
3. confirm the form is available only when `role.assign` is present
4. assign a non-sensitive role to an existing active team member
5. confirm the check-and-confirm panel appears before the write
6. confirm success output
7. confirm `auth_role_assignments` contains the role assignment
8. confirm `auth_audit_events` contains `auth.role_assignment.created`
9. attempt Safeguarding Lead without confirmations and confirm it is blocked
