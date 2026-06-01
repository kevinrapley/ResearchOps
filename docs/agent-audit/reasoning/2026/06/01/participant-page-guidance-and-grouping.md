# Agent trace — Participant page guidance and grouping

**Date:** 2026-06-01  
**Trace type:** operational audit trace  
**Branch:** `fix/participant-page-guidance-and-grouping`  
**Base:** merged PR #326

## Scope

Improve the project dashboard participant creation page after team critique.

This branch does not change the participant data model or D1 canonical behaviour from PR #326.

## Team consultation summary

Research Operations needs the page to explain what happens after a participant is created. The form now tells users that creating a record links the participant to the selected study, but does not send an email, create a consent request or schedule a session.

User Research needs the page to explain the workflow in operational language. The lead paragraph now focuses on managing recruitment, consent, withdrawal and sessions.

Privacy needs the page to explain why real names and contact details are captured and how the default pseudonymised display works. The page now says participant lists continue to show the participant reference by default.

Security needs the page to make the permission boundary visible. The page now states that real names, contact details and support needs are restricted to authorised project roles.

Interaction Design needs clearer grouping. The form is now grouped under Study, Participant identity, Contact details, and Access or support needs.

Content Design needs clearer labels and optional-field wording. The page now uses Participant reference (optional), Email address (optional), Phone number (optional), Preferred contact method, and Access or support needs (optional).

Accessibility needs clearer structure and GOV.UK components. The page keeps GOV.UK macros and adds GOV.UK Details and Inset Text content to explain the workflow.

## Files changed

- `public/partials/header.html`
- `src/govuk/templates/pages/project-dashboard-participants.njk`
- `tests/govuk-page-chrome-navigation-route-state.test.js`
- `tests/participant-pseudonymised-view-route-state.test.js`

## Validation expectation

The render workflow should regenerate `public/pages/project-dashboard/participants/index.html` from the updated Nunjucks source.

Expected checks:

```bash
npm run validate
npm run lint
npm test -- --ci
```
