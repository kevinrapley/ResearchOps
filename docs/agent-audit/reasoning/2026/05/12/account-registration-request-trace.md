# Agent trace: account registration request journey

Date: 2026-05-12

Branch: `feature/user-registration-review`

Repository: `kevinrapley/ResearchOps`

Slice: `account-registration-request`

Trigger: `[reasoning]`

## Purpose

This trace records the implementation response for the account registration request journey.

The user asked for the multidisciplinary team to review the registration implementation, then requested the changes and an agent trace in Markdown and JSON with product documentation.

The task was to improve the registration journey so a person can request a ResearchOps account without being granted a role during registration.

## Safe reasoning summary

The work was treated as an access-request service, not as a role-selection service.

The main risk was that a user-facing question about role could imply that selecting an option gives access. The implementation therefore moved the language towards purpose of use:

```text
What do you need to use ResearchOps for?
```

The route and schema still retain `requested_role_key` and `requested_role_label` for compatibility with the existing control-plane naming, but the product meaning is now review information only.

## Roles consulted

The review used the repository bundle roles requested by the user:

- GOV.UK developer
- GOV.UK accessibility specialist
- GOV.UK content designer
- GOV.UK designer
- GOV.UK QA
- GOV.UK release manager
- interaction designer
- service designer
- content designer
- operations
- developer
- information architect
- product lead
- quality lead
- security specialist
- service owner

## Interpretation of the task

The implementation needed to:

1. remove misleading role-selection language
2. avoid GOV.UK notification banner misuse on the registration form
3. add a check-answers step before submission
4. keep registration separate from role assignment
5. return duplicate pending requests safely
6. add tests proving the route does not create role assignments
7. document the product slice under `docs/product/`
8. add agent traces in both Markdown and JSON

## Source material used

The implementation drew from these repository files:

- `public/pages/account/register/index.html`
- `public/js/auth-registration-page.js`
- `public/pages/team/registration-requests/index.html`
- `public/js/auth-registration-requests-page.js`
- `infra/cloudflare/src/core/auth/registration-requests.js`
- `infra/cloudflare/migrations/0004_auth_registration_requests.sql`
- `tests/auth-registration-requests-route-state.test.js`
- existing passwordless sign-in and auth route patterns
- existing docs/agent-audit trace conventions
- existing docs/product date-based documentation pattern

## Implementation decisions

### Registration remains public

The submit route stays unauthenticated because the user may not have an account yet.

```text
POST /api/auth/registration-requests
```

### Review remains protected

The review route stays protected by `role.assign`.

```text
GET /api/auth/registration-requests
```

### Purpose of use replaces role-selection language

The form now asks what the user needs to use ResearchOps for. The options are phrased as activities:

- plan, run or analyse user research
- take notes in research sessions
- observe research sessions
- use research evidence to design or improve a service
- manage team access
- something else

### Check answers before submission

The page now has a separate check-answers section.

Submission is split into:

1. validate form
2. show answers for review
3. send request

### Duplicate requests return 200

If a pending request already exists for the same normalised email address, the route returns the existing request with `created: false` and HTTP `200`.

This avoids treating a duplicate as a newly created resource.

### Role assignment is not touched

The implementation must not write to `auth_role_assignments`.

This is checked by route-state and runtime tests.

## Files changed in this pass

- `infra/cloudflare/src/core/auth/registration-requests.js`
- `public/pages/account/register/index.html`
- `public/js/auth-registration-page.js`
- `public/pages/team/registration-requests/index.html`
- `public/js/auth-registration-requests-page.js`
- `tests/auth-registration-requests-route-state.test.js`
- `tests/auth-registration-requests-runtime.test.js`
- `docs/product/26/05/12/account-registration-request-2026-05-12.md`
- `docs/agent-audit/reasoning/2026/05/12/account-registration-request-trace.md`
- `docs/agent-audit/reasoning/2026/05/12/account-registration-request-trace.json`

## Validation added

A route-state test now checks:

- the worker routes registration requests
- migration creates a review queue
- registration does not create role assignments
- form language is review-oriented
- the form uses check answers
- the review page is read-only and points to the separate role-assignment journey

A runtime test now checks:

- valid request creates a pending user and pending request
- duplicate pending request returns HTTP `200`
- invalid email returns a user-facing error
- no SQL statement touching `auth_role_assignments` is used by the registration route

## Issues addressed from the multidisciplinary review

### Notification banner misuse

The public registration page no longer uses a GOV.UK notification banner for `Before you start` information.

The content is now normal body text and an inset text.

### Role ambiguity

The page no longer asks the user to pick a role as the primary question.

It asks what they need to use ResearchOps for.

### Review expectation

The copy says a team admin will review the request and decide what access is needed.

### Check answers

A check-answers stage has been added before the request is sent.

### Duplicate request handling

The API now distinguishes between a new request and an existing pending request.

## Boundaries

This pass does not add approval, rejection, mark-as-reviewed or return-for-more-information behaviour.

This pass does not add rate limiting or domain allow-listing.

This pass does not add email notifications.

This pass does not complete visual-walkthrough report regeneration.

## Residual risks

The team admin review page is still read-only. The next slice should add review outcome states and connect a role assignment back to the original request.

The public submit route needs abuse protection before release.

The `Team or service` field remains free text. It should become a controlled team selector or autocomplete when team records are mature enough.

The visual-walkthrough registry should be updated before this is treated as release-ready.

## Review outcome

The branch is improved and still intentionally held at review stage.

It is not release-ready.
