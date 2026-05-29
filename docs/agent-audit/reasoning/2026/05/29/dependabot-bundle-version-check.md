# Dependabot bundle version check trace

## Run metadata

- Date: 2026-05-29
- Repository: `kevinrapley/ResearchOps`
- Branch: `chore/dependabot-bundle-version-check`
- Trace requirement: required by `chore/` branch policy
- Trace layer: operational

## Task summary

Set up Dependabot and add a repository check that fails when bundle files with version references drift from the bundle version in `prompt.spec.yaml`.

## Selected bundles

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`

## Files modified

- `.github/dependabot.yml`
- `.github/workflows/bundle-version-consistency.yml`
- `package.json`
- `scripts/validate.sh`
- `scripts/agent-operating-model/validate-operating-model.mjs`
- `scripts/agent-operating-model/validate-bundle-version-consistency.mjs`
- `docs/agent-audit/reasoning/2026/05/29/dependabot-bundle-version-check.md`
- `docs/agent-audit/reasoning/2026/05/29/dependabot-bundle-version-check.json`

## Implementation summary

1. Added weekly Dependabot checks for npm dependencies and GitHub Actions.
2. Added grouped Dependabot updates for frontend tooling, QA tooling and GOV.UK frontend.
3. Added a bundle-version consistency validator.
4. Wired the validator into `package.json`, `scripts/validate.sh` and the operating-model validator.
5. Added a dedicated Bundle version consistency workflow.

## Validation plan

- Open a pull request to `main`.
- Use GitHub Actions to validate CI, release gate, operating-model checks and the new bundle-version workflow.
