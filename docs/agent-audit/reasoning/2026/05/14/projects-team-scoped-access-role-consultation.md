# Role consultation transcript — Projects team-scoped access

**Date:** 2026-05-14  
**Branch:** `fix/projects-team-scoped-access`  
**Trace type:** role consultation transcript  
**Related trace:** `docs/agent-audit/reasoning/2026/05/14/projects-team-scoped-access-plan.md`

## Evidence boundary

This is a structured role consultation based on checked-in role modules from the repository operating model.

It is not a transcript from human participants.

It records the role perspectives applied to the change plan and the specific adjustments made before implementation work continues.

## Role modules consulted

### GOV.UK Design System bundle

- `.agent-operating-model/bundles/govuk-design-system/roles/designer.xml`
- `.agent-operating-model/bundles/govuk-design-system/roles/developer.xml`
- `.agent-operating-model/bundles/govuk-design-system/roles/content-designer.xml`
- `.agent-operating-model/bundles/govuk-design-system/roles/accessibility-specialist.xml`
- `.agent-operating-model/bundles/govuk-design-system/roles/qa.xml`

### Multi-functional team bundle

- `.agent-operating-model/bundles/multi-functional-team/roles/product-management.xml`
- `.agent-operating-model/bundles/multi-functional-team/roles/user-research.xml`
- `.agent-operating-model/bundles/multi-functional-team/roles/research-operations.xml`
- `.agent-operating-model/bundles/multi-functional-team/roles/developer.xml`
- `.agent-operating-model/bundles/multi-functional-team/roles/quality-assurance.xml`
- `.agent-operating-model/bundles/multi-functional-team/roles/governance.xml`
- `.agent-operating-model/bundles/multi-functional-team/roles/privacy.xml`

## Consultation question

How should the `/pages/projects/` project-card, dashboard-link and project-visibility defects be fixed while preserving ResearchOps access control, GOV.UK-style user experience, data minimisation, auditability and rollback safety?

## Transcript

### Facilitator

The current project page shows every project card as `Home Office Biometrics`. The card data appears broken. User group pills can render malformed identity-like values. Dashboard links are failing. Project visibility must be team-scoped, with ResearchOps Core retaining platform-wide oversight. User researchers and ResearchOps Core members must be able to start research projects.

What must change in the plan?

### GOV.UK Designer

Do not treat the card label as decorative copy. The label communicates ownership and orientation. If the project belongs to a team, the card should expose that in a consistent, scannable way.

The card should not rely on a hard-coded organisation fallback. If a team is missing, show a clear fallback such as `Unassigned team` or suppress the label if the product decision is that unassigned projects should not appear to non-Core users.

### GOV.UK Content Designer

The words on the page should be user-facing and task-based. Avoid implementation terms like `team_id`, `permission code`, `record id`, or `Airtable lookup` in the card UI.

Use `Team` as the concept if the service model is team ownership. Avoid `Org` if the platform model is now team-scoped access. Error text should not expose raw malformed values from Airtable or identity fields.

### GOV.UK Accessibility Specialist

Do not fix the issue by replacing links or buttons with custom interactive elements. Dashboard links should remain normal links. The Start project control should remain a link or button with an accessible name and predictable keyboard behaviour.

When projects fail to load, use a status or alert pattern that is clear but does not trap focus. If a gated action is unavailable, do not leave a dead control in the page.

### GOV.UK Developer

Keep progressive enhancement. The page should render from a clear API contract. Client-side filtering must not be used as the primary access-control mechanism.

The client should handle missing fields defensively, but the server should own visibility, normalisation of record-level access, and safe output shape.

### GOV.UK QA

The acceptance criteria need route-state and regression tests. Tests should assert the absence of the hard-coded `Home Office Biometrics` fallback, credentialed project fetches, direct dashboard reads, and permission-gated Start project behaviour.

The malformed `User groups` defect should have a regression assertion so identity-like fragments cannot be rendered as blue pills again.

### Product Management

The outcome is not just cleaner cards. The outcome is that users see the right research projects for their team context, and ResearchOps Core can oversee all projects.

The plan must separate three product states:

- ResearchOps Core oversight across all teams.
- Ordinary team membership with bounded visibility.
- Project setup capability for user researchers and ResearchOps Core.

### User Research

The Start research project action is important for researchers doing their work. Do not hide it from the exact users who need to initiate research setup.

The plan should avoid making ordinary researchers understand permission internals. The page should simply show the projects they can work with and the route to start a project if they are allowed to do so.

### Research Operations

ResearchOps Core needs platform-wide visibility for oversight, quality, consistency and safe operations. That is not the same as ordinary team access.

The plan should treat ResearchOps Core as an explicit governance exception and should avoid making unassigned or malformed projects visible to ordinary team members.

### Developer

Make the change as a narrow vertical slice:

1. Server-side route and service contract.
2. Project data normalisation and visibility.
3. Client rendering and dashboard read behaviour.
4. Tests and fixtures.
5. Product documentation and recent learnings.

Do not mix all of this into one large commit. Each commit should be reviewable and reversible.

### Quality Assurance

The validation plan must state what is run and what is only mapped. If local execution is not available, do not claim tests passed.

Add tests at the correct level. Route-state tests are suitable for detecting accidental route removal, credential omission, unsafe fallbacks and dashboard lookup regressions.

### Governance

Project visibility is an access-control rule. It must be enforced server-side. A front-end-only filter would be under-governed and non-auditable.

ResearchOps Core global visibility must be explicit, not an accidental side effect of missing filters.

The branch must retain a rollback path without data migration. If Airtable schema assumptions are uncertain, the plan must document them and fail safely.

### Privacy

Malformed `User groups` values appear to include email/person-field fragments. Treat this as a privacy issue, not just broken formatting.

Do not render raw identity-like fragments in blue pills. Do not log raw malformed values. If data is invalid, suppress it or normalise it to a safe label only when the source shape is clear.

## Plan adjustments resulting from consultation

### Adjustment 1 — Server-side access before UI repair

The implementation order is changed to prioritise API visibility enforcement before card display changes.

Reason: project visibility is access control, not presentation.

### Adjustment 2 — Team label is user-facing content

The card label should use the product language `Team`, not implementation labels such as `Org`, `team_id`, or Airtable field names.

Reason: the page should explain ownership in plain language.

### Adjustment 3 — Unassigned projects are restricted

Projects without a resolvable team should be visible only to ResearchOps Core.

Reason: ordinary team users should not see records where team ownership cannot be established.

### Adjustment 4 — User group parsing is privacy-sensitive

The plan must include filtering for identity-like fragments and must avoid raw-value logging.

Reason: malformed person-field JSON can expose personal data.

### Adjustment 5 — Start project is both UI and API gated

The Start research project action should be shown only when the API reports capability, and `POST /api/projects` must enforce the same rule server-side.

Reason: client-side gating alone is insufficient.

### Adjustment 6 — Dashboard uses direct project read

The dashboard should fetch `/api/projects/:id` directly rather than load all visible projects and search client-side.

Reason: direct reads give clearer access semantics and avoid broken links when list visibility changes.

### Adjustment 7 — Validation plan widened

Route-state tests must cover:

- `GET /api/projects` uses scoped auth context.
- `POST /api/projects` exists and is permission-gated.
- project cards do not hard-code `Home Office Biometrics`.
- project fetches use credentials.
- malformed user-group identity fragments are not rendered.
- dashboard loads a direct project endpoint.
- Start project visibility is capability-driven.

### Adjustment 8 — Rollback remains non-destructive

No D1 migration and no Airtable schema migration are included in this fix.

Reason: current uncertainty is around field mapping and route behaviour, not an agreed data migration.

## Revised implementation sequence

1. Update trace and role-consultation artefacts.
2. Server-side project access route and service signatures.
3. Project service normalisation, visibility and create permission enforcement.
4. Project page, dashboard and start-project client behaviour.
5. Route-state tests and visual walkthrough fixture updates.
6. Product documentation and RECENT_LEARNINGS.md assessment.
7. Validation command mapping and CI status review.
8. PR only when branch is coherent.

## Residual questions

The exact Airtable field or fields that represent project ownership by team remain uncertain.

The safest implementation should support configured field names and known read variants, while documenting the expected field configuration.

If Airtable schema inspection becomes available, this trace should be updated with the confirmed field names before merge.
