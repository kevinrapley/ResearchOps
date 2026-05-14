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

Full repository validation was not executed in this chat tool path before opening the draft PR.

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

### 2026-05-14 — PR check repair pass

Observed failing checks on draft PR #252 after the initial PR creation:

- CI
- Worker CI
- Validate ResearchOps
- Release Gate

Initial unit-test failures were traced to:

- `tests/auth-foundation-route-state.test.js`
- `tests/project-dashboard-route-state.test.js`
- `tests/projects-route-contract.test.js`

Implemented repair commits for:

- explicit scoped project authentication error responses in `infra/cloudflare/src/worker.js`
- the existing auth-foundation route-state import expectation by splitting the `access-scoped` imports
- stale project dashboard route-state expectations after the dashboard moved to direct `/api/projects/:id` reads
- authenticated `/api/projects` route contract fixtures after the project list became protected by scoped auth context
- D1 mock support for both `.bind().all()` and direct `.all()` calls used by the scoped auth resolver

Observed validation state on head `28dae214d14392946eeabee47d034bfe344885fc` before the trace-sync commit:

- CI: success
- Worker CI: success
- Validate ResearchOps: success
- Release Gate: success
- Format pull request: success
- QA broken links: success
- Accessibility audit: success
- BDD: success

### 2026-05-14 — Trace JSON sync

The machine-readable trace JSON had fallen behind the markdown plan and this progress log.

Updated `projects-team-scoped-access-plan.json` so it records:

- completed implementation units
- the browser-side CSV fallback access-control pivot
- product documentation and recent learning updates
- the PR check repair pass
- the observed green validation state for head `28dae214d14392946eeabee47d034bfe344885fc`

This trace-sync commit creates a newer PR head, so CI must be checked again after the commit lands.
