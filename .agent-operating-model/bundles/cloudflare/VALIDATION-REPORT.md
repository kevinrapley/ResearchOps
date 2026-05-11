# Validation Report — Cloudflare Developer Platform Bundle v1.0.0

Validation status: passed for ResearchOps scope.

Last checked: 2026-05-11.

## Scope

This bundle governs Cloudflare Workers, Pages, Wrangler, bindings, secrets, D1, KV, R2, Durable Objects, Queues, Workflows, Workers AI, Vectorize, deployment evidence, testing, observability, compatibility and limits for ResearchOps.

Cloudflare platform claims are constrained to `developers.cloudflare.com`.

## Entrypoints checked

Checked entrypoints:

- `README.md`
- `CHANGELOG.md`
- `prompt.spec.yaml`
- `prompt.body.xml`
- `evals.yaml`
- `tests.regression.yaml`
- `tests.redteam.yaml`
- `variables.schema.json`
- `output.schema.json`
- `grade.schema.json`
- `registry-manifest.yaml`
- `references/source-catalog.yaml`

## Structural checks

The bundle has build, review and release modes.

It includes contract schemas for Wrangler configuration review, Cloudflare validation evidence and Cloudflare gap registers.

It includes reference modules for Workers runtime, Wrangler, bindings, secrets, storage, state, Pages, deployment, queues, workflows, AI, Vectorize, versions, Cron Triggers, testing, observability, compatibility, limits, Service Bindings, Smart Placement, Hyperdrive and Static Assets.

## Evaluation coverage

Regression and red-team assets are present.

Repository regression tests check Cloudflare bundle selection, source-catalog discipline, manifest assets, prompt/spec entrypoints and short-token matching boundaries.

## Known gaps

The bundle does not attempt exhaustive Cloudflare product-family coverage.

Future expansion should be needs-led for Access, Turnstile, DNS, Cache Rules, WAF, API Tokens, Images, Stream, Browser Rendering, Zaraz, Workers for Platforms, Containers and Zero Trust.

## Result

The bundle is suitable for current ResearchOps Cloudflare runtime and integration work.
