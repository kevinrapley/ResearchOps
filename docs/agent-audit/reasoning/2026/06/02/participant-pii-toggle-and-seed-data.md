# Agent trace — Participant PII reveal and hide toggle

**Date:** 2026-06-02  
**Trace type:** operational audit trace  
**Branch:** `fix/participant-pii-toggle-and-seed-data`

## Task

Add reversible participant PII reveal and hide behaviour, and seed explicit non-real prototype participant details for Test Project 1.

## Scope controls

- Participant details remain hidden by default.
- Participant PII is still fetched only through `/api/participants/contact`.
- The reveal endpoint remains permission-gated and project-scoped.
- Hide clears revealed private fields from client state.
- Seeded details use explicit prototype placeholders rather than real personal data.

## Team consultation summary

**Research Operations:** reveal must be reversible so authorised users can stop displaying PII after the operational need has passed.

**User Research:** participant lists must stay pseudonymised by default and avoid permanently expanding visible identifying fields.

**Privacy and Security:** revealed details should not remain in client state after hide and should remain behind the scoped reveal endpoint.

**Content Design:** use a direct `Hide details` action instead of a static `Details revealed` tag.

**Frontend:** seed explicit prototype details so reveal testing does not show every field as missing.

## Files changed

- `public/js/project-dashboard-participants-list.js`
- `infra/cloudflare/migrations/0008_seed_test_project_1_participants.sql`
- `src/styles/project-dashboard.scss`
- `public/css/project-dashboard.css`
- `tests/project-dashboard-route-state.test.js`
- `tests/test-project-1-participants-seed-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/02/participant-pii-toggle-and-seed-data.json`
- `docs/agent-audit/reasoning/2026/06/02/participant-pii-toggle-and-seed-data.md`

## Validation expectation

Expected checks:

```bash
npm run validate
npm run lint
npm test -- --ci
```
