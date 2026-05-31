# Agent trace — Participant pseudonymised view

**Date:** 2026-05-31  
**Trace type:** operational audit trace  
**Branch:** `feature/pseudonymised-participant-view`  
**Related work:** Story 7 — Show pseudonymised participant data by default; Story 6 and Story 12 controls for one protected journey

## Evidence boundary

This trace records repository evidence, implementation scope, files changed, validation expected and residual risk.

It does not expose private chain-of-thought.

## Operating-model bootstrap

Loaded repository-local sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`

Selected bundles:

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`
- `.agent-operating-model/bundles/airtable-public-api/`

Selection rationale:

- GitHub governance is in scope because this task creates a feature branch and PR.
- ResearchOps Developer Control is in scope because this changes platform Worker routes and service modules.
- Multi-functional Team is in scope because this is a public-sector product/security/privacy journey.
- GOV.UK Design System is in scope because the user-facing participant page and denied state are changed.
- Cloudflare is in scope because the Worker, D1 migrations and D1 apply workflow are changed.
- Airtable is in scope because participant records remain Airtable-backed research data.

## Task summary

Implement Story 7 as the first protected vertical journey using Story 6 and Story 12 controls.

The slice protects participant contact details by making the participant list pseudonymised by default and requiring a D1 permission check before contact details can be deliberately revealed.

## Protected journey

- User opens the study participants page.
- The browser calls `GET /api/participants?study=...`.
- The Worker resolves the user and route permission through D1.
- The Worker requests only the canonical safe participant fields from Airtable for the default list.
- The UI shows participant references and restricted contact states.
- A user with `participant.pii.reveal` can deliberately call `GET /api/participants/contact?participant=...`.
- The Worker checks D1 permission before fetching and returning contact fields.
- Reveal success and denied attempts are recorded as audit events.

## Files changed

- `.github/workflows/apply-d1-participant-pseudonymised-view.yml`
- `infra/cloudflare/migrations/0007_participant_pseudonymised_view.sql`
- `infra/cloudflare/src/core/router.js`
- `infra/cloudflare/src/service/index.js`
- `infra/cloudflare/src/service/participants.js`
- `public/components/participants/participants-page.js`
- `public/pages/study/participants/scheduler.js`
- `tests/participant-pseudonymised-view-route-state.test.js`
- `docs/agent-audit/reasoning/2026/05/31/participant-pseudonymised-view.md`
- `docs/agent-audit/reasoning/2026/05/31/participant-pseudonymised-view.json`

## Implementation summary

The default participant list now uses a pseudonymised response shape:

- `participant_ref`
- `display_name` derived from the participant reference
- `contact_restricted`
- `can_reveal_contact`
- `channel_pref`
- `consent_status`
- `status`
- `createdAt`

The default list no longer returns `email` or `phone`.

The contact reveal route returns contact details only after D1 route permission checks succeed.

The UI shows a restricted state by default and labels revealed contact information as sensitive.

D1 is seeded with:

- `participant.record.view`
- `GET /api/participants` requiring `participant.record.view`
- `GET /api/participants/contact` requiring `participant.pii.reveal`

The D1 apply workflow runs on merge to `main` and verifies the permission and route declarations.

## Scope controls

This branch does not implement Story 8 access requests.

This branch does not create a new access-request flow.

This branch does not grant `participant.pii.reveal` to default researcher roles.

This branch does not change Airtable schema.

This branch does not attempt to protect all remaining API routes.

## Validation expected

Run:

```bash
npm run validate
npm run lint
npm test -- --ci
```

CI should also confirm:

- the participant route-state contract passes
- the default participant route does not expose contact fields in its mapped response
- the reveal route is present and protected by D1 route declarations
- the D1 apply workflow exists and includes post-apply checks
- the participant page renders a restricted state by default

## Residual risk

The router file was replaced with a compact equivalent because a partial patch path was unavailable through the connector context. This should be reviewed carefully in PR diff and CI.

The default Airtable request projects canonical safe participant field names only. If the live Airtable table uses alternate field names for the Study link or status fields, the list route may need a follow-up safe schema-discovery pattern. It must not fall back to fetching full participant records for the default list.

The existing participant creation route still accepts contact details. This slice focuses on the default participant list and reveal route. Further server-side protection for create/update participant routes should be covered by a later protected journey or a follow-up hardening slice.
