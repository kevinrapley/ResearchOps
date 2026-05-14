# Agent trace progress — Projects team-scoped access

**Date:** 2026-05-14  
**Branch:** `fix/projects-team-scoped-access`  
**Related plan:** `docs/agent-audit/reasoning/2026/05/14/projects-team-scoped-access-plan.md`  
**Role consultation:** `docs/agent-audit/reasoning/2026/05/14/projects-team-scoped-access-role-consultation.md`

## Progress entries

### Trace and role consultation

Created the initial plan markdown and JSON trace files before code changes.

Created a transcript-style role consultation with GOV.UK Design System and multi-functional team roles.

Updated the plan and JSON trace so the consultation visibly changes the implementation approach.

### Server-side routing and service signatures

Committed `infra/cloudflare/src/service/index.js` so project list, create, read and patch methods can accept scoped authentication context.

Committed `infra/cloudflare/src/worker.js` so `GET /api/projects`, `POST /api/projects`, `GET /api/projects/:id` and `PATCH /api/projects/:id` resolve scoped authentication context and pass it to the project service.

### Project service access and data contract

Committed `infra/cloudflare/src/service/projects.js` to:

- normalise project team fields
- apply server-side project visibility filtering
- restrict unscoped projects to ResearchOps Core users
- return `canStartProject`
- enforce `POST /api/projects` permissions
- suppress identity-like `UserGroups` fragments
- check direct project read access before returning a project

Local parser check performed before commit:

```bash
node --check /mnt/data/projects.js
```

### Projects page client

Committed `public/js/projects-page.js` to:

- fetch project data with credentials
- hide the Start research project action until API capability is known
- remove the hard-coded `Home Office Biometrics` project-card fallback
- render team ownership from returned project team fields
- suppress identity-like user group fragments client-side as a defence in depth

Local parser check performed before commit:

```bash
node --check /mnt/data/projects-page.js
```

### Project dashboard client

Committed `public/js/project-dashboard.js` to:

- fetch `/api/projects/:id` directly with credentials
- stop loading all visible projects before selecting one by URL id
- use team ownership fields instead of a hard-coded organisation fallback
- include credentials on project patch requests
- block identity-like user group labels in the dashboard add-user-group form

Local parser check performed before commit:

```bash
node --check /mnt/data/project-dashboard.js
```

### Start project client change prepared

Next implementation unit:

- update `public/pages/start/start-new-project.js` to stop sending hard-coded `org: Home Office Biometrics`
- submit to the configured API origin rather than assuming the same origin
- include credentials so the Worker can attach the active team context server-side

Expected validation later:

```bash
node --test tests/projects-page-route-state.test.js
npm test -- --ci
npm run validate
```
