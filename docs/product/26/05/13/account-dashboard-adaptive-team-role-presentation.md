# Account dashboard adaptive team and role presentation

**Date:** 2026-05-13  
**Status:** product decision, revised after design review  
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

The second version removed the table but still exposed too much system model detail. It kept an `Account summary` heading for one row, used a `Current` tag for single-team users, showed an empty actions section for users with no actions, and showed permissions as a primary page section.

That still made the page feel more like an access-control debug view than a user account page.

## Decision

The account dashboard must adapt its presentation based on the user's membership shape and avoid exposing unnecessary permission detail.

### Page title

Use `Your ResearchOps account` as the page title.

Do not use `Welcome. Here is your account dashboard` or `Welcome, [name]. Here is your account dashboard`.

The title should be a direct task/page label, not a product-style greeting.

### Account summary

Show `Signed in as` as a summary-list row below the lead text.

Do not use a separate `Account summary` heading if it only contains one row.

### One team

If a user belongs to one team, show a simple single-team summary.

The summary should show:

- team name
- role or roles in that team

Do not show a multi-team list or a table.

Do not show a `Current` tag for a single-team user. There is nothing to compare with and no team-switching interaction yet.

### More than one team

If a user belongs to more than one team, show a list of team memberships.

Each list item should show:

- team name
- role or roles in that team

The `Current` tag may be used only when there is more than one team and the current team context is meaningful.

Do not show detailed permission labels in the team-membership list.

### Actions

Show `Actions you can take` only when at least one action is available.

Do not show an empty actions section to ordinary users.

An account with no available actions should simply omit the section.

### Permission details

Do not show permissions as a primary page section.

Permission labels can be shown in a GOV.UK details component labelled `View permission details`.

Only show that details component when it is genuinely useful. In this branch, it is shown for ResearchOps Core Team Admin users because that state has wider administrative powers and the permission details support auditability.

Ordinary users do not need a permissions list to understand their account.

### ResearchOps Core Team Admin

If a user is a Team Admin in ResearchOps Core Team, explain the extra administrative capability in plain English.

Use a short inset text after the relevant team membership.

The text should make clear that this role can manage roles across teams and create new teams.

Do not force all global permission labels into the team-membership display.

## Rationale

A table is useful when users need to compare values across rows and columns.

The account dashboard is not primarily a comparison task.

The user needs to answer simpler questions:

- who am I signed in as?
- which team or teams do I belong to?
- what role or roles do I have there?
- what can I do now?

A simple summary supports the single-team case better because there is no comparison to make.

A list supports the multi-team case better because it reads as memberships rather than data rows.

Permissions remain important for system behaviour and auditability, but most users should not have to read permission labels to understand their account.

Permissions should sit behind a details component for admin contexts rather than being displayed as the main page content.

## Role input

### GOV.UK Design System

The GOV.UK bundle requires using appropriate components for the task rather than using tables for layout. The table component should be used for structured data where values relate to both columns and rows. Summary lists are better for key-value account information. GOV.UK details can hide information that is useful for some users but not needed by most users to complete the task.

### Interaction design

The interaction design concern is task flow and cognitive load. The dashboard should not ask a single-team user to interpret a multi-team structure or an access-control permissions list. It should progressively reveal complexity only where the account state requires it.

### Content design

The content design concern is clarity. The account dashboard should use plain language such as `Your ResearchOps account`, `Your team`, `Your teams`, and `Role or roles`. It should avoid implementation language such as permission codes in the main account summary.

### Information architecture

The IA concern is keeping related information together while avoiding false equivalence. Team membership and capabilities are related but not the same information type. The dashboard should separate team-role membership from permission detail.

### Service design and product

The service-design concern is that Team Admin in ResearchOps Core Team is a different service state from ordinary team membership. The UI should acknowledge this extra capability without making the basic account view harder to use.

## Acceptance criteria

Given a user belongs to one team, when they view their account dashboard, then they see a simple `Your team` summary.

Given a user belongs to one team, when they view their account dashboard, then they do not see a `Current` tag.

Given a user belongs to one team, when they view their account dashboard, then they do not see a multi-team table.

Given a user belongs to more than one team, when they view their account dashboard, then they see a `Your teams` list.

Given a user belongs to more than one team, when they view their account dashboard, then each team shows the role label or labels for that team.

Given a user has no available actions, when they view the account dashboard, then the actions section is hidden.

Given a user has available actions, when they view the account dashboard, then the actions section is shown.

Given a user is Team Admin in ResearchOps Core Team, when they view the account dashboard, then they see a short explanation that they can manage roles across teams and create new teams.

Given a user is Team Admin in ResearchOps Core Team, when they view the account dashboard, then they can open `View permission details` if they need to inspect permission labels.

Given a user is not Team Admin in ResearchOps Core Team, when they view the account dashboard, then permission labels are not shown as primary content.

## Implementation notes

`public/js/auth-account-page.js` should render single-team and multi-team states through separate functions.

`renderSingleTeamMembership()` should use simple heading and GOV.UK summary-list markup.

`renderMultipleTeamMemberships()` should use a spaced list.

`renderTeamMemberships()` should decide between those states based on membership count.

`renderActions()` should hide the action section when no actions are available.

`renderPermissions()` should hide permission details unless the current membership state means they add value.

The route-state test should block regression to the earlier table-based design, the one-row `Account summary` section, single-team `Current` tags, empty action sections, and primary permission-list display.
