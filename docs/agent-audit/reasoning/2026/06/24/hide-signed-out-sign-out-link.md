# Trace - hide signed-out Sign out masthead link

- Date: 2026-06-24
- Branch: `fix/hide-signed-out-sign-out-link`
- Trace decision: required because this is repository-affecting work on a `fix/` branch.
- Task: fix the merged PR #425 regression where signed-out users visually saw both `Sign in` and `Sign out` in the masthead.

## Operating Model

Loaded:

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
- `.agent-operating-model/github-mutation-policy.md`

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`

Skipped conditional bundles:

- `cloudflare`: no Worker, binding, route or deployment behaviour was changed.
- `openai-platform`: no OpenAI API or model behaviour was changed.
- `mcp-agent-tooling`: no MCP or agent-tool contract behaviour was changed.
- `airtable-public-api`: no Airtable integration behaviour was changed.
- `mural-public-api`: no Mural integration behaviour was changed.

Precedence applied:

- GitHub Diamond governed branch hygiene, trace creation, validation, commit, push and PR creation.
- ResearchOps Developer Control governed service-specific shared header behaviour.
- Multi-Functional Team governed clear signed-out user-facing account state.
- GOV.UK Design System governed header/navigation accessibility and visual state.

## Files Read

- `README.md`
- `.github/CODEOWNERS`
- `.github/pull_request_template.md`
- `package.json`
- `package-lock.json`
- `RECENT_LEARNINGS.md`
- `public/partials/header.html`
- `public/css/govuk/govuk-header-service-brand.css`
- `public/js/auth-header-links.js`
- `tests/auth-header-links-route-state.test.js`
- `tests/govuk-page-chrome-navigation-route-state.test.js`

## Diagnosis

- Live `https://research-operations.com/partials/header.html` and `https://researchops.pages.dev/partials/header.html` contained `hidden aria-hidden="true"` on the `Sign out` anchor.
- Live `govuk-header-service-brand.css` only had a selector for `.researchops-header__account[hidden]`, not `.researchops-header__account-link[hidden]`.
- The previous test asserted the hidden attribute existed in markup but did not assert the individual hidden account-link CSS selector.
- The shared header stylesheet URL was unversioned, so browsers could retain the old account-link CSS.

## Changes

- Added `.researchops-header__account-link[hidden] { display: none !important; }` to the shared header stylesheet.
- Cache-busted the shared header stylesheet URL with `hide-signed-out-sign-out-20260624-1` in both the link tag and `ensurePageChromeStylesheet`.
- Updated route-state tests to assert the versioned stylesheet URL and individual hidden account-link CSS rule.
- Added a `RECENT_LEARNINGS.md` entry for the visual hidden-state and shared CSS cache-busting trap.

## Validation

- `npm run agent:model -- "<task>"`: passed; always-load bundles selected. GOV.UK Design System was manually selected from the conditional UI rule because the task is masthead CSS/header UI.
- Live asset inspection with `curl`: confirmed header markup had `hidden` on `Sign out` and CSS lacked an individual hidden link selector before this fix.
- `npm test -- tests/auth-header-links-route-state.test.js tests/govuk-page-chrome-navigation-route-state.test.js`: passed, 2 tests.
- Browser check with `/api/me` returning 401: passed; `Sign in` was visible and `Sign out` had `display: none` with zero rendered dimensions.
- `npm run lint`: passed with existing repository warnings and no errors.
- `npm test`: passed, 245 tests.
- Trace JSON parse plus Prettier check for changed files: passed.
- `npm run trace:coverage -- --date 2026-06-24`: passed.
- `git diff --check`: passed.

## Residual Risk

- Live Cloudflare Pages deployment was not changed locally; this branch needs normal PR merge and deployment to update the served stylesheet.
- The browser check used a local static server with mocked unauthenticated `/api/me`.
