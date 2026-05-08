# Agent trace checkpoint 031: main format diagnostics complete

Branch: `main`

Files changed:

- `.github/workflows/worker-ci.yml`
- `.github/workflows/format-pr.yml`

`worker-ci.yml` now separates Prettier and ESLint. If Prettier fails, the workflow writes and uploads `prettier-fix.patch` before failing.

`format-pr.yml` now also runs on pushes to `main` and on manual dispatch.

This checkpoint does not claim that the next CI run passes.
