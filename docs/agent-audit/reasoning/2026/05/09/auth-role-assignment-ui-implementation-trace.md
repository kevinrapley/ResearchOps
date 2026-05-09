# Agent trace: auth role assignment UI implementation

Date: 2026-05-09

Branch: `feature/auth-role-assignment-ui`

Slice: `auth-role-assignment-ui`

Previous slice: authentication role assignment API, merged through PR #219.

## Purpose

A Team Admin account now exists in live D1 and the role-assignment API has been merged into `main`.

This slice adds a first Team Admin user interface for assigning D1-backed roles to existing active team members.

The page is:

```text
/pages/team/role-assignments/
```

## UI behaviour

The page loads the current authenticated context with:

```text
GET /api/me
```

It enables role assignment only when the current active team context includes:

```text
role.assign
```

It submits assignments to:

```text
POST /api/auth/role-assignments
```

## Page implementation

New page:

```text
public/pages/team/role-assignments/index.html
```

The page includes:

- current access panel
- target team member email field
- optional target user ID field
- role selector
- role summary panel
- requested reason textarea
- optional expiry field
- sensitive-role confirmation checkbox
- Safeguarding Lead confirmation checkbox
- error summary
- success and error result panels

## Client implementation

New client script:

```text
public/js/auth-role-assignment-page.js
```

The script:

- loads `/api/me`
- detects `role.assign`
- disables submission when role assignment is unavailable
- presents seeded role metadata and permission codes
- validates the form before POST
- sends the API request body expected by the merged role-assignment API
- shows success and error responses

## Styling

New stylesheet:

```text
public/css/auth-role-assignments.css
```

The stylesheet follows the existing GOV.UK-like ResearchOps page styling and Kevin's project CSS format.

It covers:

- current access panel states
- role summary panel
- sensitive confirmation blocks
- success and error result panels

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

New route-state test:

```text
tests/auth-role-assignment-ui-route-state.test.js
```

The test checks:

- page structure
- role selector options
- use of `/api/me`
- use of `/api/auth/role-assignments`
- `credentials: "include"`
- `role.assign` gate
- request contract fields
- client validation messages
- visible role metadata and permission codes
- stylesheet hooks

The test is wired into:

```text
scripts/validate.sh
```

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

## Product documentation

Product documentation lives at:

```text
docs/product/26/05/09/auth-role-assignment-ui-2026-05-09.md
```

## Boundary

This slice does not create a user search endpoint.

This slice does not create users.

This slice does not create team memberships.

This slice does not list all team members.

This slice does not add role removal.

This slice does not support permission exceptions.

This slice does not run the D1 route-status workflow.

## Required operational follow-up after merge

After merge and deployment, test the page with the seeded Team Admin account.

Recommended checks:

1. open `/pages/team/role-assignments/`
2. confirm the page detects `role.assign`
3. assign a non-sensitive role to an existing active team member
4. confirm success output
5. confirm `auth_role_assignments` contains the role assignment
6. confirm `auth_audit_events` contains `auth.role_assignment.created`
7. attempt Safeguarding Lead without confirmations and confirm it is blocked
