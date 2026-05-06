# Wrangler deployment toolchain

ResearchOps deploys Cloudflare Workers through GitHub Actions using Wrangler.

Deployment workflows must use a pinned Wrangler version. They must not use `wrangler@latest`.

## Current pinned version

`4.34.0`

The value is recorded in these places:

- `.github/workflows/deploy-worker.yml`
- `.github/workflows/deploy-agent-gateway.yml`
- `.github/workflows/worker-ci.yml`
- `deployment-toolchain.yaml`

Keep these values aligned.

## Cloudflare deployables

ResearchOps has two Cloudflare Worker deployables.

### ResearchOps API Worker

This is the main service API Worker.

```text
config: infra/cloudflare/wrangler.toml
workflow: .github/workflows/deploy-worker.yml
```

The API Worker workflow must not deploy only because the agent gateway changes.

### ResearchOps Agent Gateway Worker

This is the production-safe capability layer for AI-agent access to Cloudflare resources.

```text
config: infra/cloudflare/agent-gateway/wrangler.toml
workflow: .github/workflows/deploy-agent-gateway.yml
```

The agent gateway is a separate Worker. It has separate secrets, a separate audit D1 binding and a separate deployment workflow.

## Why this is pinned

A floating deployment tool can change behaviour without a repository change.

That makes release evidence weaker because a deployment that passed yesterday may use a different Wrangler release today.

Pinning Wrangler gives the release gate and deployment workflow a stable toolchain boundary.

## Upgrade process

When upgrading Wrangler:

1. Change `WRANGLER_VERSION` in `.github/workflows/deploy-worker.yml`.
2. Change `WRANGLER_VERSION` in `.github/workflows/deploy-agent-gateway.yml`.
3. Change `WRANGLER_VERSION` in `.github/workflows/worker-ci.yml`.
4. Change the matching version in `deployment-toolchain.yaml`.
5. Run repository validation.
6. Confirm `npx --yes wrangler@${WRANGLER_VERSION} --version` succeeds.
7. Review Cloudflare release notes and any compatibility-date implications.
8. Deploy through the relevant workflow, not a local unrecorded command.

## Release evidence

Deployment evidence should include:

- workflow run URL
- commit SHA
- Wrangler version
- `wrangler.toml` path
- deployment target
- validation status before deployment

For the agent gateway, evidence should also include confirmation that:

- the audit D1 binding is configured
- the gateway uses a narrow Cloudflare API token
- the deployment was triggered deliberately through `.github/workflows/deploy-agent-gateway.yml`

## Rollback

For the ResearchOps API Worker, revert the relevant application or infrastructure change and rerun `.github/workflows/deploy-worker.yml`.

For the ResearchOps Agent Gateway Worker, revert the relevant gateway change and rerun `.github/workflows/deploy-agent-gateway.yml`.

If the Wrangler version itself caused the problem, revert the version change in all workflow files and `deployment-toolchain.yaml`, then rerun the affected deployment workflow.
