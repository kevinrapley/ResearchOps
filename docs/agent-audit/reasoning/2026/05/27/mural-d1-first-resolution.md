# Mural D1-first board resolution fix

## Run metadata

- Date: 2026-05-27
- Branch: `fix/mural-d1-first-resolution`
- Trigger: after PR #287 merged, `Test Project 1` still resolved as having no Reflexive Journal Mural board even though Airtable contained a matching Mural Boards record.
- Follow-up trigger: after a linked board was created, the dashboard showed two Mural open actions: `Open "Reflexive Journal"` and `Open Mural board`.

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

The user later confirmed the linked-board state worked, but the action labels were wrong. The second visible action should be named `Open Mural board`, and the third visible `Open Mural board` action was erroneous.

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
- `govuk-design-system`
- `cloudflare`
- `airtable-public-api`
- `mural-public-api`

## Files read

- `infra/cloudflare/src/service/internals/airtable.js`
- `infra/cloudflare/src/service/internals/mural.js`
- `infra/cloudflare/src/service/internals/researchops-d1.js`
- `public/components/mural-integration.js`
- `public/components/project-dashboard-mural-state.js`
- `src/govuk/templates/pages/project-dashboard.njk`
- `public/pages/project-dashboard/index.html`
- `tests/mural-airtable-board-registry.test.js`
- `tests/project-dashboard-route-state.test.js`
- `tests/mural-ui-route-state.test.js`
- `RECENT_LEARNINGS.md`

## Diagnosis

PR #287 made D1 available in the helper, but the Airtable fallback was still too broad after D1 missed. When a project ID was known, the helper queried Airtable by `Purpose` and `Active`, then locally filtered the returned page for `Project ID`, `Project`, or `Projects`.

That means a valid Airtable row can be missed if it is outside the returned page, even when it has an exact `Project ID` match.

Manual D1 seeding would mask the problem for one project. It would not fix the runtime ordering or self-healing path.

The follow-up UI defect came from two dashboard controls. `mural-integration.js` changes `#mural-setup` into an open action when a board is linked, while the static `#mural-open` action remains visible as a second open control.

## Changes made

- Kept D1 as the first board lookup path.
- Added exact Airtable fallback using `{Project ID}` when a project ID is known.
- Kept the broad Airtable legacy fallback for rows that use linked `Project` or `Projects` fields instead of `Project ID`.
- Mirrored Airtable fallback matches into D1 so the next request resolves from D1.
- Ensured the D1 `mural_boards` table exists before mirroring a mapping.
- Updated unit tests for D1-first lookup, exact Airtable fallback, legacy Airtable fallback, and D1 mirroring.
- Converted `project-dashboard-mural-state.js` from an inert bridge into a small action normaliser.
- Hid the legacy `#mural-open` action and removed it from keyboard focus.
- Normalised the linked-state setup action label from `Open "Reflexive Journal"` to `Open Mural board`.
- Updated route-state tests for the new action normaliser contract.

## Seed-file decision

No seed file was added. The normal runtime path should not require manual seed data. The corrected fallback should discover the existing Airtable row and mirror it into D1 automatically.

## Validation

Validation is delegated to GitHub Actions. The focused unit tests cover the corrected order and fallback behaviour. Route-state tests cover the single linked Mural board action behaviour.
