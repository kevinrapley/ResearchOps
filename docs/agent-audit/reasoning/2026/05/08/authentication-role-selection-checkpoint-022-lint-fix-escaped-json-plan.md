# Agent trace checkpoint 022: escaped JSON lint fix plan

> This checkpoint belongs to `[reasoning]` trace `atrace-20260508-authentication-role-selection-real-implementation`. It records the repeated Prettier failure and the next formatting correction before code changes are made. It does not expose private chain-of-thought.

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

The remaining formatting issue is the escaped double quotes inside single-quoted JSON strings, for example:

```js
'[\"audit.view\"]'
```

Prettier rewrites these as unescaped JSON strings inside single quotes:

```js
'["audit.view"]'
```

## Planned fix

Update `tests/auth-route-permissions.test.js` to remove unnecessary escaping from JSON string literals used in D1 route-permission test fixtures.

Expected behavioural impact:

- none

## Boundary

This fix does not change Worker runtime behaviour.

This fix does not apply the D1 migration to the live database.

This fix does not change route-permission semantics.
