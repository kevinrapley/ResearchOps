# Agent trace — D1 participant migration compatibility

**Date:** 2026-06-01  
**Trace type:** operational audit trace  
**Branch:** `hotfix/d1-participant-migration-compatibility`  
**Related work:** D1 participant seed workflow compatibility

## Evidence boundary

This trace records the post-merge test failure investigation and the compatibility fix for the D1 participant seed workflow. It does not expose private chain-of-thought.

## Problem

After PR #323 was merged, tests and release checks on `main` failed. The merged participant seed introduced a canonical D1 participant table shape, but the remote D1 environment may already have an earlier `rops_participants_cache` table shape from a prior seed attempt.

`CREATE TABLE IF NOT EXISTS` does not add missing columns when the table already exists. A replayed seed can therefore fail if `participant_airtable_id`, `access_needs` or `sensitive_contact_json` are missing.

The unit-test suite also requires a JSON trace in today's trace directory, so this hotfix includes a June 1 trace file.

## Implementation

The D1 participant seed workflow now:

- creates the base participant table when absent
- inspects `pragma_table_info('rops_participants_cache')`
- adds `participant_airtable_id` if missing
- adds `access_needs` if missing
- adds `sensitive_contact_json` if missing
- replays the existing `0008_seed_test_project_1_participants.sql` seed
- keeps the participant count and route declaration post-apply checks

The participant seed route-state test was updated to assert the compatibility workflow contract without depending on exact non-functional wording.

## Files changed

- `.github/workflows/apply-d1-test-project-1-participants.yml`
- `tests/test-project-1-participants-seed-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/01/d1-participant-migration-compatibility.md`
- `docs/agent-audit/reasoning/2026/06/01/d1-participant-migration-compatibility.json`

## Scope controls

This hotfix does not change participant runtime code.

This hotfix does not change seeded participant data.

This hotfix does not migrate sessions to D1.

This hotfix only makes the D1 apply workflow tolerant of a previously-created participant table shape.

## Validation expected

GitHub Actions should confirm:

- unit tests pass
- trace coverage passes for 2026-06-01
- release gate passes
- D1 apply workflow remains path-scoped and manually dispatchable
