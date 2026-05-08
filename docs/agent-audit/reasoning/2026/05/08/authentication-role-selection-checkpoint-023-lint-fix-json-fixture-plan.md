# Agent trace checkpoint 023: JSON fixture lint fix plan

> This checkpoint belongs to `[reasoning]` trace `atrace-20260508-authentication-role-selection-real-implementation`. It records the third repeated Prettier failure and the planned resilient fix before code changes are made. It does not expose private chain-of-thought.

## Branch

`feature/auth-foundation-real-d1-current-main`

## Reported failure

GitHub Actions again failed during:

```bash
npm run lint
```

Prettier again reported formatting issues in:

```text
tests/auth-route-permissions.test.js
```

## Diagnosis

Repeated small formatting edits have not resolved the CI signal. The test file still uses inline JSON string fixtures for `required_permissions_json`.

The resilient correction is to remove the fragile inline JSON literal pattern entirely and generate those fixture values using `JSON.stringify`.

## Planned fix

Update `tests/auth-route-permissions.test.js` to add a small helper:

```js
function requiredPermissions(...codes) {
  return JSON.stringify(codes);
}
```

Then replace inline JSON string fixtures with calls such as:

```js
required_permissions_json: requiredPermissions("audit.view"),
```

## Local check before repository update

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

## Boundary

This fix does not change Worker runtime behaviour.

This fix does not apply the D1 migration to the live database.

This fix does not change route-permission semantics.
