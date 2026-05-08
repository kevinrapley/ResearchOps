# Agent trace: authentication role-selection implementation

> This is an auditable trace for a repository-affecting task that included `[reasoning]`. It records operating-model bootstrap, selected and skipped bundles, precedence decisions, branch hygiene, files read, attempted direction, correction and current boundary. It does not expose private chain-of-thought.

## Run metadata

- Trace ID: `atrace-20260508-authentication-role-selection-implementation`
- Date: 2026-05-08
- Repository: `kevinrapley/ResearchOps`
- Active branch: `feature/auth-foundation-d1-rbac-current-main`
- Base commit: `90abe806b530f377207733fcf5bf454e4ba32cde`
- Trigger token detected: `[reasoning]`
- Trace layer: `operational`

## User task summary

The user stated that PR #214 had been merged into `main` and asked to begin systematically building the authentication role-selection capability using the captured documentation.

The active implementation must be based on the authentication and role-selection requirements, reference notes and decision record created under `docs/product/26/05/08/`.

## Operating-model bootstrap recorded

The repository operating model was loaded from the repository, not from chat memory.

Files loaded or checked:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`
- `docs/devops/ResearchOps-Bundle-Setup.zip`

The bundle package path was checked as the authoritative package reference.

## Selected bundles

Selected bundles:

- `github-diamond`
- `researchops-developer`
- `gov-product-assistant-gold-standard`
- `govuk-design-system`
- `cloudflare-core-developer`
- `airtable-public-api-developer`

Selection rationale:

- `github-diamond` was selected because this is repository-affecting branch and implementation work.
- `researchops-developer` was selected because the work changes the ResearchOps platform.
- `gov-product-assistant-gold-standard` was selected because the work affects governance, personal data, safeguarding and service assurance.
- `govuk-design-system` was selected because account, permission, denial and role management UI are in scope.
- `cloudflare-core-developer` was selected because the Worker, D1 and authentication boundary are in scope.
- `airtable-public-api-developer` was selected because the design explicitly preserves Airtable as the research data layer behind Worker authorisation.

## Skipped bundles

Skipped bundle:

- `mural-public-api-developer`

Skip rationale:

- No Mural OAuth, workspace, room, board, widget or sticky-note implementation is in scope for this authentication slice.

## Precedence decisions

- GitHub Diamond governs branch hygiene, commits, PR discipline, trace evidence and validation claims.
- ResearchOps Developer governs repository architecture and implementation slicing.
- Gold Standard Gov Product Assistant governs risk, governance and public-sector assurance framing.
- GOV.UK Design System governs account and access UI quality where UI is changed.
- Cloudflare Core Developer governs Worker, D1, route and binding decisions.
- Airtable Public API governs the boundary that Airtable remains a protected research data layer rather than an authorisation engine.

No bundle conflict has been found so far.

## Branch hygiene

- PR #214 was verified as merged.
- Branch `feature/auth-foundation-d1-rbac-current-main` was created from merge commit `90abe806b530f377207733fcf5bf454e4ba32cde`.

## Files read

Repository files read so far:

- `docs/product/26/05/08/authentication-role-selection-decisions-2026-05-08.md`
- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`
- `docs/devops/ResearchOps-Bundle-Setup.zip`
- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/src/core/router.js`
- `infra/cloudflare/wrangler.toml`
- `package.json`
- `tests/projects-route-contract.test.js`
- `eslint.config.js`

## Correction recorded

An initial implementation direction attempted to start from mock identity scaffolding. The user corrected this, stating that this is not a mock implementation.

Correction applied:

- stop the mock-identity-first direction
- do not commit a mock identity foundation file
- treat the build as a real authentication foundation implementation
- continue tracing the repository-affecting work

A check for `infra/cloudflare/src/core/auth/foundation.js` on the implementation branch returned not found. No mock foundation file is present on the branch at the time this trace entry was written.

## Current implementation boundary

The next implementation step must use the captured documentation to begin a real foundation slice. It should not rely on mock identity as the product behaviour.

The implementation should still remain systematic and reviewable. The next slice should prioritise:

- D1 schema and migrations for users, identities, teams, roles, permissions, role assignments and audit
- route-permission mapping
- server-side authorisation middleware
- real identity boundary design for Cloudflare Access or OIDC
- production-safe configuration checks
- tests that prove protected routes fail closed

## Validation not yet claimed

No local lint, typecheck, test or build success is claimed at this point.

## Residual risks

- The branch currently contains trace start only.
- The real authentication provider choice still needs implementation-level detail.
- D1 migrations must be introduced carefully because they affect the control plane.
- Cloudflare Access or OIDC configuration cannot be changed safely without explicit implementation planning and environment-specific validation.
