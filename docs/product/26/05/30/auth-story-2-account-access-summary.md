# Story 2 — See my account, teams, roles and access summary

**Date:** 2026-05-30  
**Epic:** ROPS-AUTH-P1-000 — Governed access, permissions and audit  
**Story:** See my account, teams, roles and access summary  
**Branch:** `feature/account-access-summary`  
**Status:** alpha implementation plan

## Story

As a signed-in ResearchOps user, I need to see my account, teams, roles and access summary, so that I understand who I am signed in as, which teams I belong to, what role I hold in each team and what I can do from here.

## Team position

Story 2 should make access understandable.

It should not make access changeable.

## Intent

Story 1 established stable identity resolution.

Story 2 makes that identity and access context understandable to the user. It presents account identity, team membership, role scope and task-based access in plain English.

It does not add role requests, role approval, team switching or permission management.

## Product principles

1. A user may belong to more than one team.
2. A user may hold different roles in different teams.
3. A current team context may exist, but it is not the user’s whole account state.
4. Roles and capabilities must be shown where they apply.
5. Users should see task-based descriptions, not raw permission codes.
6. Hidden UI actions are not the security boundary.
7. The Worker remains responsible for server-side enforcement.

## Acceptance criteria

### AC1 — Show account identity

Given I am signed in, when I visit my account page, then I see my display name, email address and account status, and no session token, provider token or raw identity-provider claim is shown.

### AC2 — Show all active team memberships

Given I belong to one or more teams, when I visit my account page, then each active team membership is listed separately.

### AC3 — Show current team context without hiding other teams

Given I have a current team context, when I visit my account page, then that team is marked as current, and my other active team memberships remain visible.

### AC4 — Show roles within the team where they apply

Given I have different roles in different teams, when I visit my account page, then each role is shown under the team where it applies.

### AC5 — Show no-role state

Given I am a member of a team but have no active role in that team, when I visit my account page, then that team is still shown with “No active role”.

### AC6 — Show no-team state

Given I am signed in but have no active team membership, when I visit my account page, then I see that I am not currently a member of any team and I am told how to get help.

### AC7 — Show task-based access summary

Given my role grants capabilities, when I visit my account page, then I see those capabilities in plain English and not as raw permission codes.

### AC8 — Show sensitive capabilities proportionately

Given I have a sensitive capability, when I visit my account page, then the capability is described clearly without exposing sensitive records.

### AC9 — Show only relevant account actions

Given my current permissions allow account-related actions, when I visit my account page, then I see only relevant actions, and protected APIs still enforce access server-side.

### AC10 — Redirect signed-out users

Given I am not signed in, when I visit my account page, then I am redirected to the sign-in page.

## Cross-cutting accessibility criteria

The account page must:

- use headings to structure account, team and access sections
- use semantic lists, summary lists or tables for team-role summaries
- mark current team with visible text, not colour alone
- support keyboard navigation
- show loading and error states accessibly
- work at 200% zoom
- avoid colour-only meaning

## Cross-cutting API criteria

`/api/me` must:

- include stable user identity
- include active team context where available
- include `teamMemberships` or `memberTeams`
- include roles and task-based capabilities per team
- exclude provider tokens
- exclude session tokens
- exclude raw identity-provider claims

## Cross-cutting test criteria

Automated tests must cover:

- one team, one role
- multiple teams, different roles
- team with no active role
- signed-in user with no team
- current team marker
- plain-English capability labels
- absence of raw permission codes in visible labels
- unauthenticated redirect
- no token leakage

## Out of scope

This story does not include:

- creating a team
- joining a team
- switching active team
- requesting a role
- approving role requests
- assigning permissions
- revealing participant PII
- viewing audit logs
- managing users
- editing team settings

## Definition of done

Story 2 is done when a signed-in user can open their account page and answer four questions without needing to understand the data model:

- Who am I signed in as?
- Which team context am I currently using?
- Which teams and roles do I have?
- What can I do from here?
