# Agent trace — Projects team-scoped access plan

**Date:** 2026-05-14  
**Trace type:** operational audit trace  
**Branch:** `fix/projects-team-scoped-access`  
**Scope:** projects page, project cards, project visibility, project dashboard links, project creation, Airtable project data, route-state validation

## Evidence boundary

This trace records repository evidence, implementation decisions, files read, files changed, validation attempted, pivots and residual risk.

It does not expose private chain-of-thought.

## Original task summary

Fix `/pages/projects/` so project cards show the team the project belongs to rather than the hard-coded `Home Office Biometrics` label.

Apply team-scoped project visibility:

- ResearchOps Core members can see projects across all teams for Research Operations oversight.
- Members of other teams can see only projects belonging to their team memberships.
- User researchers and ResearchOps Core members can start a research project.

Investigate and correct broken card data, malformed `User groups` pills, broken project dashboard links, and unexpected project-card creation concerns.

## Corrective branch behaviour

Earlier attempted branches are not to be used for this work:

- `fix/team-scoped-project-cards`
- `fix/team-scoped-project-cards-v2`

They were created before the repository operating model had been loaded correctly. This branch restarts the work after bootstrap.

## Operating model files loaded

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
- `RECENT_LEARNINGS.md`
- `package.json`
- `.editorconfig`

## Selected bundles

Always-load bundles:

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`

Conditional bundles:

- `.agent-operating-model/bundles/govuk-design-system/` because the task includes page UI, content, link behaviour and accessibility.
- `.agent-operating-model/bundles/cloudflare/` because the task includes Worker routing and API behaviour.
- `.agent-operating-model/bundles/airtable-public-api/` because the task includes Airtable-backed project records and field-shape handling.

Skipped bundles:

- `.agent-operating-model/bundles/openai/`
- `.agent-operating-model/bundles/mcp-agent-tooling/`
- `.agent-operating-model/bundles/mural-public-api/`

## Bundle and role input applied

GitHub Diamond requires discovery before change, approved branch prefixes, trace capture on `fix/`, small commits, and no fabricated validation evidence.

ResearchOps Developer Control requires inspection before implementation, correct layer selection, route contract tests for API changes, and honest validation status.

GOV.UK Design System roles require clear task language, semantic HTML, progressive enhancement, keyboard operation and accessibility-preserving implementation.

Multi-functional team roles add the following concerns:

- Product management: keep decisions outcome-focused and evidence-linked.
- User research: preserve access to research setup for appropriate user-research roles.
- Research operations: support safe, repeatable oversight by ResearchOps Core.
- Developer: implement safely, incrementally and reversibly.
- QA: make behaviour testable and validation evidence explicit.
- Governance: maintain auditable access-control decisions.
- Privacy: avoid logging or rendering unnecessary personal data.

## Initial files inspected

- `public/pages/projects/index.html`
- `public/js/projects-page.js`
- `public/js/project-dashboard.js`
- `public/pages/start/start-new-project.js`
- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/src/service/index.js`
- `infra/cloudflare/src/service/projects.js`
- `infra/cloudflare/src/core/auth/access-scoped.js`
- `infra/cloudflare/migrations/0001_auth_foundation.sql`
- `visual-walkthrough.operational-fixtures.mjs`
- `tests/projects-page-route-state.test.js`
- `docs/product/26/05/13/account-registration-team-scoped-access-iteration-log.md`
- `docs/product/26/05/13/account-dashboard-adaptive-team-role-presentation.md`
- `docs/agent-audit/reasoning/2026/05/13/account-registration-team-scoped-access-branch-trace.md`
- `docs/agent-audit/reasoning/2026/05/13/account-registration-team-scoped-access-branch-trace.json`

## Initial findings

`public/js/projects-page.js` hard-codes `Home Office Biometrics` as the card organisation fallback.

`/api/projects` currently lists projects without receiving scoped authentication context from the Worker route.

The project service maps core project fields but not a canonical team identity.

`UserGroups` is parsed as comma-separated text and can render malformed person-field or JSON fragments.

`public/js/project-dashboard.js` loads all projects from `/api/projects` and searches client-side by ID. This becomes fragile once server-side team filtering is introduced.

`public/pages/start/start-new-project.js` posts to `/api/projects`, while routing must be verified and creation must attach the active team context.

The visual walkthrough fixture mocks project reads. It does not create live Airtable or D1 project records.

## Change plan

### Commit 1 — Trace plan

Create this trace markdown file and the matching machine-readable JSON file before code changes.

### Commit 2 — Server-side project access contract

Update Worker routing and project service methods so project list, read, patch and create receive the scoped authenticated context.

Apply visibility rules server-side:

- ResearchOps Core members can see all projects.
- Non-Core members can see projects where returned project team identifiers match their team memberships.
- Projects with no team scope are visible only to ResearchOps Core.

Add create-project handling through `POST /api/projects` using the active team context.

### Commit 3 — Project card and dashboard client behaviour

Update the projects page controller to:

- fetch `/api/projects` with credentials
- remove the hard-coded `Home Office Biometrics` fallback
- normalise team display from API data
- filter malformed user group identity fragments
- gate the Start project action based on API capability

Update project dashboard loading to read `/api/projects/:id` directly.

Update start-project submission so it uses credentials and does not hard-code the organisation as `Home Office Biometrics`.

### Commit 4 — Tests and operational fixtures

Update route-state tests to cover the new project data contract, credentialed fetches, direct dashboard reads, and absence of hard-coded project organisation fallbacks.

Update visual walkthrough fixtures so project records include team identifiers and team names.

### Commit 5 — Product docs and recent learnings decision

Add a product note under `docs/product/26/05/14/` describing project visibility, project ownership, and card data decisions.

Decide whether `RECENT_LEARNINGS.md` needs a reusable lesson. Current candidate: project access-control fixes must start server-side and must not rely on front-end card filtering.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Airtable project team schema is not yet explicit or may differ by environment. | Project visibility could filter incorrectly. | Tolerate known field variants for reads; document field assumptions; do not silently invent migrations. |
| CSV fallback records may not contain team scope. | Non-Core users could see records they should not see. | Treat unscoped records as visible only to ResearchOps Core. |
| Project creation may fail if Airtable lacks configured team fields. | Researchers cannot create projects until schema or config is aligned. | Return a clear configuration error and document required field configuration. |
| Gating Start project on client only would be insufficient. | Unauthorised users could still call API. | Enforce permission server-side and mirror capability in the UI. |
| Dashboard direct read may expose not-found states for inaccessible projects. | Users may see generic failure where access is denied. | Return `Project not found` for inaccessible projects to avoid leaking existence. |
| Malformed `UserGroups` may contain personal data fragments. | Personal data could be rendered in blue pills. | Filter object/identity-like fragments and avoid logging raw values. |
| Earlier abandoned branches may confuse review. | Reviewers may inspect stale partial work. | Record abandoned branch names here and use only this branch for PR. |

## Validation plan

Commands to run or record if not available through tool path:

```bash
npm run agent:model:validate
npm run agent:bundles:validate
npm run trace:coverage
npm run format:check
npm run lint
npm test -- --ci
npm run validate
```

Targeted tests expected to be relevant:

```bash
node --test tests/projects-page-route-state.test.js
node --test tests/auth-account-dashboard-route-state.test.js
```

## Rollback notes

No D1 migration is planned.

No Airtable schema migration is planned.

Rollback is to revert the branch commits or close the PR unmerged.

If deployed and problematic, roll back the Worker and Pages deployments to the previous main deployment.

Airtable data should remain untouched unless a human-approved schema correction is later agreed.

## Progress log

### 2026-05-14 — Plan created

Created the branch after operating-model bootstrap.

Created initial audit trace plan before code changes.

Created matching machine-readable JSON trace.

### 2026-05-14 — Server routing change prepared

Prepared to update `infra/cloudflare/src/worker.js` so project list, create, read and patch routes resolve `resolveAuthenticatedContext()` from the scoped auth layer and pass the resulting context into the project service.

The routing change also needs to stop treating `POST /api/projects` as absent, because the endpoint catalog declares the route and the start-project journey posts to it.

Validation expectation for this unit: route-state tests should later assert `POST /api/projects` routing and scoped auth-context handoff.
