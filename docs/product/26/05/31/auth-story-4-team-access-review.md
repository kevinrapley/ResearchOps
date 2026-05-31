# Story 4 — Team Admin reviews team access requests

**Date:** 2026-05-31  
**Epic:** ROPS-AUTH-P1-000 — Governed access, permissions and audit  
**Story:** Team Admin reviews team access requests  
**Branch:** `feature/team-access-request-review-v2`  
**Status:** alpha implementation plan

## Story

As a Team Admin, I need to approve or reject team access requests for teams I administer, so that people only become team members after review.

## Team position

Story 4 can approve team membership.

It must not assign roles, permissions or sensitive access.

## Scope

This story includes:

- Team Admin review page
- pending request list
- empty state
- approve request
- reject request
- optional rejection reason
- server-side Team Admin checks
- approval creates active membership
- approval creates no role
- decision audit events
- requester account shows approved or not approved
- route-state and API tests

This story excludes:

- email notifications
- bulk decisions
- advanced filters
- appeals
- team creation
- role assignment
- permission assignment
- audit viewer

## Core acceptance criteria

### AC1 — Team Admin sees pending requests for teams they administer

Given I am signed in as a Team Admin, when I open the review page, then I see pending team access requests only for teams I administer.

### AC2 — Non-Team Admin users cannot see the review queue

Given I am not a Team Admin for a team, when I try to view its access requests, then no request data is returned and I see a plain-language access denied message.

### AC3 — Empty state is clear

Given there are no pending requests for teams I administer, when I open the review page, then I see “There are no team access requests to review.”

### AC4 — Request details are visible and safe

Given a pending request exists for a team I administer, when I review it, then I can see requester name, requester email, requested team, request date and optional message.

The optional message is escaped and does not render HTML.

### AC5 — Team Admin can approve a pending request

Given I am a Team Admin for the requested team, when I approve a pending request, then the request becomes approved and an active team membership is created.

### AC6 — Approval does not assign a role

Given I approve a request, when the decision is saved, then no role assignment, permission exception or sensitive access is created.

### AC7 — Approved requester sees team membership with no active role

Given my request is approved, when I view my account page, then the team appears under “Your teams and roles” and the role state says “No active role”.

### AC8 — Team Admin can reject a pending request

Given I am a Team Admin for the requested team, when I reject a pending request, then the request becomes rejected and no team membership is created.

### AC9 — Rejection can include an optional reason

Given I reject a request, when I provide a reason, then the reason is stored and safely shown to the requester where appropriate.

### AC10 — Rejection reason has a linked privacy hint

Given I enter a rejection reason, when I use assistive technology, then the warning not to include participant names, contact details or sensitive research information is linked to the textarea using `aria-describedby`.

### AC11 — Requester sees not-approved state

Given my request is rejected, when I view my account page, then I see that the request was not approved and I do not gain team access.

### AC12 — Already reviewed or cancelled requests cannot be decided

Given a request is approved, rejected or cancelled, when a Team Admin tries to decide it again, then no change is made and a clear message is shown.

### AC13 — Self-approval is blocked

Given I submitted a request, when I try to approve my own request, then the platform blocks the action and no membership, role or permission is created.

### AC14 — Server checks authority and state

Given a decision is submitted, when the API receives it, then the Worker checks Team Admin authority, request status, requester identity and target team status before changing anything.

### AC15 — Decision is audited

Given a Team Admin approves or rejects a request, when the decision is saved, then an access-control audit event records actor, requester, team, request ID, decision, result and timestamp.

### AC16 — Review flow is accessible and plain English

Given I use the review flow, when I read or act on the page, then headings, labels, actions, status text, errors and confirmations are accessible and plain language.

### AC17 — Tests cover the review flow

Automated tests cover viewing, approving, rejecting, rejected reason, no-role approval, access denial, cancelled request, already reviewed request, self-approval, audit event, requester account state and accessible structure.

## Definition of done

Story 4 is done when a Team Admin can review a pending team access request, approve or reject it, and the requester sees the outcome.

The Team Admin should understand:

- I approved team membership only.
- I did not assign a role.
- I did not grant sensitive access.

Final principle:

Story 4 lets a Team Admin open or close the team door. It must not hand out keys to rooms inside the building.
