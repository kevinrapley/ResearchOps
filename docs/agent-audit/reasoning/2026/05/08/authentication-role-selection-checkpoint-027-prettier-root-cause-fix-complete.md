# Agent trace checkpoint 027: Prettier root cause fix complete

> This checkpoint belongs to `[reasoning]` trace `atrace-20260508-authentication-role-selection-real-implementation`. It records the exact formatting fix after the root cause was identified. It does not expose private chain-of-thought.

## Branch

`feature/auth-foundation-real-d1-current-main`

## File changed

- `tests/auth-route-permissions.test.js`

## Root cause

The repeated Prettier failures were caused by repository-level `.editorconfig` settings that were not present in earlier temporary file-only checks.

The repository `.editorconfig` sets:

```ini
[*]
indent_style = tab
indent_size = 2
```

Prettier reads `.editorconfig` by default. The file had been formatted with spaces. CI checked the file inside the repository and therefore expected tabs.

## Exact fix applied

`tests/auth-route-permissions.test.js` was replaced with the output shape produced by Prettier 3.6.2 when `.editorconfig` is present.

The concrete fix is tab indentation across the JavaScript file.

Example before:

```js
import {
  assertRoutePermission,
  resolveRoutePermissionDeclaration,
  routePermissionErrorResponse,
} from "../infra/cloudflare/src/core/auth/route-permissions.js";
```

Example after:

```js
import {
	assertRoutePermission,
	resolveRoutePermissionDeclaration,
	routePermissionErrorResponse,
} from "../infra/cloudflare/src/core/auth/route-permissions.js";
```

Nested object example after:

```js
return {
	prepare() {
		return {
			bind(method, pathname) {
				return {
					async first() {
						if (!declaration) return null;
					},
				};
			},
		};
	},
};
```

## Behavioural impact

None.

The change is formatting only. It does not change route-permission test assertions or Worker runtime behaviour.

## Validation status

The formatting has been aligned to the repository `.editorconfig` contract.

Repository-level CI still needs to confirm that `prettier -c .` passes.

## Future rule candidate

When formatting JavaScript in this repository, run Prettier from the repository root so it reads `.editorconfig`.

Do not rely on temporary standalone file checks outside the repository tree.

Use:

```bash
npm run format
```

or targeted:

```bash
npx prettier --write tests/auth-route-permissions.test.js
```

from the repository root.

Do not add `prettier --write .` into CI before lint as a normal validation step. CI should detect formatting drift, not silently rewrite it without committing the result.
