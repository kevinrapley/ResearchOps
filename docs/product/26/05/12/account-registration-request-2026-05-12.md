# Account registration request journey

Date: 2026-05-12

Branch: `feature/user-registration-review`

Repository: `kevinrapley/ResearchOps`

Status: review branch, not release-ready

## Purpose

This product note documents the first pass of the ResearchOps account registration request journey.

The journey lets someone ask for a ResearchOps account before they have a team role. It deliberately does not give access during registration.

A team admin reviews the request. They can use the request information to decide whether the person should be added to a team and which access they need.

## User need

As someone who needs to use ResearchOps, I need a way to request an account so that a team admin can review my access request before I can use protected service areas.

As a team admin, I need to see why someone needs access before I add them to a team or assign a role.

## Scope

This slice includes:

- public account request page
- client-side validation with GOV.UK-style error messages
- check-answers step before sending the request
- unauthenticated `POST /api/auth/registration-requests`
- protected `GET /api/auth/registration-requests`
- D1 review-queue table for pending requests
- team admin read-only review page
- route-state tests and runtime tests
- agent audit traces in Markdown and JSON

## Out of scope

This slice does not include:

- approving a request
- rejecting a request
- asking the requester for more information
- assigning a role from the registration request page
- email confirmation to the requester
- email notification to team admins
- rate limiting or domain allow-listing

Those are follow-on service states and controls.

## Key product decision

The registration form asks what the person needs to use ResearchOps for. It does not ask them to choose a system role.

The answer is stored as review information only.

The implementation must not write to `auth_role_assignments` during registration.

## User-facing journey

1. User opens `/pages/account/register/`.
2. User enters full name, work email address, team or service, purpose of use and reason for access.
3. User selects `Continue`.
4. User checks their answers.
5. User selects `Send request`.
6. Request is sent to the review queue.
7. User is told that access is not granted until a team admin reviews and approves the request.

## Team admin journey

1. Team admin opens `/pages/team/registration-requests/`.
2. Team admin sees pending requests.
3. Each request shows name, email, what the person needs to use ResearchOps for, team or service, reason for access and submitted date.
4. Team admin uses the existing role assignment journey after checking the request.

The review page is intentionally read-only in this slice.

## Content model

The public page uses these core messages:

- `Request a ResearchOps account`
- `A team admin will review your request before any team access or role is added to your account.`
- `Your answer about what you need to do does not give you access. It helps a team admin decide what access you may need.`
- `What do you need to use ResearchOps for?`
- `A team admin will review your request and decide what access you need.`
- `Check your answers before sending your request`

The form avoids exposing implementation terms such as `roleKey`, `targetUserId`, JSON body names or table names.

## Data model

Migration `0004_auth_registration_requests.sql` creates `auth_registration_requests`.

Important fields:

- `user_id`
- `email`
- `normalised_email`
- `display_name`
- `requested_role_key`
- `requested_role_label`
- `team_or_service`
- `requested_reason`
- `request_status`
- `submitted_at`

`requested_role_key` is a legacy-compatible internal key for the selected purpose of use. It must not be treated as an assigned role.

`requested_role_label` is the human-readable purpose label shown to reviewers.

## Access control

`POST /api/auth/registration-requests` is public because a requester may not have an account yet.

`GET /api/auth/registration-requests` requires `role.assign` because it exposes pending account requests to team admins.

## Validation

Client-side and server-side validation use plain-language messages.

Examples:

- `Enter your full name.`
- `Enter your email address.`
- `Enter an email address in the correct format, like name@example.com.`
- `Enter the team or service you need access for.`
- `Select what you need to use ResearchOps for.`
- `Enter why you need access.`
- `Tell us a little more about why you need access.`

## Test coverage

`tests/auth-registration-requests-route-state.test.js` asserts:

- the worker routes registration requests
- registration creates a review queue, not a role assignment
- the route captures requested purpose information only
- the registration page uses review language
- errors are user-facing
- check-answers behaviour exists
- team admin review is separate from role assignment
- sign-in links to account registration

`tests/auth-registration-requests-runtime.test.js` asserts:

- a valid request creates a pending user and registration request
- duplicate pending requests return the existing request with status `200`
- invalid email returns a user-facing error
- the registration request route does not touch `auth_role_assignments`

## Risks and follow-up work

### Review-state gap

The review page is read-only. A future slice needs explicit states for approved, rejected, more information needed, withdrawn and duplicate.

### Operational queue management

A team admin can assign a role after reading a request, but the request is not yet marked as resolved. A future slice should connect the decision outcome back to the request queue.

### Abuse and spam

The public route needs rate limiting, duplicate strategy, optional allowed-domain checks and monitoring for repeated submissions.

### Team taxonomy

`Team or service` is currently free text. A future version should connect this to known team records or an autocomplete.

### Notification model

A future version should notify team admins when a request is submitted and tell the requester when their request is reviewed.

## Release view

This is suitable for product and design review.

It should not be treated as release-ready until review decision states, rate limiting, visual walkthrough coverage and release validation have been completed.
