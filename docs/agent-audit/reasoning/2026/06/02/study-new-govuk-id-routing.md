# Agent trace — Study new GOV.UK template and ID routing

**Date:** 2026-06-02  
**Branch:** `feature/study-new-govuk-template-current`  
**Mode:** `rops-feature`  
**Trace type:** operational audit trace

## Evidence boundary

This is an operational trace. It records inspectable repository work, implementation decisions, validation status and residual risk. It does not expose private chain-of-thought.

## Task

The `/pages/study/new/` page needed to move from hand-written static HTML to a GOV.UK Frontend Nunjucks template, using macros for breadcrumbs, buttons and form controls.

The page also needed to stop using the old project `pid` query parameter. The project a new Study belongs to should be passed as `id`.

The “Back to project dashboard” action needed to be removed.

## Operating model and bundles applied

Loaded operating model sources included:

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`

Selected bundles:

- GitHub Diamond
- ResearchOps Developer Control
- Multi-Functional Team
- GOV.UK Design System
- Cloudflare

Task signals:

- `ui-or-content-change`
- `runtime-or-deployment-change`

## Findings

The existing `/pages/study/new/index.html` was a hand-written static page and the controller accepted both `pid` and `id`.

The Project Dashboard runtime controller generated the Add study route with `pid`.

The Study landing page already supports canonical Study record ID routing at `/pages/study/?id=<study-record-id>`.

The create-study service still requires `project_airtable_id` in the POST payload. This is a payload contract, not a public route query parameter.

## Decisions

1. Create `src/govuk/templates/pages/study-new.njk` as the source template.
2. Register it in `scripts/govuk/render-govuk-pages.mjs`.
3. Replace the rendered static page at `public/pages/study/new/index.html`.
4. Use GOV.UK macros for breadcrumbs, buttons, error summary, inset text, input, select and textarea.
5. Remove the old back action from the Study creation page.
6. Accept only `?id=<project-record-id>` on `/pages/study/new/`.
7. Redirect successful creation to `/pages/study/?id=<study-record-id>`.
8. Keep `project_airtable_id` in the POST payload because the service still validates that field.
9. Keep participant add/import links unchanged because they were out of scope.
10. Use same-origin API routing unless an explicit API origin is configured.

## Changes made

Created:

- `src/govuk/templates/pages/study-new.njk`
- `tests/study-new-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/02/study-new-govuk-id-routing.json`
- `docs/agent-audit/reasoning/2026/06/02/study-new-govuk-id-routing.md`

Modified:

- `scripts/govuk/render-govuk-pages.mjs`
- `public/pages/study/new/index.html`
- `public/pages/study/new/study-new.js`
- `public/js/project-dashboard.js`

## Validation status

A route-state test was added:

- `tests/study-new-route-state.test.js`

The test pins:

- the new template is registered with the GOV.UK page renderer;
- the template imports the GOV.UK macros used by the page;
- the rendered page uses `/assets/govuk/govuk-frontend.css`;
- the rendered page does not include old local GOV.UK CSS imports;
- the back action is absent;
- the study-new page and template do not include `?pid=`;
- the study-new controller reads `id` only;
- the created study redirect uses `/pages/study/?id=<study-record-id>`;
- the Project Dashboard runtime Add study link uses `/pages/study/new/?id=<project-record-id>`.

Local validation was not run in this connector-only mutation session. CI or a local checkout should run:

```sh
npm run build:govuk-pages
node --test tests/study-new-route-state.test.js
npm test
npm run validate
```

## Manual preview validation targets

Use a branch preview and a known Project record ID:

- `/pages/project-dashboard/?id=<project-record-id>`
- select Add study
- confirm the visible URL is `/pages/study/new/?id=<project-record-id>`
- submit a valid study
- confirm the redirect is `/pages/study/?id=<created-study-record-id>`

Expected behaviour:

- the page renders with GOV.UK Frontend components;
- there is no “Back to project dashboard” action;
- Cancel returns to the project dashboard after the project context resolves;
- the POST payload still contains `project_airtable_id`;
- the public Study creation route no longer uses `pid`.

## Residual risks

The create-study API still validates `project_airtable_id` because the service contract remains Airtable-backed.

Participant add/import links on the Project Dashboard still use `pid`. They were left unchanged because this task was scoped to `/pages/study/new/`.

The Project Dashboard Nunjucks and rendered HTML still contain the initial fallback `href="/pages/study/new/?pid="` for the Add study link. The runtime controller updates that link to `?id=` once project context has loaded. This should be tightened in a follow-up source/render pass if the team wants static no-JavaScript fallback parity.

No browser preview was available in this session, so form submission and redirect behaviour still need branch-preview confirmation.
