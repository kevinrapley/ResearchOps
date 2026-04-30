# Wrangler deployment toolchain

ResearchOps deploys its Cloudflare Worker through GitHub Actions using Wrangler.

The deployment workflow must use a pinned Wrangler version. It must not use `wrangler@latest`.

## Current pinned version

`4.38.0`

The value is recorded in two places:

- `.github/workflows/deploy-worker.yml`
- `deployment-toolchain.yaml`

Keep these values aligned.

## Why this is pinned

A floating deployment tool can change behaviour without a repository change.

That makes release evidence weaker because a deployment that passed yesterday may use a different Wrangler release today.

Pinning Wrangler gives the release gate and deployment workflow a stable toolchain boundary.

## Upgrade process

When upgrading Wrangler:

1. Change `WRANGLER_VERSION` in `.github/workflows/deploy-worker.yml`.
2. Change the matching version in `deployment-toolchain.yaml`.
3. Run repository validation.
4. Confirm `npx --yes wrangler@${WRANGLER_VERSION} --version` succeeds.
5. Review Cloudflare release notes and any compatibility-date implications.
6. Deploy through the workflow, not a local unrecorded command.

## Release evidence

Deployment evidence should include:

- workflow run URL
- commit SHA
- Wrangler version
- `wrangler.toml` path
- deployment target
- validation status before deployment

## Rollback

Revert the Wrangler version change in both files and rerun the deployment workflow.
