# Authentication role assignment UI

Date: 2026-05-09

## Purpose

A Team Admin account now exists in live D1. The role-assignment API has been merged into `main`, but applying roles through raw endpoint calls is not a usable operating model.

This slice adds a first Team Admin UI for assigning D1-backed roles to existing team members.

The page is:

```text
/pages/team/role-assignments/
```

## User need

As a Team Admin, I need to assign a role to an existing team member, so that role changes can be made through a governed interface rather than manual SQL or ad hoc API calls.

## Implemented page

The page contains:

- current signed-in user and active team status
- role-assignment form
- target member email field
- optional target user ID field
- role selector
- role summary panel
- audit reason textarea
- optional expiry field
- sensitive-role confirmation checkbox
- Safeguarding Lead confirmation checkbox
- GOV.UK-style error summary
- success and error result panels

## Runtime behaviour

The page checks the signed-in user's current access by calling:

```text
GET /api/me
```

The client enables the submit button only when the active team context includes:

```text
role.assign
```

The page submits role assignments to:

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

## Roles shown

The first UI supports assigning the seeded D1 roles:

- Observer
- Researcher
- Research Lead
- Approver
- Safeguarding Lead
- Team Admin

The UI shows the role description and permission codes before submission.

## Validation

The client validates before POST:

- at least one target identifier exists
- role is selected
- requested reason is at least 12 characters
- expiry date is parseable when provided
- sensitive confirmation is present for sensitive roles
- safeguarding confirmation is present for Safeguarding Lead

The server remains authoritative.

## Accessibility and GOV.UK pattern use

The page uses:

- `govuk-error-summary`
- form groups with labels, hints and error messages
- fieldsets for sensitive confirmations
- visible role summary before submission
- `aria-live` regions for status and result messages
- `aria-busy` while checking current access

## Boundary

This slice does not create a user search endpoint.

This slice does not create users.

This slice does not create team memberships.

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
2. confirm the page detects `role.assign`
3. assign a non-sensitive role to an existing active team member
4. confirm success output
5. confirm `auth_role_assignments` contains the role assignment
6. confirm `auth_audit_events` contains `auth.role_assignment.created`
7. attempt Safeguarding Lead without confirmations and confirm it is blocked
