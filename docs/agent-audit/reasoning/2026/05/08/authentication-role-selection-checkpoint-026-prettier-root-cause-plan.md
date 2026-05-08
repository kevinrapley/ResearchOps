# Agent trace checkpoint 026: Prettier root cause plan

> This checkpoint belongs to `[reasoning]` trace `atrace-20260508-authentication-role-selection-real-implementation`. It records the confirmed root cause of the repeated Prettier failure before applying the exact formatting output. It does not expose private chain-of-thought.

## Branch

`feature/auth-foundation-real-d1-current-main`

## Reported failure

GitHub Actions repeatedly failed during:

```bash
prettier -c .
```

The repeatedly reported file was:

```text
tests/auth-route-permissions.test.js
```

## Root cause now identified

The repository has an `.editorconfig` file with:

```ini
[*]
indent_style = tab
indent_size = 2
```

Prettier reads `.editorconfig` by default. That means JavaScript files in this repository are formatted with tabs, not two spaces.

The earlier local checks were wrong because they checked a temporary standalone file outside the repository context. Without the repository `.editorconfig`, Prettier used its default space indentation and reported a false local pass.

## Correct reproduction

The failure reproduces when the repository `.editorconfig` is present beside the file:

```bash
npx --yes prettier@3.6.2 -c tests/auth-route-permissions.test.js
```

The same file then passes after applying:

```bash
npx --yes prettier@3.6.2 --write tests/auth-route-permissions.test.js
```

## Exact planned fix

Replace `tests/auth-route-permissions.test.js` with the output produced by Prettier 3.6.2 while `.editorconfig` is present.

The concrete change is tab indentation throughout the JavaScript file.

## Copilot workflow suggestion assessment

The suggestion to add `npx prettier --write .` before lint in the validation workflow should not be used as the primary fix.

Reason:

- validation workflows should detect formatting drift rather than silently mutate it
- a `--write` step in CI changes the runner workspace but does not automatically commit the correction back to the PR
- it can mask formatting problems in later steps and still leave the branch unformatted

The better rule is:

- run `npm run format` or `npx prettier --write <file>` before committing
- keep CI as `prettier -c .` so it enforces the repository contract

## Prevention rule to write after CI confirms the fix

When formatting JavaScript in this repository, run Prettier from the repository root so it can read `.editorconfig`.

Do not rely on temporary file-level checks outside the repository tree because they will miss `indent_style = tab`.
