# Manage Participant Consent Sourcebook PR Trace

Date: 2026-07-04
Branch: `feature/manage-participant-consent-sourcebook`
Task: Create a ready-for-review PR for adding Sourcebook components to the manage participant consent page after PR #462 merged to `main`.

## Operating Model Bootstrap

- Loaded `AGENTS.md`.
- Loaded `.agent-operating-model/orchestration.xml`.
- Loaded `.agent-operating-model/bundle-registry.json`.
- Loaded `.agent-operating-model/task-signal-catalog.json`.
- Loaded `.agent-operating-model/selection-rules.json`.
- Loaded `.agent-operating-model/precedence-policy.md`.
- Verified selected bundle directories contain `prompt.spec.yaml` and `prompt.body.xml`.

## Selected Bundles

- `.agent-operating-model/bundles/github/` (`github-diamond`)
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`

Skipped:

- `cloudflare`: no Worker runtime, binding or deployment change.
- `openai-platform`: no OpenAI API or model integration change.
- `mcp-agent-tooling`: no MCP protocol, tool or resource change.
- `airtable-public-api`: no Airtable API integration change.
- `mural-public-api`: no Mural API integration change.

## Implementation Summary

- Created `feature/manage-participant-consent-sourcebook` from `origin/main` after PR #462 merged.
- Added route mapping for `/pages/study/participant-consent/` to `REC-ADMN 3.1.1`.
- Added Sourcebook context, evidence ledger and consent assurance gate to the participant consent page.
- Added participant-aware ledger and gate updates to the participant consent page controller.
- Added responsive layout rules so Sourcebook context uses a right rail only at desktop widths and stacks cleanly on tablet and mobile.
- Refined Sourcebook component tag colours and narrow-width table layouts for accessible contrast and readable mobile presentation.
- Regenerated GOV.UK pages and generated CSS outputs.

## Validation

- `npm run build:generated-css` passed.
- `npm run build:govuk-pages` passed.
- `node --test tests/participant-consent-route-state.test.js tests/sourcebook-context-route-state.test.js tests/search-page-route-state.test.js tests/consent-page-route-state.test.js tests/auth-team-access-request-route-state.test.js tests/auth-role-assignment-ui-route-state.test.js tests/sourcebook-api.test.js tests/sourcebook-api-route-state.test.js` passed with 27 tests.
- Playwright rendered checks passed at `1272x739`, `1100x900`, `900x900`, `700x900`, `470x858`, `390x858` and `319x858`.
- `git diff --name-only --diff-filter=ACM origin/main | rg -v '\.njk$' | xargs npx prettier -c` passed.
- `npm run trace:coverage` passed.
- `git diff --check` passed.
- `npm run validate` passed.

## Residual Risk

- Full CI remains the merge gate.
