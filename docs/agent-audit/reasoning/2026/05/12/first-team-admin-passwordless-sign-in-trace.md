# Agent trace: first Team Admin passwordless sign-in journey

Date: 2026-05-12

Branch: `fix/team-admin-sign-in-journey`

Repository: `kevinrapley/ResearchOps`

Slice: `first-team-admin-passwordless-sign-in`

## Purpose

This trace records the implementation and review response for the first Team Admin passwordless sign-in journey.

The goal of the slice is to let the first Team Admin sign in through a ResearchOps-owned one-time-code flow, reach a signed-in account dashboard, sign out, and access Team Admin role-assignment controls.

## Scope

The slice covers:

1. passwordless email-code sign-in
2. passwordless session resolution
3. account dashboard redirect behaviour
4. signed-in account dashboard content
5. permission-led dashboard actions
6. Team Admin role-assignment UI access
7. automated Codex review fixes for passwordless security boundaries
8. visual walkthrough and test contract alignment for the new account route

## Key decisions

The implementation keeps the user inside ResearchOps UI rather than exposing Cloudflare Access UI.

Successful sign-in redirects users from:

```text
/pages/account/sign-in/
```

to:

```text
/pages/account/
```

Already-authenticated users who visit the sign-in page are also redirected to the account dashboard.

The account dashboard renders actions from permission codes rather than role labels. This means the UI is governed by capabilities such as:

```text
role.assign
governed.approve
safeguarding.view
audit.view
```

The branch preview uses the preview Worker API origin for passwordless endpoints. This keeps the Team Admin session and permissions tied to the Worker context used by the branch preview.

## Implemented behaviour

The sign-in page supports a two-step passwordless journey:

1. submit a work email address
2. submit the six digit one-time code

The Worker exposes:

```text
POST /api/auth/email/start
POST /api/auth/email/verify
POST /api/auth/logout
```

The account dashboard exposes:

- signed-in user details
- active team
- current roles
- permission-based actions
- visible permissions
- sign out

The role-assignment page loads the Team Admin context through `/api/me` and displays the assign-a-role form when the signed-in user has the required permission.

## Codex review findings addressed

Codex raised two P1 findings against the passwordless session implementation.

### P1: enforce attempt limits before verifying codes

The original verifier decremented `attempts_remaining` after failed codes but did not reject a challenge whose attempts had already reached zero.

The implementation now:

- checks `attempts_remaining` before comparing the submitted code
- returns `code_attempts_exceeded` once the limit has been consumed
- locks the challenge when the final permitted attempt is used
- records `auth.email_code.locked`

This restores the intended five-attempt boundary for issued one-time-code challenges.

### P1: exclude expired role assignments from permissions

The original passwordless session context returned permissions for active role assignments without applying the `expires_at` boundary.

The implementation now filters both role and permission queries using:

```text
ra.expires_at IS NULL OR ra.expires_at > strftime(...)
```

This prevents expired temporary access from continuing to authorise protected routes through `/api/me`.

## Test failures reviewed and fixed

The branch initially had three failing unit-test areas.

### Agent trace coverage

The trace coverage test expected at least one committed JSON trace for the current day under:

```text
docs/agent-audit/reasoning/2026/05/12
```

A JSON trace was added for the slice.

This Markdown trace was then added as the human-readable companion so the trace follows the established dual-format convention.

### Reports-site validation counts

The committed reporting-site validation expected the previous manifest counts.

The new account dashboard route added one page, one state and two screenshots.

The validation contract was updated from:

```text
22 pages
39 states
78 captures
78 screenshots
```

to:

```text
23 pages
40 states
80 captures
80 screenshots
```

### Visual walkthrough registry

The registry test discovered the new public route:

```text
/pages/account/index.html
```

but the route was not registered in `visual-walkthrough.config.mjs`.

The route was added as `account-dashboard` with deterministic Team Admin context and dashboard-specific wait text.

The sign-in capture was also corrected to represent the code-request page rather than the signed-in dashboard state.

## Validation evidence

After the Codex and test-contract fixes, the branch validation checks reached a passing state before this Markdown companion trace was added.

The passing checks included:

- `Format pull request`
- `CI`
- `Validate ResearchOps`
- `qa-bdd`
- `Release Gate`
- `Accessibility audit (pa11y-ci)`
- `QA — Broken links (Lychee)`
- `Worker CI`

Worker CI completed its validation contract, Prettier check, ESLint, unit tests and Worker deployment-bundle validation successfully.

## Files changed in this review pass

- `infra/cloudflare/src/core/auth/passwordless.js`
- `tests/auth-sign-in-route-state.test.js`
- `visual-walkthrough.config.mjs`
- `tests/reports-site-validation.test.js`
- `docs/agent-audit/reasoning/2026/05/12/first-team-admin-passwordless-sign-in-trace.json`
- `docs/agent-audit/reasoning/2026/05/12/first-team-admin-passwordless-sign-in-trace.md`

## Manual verification recorded from preview

The branch preview confirmed:

- `/pages/account/sign-in/` sends a one-time code by email
- the emailed code verifies successfully
- successful verification redirects to `/pages/account/`
- `/pages/account/` shows the signed-in account dashboard
- the dashboard shows active team and current roles
- permission-based actions appear from capability codes rather than role labels
- sign out returns the user to `/pages/account/sign-in/`
- visiting `/pages/account/sign-in/` while already signed in redirects back to `/pages/account/`
- the Team Admin can open `/pages/team/role-assignments/` and see the assign-a-role form

## Boundaries

This slice does not add a user-facing route for requesting an account.

This slice does not prove final role-assignment submit in preview because the preview environment only contains the first Team Admin account.

Production passwordless deployment remains separate from this preview validation path.

## Residual risks

The sign-in flow now has attempt limiting at the challenge level. Future hardening should consider email-level and IP-adjacent throttling where that can be done without creating unsafe operational lockout behaviour.

The dashboard exposes capability-led actions. Future review should check whether each action has enough plain-English explanation for less technical Team Admins.

The role-assignment submit path still needs live evidence once there is a second active team member to receive a role assignment.
