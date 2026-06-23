# Trace - signed-out header sign-in link

- Date: 2026-06-23
- Branch: `fix/signed-out-header-sign-in-link`
- Trace decision: required because this is repository-affecting work on a `fix/` branch.
- Task: when a user is not logged in to the ResearchOps service, replace the username and Sign out header links with a Sign in link that takes the user to the sign-in page.

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

- GitHub Diamond governed branch, trace and validation discipline.
- ResearchOps Developer Control governed service-specific auth header behaviour.
- Multi-Functional Team governed user-facing clarity for signed-out account state.
- GOV.UK Design System governed header/navigation accessibility and link clarity.

## Files Read

- `README.md`
- `.github/CODEOWNERS`
- `.github/pull_request_template.md`
- `.github/workflows/ci.yml`
- `.github/workflows/validate.yml`
- `.github/workflows/render-govuk-pages.yml`
- `package.json`
- `package-lock.json`
- `RECENT_LEARNINGS.md`
- `public/partials/header.html`
- `public/js/auth-header-links.js`
- `public/js/govuk-frontend-init.js`
- `scripts/govuk/render-govuk-pages.mjs`
- `tests/auth-header-links-route-state.test.js`
- `tests/auth-story-1-acceptance-route-state.test.js`

## Changes

- Updated the shared header default account state to show a visible `Sign in` link to `/pages/account/sign-in/`.
- Kept the `Sign out` link hidden by default and made `auth-header-links.js` reveal it only after `/api/me` confirms a signed-in account.
- Added signed-out rendering behaviour for failed, unauthenticated or empty account responses.
- Bumped the auth header cache key from `header-account-links-20260615-2` to `header-account-links-20260623-1`.
- Updated the generated account page and the route-state test expectations for the new default signed-out header state.

## Validation

- `npm run agent:model -- "<task>"`: passed; selected GitHub Diamond, ResearchOps Developer Control, Multi-Functional Team and GOV.UK Design System bundles.
- `npm test -- tests/auth-header-links-route-state.test.js`: passed.
- `npm test -- tests/auth-header-links-route-state.test.js tests/auth-story-1-acceptance-route-state.test.js`: passed, 2 tests.
- `npx prettier -c public/partials/header.html public/js/auth-header-links.js public/js/govuk-frontend-init.js scripts/govuk/render-govuk-pages.mjs public/pages/account/index.html tests/auth-header-links-route-state.test.js`: passed.
- `npm run build:govuk-pages`: passed.
- Browser check with `/api/me` returning 401: passed; `Sign in` was visible, linked to `/pages/account/sign-in/`, and `Sign out` was hidden.
- `npm run lint`: passed with existing repository warnings and no errors.
- `npm test`: passed, 245 tests.
- `npm run trace:coverage -- --date 2026-06-23`: passed.
- `git diff --check`: passed.

## Residual Risk

- The check covered the signed-out path locally with a static server and mocked unauthenticated `/api/me`; live Cloudflare deployment was not changed or verified.
- Existing repository-wide lint warnings remain outside this change.
