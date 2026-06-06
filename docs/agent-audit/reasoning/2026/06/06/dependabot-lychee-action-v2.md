# Dependabot Lychee action v2

## Run metadata

- Date: 2026-06-06
- Original branch: `dependabot/github_actions/lycheeverse/lychee-action-2`
- Post-merge branch: `main`
- Trace requirement: not required on the original `dependabot/` branch, but required for post-merge `main` validation because PR #333 changed agent-significant operating-model files.
- Task: get Dependabot PR #333 green after rebasing and allow `dependabot/` automation branches in the repository branch-prefix policy.

## Operating model loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.body.xml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.spec.yaml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.body.xml`

## Bundles selected

- `github-diamond`: repository governance, branch policy, PR discipline and CI handling.
- `researchops-developer-control`: ResearchOps repository conventions and validation expectations.
- `multi-functional-team`: assurance view on whether the dependency update was safe to merge.

## Bundles skipped

- `govuk-design-system`: no service UI or GOV.UK component work changed.
- `cloudflare`: no Worker runtime code or bindings changed.
- `openai-platform`: no OpenAI integration changed.
- `mcp-agent-tooling`: no MCP contracts changed.
- `airtable-public-api`: no Airtable API code changed.
- `mural-public-api`: no Mural API code changed.

## Files read

- `.github/workflows/qa-links.yml`
- `scripts/agent-trace/assert-trace-coverage.mjs`
- `tests/agent-trace-coverage.test.js`
- `AGENTS.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/README.md`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/github/CHANGELOG.md`
- `.agent-operating-model/bundles/github/registry-manifest.yaml`

## Files changed

- `.github/workflows/qa-links.yml`
- `scripts/agent-trace/assert-trace-coverage.mjs`
- `tests/agent-trace-coverage.test.js`
- `AGENTS.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/README.md`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/github/CHANGELOG.md`
- `.agent-operating-model/bundles/github/registry-manifest.yaml`

## Implementation summary

- Updated the Lychee workflow to use `lycheeverse/lychee-action@v2` with repository `lychee.toml` as the source of link-check configuration.
- Added `dependabot/` to the branch-prefix allow list for automated dependency update branches.
- Updated trace coverage policy so `dependabot/` branches are allowed and do not require promoted trace artefacts while still keeping normal work branches trace-gated.
- Updated tests for the new `dependabot/` branch-prefix behaviour.
- Updated operating-model documentation and GitHub bundle prompt text so the branch policy is consistent across enforcement and documentation.
- Regenerated the GitHub bundle registry manifest after bundle text changed.
- Follow-up fix for PR #359: updated `lychee.toml` for Lychee `0.23.0` compatibility by changing `exclude_mail` to `include_mail`, changing `verbose` from a boolean to a log level, replacing the invalid `*.invalid` regex with `.*\\.invalid`, and setting `root_dir = "public"` so generated root-relative app links resolve in CI.

## Post-merge issue

- PR #333 was checked on its `dependabot/` branch, where trace coverage is deliberately skipped.
- After merge, `main` validation runs from a mainline branch and detects agent-significant operating-model changes in the merge diff.
- The missing trace directory for `2026-06-06` caused `npm run validate` to fail at `trace:coverage`.
- This trace was added as the missing audit artefact for the PR #333 operating-model change.

## Validation

- `npm run agent:model -- "Fix failing checks on Dependabot PR 333 updating lycheeverse/lychee-action from v1 to v2"`
- `npm run trace:coverage` on `dependabot/github_actions/lycheeverse/lychee-action-2`
- `npm test -- tests/agent-trace-coverage.test.js`
- `npm run agent:model:validate`
- `npm run agent:bundle-versions:validate`
- `npm test`
- `npm run validate` on the merged main state reproduced the missing trace failure.
- `/tmp/lychee-v0.23.0/lychee --config lychee.toml .` reproduced the PR #359 Lychee failure, then passed after the `lychee.toml` compatibility fix.

## Residual risk

- The original merge failure was caused by checking branch-local CI without simulating post-merge `main` trace enforcement. Future dependency PRs that modify operating-model files should either include an appropriate promoted trace or have their post-merge main validation simulated before being marked safe.
