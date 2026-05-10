# Cloudflare Developer Platform Prompt Bundle

Version: 1.0.0
Status: canonical
Source of truth: https://developers.cloudflare.com/

This bundle governs Cloudflare implementation work for ResearchOps. It is structured like the other checked-in prompt bundles, but the Cloudflare platform content is sourced only from Cloudflare developer documentation.

## Coverage

The bundle covers:

- Workers runtime and fetch handlers
- Wrangler configuration
- bindings, environment variables and secrets
- local development variables
- Workers routes, Custom Domains and `workers.dev`
- Pages Functions bindings
- D1, KV, R2 and Durable Objects
- Queues and Workflows
- Workers AI and Vectorize
- Workers versions, deployments and gradual deployments
- Cron Triggers
- Workers testing
- Workers Logs, source maps and observability evidence
- compatibility dates and compatibility flags
- Workers limits and runtime constraints
- Service Bindings
- Smart Placement
- Hyperdrive
- Static Assets

## Operating principle

Prefer Cloudflare bindings inside Workers and Pages Functions. Use REST APIs only where the Cloudflare docs indicate that the REST API is the correct interface for non-Worker applications or account/resource management.

Do not invent Cloudflare product behaviour. If the docs do not establish a capability, state the gap and stop or seek a verified source from `developers.cloudflare.com`.

## Operational checks

Cloudflare work must record:

- products and bindings in scope
- Wrangler configuration changes
- secrets and local variable handling
- compatibility date and compatibility flag changes
- account plan or runtime limit assumptions
- local, preview and production validation boundaries
- deployment, version, rollback or gradual rollout evidence
- observability checks and residual risks

Use `scripts/validate-source-catalog.py` to ensure every Cloudflare source URL used by the bundle is present in `references/source-catalog.yaml` and belongs to `developers.cloudflare.com`.
