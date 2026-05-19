# Projects team-scoped access and card data

**Date:** 2026-05-14  
**Status:** product decision and implementation note  
**Area:** projects page, project dashboard, project creation, team-scoped access, Airtable project data

## Context

The `/pages/projects/` page showed project cards with `Home Office Biometrics` as the team label.

That was incorrect because the label should reflect the team that owns or works on the project.

The same area also showed malformed `User groups` pills where identity-like field fragments could be rendered as user group labels.

The project dashboard links were fragile because the dashboard loaded all visible projects, then searched client-side for the selected project ID.

A branch-preview screenshot later showed that the page was still rendering data that did not belong to the Airtable `Projects` table. The tests were passing, but they were proving an invented `PID` contract rather than the real Airtable record contract.

## Decision

Project visibility is an access-control rule and must be enforced server-side.

The project API now receives scoped authentication context before listing, reading, updating or creating project records.

ResearchOps Core members can see all projects across teams for Research Operations oversight.

Members of other teams can see only projects whose team identifiers match one of their team memberships.

Projects without a resolvable team are treated as visible only to ResearchOps Core.

## Source-of-truth decision

The Airtable `Projects` table is the authoritative source for project cards.

`Project Details` can enrich a valid project after that project has been read from the `Projects` table, but it must never create a project card.

The canonical project identifier is the Airtable `Record ID` value, which is the Airtable `rec...` record id.

The current Airtable project IDs observed from the Airtable screenshot are:

- `recMtdmBbaFilF2Tm`
- `recpZe8mLEiASXfRd`
- `recgdpwEI5hFO7bUZ`
- `recIFoFmpDIGBP726`
- `recUUeazIqBMfsZL4`

The Projects UI and project dashboard routes use these `rec...` identifiers. `PID` and `LocalId` are not the routing contract for project cards or dashboards.

## Project card data decision

Project cards should show the team associated with the project.

The card should not hard-code `Home Office Biometrics` as a fallback.

The card uses user-facing team language. It does not expose permission codes as user-facing card content.

The Airtable `rec...` record id is allowed in URLs because it is the canonical route identifier for a project. It should not be shown as a visible label unless the interface specifically needs to expose the technical project reference.

If a project reaches the client without a team label, the defensive UI fallback is `Unassigned team`.

## User groups decision

Malformed values that look like person-field or identity fragments are not valid user group labels.

Those values should be suppressed during normalisation.

This is a privacy and content-quality issue, not only a visual defect.

The implementation avoids logging raw malformed `UserGroups` values.

## Start project decision

The Start research project action is capability-driven.

The project list response includes `canStartProject`.

The projects page hides the action until capability is known.

`POST /api/projects` enforces the same rule server-side.

The start-project client no longer sends `org: Home Office Biometrics`.

The Worker attaches project team context from the authenticated user context.

## Dashboard decision

The project dashboard now reads the selected project directly from `/api/projects/:id`.

The `:id` value is the Airtable `rec...` record id from the `Projects` table.

The dashboard no longer loads all projects and searches for the selected record in the browser.

This gives clearer access semantics and avoids failures caused by list filtering or client-side selection.

## D1 cache decision

D1 mirrors the active Airtable `Projects` set by Airtable `rec...` record id.

When the Airtable project list succeeds, the Worker updates `rops_projects_cache` as a non-destructive cache:

- existing Airtable-source cached projects are marked `active = 0`
- current Airtable Projects records are upserted with `active = 1`
- stale cache rows are retained rather than deleted

Airtable remains the source of truth. D1 cache sync is best effort and must not block the authoritative Airtable response.

No D1 migration file is included in this branch. The table is created lazily by the Worker if the D1 binding exists.

## Airtable field decision

The implementation supports configured field names for project team fields:

- `AIRTABLE_PROJECT_TEAM_NAME_FIELD`
- `AIRTABLE_PROJECT_TEAM_ID_FIELD`

Where configuration is not supplied, the default field names are:

- `Team Name`
- `Team ID`

Reads tolerate known field variants so the page can recover from existing Airtable field shapes.

No Airtable schema migration is included in this branch.

## Acceptance criteria covered

Given I am a member of the ResearchOps Core team, and I am not a member of other teams on the platform, then I can see all projects within every team, so that I have Research Operations oversight.

Given I am a member of team or teams other than ResearchOps Core team, then I can see projects within the team or teams I have membership of.

Given I am a user researcher, or a member of the ResearchOps Core team, I can start a research project using the available button.

## Role input

The GOV.UK Design System role consultation required plain user-facing content, semantic links and buttons, progressive enhancement and no unnecessary custom interaction.

The multi-functional team role consultation required server-side access control, privacy-safe handling of malformed values, auditable decisions and reversible commits.

The transcript is recorded at:

`docs/agent-audit/reasoning/2026/05/14/projects-team-scoped-access-role-consultation.md`

## Validation notes

The branch adds and updates coverage for:

- scoped project routing
- credentialed project fetches
- direct project dashboard reads by Airtable `rec...` id
- rejection of non-record project identifiers such as `PID-*`
- the five current Airtable `Projects` records from the screenshot
- removal of the hard-coded project-card organisation fallback
- permission-driven Start project behaviour
- identity-fragment filtering in user group handling

The full validation status is recorded in the agent trace progress file for this branch.

## Rollback notes

No D1 migration file is included.

No Airtable schema migration is included.

Rollback is to revert the branch commits or close the pull request unmerged.

If deployed and problematic, roll back the Worker and Pages deployments to the previous `main` deployment.
