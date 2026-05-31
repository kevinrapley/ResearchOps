# Agent trace — Participant D1 canonical pivot

**Date:** 2026-05-31  
**Trace type:** operational audit trace  
**Branch:** `feature/pseudonymised-participant-view`  
**Related work:** Story 7 continuation — make D1 canonical and Airtable secondary

## Evidence boundary

This trace records repository evidence, implementation scope, files changed, validation expected and residual risk. It does not expose private chain-of-thought.

## Task summary

Pivot participant runtime behaviour so D1 is the canonical source of truth for testing and service behaviour. Airtable remains secondary and must not be required for the normal participant list, contact reveal or participant creation journey.

## Implementation summary

The participant service now reads participant lists from `rops_participants_cache` in D1.

The contact reveal route reads `sensitive_contact_json` from D1 after D1 route permission checks.

Participant creation now writes to D1 and requires project and study context.

The Test Project 1 seed creates 10 pseudonymised participants for project `recgdpwEI5hFO7bUZ` and study `rect3biqr`.

The D1 seed migration also declares `participant.record.create` and protects `POST /api/participants`.

The apply workflow applies the seed to remote D1 and checks participant count plus route declarations.

## Files changed

- `.github/workflows/apply-d1-test-project-1-participants.yml`
- `infra/cloudflare/migrations/0008_seed_test_project_1_participants.sql`
- `infra/cloudflare/src/service/participants.js`
- `public/pages/study/participants/scheduler.js`
- `tests/participant-pseudonymised-view-route-state.test.js`
- `tests/test-project-1-participants-seed-route-state.test.js`
- `docs/agent-audit/reasoning/2026/05/31/participant-d1-canonical-pivot.md`
- `docs/agent-audit/reasoning/2026/05/31/participant-d1-canonical-pivot.json`

## Scope controls

This branch does not implement Story 8 access requests.

This branch does not make Airtable the runtime participant source.

This branch does not seed real personal data.

This branch does not grant default users unrestricted contact reveal access.

This branch does not migrate all ResearchOps runtime entities to D1; it starts the pivot with participants.

## Validation expected

Run:

```bash
npm run validate
npm run lint
npm test -- --ci
```

CI should confirm:

- participant route-state tests pass
- Test Project 1 participant seed tests pass
- D1 apply workflow exists and performs post-apply checks
- participant service no longer imports Airtable helper paths for list/create/reveal
- the page controller posts project and study IDs when creating participants

## Residual risk

The session creation path still uses existing field names such as `study_airtable_id` and `participant_airtable_id`. This follow-up PR is intentionally scoped to the participant list/create/reveal journey.

If D1 already contains an older incompatible `rops_participants_cache` table without `sensitive_contact_json`, the remote apply may need a compatibility migration. The new migration creates the table with the canonical column for fresh or not-yet-seeded environments.
