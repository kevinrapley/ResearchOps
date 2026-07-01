# Walkthrough data-backed states

Date: 2026-07-01
Branch: `fix/walkthrough-data-backed-states`

## Task

After PR #444 was merged to `main`, the BDD walkthrough still captured several data-dependent pages as missing-context or validation states. Keep those error states, but add normal captures backed by deterministic data for add study, journal entry, edit journal entry, discussion guides, study session and team access requests.

## Trace decision

The active branch prefix `fix/` requires an auditable trace for repository-affecting work.

## Operating model

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

Skipped bundles:

- `cloudflare`: no Worker, binding, Pages deployment or Cloudflare API change.
- `openai-platform`: no OpenAI API integration changed.
- `mcp-agent-tooling`: no MCP tooling changed.
- `airtable-public-api`: no Airtable API implementation changed.
- `mural-public-api`: no Mural API implementation changed.

## Files read

- `visual-walkthrough.config.mjs`
- `visual-walkthrough.operational-fixtures.mjs`
- `scripts/walkthrough-playwright.mjs`
- `scripts/visual-walkthrough.mjs`
- `public/pages/study/new/study-new.js`
- `public/js/journal-entry.js`
- `public/js/journal-entry-edit.js`
- `public/components/guides/guides-page.js`
- `public/components/guides/guide-editor.js`
- `public/components/session-controller.js`
- `public/components/session-consent-controller.js`
- `public/js/auth-team-access-review-page.js`
- `tests/qa-bdd-authenticated-walkthrough-route-state.test.js`
- `tests/auth-team-access-review-route-state.test.js`
- `tests/visual-walkthrough-registry-coverage.test.js`

## Files modified

- `visual-walkthrough.config.mjs`
- `visual-walkthrough.operational-fixtures.mjs`
- `tests/qa-bdd-authenticated-walkthrough-route-state.test.js`
- `tests/auth-team-access-review-route-state.test.js`
- `docs/agent-audit/reasoning/2026/07/01/walkthrough-data-backed-states.md`
- `docs/agent-audit/reasoning/2026/07/01/walkthrough-data-backed-states.json`

## Work done

- Changed the add-study operational path to use the project ID parameter the page reads.
- Added deterministic journal-entry, discussion-guide, participant-consent and team-access review fixtures.
- Added mock routes for journal entry detail/list, guide detail and team access review requests.
- Made the six data-dependent walkthrough defaults use the operational data-backed state.
- Kept the previous missing-ID, consent-gate, empty guide source and team-access decision failures as explicit named states.
- Added route-state tests that assert the operational defaults and named error states remain registered.

## Validation

- `node --test tests/qa-bdd-authenticated-walkthrough-route-state.test.js tests/auth-team-access-review-route-state.test.js tests/visual-walkthrough-registry-coverage.test.js tests/study-guides-route-state.test.js tests/study-session-route-state.test.js tests/journal-entry-page-route-state.test.js`: passed.
- `node --check visual-walkthrough.config.mjs && node --check visual-walkthrough.operational-fixtures.mjs`: passed.
- `npx prettier -c visual-walkthrough.config.mjs visual-walkthrough.operational-fixtures.mjs tests/qa-bdd-authenticated-walkthrough-route-state.test.js tests/auth-team-access-review-route-state.test.js`: passed.
- Local Playwright state verification for the six normal states and six explicit error states: passed.
- `npx eslint visual-walkthrough.config.mjs visual-walkthrough.operational-fixtures.mjs tests/qa-bdd-authenticated-walkthrough-route-state.test.js tests/auth-team-access-review-route-state.test.js`: passed with existing flat-config warnings about `eslint-env` comments.
- `npm run generated-css:check`: passed.

## Issues and residual risk

- `npm run lint` did not complete because the repository-wide Prettier check flagged existing `.claude/settings.local.json` formatting before ESLint ran. Targeted Prettier, targeted ESLint and generated CSS checks passed for this change.
- The local Playwright verification checks rendered content and state actions, but the full BDD walkthrough was not regenerated in this branch.
