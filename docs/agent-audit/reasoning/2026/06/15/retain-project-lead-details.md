# Agent trace - Retain project lead details

**Date:** 2026-06-15
**Trace type:** operational audit trace
**Branch:** `fix/retain-project-lead-details`
**Trace required:** yes, because the branch starts with `fix/`

## Task

Fix the project dashboard so lead researcher details remain visible when the
same project is viewed under a different authorised login.

## Operating Model

Loaded repository operating-model sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`

Selected bundle stack:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`
- `airtable-public-api` at `.agent-operating-model/bundles/airtable-public-api/`

## Implementation

Updated the project dashboard controller to load the project-specific record
endpoint before falling back to the project list endpoint. The record endpoint is
the route that joins Project Details, including lead researcher and lead
researcher email.

Bumped the dashboard controller asset query string in the Nunjucks source and
generated HTML so browsers fetch the updated controller.

## Files

Modified:

- `public/js/project-dashboard.js`
- `src/govuk/templates/pages/project-dashboard.njk`
- `public/pages/project-dashboard/index.html`
- `tests/project-dashboard-route-state.test.js`

Created:

- `docs/agent-audit/reasoning/2026/06/15/retain-project-lead-details.md`
- `docs/agent-audit/reasoning/2026/06/15/retain-project-lead-details.json`

## Validation

Passed:

- `node tests/project-dashboard-route-state.test.js`
- `node tests/projects-route-contract.test.js`
- `npx prettier -c public/js/project-dashboard.js public/pages/project-dashboard/index.html tests/project-dashboard-route-state.test.js docs/agent-audit/reasoning/2026/06/15/retain-project-lead-details.md docs/agent-audit/reasoning/2026/06/15/retain-project-lead-details.json`
- `npm run trace:coverage`
- `git diff --check`

## Residual Risk

This is a controller load-order fix. It assumes `/api/projects/:id` remains the
authoritative project dashboard data path for joined Project Details, with the
project list retained as a fallback.
