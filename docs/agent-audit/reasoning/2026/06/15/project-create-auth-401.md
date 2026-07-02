# Agent trace - Project create authentication 401

**Date:** 2026-06-15  
**Trace type:** operational audit trace  
**Branch:** `fix/project-create-team-fields-nonblocking`
**Trace required:** yes, because the branch starts with `fix/`  
**Related work:** Fix authenticated project creation from the Start a new research project check-answers step

## Task

Investigate and fix a `401 authentication_required` error shown to a synthetic
ResearchOps user when submitting the Start a new research project flow from the
check-answers step.

The screenshot showed the shared header rendering the signed-in user while the
project create POST returned `authentication_required`.

## Branch Trace Decision

The active replacement branch is `fix/project-create-team-fields-nonblocking`.
Repository policy allows `fix/` as a work-branch prefix and requires an
auditable trace for repository-affecting work on fix branches.

PR #403 was merged before the later Airtable team-field fallback was included
in `main`. The follow-up commit was therefore carried onto this replacement
branch from current `origin/main` without force-updating or reopening the merged
branch.

## Operating Model

Loaded repository operating-model sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/bundles/`

Selected bundle stack:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`
- `airtable-public-api` at `.agent-operating-model/bundles/airtable-public-api/`

The first three bundles are always-load bundles. `govuk-design-system` applies
because the user-facing error is in the GOV.UK start-project form flow.
`cloudflare` applies because the root cause is in Cloudflare Pages Worker proxy
and Worker authentication behaviour. `airtable-public-api` applies to the
follow-up because Airtable rejected configured project team fields during record
creation.

Skipped conditional bundles:

- `openai-platform` - no OpenAI API, model or eval implementation was in scope.
- `mcp-agent-tooling` - no MCP tool, resource, prompt or consent work was in scope.
- `mural-public-api` - no Mural API or collaboration integration work was in scope.

Precedence decisions:

- GitHub Diamond governed branch naming, trace coverage, surgical mutation and PR readiness.
- ResearchOps Developer Control governed the start-project route and authenticated API conventions.
- Multi-Functional Team governed public-sector assurance and residual-risk framing.
- GOV.UK Design System governed the check-answers flow constraints and error presentation context.
- Cloudflare governed Pages Worker proxy and Worker auth handling.
- Airtable Public API governed the record-create fallback boundary for optional team fields.

No bundle conflicts were identified.

## Sub-Agent Coordination

Custom sub-agent roles were loaded from `/Users/kevin.rapley/.codex/config.toml`.
Three focused agents were used:

- `RuntimeDev` inspected the browser JavaScript, Pages Worker proxy and Worker auth path. It identified that `public/_worker.js` stripped `cf-access-jwt-assertion` before forwarding preview API traffic.
- `TestDev` identified the missing positive authenticated `POST /api/projects` regression and suggested assertions for Airtable project and detail create calls.
- `BranchGuard` and `TraceGuard` confirmed the branch prefix, trace requirement, trace location and unrelated local changes to exclude from staging.

## Implementation

Updated `public/pages/start/start-new-project.js` so the start-project controller
uses the same same-origin API convention as the authenticated project pages. The
controller still supports an explicit `data-api-origin` or `window.API_ORIGIN`
override, but no longer hardcodes a `workers.dev` API origin for Pages hosts.

Updated `public/_worker.js` so the Pages advanced API proxy keeps the signed
Cloudflare Access JWT when forwarding preview-host API requests. The proxy still
strips unsigned email identity headers, and the upstream Worker continues to
validate the signed JWT.

Extended `tests/projects-route-contract.test.js` with a positive authenticated
`POST /api/projects` regression. The test sends a realistic check-answers
payload with the passwordless session cookie and asserts the route returns 201,
creates the Airtable project with team fields, and creates linked project detail
fields.

Added `tests/pages-advanced-worker-auth-route-state.test.js` to guard against
reintroducing `cf-access-jwt-assertion` stripping in the Pages advanced worker.

Extended `tests/start-project-step-1-defaults-route-state.test.js` to ensure the
start-project controller uses `resolveApiBase()`, includes credentials, and does
not restore the hardcoded production Worker origin fallback.

Follow-up implementation: updated `infra/cloudflare/src/service/project-record-routes.js`
so a project create is not blocked when Airtable rejects only the configured
project team fields. The route now retries once without those optional fields
and returns `201` with `projectWarning: "project_team_fields_missing"` when the
fallback succeeds. Other Airtable create errors still surface as failures.

Codex review follow-up: refined the Airtable fallback so the retry removes only
the configured project team field named in the Airtable unknown-field error.
This preserves remaining supported team metadata, for example keeping
`Team Name` when only `Team ID` is rejected, so the created project remains
visible to team-scoped creators.

## Files

Read:

- `AGENTS.md`
- operating-model files listed above
- selected bundle prompt specs and bodies
- `/Users/kevin.rapley/.codex/config.toml`
- `/Users/kevin.rapley/.codex/rules/default.rules`
- `public/pages/start/start-new-project.js`
- `public/_worker.js`
- `public/js/auth-header-links.js`
- `public/components/layout.js`
- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/src/core/auth/access.js`
- `infra/cloudflare/src/core/auth/access-scoped.js`
- `infra/cloudflare/src/core/auth/passwordless.js`
- `infra/cloudflare/src/service/project-record-routes.js`
- `.agent-operating-model/bundles/airtable-public-api/prompt.spec.yaml`
- `.agent-operating-model/bundles/airtable-public-api/prompt.body.xml`
- `tests/start-project-step-1-defaults-route-state.test.js`
- `tests/start-page-route-state.test.js`
- `tests/projects-route-contract.test.js`

Created:

- `tests/pages-advanced-worker-auth-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/15/project-create-auth-401.md`
- `docs/agent-audit/reasoning/2026/06/15/project-create-auth-401.json`

Modified:

- `public/_worker.js`
- `public/pages/start/start-new-project.js`
- `infra/cloudflare/src/service/project-record-routes.js`
- `tests/projects-route-contract.test.js`
- `tests/start-project-step-1-defaults-route-state.test.js`

Pre-existing local changes left unstaged:

- `infra/cloudflare/src/core/auth/passwordless.js`
- `ResearchOps.sublime-workspace`

## Validation

Completed:

- `node tests/pages-advanced-worker-auth-route-state.test.js` - passed.
- `node tests/start-project-step-1-defaults-route-state.test.js` - passed.
- `node tests/start-page-route-state.test.js` - passed.
- `node tests/projects-route-contract.test.js` - passed.

Follow-up after GitHub review:

- `python3 .../gh-address-comments/scripts/fetch_comments.py --repo . --pr 403` - found one unresolved CodeQL review thread on `tests/projects-route-contract.test.js`.
- `python3 .../gh-fix-ci/scripts/inspect_pr_checks.py --repo . --pr 403 --json` - confirmed the failing status was the CodeQL code-scanning alert, while the GitHub Actions CodeQL run completed successfully.
- `node tests/projects-route-contract.test.js` - passed after replacing the unsafe hostname substring assertion.
- `npx prettier -c tests/projects-route-contract.test.js` - passed.
- `node tests/projects-route-contract.test.js` - passed after adding the Airtable team-field fallback.
- `npx prettier -c infra/cloudflare/src/service/project-record-routes.js tests/projects-route-contract.test.js` - passed.

Follow-up for non-blocking Airtable team fields:

- Screenshot showed `Error 500: Airtable rejected the configured project team fields.`
- Added a retry path that removes only the configured team fields when Airtable reports an unknown-field error for a project create that included team fields.
- Added route-contract coverage proving the first Airtable create attempt includes `Team ID` and `Team Name`, the retry omits them, and the route still returns `201`.

Codex review follow-up:

- `python3 .../gh-address-comments/scripts/fetch_comments.py --repo . --pr 404` - found one unresolved Codex review thread on `infra/cloudflare/src/service/project-record-routes.js`.
- `node tests/projects-route-contract.test.js` - passed after changing the retry to preserve team metadata that Airtable did not reject.
- `npx prettier -c infra/cloudflare/src/service/project-record-routes.js tests/projects-route-contract.test.js` - passed.
- `git diff --check` - passed.

## Review Thread Disposition

GitHub Advanced Security reported `CodeQL / Incomplete URL substring
sanitization` because the test asserted `url.includes("raw.githubusercontent.com")`.
The assertion now parses the URL and compares `protocol === "https:"` and
`hostname === "raw.githubusercontent.com"`, avoiding arbitrary host-prefix or
host-suffix matches.

PR #404 Codex review reported that dropping both configured team fields on
fallback could make a newly created project invisible when Airtable rejected only
one field. The fallback now removes named rejected team fields only, preserving
supported team metadata on the retry.

## Residual Risk

The local reproduction used repository mocks rather than the live Home Office
account. The fix keeps the trusted, signed Access JWT available to the upstream
Worker and preserves Worker-side JWT validation rather than relaxing API auth.
