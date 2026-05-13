# Agent trace — Account registration and team-scoped access branch

**Date:** 2026-05-13  
**Trace type:** backfilled operational audit trace  
**Branch:** `fix/account-auth-redirect-and-team-selection`  
**PR:** #250  
**Scope:** account registration, signed-in redirect, role assignment, team creation, team-scoped access, account dashboard, preview Worker deployment

## Evidence boundary

This trace is a user-readable operational audit record.

It records what repository changes were made, why they were made, what files were affected, what checks were used, where the work pivoted, and what residual risks remain.

It does not expose private chain-of-thought.

## Operating model files loaded

The repository operating model requires agents to load the checked-in operating model before repository-affecting work.

Files consulted during this backfill and design correction:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/bundles/govuk-design-system/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/references/govuk-components-reference.xml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.body.xml`
- `.agent-operating-model/bundles/multi-functional-team/roles/interaction-design.xml`
- `.agent-operating-model/bundles/multi-functional-team/roles/content-design.xml`
- `.agent-operating-model/bundles/multi-functional-team/roles/information-architect.xml`

## Bundles selected

Always-load bundles:

- GitHub Diamond
- ResearchOps Developer Control
- Multi-Functional Team

Conditional bundles selected:

- GOV.UK Design System, because frontend UI, account dashboard presentation, content, accessibility and component choice were in scope
- Cloudflare, because Worker routing, `/api/me`, D1, preview deployment and Wrangler workflows were in scope

Bundles not materially used:

- Airtable Public API
- Mural Public API
- OpenAI Platform
- MCP Agent Tooling

## Precedence decisions

Repository and PR safety were governed by the GitHub bundle.

ResearchOps platform architecture and route-state test conventions were governed by ResearchOps Developer Control.

The account dashboard UI and content decisions were governed by the GOV.UK Design System bundle, supported by the multi-functional team roles.

Cloudflare deployment behaviour was governed by the Cloudflare bundle where preview Worker deployment and D1 migrations were involved.

## Original task summary

The work began as account registration.

Users needed to request a ResearchOps account without directly receiving a role.

The request needed to help a Team Admin decide what access may be needed.

The work then expanded because registration, role assignment and account display depend on the same account model.

## Major decisions and changes

### 1. Registration request instead of role-setting

The account registration page was implemented as a request-and-review journey.

It captures the user’s name, email address, team or service, intended use and reason for access.

It does not directly assign a role.

The language was changed to avoid implying that the user can grant themselves access.

### 2. GOV.UK content and validation rules

The registration page uses user-facing validation copy.

Programmatic language such as database tables, JSON body errors and route internals was kept out of the user-facing UI.

The check-answers state was updated so `Change` links reveal the relevant answer instead of only changing the URL hash.

The check-answers section was changed so passive containers do not receive yellow focus rings.

### 3. Form affordance and spacing

The registration form initially used full-width inputs.

The implementation was corrected so full name, work email address and team or service use more appropriate field widths.

Vertical rhythm between explanatory content and the first form field was also improved.

### 4. Signed-in redirect

`/pages/account/register/` now follows the same signed-in logic as `/pages/account/sign-in/`.

Signed-in users are redirected to `/pages/account/` rather than being allowed to request another account.

### 5. Role assignment team selection

The role-assignment flow was updated to avoid silently assigning a user into ResearchOps Core Team.

The Team Admin must select the team for the assignment.

Team Admins with appropriate rights can create a new team during role assignment.

### 6. Team-scoped access model

The access model was clarified:

- a user can belong to many teams
- a user can hold different roles in different teams
- roles are scoped to teams
- permissions apply through the team context
- Team Admin in ResearchOps Core Team is the global administration exception
- other teams remain bounded by their own team scope

### 7. Avoiding scenario-specific role catalogue changes

`User Researcher` and `Note-taker` were treated as examples of the model rather than hard-coded role catalogue requirements.

The implementation retained the existing generic role model.

### 8. `/api/me` team-membership enrichment

The account dashboard needed a full membership shape rather than only `activeTeam` and `roles`.

`/api/me` was updated to expose `memberTeams` and `teamMemberships`.

Those memberships include role and permission data for each team.

### 9. Membership recovery from active role assignments

Preview data showed active permissions without team memberships in the dashboard.

The backend was made tolerant of historical or inconsistent preview data by building displayed team memberships from both:

- active `auth_team_memberships` rows
- active team-scoped `auth_role_assignments`

This does not replace the correct write path. Role assignment should still create or reactivate membership rows.

### 10. Preview Worker deployment branch filter

Backend fixes were not appearing in preview because the Worker deployment workflow only ran on `main` and `feature/**`.

The PR branch used `fix/**`.

The deploy workflow was updated to deploy preview Workers for `fix/**` branches.

### 11. Account dashboard adaptive design

The first working account dashboard used a table containing team, role and permissions.

The design was rejected because it was visually heavy and mixed role membership with capabilities.

The dashboard now adapts:

- one team: simple `Your team` summary-card
- more than one team: `Your teams` list
- ResearchOps Core Team Admin: explanatory inset
- permissions remain in a separate `Current permissions` section

## Files changed during the branch

Key files modified or created include:

- `public/pages/account/register/index.html`
- `public/js/auth-registration-page.js`
- `public/css/auth-registration.css`
- `public/pages/account/index.html`
- `public/js/auth-account-page.js`
- `public/pages/team/role-assignments/index.html`
- `public/js/auth-role-assignment-page.js`
- `infra/cloudflare/src/core/auth/access.js`
- `infra/cloudflare/src/core/auth/access-scoped.js`
- `infra/cloudflare/src/core/auth/role-assignments-scoped.js`
- `infra/cloudflare/src/core/auth/registration-requests.js`
- `infra/cloudflare/src/worker.js`
- `.github/workflows/deploy-worker.yml`
- `tests/auth-registration-requests-route-state.test.js`
- `tests/auth-registration-signed-in-redirect-route-state.test.js`
- `tests/auth-role-assignment-api-route-state.test.js`
- `tests/auth-role-assignment-ui-route-state.test.js`
- `tests/auth-account-dashboard-route-state.test.js`
- `docs/product/26/05/13/team-scoped-account-dashboard.md`
- `docs/product/26/05/13/account-dashboard-adaptive-team-role-presentation.md`
- `docs/product/26/05/13/account-registration-team-scoped-access-iteration-log.md`
- `RECENT_LEARNINGS.md`

## Validation attempted

Validation was primarily through GitHub Actions and repository route-state tests.

Observed checks during the branch included:

- CI
- Worker CI
- Release Gate
- Validate ResearchOps
- qa-bdd
- Accessibility audit
- Broken links
- Format pull request

Several checks failed during iteration and were fixed.

Examples:

- route-state tests were updated after the deploy workflow correctly added `fix/**`
- account dashboard route-state tests were updated after the UI moved away from tables
- backend preview deployment was corrected after confirming Worker fixes were not deploying from the branch pattern

## Issues and pivots

### API success did not mean preview deployment success

The account page still showed missing membership information after backend patches.

The cause was not only data shape. It was also that the preview Worker was not redeploying from the `fix/**` branch.

The branch filter fix was required before preview could reliably test the backend changes.

### Correct data did not mean correct design

Once the dashboard showed team and role data, the UI still failed as a design.

The table over-emphasised system detail and made the account dashboard harder to scan.

The design pivot changed the display pattern without changing the underlying access model.

### Trace and product documentation lagged behind implementation

The branch moved quickly across several domains.

Documentation was not updated at each pivot.

This trace, the product iteration log and recent learnings backfill the record.

## Residual risks

The dashboard still shows current permissions as a bullet list. That may be acceptable for admin users, but it may need further content design review for ordinary users.

Team switching is not yet presented as a first-class interaction on the account dashboard.

The recovery from role assignments protects display resilience, but database integrity should still be monitored so membership rows are consistently written.

The adaptive dashboard design should be checked visually in preview after the latest asset cache-bust deploys.

## Follow-up recommendations

Test the account dashboard with three preview states:

- user in one ordinary team
- user in multiple ordinary teams
- Team Admin in ResearchOps Core Team

Consider whether ordinary users need to see `Current permissions` at all, or whether that section should be reserved for admin/debug/audit contexts.

Add a future journey for changing or selecting current team context if multi-team users need to work in a specific team.

Keep product notes, recent learnings and agent traces updated during future long-running branches rather than backfilling near the end.
