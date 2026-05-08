# Agent trace: authentication and role-selection requirements

> This is an auditable trace for a repository-affecting task that included `[reasoning]`. It records the operating-model bootstrap, selected and skipped bundles, precedence decisions, branch hygiene, files read, files created, validation boundary and residual risks. It does not expose private chain-of-thought.

## Run metadata

- Trace ID: `atrace-20260508-authentication-role-selection-requirements`
- Date: 2026-05-08
- Repository: `kevinrapley/ResearchOps`
- Active branch: `feature/auth-requirements-trace-current-main`
- Abandoned branch: `feature/auth-requirements-reasoning-trace`
- Trigger token detected: `[reasoning]`
- Trace layer: `operational`

## User task summary

The user asked for requirements and architecture discussion for user authentication with role selection as a prerequisite for:

- `ROPS-DC-P1-003`: pseudonymised participant views by default
- `ROPS-DC-P1-005`: governance roles and decision ownership
- `ROPS-DC-P1-007`: safeguarding prompts and escalation routes

The user explicitly asked for no changes to the live system at this time. The required output was a full team discussion transcript, requirements, implementation options, strengths and weaknesses, and a capability matrix covering UI, Cloudflare, D1 and Airtable.

## Full operating-model bootstrap recorded

Repository bootstrap sources were loaded, checked or inspected before repository-affecting work:

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

The bundle ZIP was inspected at repository path level and confirmed as the authoritative bundle package reference. The connector exposes the ZIP as a binary repository object. This trace records path and blob presence. It does not claim internal ZIP entry review.

## Files read

Repository files read:

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
- `docs/product/researchops-design-critique-backlog-2026-05-07.md`

Public reference material was checked for currency during the requirements pass and recorded in `docs/product/authentication-role-selection-reference-notes-2026-05-08.md`.

## Selected bundles

The selected bundles were:

- `github-diamond`
- `researchops-developer`
- `gov-product-assistant-gold-standard`
- `govuk-design-system`
- `cloudflare-core-developer`
- `airtable-public-api-developer`

Selection rationale:

- `github-diamond` was selected because this was repository-affecting branch and PR work.
- `researchops-developer` was selected because the requirements concern the ResearchOps platform and its product backlog.
- `gov-product-assistant-gold-standard` was selected because the task concerns P1 public-sector product risk, governance, safeguarding and service assurance.
- `govuk-design-system` was selected because account creation, sign-in, error states, forms and accessibility are in scope.
- `cloudflare-core-developer` was selected because Cloudflare Access, Workers, D1, secrets, Turnstile and Cloudflare AI/Agents are in scope.
- `airtable-public-api-developer` was selected because the requirements define Airtable's role in the authorisation boundary and governed metadata model.

## Skipped bundles

The skipped conditional bundle was:

- `mural-public-api-developer`

Skip rationale:

- No Mural OAuth, workspace, room, board, widget or sticky note implementation or requirements were in scope for this authentication pass.

## Precedence decisions

- GitHub Diamond governed branch hygiene, no force update, PR discipline and documentation-only scope control.
- ResearchOps Developer governed repository context, backlog dependency mapping and documentation placement.
- Gold Standard Gov Product Assistant governed public-sector product framing, P1 dependency treatment, governance and risk posture.
- GOV.UK Design System governed account creation language, sign-in/sign-out UI, form clarity, accessibility and permission-denied patterns.
- Cloudflare Core Developer governed Cloudflare Access, Workers, D1, secrets, Turnstile and Cloudflare AI/Agents framing.
- Airtable Public API governed the boundary that Airtable remains a research data layer and not the primary authorisation engine.
- Mural Public API was not activated because its domain was not in scope.

No bundle conflict was found. The strongest constraint was the user's instruction not to change the live system. That constraint was applied by recording requirements only.

## Branch hygiene

A first branch, `feature/auth-requirements-reasoning-trace`, was created from a commit that became behind current `main` before file changes.

Corrective action:

- stopped using `feature/auth-requirements-reasoning-trace`
- created `feature/auth-requirements-trace-current-main` from current `main`
- confirmed `feature/auth-requirements-trace-current-main` was identical to `main` before changes
- made all documentation changes on `feature/auth-requirements-trace-current-main`
- did not force-update any branch

## Files created

- `docs/product/authentication-role-selection-requirements-2026-05-08.md`
- `docs/product/authentication-role-selection-reference-notes-2026-05-08.md`
- `docs/agent-audit/reasoning/2026/05/08/authentication-role-selection-requirements-trace.md`
- `docs/agent-audit/reasoning/2026/05/08/authentication-role-selection-requirements-trace.json`

## Files modified

- `docs/agent-audit/reasoning/2026/05/08/authentication-role-selection-requirements-trace.md`
- `docs/agent-audit/reasoning/2026/05/08/authentication-role-selection-requirements-trace.json`

The modified files were trace corrections to include the reference-notes artefact.

## Requirements recorded

The requirements document records:

- full team transcript
- account creation requirements
- authentication requirements
- logout requirements
- team membership requirements
- role request and assignment requirements
- permission-boundary requirements
- PII reveal requirements
- governed authorship requirements
- reviewer and approver requirements
- decision ownership requirements
- safeguarding visibility requirements
- audit event requirements
- UI requirements
- Cloudflare requirements
- D1 requirements
- Airtable requirements
- implementation methods
- strengths and weaknesses
- capability matrix
- recommended route
- route map
- open questions

## Reference notes recorded

The reference notes record implementation references for:

- GOV.UK account creation pattern
- GOV.UK pattern coverage
- Cloudflare Access JWT validation
- Cloudflare Access cookies and sessions
- D1 Worker bindings
- D1 database binding configuration
- Cloudflare Workers secrets
- Cloudflare Turnstile server-side validation
- Cloudflare Agents boundary

## Cloudflare AI/Agent boundary

Cloudflare AI and Agents were considered as enabled for this pass. The requirements document treats them as supporting capabilities for admin guidance, role explanation, audit summarisation and guided configuration.

They are explicitly not positioned as final access-control decision makers. Deterministic Worker and D1 logic must enforce permissions.

## Validation designed

This documentation-only branch should be reviewed for:

- transcript completeness
- coverage of the three P1 prerequisites
- account creation and authentication coverage
- role-boundary coverage
- UI, Cloudflare, D1 and Airtable coverage
- implementation-method comparison
- capability matrix completeness
- reference-note relevance
- explicit non-implementation boundary
- trace artefact presence

## Validation not claimed

I have not claimed full local `npm run lint`, `npm run validate` or `npm test` success in this environment. CI should provide the definitive result.

## Residual risks

- Requirements are architecture guidance and need future validation before implementation.
- Cloudflare and authentication product details may change and should be checked again immediately before implementation.
- No threat model has yet been completed.
- No live IAM, D1, Airtable or Worker configuration has been changed.
- No user research has validated the proposed role names or account flow.
