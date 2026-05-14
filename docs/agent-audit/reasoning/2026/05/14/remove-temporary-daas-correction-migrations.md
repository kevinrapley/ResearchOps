# Agent trace — remove temporary DaaS correction migrations and update branch trace policy

**Date:** 2026-05-14  
**Trace type:** operational audit  
**Branch:** `fix/remove-temporary-daas-correction-migration`  
**PR:** #251

## Evidence boundary

This trace records observable implementation work, files changed, validation intent and residual risks.

It does not expose private chain-of-thought.

## Branch trace decision

The branch starts with `fix/`.

Under the updated branch-prefix trace policy, `fix/` branches require auditable traces.

The user does not need to include `[reasoning]` for trace capture on `feature/`, `chore/`, `test/`, `fix/` or `perf/` branches.

`hotfix/` branches are explicitly trace-exempt.

## Trigger

PR #250 corrected the DaaS account data in both preview and production D1.

The repository still contained one-off SQL migrations and deploy workflow hooks that had served their purpose. Keeping those files would make a completed operational data correction look like a permanent repository migration.

While correcting trace coverage, the trace posture also needed to change. The previous posture relied on the user adding `[reasoning]` to prompts. That created avoidable audit gaps.

## Changes made

### Temporary migration cleanup

Updated `.github/workflows/deploy-worker.yml`.

Removed:

- `AUTH_DATA_CORRECTION_MIGRATION`
- `PREVIEW_RESEARCH_OPERATIONS_DAAS_CORRECTION`
- the production D1 step applying the DaaS correction SQL
- the preview D1 step applying the DaaS correction SQL

Deleted:

- `infra/cloudflare/migrations/0006_correct_research_operations_user_daas_team.sql`
- `infra/cloudflare/migrations/preview/0002_correct_research_operations_user_daas_team.sql`

Updated `tests/auth-registration-requests-route-state.test.js` so it no longer treats those temporary correction files as part of the repository contract.

### Branch-prefix trace governance

Updated `.agent-operating-model/trace-policy.md`.

The policy now says work branches must start with one of:

- `feature/`
- `chore/`
- `test/`
- `fix/`
- `perf/`
- `hotfix/`

It also says not to create or continue branches with unapproved prefixes such as:

- `claude/`
- `codex/`
- `bugfix/`
- `experiment/`

Trace capture is now branch-driven:

- always record traces for `feature/`, `chore/`, `test/`, `fix/` and `perf/`
- do not record traces for `hotfix/`

Updated `.agent-operating-model/README.md` and `AGENTS.md` with the same rule.

Updated `.agent-operating-model/bundles/github/prompt.body.xml` so the GitHub bundle includes branch governance in its core doctrine and mandatory sequence.

Updated `.agent-operating-model/bundles/github/CHANGELOG.md` and `RECENT_LEARNINGS.md` to record the governance change.

### Trace coverage tooling

Updated `scripts/agent-trace/assert-trace-coverage.mjs`.

The script now:

- normalises branch names from GitHub Actions and local git refs
- accepts only the approved work-branch prefixes
- requires a trace for `feature/`, `chore/`, `test/`, `fix/` and `perf/`
- skips trace coverage for `hotfix/`
- treats `main` and `master` as mainline branches exempt from work-branch prefix checks
- rejects unapproved branch prefixes, including `claude/`

Updated `tests/agent-trace-coverage.test.js` to cover:

- approved branch prefixes
- trace-required prefixes
- `hotfix/` trace exemption
- mainline branch exemption
- blocked prefixes such as `claude/`, `codex/`, `bugfix/` and `experiment/`

## Validation intent

The expected validation path is:

- `npm test`
- `npm run validate`
- CI
- Release Gate
- Worker CI

The branch should pass trace coverage because it is a `fix/` branch and this directory now contains promoted JSON trace evidence for 2026-05-14.

## Residual risks

This cleanup does not alter D1 data. It only removes the temporary mechanism that had corrected data already applied to preview and production.

If DaaS account data is lost again, it should be corrected through a deliberate operational data fix, not by reintroducing these temporary migrations.

The branch-prefix policy is now enforced through repository scripts and tests. It should also be mirrored in GitHub branch rulesets where that control is available.
