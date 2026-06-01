# Agent trace — Participant real-name capture and GOV.UK route alignment

**Date:** 2026-06-01  
**Trace type:** operational audit trace and role consultation  
**Branch:** `fix/project-participants-d1-govuk-pii-capture`  
**Related work:** Project dashboard participant route; D1-canonical participant creation; pseudonymised participant default view

## Evidence boundary

This trace records repository evidence, selected operating-model sources, role consultation outputs, implementation scope, validation expectations and residual risk.

It does not expose private chain-of-thought.

## Operating-model bootstrap

Loaded repository-local sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`
- `RECENT_LEARNINGS.md`

Selected bundles:

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`
- `.agent-operating-model/bundles/airtable-public-api/`

Selection rationale:

- GitHub governance is in scope because this branch changes repository files and requires trace coverage.
- ResearchOps Developer Control is in scope because this changes the participant route, D1 participant service and GOV.UK render workflow.
- Multi-Functional Team is in scope because participant identity is personal data in a UK Government research operations journey.
- GOV.UK Design System is in scope because the route is now generated from a Nunjucks template and uses GOV.UK form components.
- Cloudflare is in scope because D1 is the canonical participant store.
- Airtable is in scope only as a secondary adapter boundary. This change must not make Airtable canonical.

## Role consultation

### Research Operations

Research Operations needs participant handling to be operationally credible. A research team cannot safely manage recruitment, consent, withdrawal, session attendance, reminders or safeguarding using only vague display labels.

Decision: capture real first name and family name at participant creation.

Control: do not use the real name as the default display identity. Keep the participant reference as the operational display label.

### User Research

User Research needs enough identity information to run fieldwork responsibly and maintain a clear chain of custody for participant records.

Decision: first name and family name are justified participant operations data.

Control: continue to pseudonymise participant lists and expose real names only through the existing reveal boundary.

### Privacy

Names are personal data. Data minimisation does not mean refusing necessary identity data. It means collecting only what is needed, recording purpose, limiting display and controlling access.

Decision: store first name, family name and full name inside the existing sensitive participant details payload.

Control: default participant list responses must not include `first_name`, `family_name` or `full_name`.

### Security

Real names must not leak through the default participant route or project dashboard. Existing permission-gated reveal behaviour should remain the control boundary.

Decision: `GET /api/participants` remains pseudonymised by default. `GET /api/participants/contact` remains the reveal route.

Control: tests assert that the default mapper excludes name, email and phone fields.

### Interaction Design and Content Design

The old form copy over-corrected by encouraging a pseudonym instead of capturing the information researchers need. The new form must make the privacy model visible in plain English.

Decision: use separate GOV.UK text inputs for First name and Family name, plus an optional Participant reference.

Control: copy explains that real names support recruitment, consent and withdrawal, while the list continues to show participant references by default.

## Implementation summary

The `/pages/project-dashboard/participants/` page now has a Nunjucks source template:

- `src/govuk/templates/pages/project-dashboard-participants.njk`

The GOV.UK page render workflow now renders that template to:

- `public/pages/project-dashboard/participants/index.html`

The participant form now captures:

- study ID
- first name
- family name
- optional participant reference
- email address
- phone number
- preferred contact channel
- access needs

The project participant page controller now posts canonical D1-style fields:

- `project_id`
- `study_id`
- `participant_ref`
- `display_name`
- `first_name`
- `family_name`

The participant Worker stores first name, family name and full name inside `sensitive_contact_json` and returns them only from the contact reveal route.

The default D1 participant mapper continues to return pseudonymised participant references and excludes real name and contact fields.

The project dashboard link synchroniser now prefers `?id=` for participant routes and observes asynchronous dashboard panel updates so rendered participant action links do not drift back to `?pid=`.

## Files changed

- `src/govuk/templates/pages/project-dashboard-participants.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `public/pages/project-dashboard/participants/index.html`
- `public/pages/project-dashboard/participants/participants-project.js`
- `public/js/project-participant-context.js`
- `public/js/project-dashboard-context.js`
- `infra/cloudflare/src/service/participants.js`
- `tests/participant-pseudonymised-view-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/01/participant-real-name-capture.md`
- `docs/agent-audit/reasoning/2026/06/01/participant-real-name-capture.json`

## Scope controls

This branch does not make Airtable canonical.

This branch does not expose real names in default participant lists.

This branch does not change the existing D1 participant table schema because the existing `sensitive_contact_json` field is the sensitive-details boundary.

This branch does not implement a new access-request workflow for reveal permissions.

This branch keeps `pid` as a legacy fallback where existing study routes still depend on it, but participant dashboard entry links now prefer `id`.

## Validation expected

Run:

```bash
npm run validate
npm run lint
npm test -- --ci
```

CI should confirm:

- the GOV.UK render workflow includes the project participant page
- the committed static participant page contains the rendered GOV.UK form fields
- participant creation posts D1-canonical project and study IDs
- first name and family name are stored only as sensitive details
- the default participant mapper excludes first name, family name, full name, email and phone
- the contact reveal route returns sensitive participant details only after permission checks
- dashboard participant links prefer the canonical `id` project parameter

## Residual risk

The study participants page still contains older inline add-participant behaviour. This branch focuses on the project-dashboard participant creation route requested by the user.

The D1 sensitive payload now holds names as well as contact details. A later hardening branch can split identity details into a dedicated private participant table if retention, field-level audit or deletion rules require it.
