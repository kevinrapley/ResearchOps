# Changelog

All notable changes to this prompt bundle are documented in this file.

## v1.13.0 — 2026-04-26

### Added

- Added explicit component-targeting governance so the agent checks whether a requested UI change belongs in a page, a local component, a shared component, CSS, JavaScript, router, data adapter or workflow before editing.
- Added `references/component-routing-contract.xml`.
- Added `references/visual-walkthrough-control.xml`.
- Added `references/deployment-control.xml`.
- Added `references/route-shape-fixture-index.xml`.
- Added `contracts/route-shape-fixture.schema.json`.
- Added examples for route availability, proxy worker joined tests, single-record route status, fixture index validation, conformance summary and CI governance.
- Added examples for start overview routing, start project flow, participant consent, synthesize, research components, analysis endpoints and diagnostics.
- Added examples for product docs, metadata provenance, PR/logging governance and ethics impact.
- Added explicit routes and files for the ResearchOps start/project overview pattern.
- Added named coverage for `reports-site`, `visual-walkthrough.config.mjs` and operational fixtures.

### Changed

- Strengthened the repo-first rule so the agent must inspect existing implementation before proposing or applying changes.
- Tightened response obligations for implementation work: full-file rewrites remain preferred when changing code, but the agent must now state when it used a narrower committed diff because of GitHub connector limits.
- Extended the route availability policy to cover routes that are intentionally unavailable outside a project or study context.
- Strengthened conformance language around route shape, fixture coverage, deployment gates, preview environments and visual walkthrough evidence.
- Expanded role modules for researcher, developer, architect, QA, service owner, accessibility and ethics to better match ResearchOps platform responsibilities.
- Updated regression and red-team tests to cover component targeting, route context, joined proxy worker checks and deployment control.

### Fixed

- Reduced ambiguity around where to make UI changes when the same pattern appears in a page and a shared component.
- Reduced ambiguity between static Pages routes, Worker API routes and development-only proxy routes.
- Clarified when missing records should produce an empty state, a 404, a guarded setup blocker or a recoverable warning.

## v1.12.0 — 2026-04-26

### Added

- Added explicit conformance examples for route availability, contract fixtures, joined proxy worker tests and CI governance.
- Added `examples/conformance/` fixtures to make the bundle easier to test against ResearchOps repository behaviour.
- Added clearer registry entries for new conformance examples and workflow contracts.

### Changed

- Strengthened instruction text around D1/Airtable route drift and Worker/Pages split.
- Tightened delivery expectations for GitHub PR comments and logging governance.

## v1.11.0 — 2026-04-26

### Added

- Added ResearchOps platform context reference module.
- Added endpoint catalogue reference module.
- Added metadata provenance reference module.
- Added PR and logging governance reference module.
- Added registry manifest entries for platform, endpoint and provenance material.

### Changed

- Reworked the main prompt body to load ResearchOps platform context before mode execution.
- Added stronger traceability requirements for evidence, insights and recommendations.

## v1.10.0 — 2026-04-26

### Added

- Added ResearchOps-specific developer control bundle structure.
- Added roles, modes, references, graders, templates, tests and examples.
- Added registry manifest and validation-oriented schemas.

### Changed

- Established GOV.UK, Cloudflare, Airtable, Mural and accessibility-aware defaults for ResearchOps development.
