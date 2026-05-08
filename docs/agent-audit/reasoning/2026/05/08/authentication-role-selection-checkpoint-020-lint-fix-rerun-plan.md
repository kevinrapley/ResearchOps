# Agent trace checkpoint 020: route-permission test lint fix rerun plan

> This checkpoint belongs to `[reasoning]` trace `atrace-20260508-authentication-role-selection-real-implementation`. It records the repeated CI formatting failure and the second planned formatting correction before code changes are made. It does not expose private chain-of-thought.

## Branch

`feature/auth-foundation-real-d1-current-main`

## Reported failure

GitHub Actions again failed during:

```bash
./node_modules/.bin/prettier -c .
```

Prettier again reported formatting issues in:

```text
tests/auth-route-permissions.test.js
```

## Diagnosis

The first formatting fix corrected one long call site but left another call site in a shape that Prettier still rewrites.

The remaining offender is the `assertRoutePermission` call in `assertMissingRouteFailsClosed`.

## Planned fix

Rewrite `tests/auth-route-permissions.test.js` using the exact Prettier output shape for the file.

Expected behavioural impact:

- none

## Boundary

This fix does not change Worker runtime behaviour.

This fix does not apply the D1 migration to the live database.

This fix does not change route-permission semantics.
