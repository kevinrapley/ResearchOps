# Preview DaaS account data correction

**Date:** 2026-05-13  
**Status:** preview-only data correction  
**Area:** preview D1, account dashboard, role assignment review data

## Context

During PR #250 review, `kevin.rapley@research-operations.com` appeared in the account dashboard as a member of `ResearchOps Core Team` with the `Observer` role.

That was not the intended review state.

The intended state is:

- user: `kevin.rapley@research-operations.com`
- team: `DaaS`
- role: `Observer`

The account dashboard design work surfaced the incorrect data because it now correctly shows team-scoped role membership.

## Decision

Correct the preview D1 database so `kevin.rapley@research-operations.com` is assigned to `DaaS`, not `ResearchOps Core Team`.

This correction must be preview-only.

It must not run against production D1.

## Implementation

Added preview-only SQL file:

`infra/cloudflare/migrations/preview/0002_correct_research_operations_user_daas_team.sql`

The correction:

- creates `DaaS` as an active team if it does not already exist
- activates membership for `kevin.rapley@research-operations.com` in `DaaS`
- assigns the `Observer` role to that user in `DaaS`
- revokes the erroneous `Observer` role assignment in `ResearchOps Core Team`
- removes the ResearchOps Core Team membership for that user if no active roles remain in that team
- writes a preview data-correction audit event

The preview deploy workflow applies this file after the preview seed:

`PREVIEW_RESEARCH_OPERATIONS_DAAS_CORRECTION`

## Constraints

This is not a general migration.

It is review-data correction for the preview D1 database only.

It must remain under `infra/cloudflare/migrations/preview/`.

The production deploy job must not apply this file.

## Acceptance criteria

Given the preview D1 database contains `kevin.rapley@research-operations.com`, when the preview correction runs, then the user is an active member of `DaaS`.

Given the preview correction runs, when the user opens the account dashboard, then the user sees `DaaS` as their team and `Observer` as their role.

Given the preview correction runs, then the erroneous `Observer` assignment in `ResearchOps Core Team` is revoked for that user.

Given the production deployment runs, then this preview correction is not applied.

## Future note

This correction should not be repeated for new users. New role assignments should use the role-assignment journey, which creates or reactivates team membership and role assignment records together.
