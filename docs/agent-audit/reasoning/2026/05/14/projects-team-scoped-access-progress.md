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

Decision: remove the browser-side CSV fallback from `public/js/projects-page.js`. CSV fallback remains only inside the server-side service layer, where project visibility filtering has access to authenticated context.

### Route-state tests and visual fixtures

Committed route-state and operational fixture updates to cover scoped project routing, credentialed fetches, direct dashboard project reads, removal of hard-coded `Home Office Biometrics`, removal of browser CSV fallback, capability-hidden Start action and user group identity-fragment filtering.

Committed `visual-walkthrough.operational-fixtures.mjs` so visual walkthrough project mocks include team fields and `/api/projects` returns the scoped API shape.

### Product documentation and recent learnings

Committed `docs/product/26/05/14/projects-team-scoped-access.md` to document the product decision, access-control model, card data decision, start-project rule, Airtable field expectations and rollback notes.

Committed `RECENT_LEARNINGS.md` entries for:

- access-control filtering must stay server-side
- role consultation must be visible when requested

### 2026-05-14 — PR check repair pass

Observed failing checks on draft PR #252 after the initial PR creation:

- CI
- Worker CI
- Validate ResearchOps
- Release Gate

Implemented repair commits for:

- explicit scoped project authentication error responses in `infra/cloudflare/src/worker.js`
- the existing auth-foundation route-state import expectation by splitting the `access-scoped` imports
- stale project dashboard route-state expectations after the dashboard moved to direct `/api/projects/:id` reads
- authenticated `/api/projects` route contract fixtures after the project list became protected by scoped auth context
- D1 mock support for both `.bind().all()` and direct `.all()` calls used by the scoped auth resolver

### 2026-05-14 — Screenshot-driven data correction

A branch-preview screenshot showed that tests were green while the UI was still wrong. The UI was rendering malformed Airtable/person-object fragments as project-card data, and project links were not anchored to the correct project identifier.

The correction after reviewing the Airtable screenshot is:

- the authoritative source for project cards is the Airtable `Projects` table only
- canonical project identifiers are Airtable `Record ID` / `rec...` values
- the five current Airtable project records are `recMtdmBbaFilF2Tm`, `recpZe8mLEiASXfRd`, `recgdpwEI5hFO7bUZ`, `recIFoFmpDIGBP726` and `recUUeazIqBMfsZL4`
- `Project Details` can enrich a valid project after the project is found, but it must never create project cards
- `PID` / `LocalId` is not the routing contract for the Projects UI

Implemented `infra/cloudflare/src/service/project-record-routes.js` as the focused read path for `GET /api/projects` and `GET /api/projects/:id`.

Updated `infra/cloudflare/src/worker.js` so project reads use `listProjectRecords` and `getProjectRecord`, while `POST /api/projects` and `PATCH /api/projects/:id` remain on the existing project service.

Updated `tests/projects-route-contract.test.js` so the contract uses the five real Airtable `rec...` record IDs from the screenshot, rejects `PID-*` ids, and verifies direct read of `/api/projects/:recordId`.

Updated `public/js/projects-page.js` so project cards prefer `id`, `airtableId` and `recordId` from the API, rather than `LocalId`.

Restored `tests/projects-page-route-state.test.js` as a smaller smoke test because the repository validation requires the file. The detailed behaviour is now covered by `tests/projects-route-contract.test.js`.

### 2026-05-14 — D1 active project cache

Added a non-destructive D1 mirror in `project-record-routes.js`.

When Airtable project listing succeeds, the Worker:

- creates `rops_projects_cache` if it is missing
- marks existing Airtable-source cached projects inactive
- upserts the current Airtable Projects set with `active = 1`
- keys cached projects by Airtable `rec...` id

This means the active D1 cache should match the current Airtable Projects table count whenever Airtable listing succeeds. It does not delete older rows; stale rows are retained with `active = 0`.

### 2026-05-14 — Current validation state before this trace update

Observed validation state on head `5a27cd386b9855458308e37278223256a604d433` before this trace update:

- CI: success
- Worker CI: success
- Validate ResearchOps: success
- Release Gate: success
- Format pull request: success
- QA broken links: success
- Accessibility audit: success
- BDD: success

This trace-update commit creates a newer PR head, so checks must be re-read after it lands.
