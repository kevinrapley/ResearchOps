# Agent trace: account registration request branch

Date: 2026-05-13

Branch: `feature/user-registration-review`

Pull request: #248

Repository: `kevinrapley/ResearchOps`

Slice: `account-registration-request`

## Purpose of this trace

This trace records the agent activity for the account registration request branch as a whole.

It replaces an overly narrow trace that only described a CI trace-coverage fix. The intent of this trace is to provide an audit of how the account registration work was interpreted, designed, implemented, reviewed and corrected across the branch.

This is a user-readable operational trace. It does not expose private chain-of-thought. It records the task interpretation, decision path, files consulted, implementation steps, pivots, validation evidence and remaining risks.

## Initial user request

The user asked for a registration journey, not a login journey.

The required service behaviour was:

- people can request a ResearchOps account
- no role is applied during registration
- the requester can indicate what role or kind of work they expect to do
- that information is shown to a team admin for review
- the team admin decides access later
- the implementation must use good GOV.UK language
- error messages must not expose implementation or programmatic wording
- the work should be done on a new branch
- no pull request should be opened until the user asks

## Branch setup

The work was carried out on:

```text
feature/user-registration-review
```

The branch was used as a review branch until the user confirmed the journey was working and asked for a pull request.

## Operating model used

The work was treated as a ResearchOps repository change involving:

- GitHub repository conventions
- ResearchOps developer-control rules
- GOV.UK service and content expectations
- multi-disciplinary review roles
- Cloudflare Worker and Pages deployment behaviour
- D1 migration discipline
- route-state and runtime testing
- agent audit trace requirements

The GOV.UK roles explicitly used during review were:

- developer
- accessibility specialist
- content designer
- designer
- QA
- release manager

The multi-functional roles later used in review included:

- interaction designer
- service designer
- content designer
- operations
- developer
- information architect
- product lead
- quality lead
- security specialist
- service owner

## Initial interpretation

The central product risk was that registration could be mistaken for role assignment.

The implementation therefore needed two separate concepts:

1. an account registration request
2. a role assignment decision

The requester could describe what they needed to do. That information would be review evidence only. The system must not treat it as an assigned role.

## Initial implementation

The first implementation added:

- public account request page at `/pages/account/register/`
- registration page JavaScript at `public/js/auth-registration-page.js`
- team admin review page at `/pages/team/registration-requests/`
- team admin review JavaScript at `public/js/auth-registration-requests-page.js`
- sign-in page link to the registration journey
- Worker route for `POST /api/auth/registration-requests`
- Worker route for `GET /api/auth/registration-requests`
- D1 table for registration requests
- route-state test to assert registration does not assign a role

The first schema stored:

- user ID
- email
- normalised email
- display name
- requested role key
- requested role label
- team or service
- reason for access
- request status
- submitted date

The route created or reused a pending user record and wrote a registration request. It deliberately did not write to `auth_role_assignments`.

## First review finding

The multidisciplinary review found that the architecture was right, but the journey was not yet GOV.UK-good enough.

Key issues identified:

- the page still leaned too much on role language
- the public registration page used a notification banner for information that was directly part of the task
- the journey needed a check-answers step
- the team admin page was read-only, which was acceptable for review but not release-complete
- the route-state tests needed runtime coverage

## First implementation pivot

The public page was changed so the primary question became:

```text
What do you need to use ResearchOps for?
```

The options were changed from role labels to activity-based labels, such as:

- plan, run or analyse user research
- take notes in research sessions
- observe research sessions
- use research evidence to design or improve a service
- manage team access
- something else

The notification banner was removed from the public registration page.

A check-answers section was added before submission.

The backend was changed so duplicate pending requests return HTTP `200` with `created: false` instead of being treated as a new resource.

A runtime test using a fake D1 store was added to check:

- valid registration creates a pending user and request
- duplicate pending requests return the existing request
- invalid email returns a user-facing error
- the route does not touch `auth_role_assignments`

## Form design review finding

The user then identified that the page had two design-system issues that should have been caught earlier:

- vertical rhythm between intro copy and the form was poor
- text inputs defaulted to full width rather than using sensible field affordance

The lesson was that input width is not cosmetic. It gives users a cue about the expected kind and length of answer.

## Form design implementation pivot

A dedicated stylesheet was added:

```text
public/css/auth-registration.css
```

It introduced:

- spacing between intro content and the form area
- explicit inset text styling
- GOV.UK-style confirmation panel styling
- form-group spacing
- two-thirds input widths for full name, work email address, team or service and the conditional something-else field
- a two-thirds width textarea for reason for access

The GOV.UK bundle was updated with a new form-affordance reference module:

```text
.agent-operating-model/bundles/govuk-design-system/references/govuk-form-affordance-reference.xml
```

That module requires future agents to make explicit input-width and vertical-rhythm decisions when creating or reviewing forms.

The following operating model files were updated so this learning would persist:

- `.agent-operating-model/bundles/govuk-design-system/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml`
- `.agent-operating-model/bundles/govuk-design-system/registry-manifest.yaml`
- `.agent-operating-model/bundles/govuk-design-system/CHANGELOG.md`
- `.agent-operating-model/README.md`
- `RECENT_LEARNINGS.md`

## Product documentation

A product note was added at:

```text
docs/product/26/05/12/account-registration-request-2026-05-12.md
```

It records:

- purpose
- user needs
- scope
- out-of-scope areas
- user-facing journey
- team admin journey
- content model
- form layout and affordance
- check-answers behaviour
- API routing and preview support
- data model
- access control
- validation
- tests
- operating model updates
- risks and follow-up work

## User acceptance and PR opening

After the user said the journey looked to be working well, a pull request was opened:

```text
PR #248 — Add account registration request journey
```

The PR body documented the feature scope, validation files and known limitation that approval and rejection decisions were not included in this slice.

## Failing preview behaviour found by user

The user then tested the branch preview and found three important issues:

1. `Send request` failed with `There is a problem with the service`.
2. `Change` links on the check-answers page did not actually let the user change answers.
3. A yellow focus ring appeared around the whole check-answers container.

These were treated as end-to-end journey failures, not minor UI bugs.

## Preview and production investigation

The failure implied that the rendered Pages branch preview was not enough. The frontend needed a working API route for the same branch.

The investigation identified multiple delivery issues:

- the frontend forced an external Worker origin instead of trying a relative `/api/*` route first
- Pages previews may not proxy the API route to the matching Worker
- Worker CORS only covered known origins and did not generically allow ResearchOps Pages branch previews
- the Worker deploy workflow only deployed on `main`, so the branch preview could render new frontend code while still calling stale Worker code
- the registration migration used `0004`, but `main` already had `0004_auth_login_challenges_locked_status.sql`

## Preview and production implementation pivot

The registration page JavaScript was changed to:

- try relative `/api/auth/registration-requests` first
- fall back to `rops-api-passwordless-preview`
- fall back to production `rops-api`
- expose helper functions for route-state assertions

The team admin registration-request review page was given the same preview-safe API routing model.

The Worker CORS logic was changed so it allows:

```text
https://researchops.pages.dev
https://*.researchops.pages.dev
```

The Worker deploy workflow was changed so:

- `main` deploys production Worker
- `feature/**` deploys a preview Worker named `rops-api-passwordless-preview`
- both production and preview jobs apply the auth migrations
- the registration request migration is applied before deployment

The registration migration was renumbered to:

```text
infra/cloudflare/migrations/0005_auth_registration_requests.sql
```

The conflicting `0004_auth_registration_requests.sql` was removed.

## Check answers implementation pivot

The check-answers markup and JavaScript were corrected.

The passive check-answers container no longer has `tabindex`.

The transition to check answers now scrolls the section into view rather than focusing the whole container.

Each `Change` link now has a `data-change-target` attribute.

Selecting a `Change` link:

1. prevents default anchor-only behaviour
2. hides the check-answers section
3. reveals the form
4. preserves answers
5. focuses the relevant field

This aligns the single-page implementation more closely with the GOV.UK check answers behaviour.

## Guardrail tests added or updated

The route-state test now checks:

- Worker registration route wiring
- Worker CORS support for ResearchOps Pages preview origins
- preview and production Worker deployment workflow coverage
- migration path `0005_auth_registration_requests.sql`
- no role assignment during registration
- review-oriented page language
- form spacing and input width affordance
- user-facing validation messages
- check-answers functions
- check-answers change-link handlers
- no `tabindex` on the passive check-answers section
- preview-safe API routing in both registration and review pages
- team admin review remains separate from role assignment
- sign-in links to registration

The runtime test continues to check the route behaviour using fake D1.

## Recent learnings recorded

`RECENT_LEARNINGS.md` was updated with lessons on:

- branch features needing to work end to end in preview and production
- check-answers `Change` links needing to actually change answers
- avoiding focus rings on passive containers
- GOV.UK form input affordance and vertical rhythm
- updating recent learnings when a bundle misses a reusable rule

## ResearchOps developer-control bundle update

The ResearchOps developer-control integration contracts were updated with a preview-and-production end-to-end contract.

That contract says new user journeys on a branch must work in both branch preview and production, and that static rendering alone is not sufficient evidence.

## CI trace coverage failure and correction

After PR #248 was opened, the validation workflow failed at trace coverage because agent-significant files had changed on 2026-05-13 but no trace existed under:

```text
docs/agent-audit/reasoning/2026/05/13/
```

An initial attempt created a narrow PR-fix trace that only described the CI trace-coverage failure. The user correctly rejected that as too narrow because agent traces should describe the reasoning and work across the branch, not merely patch a failing test.

That narrow trace was deleted.

This branch-level trace and its JSON companion were then created to document the whole account registration implementation and correction path.

## Current known limitations

This branch still does not implement:

- approval decisions
- rejection decisions
- requesting more information
- marking a request as reviewed
- connecting a completed role assignment back to the registration request
- email notification to requester
- email notification to team admins
- rate limiting or abuse controls
- team/service controlled taxonomy
- visual walkthrough registry/report regeneration

Those are product and release follow-ups, not accidental omissions.

## Final branch intent

The branch is intended to give ResearchOps a working, reviewable account registration request journey that:

- lets people request access
- avoids self-assigned roles
- gives team admins enough information to review the request
- uses better GOV.UK content and interaction patterns
- works across preview and production environments
- records durable operating-model lessons for future agents

## Validation status at time of trace

The specific files required for trace coverage now exist under the 2026-05-13 trace directory.

A full workflow rerun is still required to confirm every CI check passes after this replacement trace.
