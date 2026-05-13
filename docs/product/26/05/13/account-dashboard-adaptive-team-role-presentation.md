# Account dashboard adaptive team and role presentation

**Date:** 2026-05-13  
**Status:** product decision  
**Area:** account dashboard, team-scoped roles, ResearchOps Core Team administration

## Context

The account dashboard now has the correct access data available from `/api/me`.

It can show the teams a user belongs to and the roles they hold in each team.

The first working version rendered this as a table with three columns:

- team
- role or roles
- permissions

This was technically correct but visually heavy and hard to scan.

It also mixed two different concepts:

- role membership, which helps a user understand where they belong
- capabilities or permissions, which explain what system controls are available in the current context

## Decision

The account dashboard must adapt its presentation based on the user's membership shape.

### One team

If a user belongs to one team, show a simple summary-card view.

The card should show:

- team name
- role or roles in that team

Do not show a multi-team list or a table.

### More than one team

If a user belongs to more than one team, show a list of team memberships.

Each list item should show:

- team name
- role or roles in that team

Do not show detailed permission labels in the team-membership list.

The account dashboard can still show current permissions separately because those permissions drive actions and controls.

### ResearchOps Core Team Admin

If a user is a Team Admin in ResearchOps Core Team, explain the extra administrative capability in plain English.

Use a short inset text after the relevant team membership.

The text should make clear that this role can manage roles across teams and create new teams.

Do not force all global permission labels into the team-membership display.

## Rationale

A table is useful when users need to compare values across rows and columns.

The account dashboard is not primarily a comparison task.

The user needs to answer simpler questions:

- Who am I signed in as?
- Which team or teams do I belong to?
- What role or roles do I have there?
- What can I do now?

A summary card supports the single-team case better because there is no comparison to make.

A list supports the multi-team case better because it reads as memberships rather than data rows.

Permissions remain important, but they should sit under `Current permissions` and actions rather than inside the team-membership display.

## Role input

### GOV.UK Design System

The GOV.UK bundle requires using appropriate components for the task rather than using tables for layout. The table component should be used for structured data where values relate to both columns and rows. Summary lists are better for key-value information, such as a user's account details.

### Interaction design

The interaction design concern is task flow and cognitive load. The dashboard should not ask a single-team user to interpret a multi-team structure. It should progressively reveal complexity only where the account state requires it.

### Content design

The content design concern is clarity. The account dashboard should use plain language such as `Your team`, `Your teams`, and `Role or roles`. It should avoid exposing implementation terms such as permission codes in the team-membership display.

### Information architecture

The IA concern is keeping related information together while avoiding false equivalence. Team membership and capabilities are related but not the same information type. The dashboard should separate team-role membership from current permissions.

### Service design and product

The service-design concern is that Team Admin in ResearchOps Core Team is a different service state from ordinary team membership. The UI should acknowledge this extra capability without making the basic account view harder to use.

## Acceptance criteria

Given a user belongs to one team, when they view their account dashboard, then they see a simple `Your team` summary card.

Given a user belongs to one team, when they view their account dashboard, then they do not see a multi-team table.

Given a user belongs to more than one team, when they view their account dashboard, then they see a `Your teams` list.

Given a user belongs to more than one team, when they view their account dashboard, then each team shows the role label or labels for that team.

Given a user is Team Admin in ResearchOps Core Team, when they view the account dashboard, then they see a short explanation that they can manage roles across teams and create new teams.

Given a user has permissions, when they view team membership information, then permission labels are not mixed into the team-membership display.

Given a user has permissions, when they view the account dashboard, then current permissions can still be shown in the `Current permissions` section.

## Implementation notes

`public/js/auth-account-page.js` should render single-team and multi-team states through separate functions.

`renderSingleTeamMembership()` should use GOV.UK summary-card and summary-list markup.

`renderMultipleTeamMemberships()` should use GOV.UK summary-card and spaced list markup.

`renderTeamMemberships()` should decide between those states based on membership count.

`renderPermissions()` should remain separate from team-membership rendering.

The route-state test should block regression to the earlier table-based design.
