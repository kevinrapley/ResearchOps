# Ethics Risk Escalation State Fix Trace

Date: 2026-07-04
Branch: `fix/ethics-risk-escalation-state`
Task: Correct the study overview state shown after a completed ethics risk assessment returns an escalation outcome, then add a dedicated route-specific next-steps workflow for escalation outcomes.

## Operating Model Bootstrap

- Loaded `AGENTS.md`.
- Loaded `.agent-operating-model/orchestration.xml`.
- Loaded `.agent-operating-model/bundle-registry.json`.
- Loaded `.agent-operating-model/task-signal-catalog.json`.
- Loaded `.agent-operating-model/selection-rules.json`.
- Loaded `.agent-operating-model/precedence-policy.md`.
- Loaded `.agent-operating-model/github-mutation-policy.md`.
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

- Separated incomplete setup tasks from completed ethics risk assessments that require governance escalation.
- Added `/pages/study/ethics-risk/next-steps/` as a dedicated follow-up workflow for `Ethics advice needed`, `Extra controls needed` and `Ethics submission likely needed` outcomes.
- Updated the session gate so escalation outcomes link to the new next-steps workflow instead of routing back to the assessment form.
- Updated the session workspace hint to say the ethics risk next steps must be completed before sessions can begin.
- Added route-specific task lists, evidence requirements and local progress recording for the three escalation routes.
- Added a route-specific next-step link from the completed ethics risk assessment outcome panel.
- Updated the Sourcebook gate copy so escalation states are labelled as governance escalation rather than setup incompleteness.
- Bumped the study page controller cache key to `study-ethics-next-steps-20260704`.

## Files Created Or Modified

- Created `src/govuk/templates/pages/study-ethics-risk-next-steps.njk`.
- Created `public/js/study-ethics-risk-next-steps-page.js`.
- Created generated `public/pages/study/ethics-risk/next-steps/index.html`.
- Modified `public/js/study-page.js`, `public/js/study-ethics-risk-page.js`, `src/govuk/templates/pages/study.njk`, `src/govuk/templates/pages/study-ethics-risk.njk`, `src/styles/study-ethics-risk.scss`, `public/css/study-ethics-risk.css`, `scripts/govuk/render-govuk-pages.mjs` and route-state tests.

## Validation

- `npm run build:govuk-pages` passed.
- `npm run build:generated-css` passed.
- `npm run generated-css:check` passed.
- `node tests/study-page-route-state.test.js` passed.
- `node tests/study-ethics-risk-route-state.test.js` passed.
- `node tests/study-child-route-state.test.js` passed.
- `npm run lint` passed with existing repository warnings only.
- `git diff --check` passed.
- `npm run trace:coverage` passed.
- `curl -k -I 'https://research-operations/pages/study/ethics-risk/next-steps/?id=rect3o7dt&project=recgdpwEI5hFO7bUZ'` returned `200 OK`.
- `curl -ks 'https://research-operations/pages/study/ethics-risk/next-steps/?id=rect3o7dt&project=recgdpwEI5hFO7bUZ'` confirmed the local HTTPS preview serves the next-steps page and controller.
- `curl -ks 'https://research-operations/api/study-ethics-risk?study=rect3o7dt'` confirmed the review study has an `ethics-advice-required` saved outcome.

## Residual Risk

- The new progress record is local-preview state. A production-backed follow-up should add a server endpoint for persisted ethics advice/control/submission progress before this becomes an authoritative record.
