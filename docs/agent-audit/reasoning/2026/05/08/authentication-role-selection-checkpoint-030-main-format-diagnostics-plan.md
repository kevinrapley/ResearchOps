# Agent trace checkpoint 030: main format diagnostics plan

This checkpoint records the follow-up automation plan after main branch CI still reported a Prettier failure and no patch artifact was visible.

## Branch

`main`

## Diagnosis

The patch artifact was configured in `.github/workflows/format-pr.yml`, which was originally pull-request-only.

The failing path on main was the Worker CI lint step in `.github/workflows/worker-ci.yml`. That path ran `npm run lint`, so it did not create or upload a patch artifact.

## Planned fix

Update `.github/workflows/worker-ci.yml` so formatting and ESLint are separate steps.

The formatting step should check Prettier. If the check fails, it should apply Prettier in the runner, write the resulting diff to `prettier-fix.patch`, print the patch, upload the artifact, and fail the job.

Update `.github/workflows/format-pr.yml` so the format diagnostic workflow also runs on main pushes and manual dispatch, not only pull requests.

## Decision

Do not silently auto-format before lint as a passing CI step. CI should still fail on formatting drift, but the exact patch should be visible and downloadable.
