# Remove legacy tabs CSS trace

## Run metadata

- Date: 2026-06-09
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/remove-legacy-tabs-css`
- Pull request: #381
- Trace layer: operational
- Branch-prefix trace decision: `fix/` requires a promoted trace.

## Original task summary

Remove the legacy static `public/css/tabs.css` stylesheet completely. Remove its use from the Reflexive Journal and Analysis page. Confirm that tabs styling is not owned by the legacy static file and that GOV.UK tabs styling comes from the generated GOV.UK Frontend stylesheet. Add regression coverage so the legacy stylesheet is not reintroduced.

## Operating-model files loaded

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
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
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.body.xml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.spec.yaml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.body.xml`

## Canonical bundle directories selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`

## Bundles selected

- `github-diamond`: branch, PR, trace, mutation and CI governance.
- `researchops-developer-control`: ResearchOps page, generated-output and route-state test contracts.
- `multi-functional-team`: government service assurance defaults.
- `govuk-design-system`: GOV.UK tabs component styling, accessibility and frontend component ownership.

## Bundles skipped

- `cloudflare`: no Worker, Pages routing, D1, KV, R2 or deployment logic changed.
- `openai-platform`: no OpenAI API, model or retrieval behaviour changed.
- `mcp-agent-tooling`: no MCP server, client or tool contract changed.
- `airtable-public-api`: no Airtable integration changed.
- `mural-public-api`: no Mural API integration changed.

## Precedence decisions

GitHub Diamond governed branch and trace behaviour. ResearchOps Developer Control governed source and rendered page parity. GOV.UK Design System governed the tab component ownership decision. The legacy `public/css/tabs.css` file was removed rather than regenerated from Sass because the correct tab component CSS already comes from `public/assets/govuk/govuk-frontend.css`, which is generated from `src/styles/govuk.scss` by the repository `build:govuk` script.

## Files read

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/*`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.body.xml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.spec.yaml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.body.xml`
- `package.json`
- `scripts/styles/build-generated-css.mjs`
- `scripts/styles/generated-css-targets.mjs`
- `src/govuk/templates/pages/projects-journals.njk`
- `public/pages/projects/journals/index.html`
- `public/css/tabs.css`
- `tests/journals-route-state.test.js`

## Files created, modified or removed

- Modified `src/govuk/templates/pages/projects-journals.njk`
- Modified `public/pages/projects/journals/index.html`
- Modified `tests/journals-route-state.test.js`
- Removed `public/css/tabs.css`
- Created `docs/agent-audit/reasoning/2026/06/09/remove-legacy-tabs-css.md`
- Created `docs/agent-audit/reasoning/2026/06/09/remove-legacy-tabs-css.json`

## Implementation summary

- Removed the `/css/tabs.css` link from the journals Nunjucks source.
- Removed the matching `/css/tabs.css` link from the committed rendered journals page.
- Deleted the static legacy `public/css/tabs.css` file.
- Added route-state assertions that the Nunjucks source, rendered page and generated CSS target manifest do not reference `tabs.css` or `src/styles/tabs.scss`.
- Left GOV.UK tabs component styling under the generated GOV.UK Frontend CSS path.

## Test-contract impact sweep

Performed. Affected contract surfaces:

- journals Nunjucks page head assets
- committed rendered journals page assets
- generated CSS manifest
- legacy static CSS file inventory
- journals route-state assertions

Legacy or affected terms checked:

- `/css/tabs.css`
- `public/css/tabs.css`
- `src/styles/tabs.scss`
- `govukTabs`
- `data-module="govuk-tabs"`
- `public/assets/govuk/govuk-frontend.css`

## Mutation strategy

The branch was created from `main` at `315df278c098eca3b128ef1cbca52628dbc1269f`. Small file edits were made through the available GitHub contents API wrapper and the legacy CSS file was removed through the delete-file wrapper. The branch diff was checked after the edits. The changed-file list was plausible for the requested task.

## Automated review comments

Review-thread state was checked after opening PR #381. No review threads were present at the time of this trace. Any later legitimate Codex or automated review comment must be handled as a work item: classify it, fix or evidence it, add a thumbs-up reaction to the original comment, reply with validation evidence and resolve only after the fix is complete.

## Validation attempted

Remote/local command validation was not run in this connector session because the repository could not be cloned from the sandbox and the connector does not execute repository scripts. Validation still required before marking the PR ready:

- `npm run build`
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/journals-route-state.test.js`
- `npm run format:check`
- `npm run validate`
- `npm run trace:coverage`

## Residual risks

- The PR remains draft until the repository validation commands have run.
- Visual verification on the branch preview is still useful because the user-reported issue was visual CSS override behaviour.
- The custom `/components/tabs.js` controller remains in scope for a later review. It is not the CSS override being removed here.
