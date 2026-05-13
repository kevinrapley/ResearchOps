# Account registration and team-scoped access iteration log

**Date:** 2026-05-13  
**Status:** product iteration log  
**Area:** account registration, role assignment, team-scoped access, account dashboard

## Purpose

This note backfills the product decisions made during the account registration and team-scoped access work on PR #250.

The branch moved from an account-registration request form into a broader access-model correction because the registration flow, role-assignment flow, account dashboard and preview Worker deployment all depend on the same account context.

## Original need

Users needed to request a ResearchOps account.

The registration request needed to capture:

- full name
- work email address
- team or service
- what the user needs to use ResearchOps for
- why the user needs access

The request must not directly set a role.

A Team Admin must review the request and decide which team access or role, if any, to assign.

## Content and GOV.UK language decisions

The registration page was changed from role-setting language to request-and-review language.

The page now explains that:

- the user is requesting an account
- a team admin will review the request
- selecting what they need to do does not give them access
- the answer helps the reviewer decide what access may be needed

Error messages were kept user-facing.

The branch avoids exposing implementation language such as database table names, route codes or JSON body terms in user-facing errors.

## Registration journey decisions

The registration journey uses a check-answers step before sending the request.

The check-answers `Change` links must reveal the relevant form field and preserve the answer.

The check-answers container must not receive a visible focus ring. Focus rings are for controls and links, not passive content regions.

`Send request` must work in both preview and production environments.

## Field affordance and vertical rhythm decisions

The registration form originally used full-width fields.

The fields were changed to more appropriate GOV.UK-style widths.

Full name, work email address and team or service use a sensible fluid width rather than full page width.

The vertical rhythm between introductory text and the form area was adjusted so the page does not feel cramped.

## Signed-in registration redirect

Signed-in users should not use the account registration page.

The registration page now follows the same logic as sign-in:

- check `/api/me`
- if authenticated, redirect to `/pages/account/`
- otherwise, show the registration request form

## Role assignment and team selection decisions

The role-assignment journey must not silently default an assignment to ResearchOps Core Team.

A Team Admin should select the team where the role applies.

A Team Admin in ResearchOps Core Team can create a new team during role assignment.

When a new team is created during role assignment, the target user must be added to that team and the role assignment must be scoped to that team.

The role assignment must activate a pending user where needed.

## Team-scoped access model

The intended model is:

- a user has one account identity
- a user can belong to many teams
- a user can hold different roles in different teams
- role assignments are scoped to a team
- permissions apply through the selected or current team context
- a role in one team must not leak privileges into another team

ResearchOps Core Team is the global administration exception.

A Team Admin in ResearchOps Core Team can administer all teams and create new teams.

For teams other than ResearchOps Core Team, role and permission effects stay inside the team boundary.

## Scenario-specific role clarification

The examples of `User Researcher` and `Note-taker` were not implemented as hard-coded role catalogue changes.

The branch keeps the generic role-assignment model already in the database.

The important rule is team-scoped role assignment, not the specific role names used in examples.

## Account dashboard data decisions

The account dashboard first showed a single `Active team` and `Current roles` summary.

That was incorrect for the access model because users can belong to multiple teams.

The dashboard was changed to use team memberships as the primary account shape.

`/api/me` now exposes `memberTeams` and `teamMemberships` data so the account page can show role membership by team.

When preview data had active role assignments but missing team-membership rows, the backend was made more robust by recovering team membership from active team-scoped role assignments.

This keeps the dashboard usable while the role-assignment write path continues to create membership rows properly.

## Account dashboard presentation decisions

The first working dashboard rendered team memberships in a table with permissions.

That was rejected because it was visually heavy and mixed different types of information.

The current decision is:

- one team: show a simple `Your team` summary card
- multiple teams: show a `Your teams` list
- ResearchOps Core Team Admin: add a short explanatory inset
- show role labels in the team membership display
- keep permission labels in the separate `Current permissions` section

## Preview deployment decision

The preview Worker deployment originally did not run on the PR branch because the workflow only targeted `main` and `feature/**`.

The branch name was `fix/account-auth-redirect-and-team-selection`.

The deploy workflow was updated to include `fix/**` so preview Worker changes can deploy from this branch class.

## Documentation and trace gap

Several implementation changes were made before this product iteration log was created.

That created a gap between the product reasoning and the repository record.

This file backfills the product decision record.

The related agent trace backfill lives under:

`docs/agent-audit/reasoning/2026/05/13/`

## Current acceptance criteria

Given a user is signed in, when they open `/pages/account/register/`, then they are redirected to `/pages/account/`.

Given a Team Admin assigns a role, when they choose an existing team, then the target user is assigned in that team rather than ResearchOps Core Team by default.

Given a Team Admin creates a new team during role assignment, when the assignment succeeds, then the target user is a member of the new team and the role is scoped to that team.

Given a user belongs to one team, when they open their account dashboard, then they see a simple summary of that team and role or roles.

Given a user belongs to multiple teams, when they open their account dashboard, then they see each team and the roles they hold in each team.

Given a user is Team Admin in ResearchOps Core Team, when they open their account dashboard, then they see that they can manage roles across teams and create new teams.

Given a user has permissions, when they view team membership information, then permissions are not mixed into the team-membership display.

Given a user has permissions, when they view the account dashboard, then current permissions can still be shown separately to explain available actions.
