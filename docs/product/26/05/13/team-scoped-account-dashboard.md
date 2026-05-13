# Team-scoped account dashboard model

**Date:** 2026-05-13  
**Status:** product behaviour note  
**Area:** account dashboard, team membership, role scoping

## Problem

The account dashboard previously presented a single `Active team` and `Current roles` pair.

That presentation made the account model look one-to-one:

- one user
- one team
- one set of roles

That is not the ResearchOps access model.

A user can belong to multiple teams. The same user can hold different roles and privileges in each team.

## Required behaviour

The account dashboard must show the user's team memberships as a list.

For each team, the dashboard must show:

- team name
- active role or roles in that team
- active permissions available through those roles

The dashboard must not rely on a single `Active team` and `Current roles` summary as the main representation of access.

## Example shape

| Team | Role or roles | Permissions |
|---|---|---|
| Home Office Biometrics | Researcher | Create governed research records, update governed research records |
| Border Force | Observer | Observe low-risk research context |
| Asylum and Immigration | Researcher, Team Admin | Create governed research records, manage team membership, assign roles |

## Current team context

ResearchOps may still maintain a current or selected team context for permission checks and task routing.

That current context must not be presented as if it is the user's whole account state.

The account dashboard can mark the current team, but the primary account view must remain the full list of team memberships and scoped roles.

## Acceptance criteria

Given a user belongs to one team, when they view their account dashboard, then they see that team and their active role or roles in that team.

Given a user belongs to more than one team, when they view their account dashboard, then they see each team listed separately.

Given a user has different roles in different teams, when they view their account dashboard, then each role is shown under the team where it applies.

Given a user has no active roles in a team, when they view their account dashboard, then that team shows `No active role` rather than hiding the team.

Given a current team context exists, when the dashboard marks that team as current, then the dashboard still shows the user's other team memberships.

Given permissions are shown, when a user reads the dashboard, then permissions are grouped under the team where the role gives access rather than shown as global privileges.

## Implementation notes

The `/api/me` response should include an enriched membership collection such as `teamMemberships` or `memberTeams`.

Each membership item should include the team identity and the active roles and permissions for that team.

The account UI should render the membership collection with GOV.UK table markup.

Actions may still be driven by the current permission context, but the user-facing account summary should expose all team memberships so cross-team access is visible and auditable.
