# Agent trace checkpoint 014: validation wiring plan

> This checkpoint belongs to `[reasoning]` trace `atrace-20260508-authentication-role-selection-real-implementation`. It records the next implementation step before code changes are made. It does not expose private chain-of-thought.

## Branch

`feature/auth-foundation-real-d1-current-main`

## Next task

Wire the authentication foundation tests into the repository validation contract.

## Rationale

The branch has added two authentication-specific test files:

- `tests/auth-foundation-route-state.test.js`
- `tests/auth-route-permissions.test.js`

The Worker deployment workflow runs `npm run validate`, which delegates to `scripts/validate.sh`. The validation script currently does not require or execute these new tests.

To make the authentication slice part of the normal CI quality gate, `scripts/validate.sh` should be updated to require and run both test files.

## Intended change

Update `scripts/validate.sh` to:

- require `tests/auth-foundation-route-state.test.js`
- require `tests/auth-route-permissions.test.js`
- run both tests during validation

## Boundary

This does not run tests in this assistant environment.

This does not apply the D1 migration to the live database.

This does not change Worker runtime behaviour.

## Expected result

Future `npm run validate` executions should include the authentication foundation tests automatically.
