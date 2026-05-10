# Cloudflare Developer Platform Prompt Bundle

Version: 1.0.0
Status: canonical
Source of truth: https://developers.cloudflare.com/

This bundle governs Cloudflare implementation work for ResearchOps. It is structured like the other checked-in prompt bundles, but the Cloudflare platform content is sourced only from Cloudflare developer documentation.

## Coverage

The bundle covers Workers runtime and fetch handlers, Wrangler configuration, bindings and environment access, secrets and local development variables, Workers routes, Pages Functions bindings, D1, KV, R2, Durable Objects, Queues, Workflows, Workers AI and Vectorize.

## Operating principle

Prefer Cloudflare bindings inside Workers and Pages Functions. Use REST APIs only where the Cloudflare docs indicate that the REST API is the correct interface for non-Worker applications or account/resource management.

Do not invent Cloudflare product behaviour. If the docs do not establish a capability, state the gap and stop or seek a verified source from `developers.cloudflare.com`.
