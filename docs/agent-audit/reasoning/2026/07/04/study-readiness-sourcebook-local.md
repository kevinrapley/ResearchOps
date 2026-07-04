# Study Readiness Sourcebook Local Trace

Date: 2026-07-04
Branch: `feature/study-readiness-sourcebook`
Task: Apply Sourcebook components locally to the study readiness page for preview review.

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

- Added `/pages/study/` Sourcebook mappings for study readiness across scope, governance triage and consent clauses.
- Added Sourcebook context, readiness gate and evidence ledger to the study page.
- Connected the study page controller so Sourcebook gate and ledger statuses update from live study readiness evidence.
- Reused the shared Sourcebook styles in the study page stylesheet and added study-specific layout rules.
- Regenerated GOV.UK pages and generated CSS outputs for local preview.
- Revised the integration after team review so Sourcebook evidence is conservative, the gate follows ledger evidence as well as readiness, the context appears before the readiness task list, and the study route includes method/risk and environment readiness clauses.
- Revised the layout after interaction-design review so the compact Sourcebook context sits directly after the session gate, long clause text is hidden in the compact context, and the right column is reserved for readiness and evidence summary content.
- Reordered the study readiness page so Study setup tasks appear before the compact Sourcebook context, keeping the governance explanation as supporting context after the main operational checklist.
- Consolidated Sourcebook with the existing study page content so the gate is a short session-start decision, setup tasks carry inline Sourcebook references, the rationale block is title-only, and the evidence ledger sits behind a GOV.UK details disclosure as an audit record.
- Removed the unnecessary visible "Edit cancelled." description edit status and wired the controller to the existing status region so it does not create a duplicate live region.
- Updated the local preview helper at `/Users/kevin.rapley/.hermes/scripts/serve_research_operations.py` so `http://127.0.0.1:8082` serves the seeded discussion guide for `rect3o7dt` through `/api/guides`, plus the study support and consent endpoints needed by this local preview.
- Restarted the local preview on `http://127.0.0.1:8082` from the current working-copy `public/` directory so the live page includes the Sourcebook markup instead of the older `/Users/kevin.rapley/ResearchOps/public` output.
- Added a generated `/css/sourcebook-components.css` stylesheet for shared Sourcebook components and linked it from the study page before `/css/study-page.css`, leaving route-specific spacing overrides in the study stylesheet.
- Reconciled the study readiness page states so Study setup task tags are driven by the same readiness evaluation as the Study readiness summary, and Sourcebook audit incompleteness no longer says the study is not ready to begin sessions.
- Reconciled the Sourcebook evidence record with the same readiness signals so completed setup/readiness items mark the mapped evidence rows as present instead of leaving a contradictory audit state.
- Moved the final PR work onto `feature/study-readiness-sourcebook` from current `origin/main` after PR #463 was merged, preserving the local study readiness changes while avoiding reuse of the merged participant-consent branch.

## Validation

- `npm run build:generated-css` passed.
- `npm run build:govuk-pages` passed.
- `node --test tests/study-page-route-state.test.js tests/sourcebook-context-route-state.test.js` passed with 6 tests.
- `node --test tests/study-page-route-state.test.js tests/sourcebook-context-route-state.test.js tests/sourcebook-api.test.js tests/sourcebook-api-route-state.test.js` passed with 23 tests.
- `npx prettier -c sourcebook/sourcebook-route-mappings.json scripts/govuk/render-govuk-pages.mjs public/js/study-page.js src/styles/study-page.scss tests/study-page-route-state.test.js tests/sourcebook-context-route-state.test.js docs/agent-audit/reasoning/2026/07/04/study-readiness-sourcebook-local.md docs/agent-audit/reasoning/2026/07/04/study-readiness-sourcebook-local.json` passed.
- `npm run trace:coverage` passed.
- `git diff --check` passed.
- Playwright rendered checks passed at `1272x739`, `700x900` and `390x858`, confirming desktop rail layout, tablet/mobile stacking and no horizontal overflow.
- `npm run validate` passed.
- After the team-review revision, `node --test tests/study-page-route-state.test.js tests/sourcebook-context-route-state.test.js tests/sourcebook-api.test.js tests/sourcebook-api-route-state.test.js` passed with 23 tests.
- After the team-review revision, Playwright rendered checks passed at `1272x739`, `900x900`, `700x900` and `390x858`, confirming the gate reports missing evidence, the ledger has both present and needed states, Sourcebook context precedes the readiness list, and no horizontal overflow is introduced.
- After the interaction-design layout revision, `node --test tests/study-page-route-state.test.js tests/sourcebook-context-route-state.test.js tests/sourcebook-api.test.js tests/sourcebook-api-route-state.test.js` passed with 23 tests.
- After the interaction-design layout revision, Playwright rendered checks passed at `1272x739`, `900x900`, `700x900` and `390x858`, confirming Sourcebook context follows the session gate, long clause text is hidden in compact mode and no horizontal overflow is introduced.
- After the interaction-design layout revision, `npx prettier -c sourcebook/sourcebook-route-mappings.json scripts/govuk/render-govuk-pages.mjs public/js/study-page.js src/styles/study-page.scss tests/study-page-route-state.test.js tests/sourcebook-context-route-state.test.js docs/agent-audit/reasoning/2026/07/04/study-readiness-sourcebook-local.md docs/agent-audit/reasoning/2026/07/04/study-readiness-sourcebook-local.json` passed.
- After the interaction-design layout revision, `npm run trace:coverage` passed.
- After the interaction-design layout revision, `git diff --check` passed.
- After the interaction-design layout revision, `npm run validate` passed.
- After the setup-first reorder, `npm run build:generated-css` passed.
- After the setup-first reorder, `npm run build:govuk-pages` passed.
- After the setup-first reorder, `node --test tests/study-page-route-state.test.js tests/sourcebook-context-route-state.test.js tests/sourcebook-api.test.js tests/sourcebook-api-route-state.test.js` passed with 23 tests.
- After the setup-first reorder, `npx prettier -c src/styles/study-page.scss tests/study-page-route-state.test.js public/css/study-page.css public/pages/study/index.html docs/agent-audit/reasoning/2026/07/04/study-readiness-sourcebook-local.md docs/agent-audit/reasoning/2026/07/04/study-readiness-sourcebook-local.json` passed.
- After the setup-first reorder, Playwright rendered checks passed at `1272x739`, `900x900`, `700x900` and `390x858`, confirming Study setup tasks appear before Sourcebook context, Sourcebook context appears before Study analysis tasks, and no document-level horizontal scrolling is introduced.
- After the setup-first reorder, `npm run trace:coverage` passed.
- After the setup-first reorder, `git diff --check` passed.
- After the setup-first reorder, `npm run validate` passed.
- After the Sourcebook consolidation, `npm run build:generated-css` passed.
- After the Sourcebook consolidation, `npm run build:govuk-pages` passed.
- After the Sourcebook consolidation, `node --test tests/study-page-route-state.test.js tests/sourcebook-context-route-state.test.js tests/sourcebook-api.test.js tests/sourcebook-api-route-state.test.js` passed with 23 tests.
- After the Sourcebook consolidation, `npx prettier -c src/govuk/data/sourcebook.mjs scripts/govuk/render-govuk-pages.mjs public/js/study-page.js src/styles/study-page.scss tests/study-page-route-state.test.js public/css/study-page.css public/pages/study/index.html` passed.
- After the Sourcebook consolidation, Playwright rendered checks passed at `1272x739`, `900x900`, `700x900` and `390x858`, confirming the gate has no internal Sourcebook checklist, setup tasks include 5 inline Sourcebook references, rationale text and conditions are hidden in compact context, the evidence record is collapsed, and no horizontal scrolling is introduced.
- After the Sourcebook consolidation, `npx prettier -c src/govuk/data/sourcebook.mjs scripts/govuk/render-govuk-pages.mjs public/js/study-page.js src/styles/study-page.scss tests/study-page-route-state.test.js public/css/study-page.css public/pages/study/index.html docs/agent-audit/reasoning/2026/07/04/study-readiness-sourcebook-local.md docs/agent-audit/reasoning/2026/07/04/study-readiness-sourcebook-local.json` passed.
- After the Sourcebook consolidation, `npm run trace:coverage` passed.
- After the Sourcebook consolidation, `git diff --check` passed.
- After the Sourcebook consolidation, `npm run validate` passed.
- After removing the description cancel status, `node --test tests/study-page-route-state.test.js` passed.
- After removing the description cancel status, `npx prettier -c public/pages/study/study-desc-controller.js tests/study-page-route-state.test.js` passed.
- After removing the description cancel status, Playwright confirmed Edit description then Cancel leaves one empty `#desc-status` region and no visible "Edit cancelled." text.
- After removing the description cancel status, `npx prettier -c public/pages/study/study-desc-controller.js tests/study-page-route-state.test.js docs/agent-audit/reasoning/2026/07/04/study-readiness-sourcebook-local.md docs/agent-audit/reasoning/2026/07/04/study-readiness-sourcebook-local.json` passed.
- After removing the description cancel status, `npm run trace:coverage` passed.
- After removing the description cancel status, `git diff --check` passed.
- After removing the description cancel status, `npm run validate` passed.
- `python3 -m py_compile /Users/kevin.rapley/.hermes/scripts/serve_research_operations.py` passed after adding the local preview guide and support endpoints.
- `curl http://127.0.0.1:8082/api/guides?study=rect3o7dt` returned the published `v1 guide` and draft `New guide` rows from `data/discussion-guides.csv`.
- `curl http://127.0.0.1:8082/api/study-support?study=rect3o7dt` returned a saved local support setup with no additional session support people.
- Playwright confirmed `#study-readiness-guide-status` is `Ready`, `#study-setup-support-status` is `Ready`, `#study-session-gate-summary` is `This study is ready to run`, the `1 setup task needs attention` text is absent, the begin session link is visible, and there are no failed page requests.
- After correcting the preview root, Playwright confirmed the live page includes `[data-sourcebook-gate]`, `.study-sourcebook-context` and `.study-sourcebook-evidence-details` while retaining the ready study data and no failed page requests.
- `npm run build:generated-css` passed after adding the Sourcebook component stylesheet target.
- `npm run build:govuk-pages` passed after linking `/css/sourcebook-components.css` from the study page.
- Playwright confirmed `/css/sourcebook-components.css` loads with HTTP 200 and the Sourcebook gate and context receive the expected component background, left border and spacing.
- `node --test tests/study-page-route-state.test.js tests/sourcebook-context-route-state.test.js` passed with 6 tests after updating the stylesheet contract assertions.
- `npx prettier -c src/styles/sourcebook-components.scss scripts/styles/generated-css-targets.mjs src/styles/study-page.scss tests/study-page-route-state.test.js public/css/sourcebook-components.css public/css/study-page.css public/pages/study/index.html` passed.
- `npm run build:govuk-pages` passed after replacing contradictory Sourcebook gate copy and wiring setup task statuses.
- `node --test tests/study-page-route-state.test.js tests/sourcebook-context-route-state.test.js` passed with 6 tests after adding the Sourcebook attention status and setup task status assertions.
- Playwright confirmed Study setup statuses now match the Study readiness statuses, the session gate says `This study is ready to run`, Sourcebook says `Evidence record incomplete`, and the live page no longer contains `No gate required` or `Not ready to begin sessions`.
- `npx prettier -c src/govuk/data/sourcebook.mjs scripts/govuk/render-govuk-pages.mjs public/js/study-page.js tests/study-page-route-state.test.js tests/sourcebook-context-route-state.test.js public/pages/study/index.html` passed.
- `node --test tests/study-page-route-state.test.js tests/sourcebook-context-route-state.test.js` passed with 6 tests after mapping readiness signals to the Sourcebook evidence ledger.
- Playwright confirmed Study readiness and Study setup tasks are ready, Sourcebook evidence is complete, all visible evidence ledger rows are `Present`, and there are no failed page requests.
- `npx prettier -c public/js/study-page.js tests/study-page-route-state.test.js` passed.

## Residual Risk

- No known residual implementation risk. CI remains the authoritative post-push validation gate after the PR is opened.
