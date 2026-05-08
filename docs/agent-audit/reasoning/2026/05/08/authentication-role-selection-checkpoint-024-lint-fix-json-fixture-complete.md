# Agent trace checkpoint 024: JSON fixture lint fix complete

> This checkpoint belongs to `[reasoning]` trace `atrace-20260508-authentication-role-selection-real-implementation`. It records the resilient fixture-formatting correction after repeated CI Prettier failures. It does not expose private chain-of-thought.

## Branch

`feature/auth-foundation-real-d1-current-main`

## Reported failure

GitHub Actions repeatedly failed during:

```bash
npm run lint
```

Prettier repeatedly reported formatting issues in:

```text
tests/auth-route-permissions.test.js
```

## File changed

- `tests/auth-route-permissions.test.js`

## Fix applied

The fragile inline JSON string fixtures were replaced with a helper:

```js
function requiredPermissions(...codes) {
  return JSON.stringify(codes);
}
```

Fixtures now use calls such as:

```js
required_permissions_json: requiredPermissions("audit.view"),
```

## Reason for this correction

The repeated Prettier failures were isolated to `tests/auth-route-permissions.test.js`. The previous formatting-only attempts still left the file in a state that CI rewrote.

Using `JSON.stringify` removes the escaped JSON literal formatting ambiguity while preserving the same string value passed into the D1-style fixture.

## Local formatting check used before commit

A temporary copy of the planned file content was checked with:

```bash
npx --yes prettier@3.6.2 -c /tmp/auth-route-permissions-v2.test.js
```

The check reported:

```text
All matched files use Prettier code style!
```

## Expected behavioural impact

None.

The helper returns the same JSON string shape consumed by `parsePermissions` in `route-permissions.js`.

## Validation status

This checkpoint does not claim full repository lint or validation success.

The next CI run must confirm whether the repository-level Prettier check now passes.

## Boundary

This fix does not change Worker runtime behaviour.

This fix does not apply the D1 migration to the live database.

This fix does not change route-permission semantics.
