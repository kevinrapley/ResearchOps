# Branch protection verification

This document defines the ResearchOps branch-protection control for `main`.

It is an operational checklist. The live GitHub repository settings remain the source of truth.

## Target branch

`main`

## Required protection settings

Enable these settings for `main`:

- Require a pull request before merging.
- Require at least 1 approving review.
- Dismiss stale pull request approvals when new commits are pushed.
- Require review from Code Owners.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Require conversation resolution before merging.
- Require linear history.
- Block force pushes.
- Block branch deletion.

## Required status checks

Use the exact check names shown by GitHub after successful pull-request runs.

Expected checks:

- `CI`
- `Validate ResearchOps`
- `Release gate`
- `Accessibility audit (pa11y-ci)`

If GitHub exposes a qualified check name such as `Release Gate / Release gate`, use the exact qualified value.

## Verification evidence

Record verification in `branch-protection-evidence.yaml` after the live settings are configured.

Minimum evidence:

- who configured the rule
- when it was configured
- source of verification: GitHub UI or GitHub API
- required reviews
- code owner review requirement
- required status checks
- conversation resolution requirement
- linear history requirement
- force-push and deletion settings
- screenshots or API output references where available

## Acceptance criteria

Branch protection is not considered closed until:

- the `main` branch rule exists in GitHub settings
- pull requests are required before merge
- at least one approval is required
- code-owner review is required
- the Release Gate check is required
- CI and validation checks are required
- accessibility remains a required check while the main baseline is clean
- the final state is recorded in `branch-protection-evidence.yaml`

## Notes for agents

Do not mark branch protection as implemented from `github-settings.yaml` alone.

`github-settings.yaml` is intended state. The live GitHub settings are authoritative.
