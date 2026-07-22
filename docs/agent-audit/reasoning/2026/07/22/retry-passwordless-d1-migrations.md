# Retry transient passwordless D1 migrations

## Run metadata

- Date: 2026-07-22
- Branch: `fix/retry-passwordless-d1-migrations`
- Task: Recover the failed post-merge passwordless preview Worker deployment and prevent transient Cloudflare D1 import failures from failing the workflow.

## Branch-prefix trace decision

- `fix/` requires an auditable trace.
- This record contains repository evidence, implementation decisions, validation results and residual risks only.

## Operating model and bundle selection

Loaded the repository operating model from `AGENTS.md` and `.agent-operating-model/`, including orchestration, registry, task signals, selection rules, precedence, trace and GitHub mutation policy sources.

Selected canonical bundles:

- `github-diamond` — `.agent-operating-model/bundles/github/`
- `researchops-developer-control` — `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` — `.agent-operating-model/bundles/multi-functional-team/`
- `cloudflare` — `.agent-operating-model/bundles/cloudflare/`

Skipped bundles: `govuk-design-system`, `openai-platform`, `mcp-agent-tooling`, `airtable-public-api` and `mural-public-api`.

## Evidence and decisions

- Main workflow run `29902037107` failed after the preview project seed migration completed successfully. The immediately following passwordless migration was rejected because Cloudflare D1 still reported a long-running import in progress.
- No other workflow overlapped the failed import. PR #502 changed no Cloudflare runtime, migration or passwordless deployment file.
- The same passwordless migration step had also encountered a transient Wrangler `fetch failed` error earlier on 2026-07-22.
- Rerunning the failed job without a code change passed all six remote migrations, Worker deployment, secret upload and live passwordless route verification. This confirmed a transient remote failure rather than an SQL or Nunjucks regression.
- All six remote migration commands now use `scripts/d1/execute-remote-migration-with-retry.sh`.
- The wrapper retries only the two transient failure signatures observed in GitHub Actions. It makes at most four attempts with three-second linear backoff and preserves fail-fast behaviour for deterministic failures.
- Codex review correctly identified that wrapper-only changes did not match the deployment workflow path filter. The wrapper path is now an explicit trigger.
- Codex review also identified that retries alone did not prevent overlapping runs from targeting the same Worker and D1 database. A static workflow concurrency group now serializes every branch and manual deployment, with active runs allowed to finish.
- Both valid Codex review comments were acknowledged with a `+1` reaction before remediation in accordance with the GitHub Diamond Standard.
- Existing workflow, repository and security tests were updated to assert the wrapper-based seam. No parallel test layer was added.

## Validation

- Main workflow rerun attempt 2 passed against the deployed passwordless preview Worker and remote D1 database.
- `bash -n scripts/d1/execute-remote-migration-with-retry.sh` passed.
- Simulated Wrangler checks proved immediate success and bounded retry exhaustion with the original exit status.
- Targeted affected tests passed: 16 tests.
- `npm test -- --test-reporter=dot` passed after replacing the two direct-Wrangler implementation assertions exposed by the full suite.
- `npm run lint` passed with the repository's existing warning baseline and no errors.
- `npm run trace:validate` and `npm run trace:coverage` passed for the `fix/` branch.
- `npm run validate` passed, including the full build, operating-model validation and evals, trace checks, report and sourcebook integrity, syntax checks, performance audit and route-state validation.
- Targeted Prettier checks and `git diff --check` passed.
- After the Codex review fixes, the focused workflow contract suite passed all 14 tests.
- The GitHub Diamond standard workflow hardening validator passed the edited workflow with no warnings. The repository does not include actionlint or the release-mode workflow action-lock file, so those optional checks were unavailable.
- The complete post-review `npm run lint`, `npm test -- --test-reporter=dot` and `npm run validate` gates passed.

## Changed-file plausibility

- Seven paths are changed: the passwordless preview workflow, one shared D1 retry wrapper, three existing test contracts and two trace files.
- No Worker runtime, SQL migration, Wrangler configuration, binding or secret definition changed.

## Residual risks

- Retry classification depends on the error text emitted by the pinned Wrangler version for the two observed failure modes.
- Deterministic SQL, authentication and configuration errors remain fail-fast.
- Local wrapper validation uses simulated Wrangler commands. The branch-triggered preview deployment provides the remote Cloudflare evidence for the final change.
