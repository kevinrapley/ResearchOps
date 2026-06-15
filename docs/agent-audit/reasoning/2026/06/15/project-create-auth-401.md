# Agent trace - Project create authentication 401

**Date:** 2026-06-15  
**Trace type:** operational audit trace  
**Branch:** `fix/project-create-auth-401`  
**Trace required:** yes, because the branch starts with `fix/`  
**Related work:** Fix authenticated project creation from the Start a new research project check-answers step

## Task

Investigate and fix a `401 authentication_required` error shown to
`kevin.rapley@homeoffice.gov.uk` when submitting the Start a new research
project flow from the check-answers step.

The screenshot showed the shared header rendering the signed-in user while the
project create POST returned `authentication_required`.

## Branch Trace Decision

The branch is `fix/project-create-auth-401`. Repository policy allows `fix/` as
a work-branch prefix and requires an auditable trace for repository-affecting
work on fix branches.

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

The first three bundles are always-load bundles. `govuk-design-system` applies
because the user-facing error is in the GOV.UK start-project form flow.
`cloudflare` applies because the root cause is in Cloudflare Pages Worker proxy
and Worker authentication behaviour.

Skipped conditional bundles:

- `openai-platform` - no OpenAI API, model or eval implementation was in scope.
- `mcp-agent-tooling` - no MCP tool, resource, prompt or consent work was in scope.
- `airtable-public-api` - Airtable create behaviour was mocked in tests, but no Airtable API integration contract changed.
- `mural-public-api` - no Mural API or collaboration integration work was in scope.

Precedence decisions:

- GitHub Diamond governed branch naming, trace coverage, surgical mutation and PR readiness.
- ResearchOps Developer Control governed the start-project route and authenticated API conventions.
- Multi-Functional Team governed public-sector assurance and residual-risk framing.
- GOV.UK Design System governed the check-answers flow constraints and error presentation context.
- Cloudflare governed Pages Worker proxy and Worker auth handling.

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

## Review Thread Disposition

GitHub Advanced Security reported `CodeQL / Incomplete URL substring
sanitization` because the test asserted `url.includes("raw.githubusercontent.com")`.
The assertion now parses the URL and compares `protocol === "https:"` and
`hostname === "raw.githubusercontent.com"`, avoiding arbitrary host-prefix or
host-suffix matches.

## Residual Risk

The local reproduction used repository mocks rather than the live Home Office
account. The fix keeps the trusted, signed Access JWT available to the upstream
Worker and preserves Worker-side JWT validation rather than relaxing API auth.
