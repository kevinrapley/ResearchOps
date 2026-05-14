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

Local parser checks performed before commit and after the access-control pivot:

```bash
node --check /mnt/data/projects-page.js
node --check /mnt/data/projects-page-no-csv.js
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

### Start project client

Committed `public/pages/start/start-new-project.js` to:

- stop sending hard-coded `org: Home Office Biometrics`
- submit to the configured API origin rather than assuming the same origin
- include credentials so the Worker can attach the active team context server-side

Local parser check performed before commit:

```bash
node --check /mnt/data/start-new-project.js
```

### Client CSV fallback access-control pivot

Identified that the browser-side fallback from `/api/projects` to `/api/projects.csv` would bypass the server-side project visibility rule if the CSV endpoint is not itself team-scoped.

Decision: remove the browser-side CSV fallback from `public/js/projects-page.js`. CSV fallback remains only inside the server-side project service, where project visibility filtering has access to the authenticated context.

### Route-state tests and visual fixtures

Committed `tests/projects-page-route-state.test.js` to cover:

- scoped Worker project routing
- credentialed project fetches
- direct dashboard project reads
- removal of hard-coded `Home Office Biometrics` card fallback
- removal of browser-side project CSV fallback
- capability-hidden Start project action
- `user_researcher` project-start capability recognition
- identity-fragment filtering in user group handling

Parser check performed before the route-state test update:

```bash
node --check /mnt/data/projects-page-route-state.test.js
```

Committed `visual-walkthrough.operational-fixtures.mjs` so visual walkthrough project mocks include team fields and `/api/projects` returns the scoped API shape:

```json
{
	"ok": true,
	"projects": ["operationalProject"],
	"canStartProject": true
}
```

### Product documentation and recent learnings

Committed `docs/product/26/05/14/projects-team-scoped-access.md` to document the product decision, access-control model, card data decision, start-project rule, Airtable field expectations and rollback notes.

Committed `RECENT_LEARNINGS.md` entries for:

- access-control filtering must stay server-side
- role consultation must be visible when requested

### Validation status before PR

Local parser checks were performed on generated replacement files in the tool environment as listed above.

Full repository validation was not executed in this chat tool path.

Mapped validation commands for CI or local checkout:

```bash
npm run agent:model:validate
npm run agent:bundles:validate
npm run trace:coverage
npm run format:check
npm run lint
node --test tests/projects-page-route-state.test.js
npm test -- --ci
npm run validate
```

The PR should remain draft until CI validates formatting, linting, route-state tests and the wider repository suite.
