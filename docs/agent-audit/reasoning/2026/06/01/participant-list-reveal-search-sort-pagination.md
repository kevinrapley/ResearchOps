# Agent trace — Participant list reveal, search, sort and pagination

**Date:** 2026-06-01  
**Trace type:** operational audit trace  
**Branch:** `fix/participant-list-reveal-search-sort-pagination`  
**Base:** `main` after PR #327

## Scope

Implement participant-list behaviour on the project dashboard:

- authorised users can reveal participant first name, family name and contact details
- participant lists with more than 10 participants get search, sort and pagination controls
- long study titles are constrained to one line and truncated at a word boundary with a horizontal ellipsis

## Operating model

Loaded repository operating model sources:

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

## Team consultation summary

Research Operations needs participants to be manageable when a project has more than a small number of recruits. Search, sorting and pagination reduce scanning effort once the list is longer than 10 records.

User Research needs the default display to remain pseudonymised while allowing authorised reveal of real identity for recruitment, consent, withdrawal and session operations.

Privacy needs real names and contact details to stay behind the existing reveal boundary. The project dashboard still shows participant references by default.

Security needs reveal actions to call the permission-gated participant contact endpoint, not expose PII through the default participant list response.

Interaction Design needs controls to appear only when useful. Search, sort and pagination are only shown when the participant count is greater than 10.

Content Design needs sort labels to match the acceptance language: A-Z, Z-A, First to last, Last to first, and User group.

Accessibility needs the pagination navigation to have an accessible label and study titles to expose the full title through `title` while visually truncating the visible line.

## Files changed

- `src/govuk/templates/pages/project-dashboard.njk`
- `public/js/project-dashboard-participants-list.js`
- `src/styles/project-dashboard.scss`
- `public/css/project-dashboard.css`
- `tests/project-dashboard-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/01/participant-list-reveal-search-sort-pagination.md`
- `docs/agent-audit/reasoning/2026/06/01/participant-list-reveal-search-sort-pagination.json`

## Scope controls

This branch does not change the D1 participant table model.

This branch does not change the existing `/api/participants/contact` reveal permission boundary.

This branch does not add new participant API endpoints.

This branch does not make PII part of the default participant list response.

## Validation expectation

Expected checks:

```bash
npm run validate
npm run lint
npm test -- --ci
```

The GOV.UK render workflow should regenerate `public/pages/project-dashboard/index.html` from the updated Nunjucks source.
