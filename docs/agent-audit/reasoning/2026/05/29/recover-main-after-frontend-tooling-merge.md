# Recover main after frontend-tooling merge

## Run metadata

- Date: 2026-05-29
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/revert-frontend-tooling-dependabot`
- Trace requirement: required by `fix/` branch policy
- Trace layer: operational

## Task summary

Main was broken after accidental merge of Dependabot PR #303, which upgraded the frontend tooling group including ESLint 10.

## Diagnosis

The merged dependency graph includes ESLint 10 and related packages that require Node `^20.19.0 || ^22.13.0 || >=24`, while the repository still declared only `node >=20` and several workflows requested generic Node 20.

A full lockfile revert was considered but avoided because restoring `package-lock.json` through the connector would require a high-risk full-file replacement of a large lockfile. The chosen recovery is to align the repository runtime contract with the merged dependency graph.

## Files modified

- `package.json`
- `.nvmrc`
- `.github/workflows/ci.yml`
- `.github/workflows/validate.yml`
- `.github/workflows/bundle-version-consistency.yml`
- `.github/workflows/worker-ci.yml`
- `docs/agent-audit/reasoning/2026/05/29/recover-main-after-frontend-tooling-merge.md`
- `docs/agent-audit/reasoning/2026/05/29/recover-main-after-frontend-tooling-merge.json`

## Implementation summary

- Updated `package.json` `engines.node` to match the ESLint 10 runtime contract.
- Added `.nvmrc` with Node 22.13.0 for local and platform build environments that honour NVM files.
- Updated the main CI matrix to test Node 20.19.0 and 22.13.0.
- Updated Validate ResearchOps, Bundle Version Consistency and Worker CI to use Node 20.19.0 explicitly.

## Notes

The release-gate workflow still requests Node 20. A large release-gate workflow rewrite was blocked by the connector safety layer. `actions/setup-node` should resolve `20` to a current Node 20 patch, but a follow-up can update that workflow surgically if needed.
