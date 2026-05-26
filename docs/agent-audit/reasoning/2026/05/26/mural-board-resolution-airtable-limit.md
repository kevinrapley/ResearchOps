# Mural board resolution and Airtable billing-limit fix

## Run metadata

- Date: 2026-05-26
- Branch: `fix/mural-board-resolution-create`
- Trigger: post-merge dashboard test showed Mural OAuth connected, but board creation failed.

## User evidence

DevTools showed:

- `/api/mural/verify` returned `200` and included `activeWorkspaceId: "pppt6786"`.
- `/api/mural/resolve?projectId=recgdpwEI5hFO7bUZ&uid=anon` returned `404` with `{ "ok": false, "error": "not_found" }`.
- `/api/mural/setup` returned `429` with:
  - `error: "setup_failed"`
  - `step: "register_board"`
  - `message: "airtable_create_failed"`
  - upstream Airtable error `PUBLIC_API_BILLING_LIMIT_EXCEEDED`.

This means OAuth and Mural workspace verification were working. The failure occurred after board creation, while registering the board mapping in Airtable.

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

- `public/components/mural-integration.js`
- `infra/cloudflare/src/service/internals/mural.js`
- `infra/cloudflare/src/service/internals/airtable.js`
- `infra/cloudflare/src/lib/mural.js`
- `infra/cloudflare/src/service/internals/researchops-d1.js`
- `infra/cloudflare/migrations/researchops-d1/0001_seed.sql`
- `package.json`

## Diagnosis

The Mural account connection is not the problem. The client reaches the authenticated setup path.

The existing board was not resolved because the Airtable board lookup was broad: it queried by UID, purpose and active state, then filtered the first page of results by project ID in JavaScript. That can miss a project board if the row is not in the first returned records or if UID differs from the current browser value.

The setup failure is caused by Airtable refusing the board registry write because the monthly public API billing limit has been exceeded. A Mural board setup should not fail after board creation solely because Airtable cannot currently accept the registry record.

## Changes made

- Changed `listBoards` in `infra/cloudflare/src/service/internals/airtable.js` to scope the Airtable formula by `Project ID` when a project ID is supplied.
- Raised the Mural board list default `max` from 25 to 100.
- Changed `createBoard` so Airtable `429 PUBLIC_API_BILLING_LIMIT_EXCEEDED` returns a deferred registry result instead of throwing `airtable_create_failed`.
- Added `tests/mural-airtable-board-registry.test.js` to cover project-scoped board lookup and deferred billing-limit behaviour.

## Expected runtime behaviour

If Mural creates or locates a board and Airtable rejects the registry write due to billing limits, `/api/mural/setup` should now continue far enough for the Worker to update its cache and return the board link instead of surfacing `setup_failed` at `register_board`.

The board registry still needs backfilling into Airtable when the Airtable plan/API limit is available again. The runtime path should not block the user from opening the Mural board.

## Validation

Validation is delegated to GitHub Actions after the pull request is opened. The new unit test exercises the changed helper behaviour without making live Airtable requests.
