# Agent trace - Header account links

**Date:** 2026-06-15  
**Trace type:** operational audit trace  
**Branch:** `feature/header-account-links`  
**Trace required:** yes, because the branch starts with `feature/`  
**Related work:** Shared signed-in account links in the ResearchOps GOV.UK header

## Task

Add signed-in account links to the shared header. When a user is logged in, the
header should show the user's display name linking to `/pages/account/`, followed
by a `Sign out` link positioned furthest right, matching the Home Office header
pattern.

The work also captured reusable custom sub-agent role names in the local Codex
config so future chats can refer to the standing production and watcher lanes
consistently.

## Branch Trace Decision

The branch is `feature/header-account-links`. Repository policy allows
`feature/` as a work-branch prefix and requires an auditable trace for
repository-affecting work on feature branches.

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
because this is a shared GOV.UK header, navigation, accessibility and content
change. `cloudflare` applies to the follow-up because the issue presented in a
Cloudflare Pages preview deployment and required cache/deployment behaviour
validation.

Skipped conditional bundles:

- `openai-platform` - no OpenAI API, model or eval implementation was in scope.
- `mcp-agent-tooling` - no MCP tool, resource, prompt or consent work was in scope.
- `airtable-public-api` - no Airtable API or data integration work was in scope.
- `mural-public-api` - no Mural API or collaboration integration work was in scope.

Precedence decisions:

- GitHub Diamond governed branch naming, trace coverage, surgical mutation and PR readiness.
- ResearchOps Developer Control governed the shared header and auth route conventions.
- Multi-Functional Team governed public-sector assurance and residual-risk framing.
- GOV.UK Design System governed the header link pattern, keyboard focus and accessible navigation labelling.
- Cloudflare governed the Pages preview cache/deployment behaviour.

No bundle conflicts were identified.

## Implementation

Updated `public/partials/header.html` to include a hidden account navigation
region inside the GOV.UK header container. The region contains a user-name link
to `/pages/account/` and a `Sign out` link. It is hidden by default so signed-out
users do not see account actions while the browser checks session state.

Added `public/js/auth-header-links.js`. It calls the same real `/api/me`
account context endpoint as the account dashboard, and reveals the account
navigation only when that response succeeds. The script uses the display name,
falling back to the email local part, and posts to `/api/auth/logout` before
redirecting to `/pages/account/sign-in/`.

Updated `public/js/auth-header-links.js` and `public/js/govuk-frontend-init.js`
so header account hydration also runs from the shared `x-include:loaded` event.
This keeps the live behaviour tied to the real `/api/me` response while
avoiding reliance on script execution from an injected partial.

Updated `public/css/govuk/govuk-header-service-brand.css` so the account links
sit on the right of the header area. The user name appears first, with a gap
before `Sign out`, and `Sign out` is positioned furthest right. The layout wraps
on narrow screens.

Updated `public/components/layout.js` so `/partials/header.html` is fetched with
`no-store` by the shared include loader. This prevents preview environments from
showing a stale cached header partial after a branch deployment. The live header
continues to call the real `/api/me` endpoint and does not use a mocked identity.

Updated `public/pages/account/index.html` to version the shared layout loader and
GOV.UK initialisation module for this feature so the live preview account page
does not reuse a visitor's previously cached loader. The header include keeps
the standard `/partials/header.html` shape and the updated loader fetches that
partial with `no-store`.

Updated `src/govuk/templates/layouts/researchops.njk`,
`scripts/govuk/render-govuk-pages.mjs` and
`scripts/govuk/normalise-service-pages.mjs` so the account-page cache keys are
source-driven and the service-page normaliser recognises versioned shared
header/footer includes.

Added focused route-state tests for the shared header, account-context auth check,
sign-out behaviour and right-aligned account-link layout. Extended the existing
auth story acceptance route-state test so header sign-out is part of the sign-out
contract.

Updated the local Codex config outside the repository at
`/Users/kevin.rapley/.codex/config.toml` with short custom sub-agent role names
and thread-capacity metadata. This local config file is not part of the PR.

## Files

Read:

- `AGENTS.md`
- operating-model files listed above
- selected bundle prompt specs and bodies
- `public/partials/header.html`
- `public/components/layout.js`
- `public/pages/account/index.html`
- `src/govuk/templates/layouts/researchops.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `scripts/govuk/normalise-service-pages.mjs`
- `public/js/auth-account-page.js`
- `public/js/auth-sign-in-page.js`
- `public/js/govuk-frontend-init.js`
- `infra/cloudflare/src/core/auth/access-scoped.js`
- `public/css/govuk/govuk-header-service-brand.css`
- `public/css/govuk/govuk-page-chrome.css`
- `tests/auth-account-dashboard-route-state.test.js`
- `tests/auth-story-1-acceptance-route-state.test.js`
- `tests/govuk-page-chrome-navigation-route-state.test.js`

Created:

- `public/js/auth-header-links.js`
- `tests/auth-header-links-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/15/header-account-links.md`
- `docs/agent-audit/reasoning/2026/06/15/header-account-links.json`

Modified:

- `public/css/govuk/govuk-header-service-brand.css`
- `public/components/layout.js`
- `public/pages/account/index.html`
- `public/js/auth-header-links.js`
- `public/js/govuk-frontend-init.js`
- `public/partials/header.html`
- `src/govuk/templates/layouts/researchops.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `scripts/govuk/normalise-service-pages.mjs`
- `tests/auth-story-1-acceptance-route-state.test.js`

Local user config updated outside repository:

- `/Users/kevin.rapley/.codex/config.toml`

## Sub-Agent Coordination

The previous standing sub-agent IDs were no longer available in this chat, and
new sub-agent spawning was blocked by the active thread limit. The work therefore
continued locally while the local config was updated to define reusable future
roles:

- `BranchGuard`
- `CheckGuard`
- `ReviewGuard`
- `RenderGuard`
- `TraceGuard`
- `TemplateDev`
- `RuntimeDev`
- `StyleDev`
- `TestDev`
- `DocsDev`

## Validation

Completed:

- `node --test tests/auth-header-links-route-state.test.js tests/auth-story-1-acceptance-route-state.test.js tests/govuk-page-chrome-navigation-route-state.test.js` - passed.
- Local config role-count inspection with Node - passed, confirming 10 custom role entries and `max_threads = 10`.
- Browser preview with a mock signed-in identity - passed. The header rendered the user's name linked to `/pages/account/`, followed by `Sign out`, with the sign-out link furthest right.
- Desktop browser viewport check at 1280 by 720 - passed. The header container rendered as a flex row, the account navigation was right-aligned, and the links stayed in the header row.
- Prettier check for changed source, tests and trace - passed.
- `npm run trace:coverage` - passed.
- `git diff --check` - passed.
- `npm test` - passed, 221 tests.

## Residual Risk

The header account navigation is client-hydrated after the shared header partial
loads. Signed-in users may briefly see no account links until the account-context
request completes. The hidden-by-default behaviour is intentional to avoid
showing account actions to signed-out users.

The local `max_threads` entry records intended orchestration capacity, but the
current running Codex session may need to reload config before any platform
thread limit changes take effect.
