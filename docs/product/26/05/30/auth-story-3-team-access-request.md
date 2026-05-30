# Story 3 — Request access to a team

**Date:** 2026-05-30  
**Epic:** ROPS-AUTH-P1-000 — Governed access, permissions and audit  
**Story:** Request access to a team  
**Branch:** `feature/team-access-request`  
**Status:** alpha implementation plan

## Story

As a signed-in ResearchOps user without the team access I need, I need to request access to a team, so that a Team Admin can review my request before I can use team-scoped ResearchOps records.

## Team position

Story 3 should let users ask to enter a team.

It should not decide what they can do once they are inside.

## In scope

- no-team prompt
- request access page
- submit access request
- duplicate request handling
- pending request state
- pending access does not grant access
- cancel pending request
- audit event for request and cancellation
- plain-language and accessible flow

## Out of scope

- Team Admin approval queue
- approve or reject request
- role request
- role assignment
- team switching
- team creation
- notification delivery
- PII access
- audit viewer

## Core acceptance criteria

1. A signed-in user with no active team sees a route to request access.
2. The request page is titled “Request access to a team”.
3. A valid request creates a pending team access request.
4. Missing or invalid form entries show accessible errors.
5. Restricted teams are not exposed by search or error text.
6. Duplicate pending requests are not created.
7. Active members cannot request the same team again.
8. Pending requests appear separately from active team memberships.
9. Pending requests do not grant team-scoped access.
10. A user can cancel a pending request.
11. Request and cancellation actions are recorded as access-control events.
12. Server checks treat only active membership as membership.
13. The flow uses plain language.
14. The flow is accessible.
15. Tests cover the request-access flow.

## Definition of done

Story 3 is done when a signed-in user can request team access, see that request as awaiting review, cancel it if needed and remain blocked from team-scoped records until active membership is granted.
