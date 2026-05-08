# Agent trace checkpoint 028: format automation plan

> This checkpoint belongs to `[reasoning]` trace `atrace-20260508-authentication-role-selection-real-implementation`. It records the automation plan for preventing repeated Prettier failures. It does not expose private chain-of-thought.

## Branch

`feature/auth-foundation-real-d1-current-main`

## Trigger

The user asked what needs to be automated so the Prettier failure does not keep recurring.

## Current facts

The repository already has:

```json
{
  "format": "prettier -w .",
  "format:check": "prettier -c .",
  "lint": "prettier -c . && eslint ."
}
```

The repository also has `.editorconfig` with:

```ini
[*]
indent_style = tab
indent_size = 2
```

The existing `Format pull request` workflow checks formatting but only reports the file name. It does not show the exact diff that `prettier --write` would produce.

## Automation decision

Do not add `prettier --write .` as a normal pre-lint step in validating CI.

Reason:

- validating CI should detect formatting drift
- `--write` in a read-only CI job mutates the runner workspace but does not commit the correction
- it can hide the evidence needed to fix the source branch

## Planned repository changes

Add an explicit Prettier config:

- `prettier.config.mjs`

This will make the repository formatting contract visible instead of relying only on `.editorconfig`.

Update the formatting workflow:

- `.github/workflows/format-pr.yml`

The workflow should still fail on unformatted code, but on failure it should:

1. run Prettier with `--write` in the runner
2. show the resulting `git diff`
3. fail with the exact patch visible in logs

Add a manual branch formatter workflow:

- `.github/workflows/format-branch.yml`

This workflow should only run on `workflow_dispatch`. It should:

1. require an explicit branch input
2. check out that branch
3. run `npm ci --ignore-scripts`
4. run `npm run format`
5. commit and push the formatting diff only if there are changes

## Expected result

The normal CI path remains strict.

The manual rescue path can apply the exact Prettier output to a branch without guessing.

Future failures will provide an exact diff, not just a filename.
