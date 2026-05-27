# Mural D1-first board resolution fix

## Run metadata

- Date: 2026-05-27
- Branch: `fix/mural-d1-first-resolution`
- Trigger: after PR #287 merged, `Test Project 1` still resolved as having no Reflexive Journal Mural board even though Airtable contained a matching Mural Boards record.

## User evidence

The user confirmed the Airtable Mural Boards row exists and includes:

- `Project ID`: `recgdpwEI5hFO7bUZ`
- `UID`: `anon`
- `Mural ID`: `pppt6786.1763312037559`
- `Purpose`: `reflexive_journal`
- `Active`: `true`
- `Primary?`: `true`
- `Workspace ID`: `pppt6786`

The user also clarified that manual D1 seeding should not be required for normal operation. D1 should be the primary runtime registry, with Airtable as fallback.

## Operating-model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`

## Selected bundles

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`
- `cloudflare`
- `airtable-public-api`
- `mural-public-api`

## Files read

- `infra/cloudflare/src/service/internals/airtable.js`
- `infra/cloudflare/src/service/internals/mural.js`
- `infra/cloudflare/src/service/internals/researchops-d1.js`
- `tests/mural-airtable-board-registry.test.js`
- `RECENT_LEARNINGS.md`

## Diagnosis

PR #287 made D1 available in the helper, but the Airtable fallback was still too broad after D1 missed. When a project ID was known, the helper queried Airtable by `Purpose` and `Active`, then locally filtered the returned page for `Project ID`, `Project`, or `Projects`.

That means a valid Airtable row can be missed if it is outside the returned page, even when it has an exact `Project ID` match.

Manual D1 seeding would mask the problem for one project. It would not fix the runtime ordering or self-healing path.

## Changes made

- Kept D1 as the first board lookup path.
- Added exact Airtable fallback using `{Project ID}` when a project ID is known.
- Kept the broad Airtable legacy fallback for rows that use linked `Project` or `Projects` fields instead of `Project ID`.
- Mirrored Airtable fallback matches into D1 so the next request resolves from D1.
- Ensured the D1 `mural_boards` table exists before mirroring a mapping.
- Updated unit tests for D1-first lookup, exact Airtable fallback, legacy Airtable fallback, and D1 mirroring.

## Seed-file decision

No seed file was added. The normal runtime path should not require manual seed data. The corrected fallback should discover the existing Airtable row and mirror it into D1 automatically.

## Validation

Validation is delegated to GitHub Actions after the PR is opened. The focused unit tests cover the corrected order and fallback behaviour.
