# Ethics Risk Escalation State Fix Trace

Date: 2026-07-04
Branch: `fix/ethics-risk-escalation-state`
Task: Correct the study overview state shown after a completed ethics risk assessment returns an escalation outcome.

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
- Updated the session gate so `Ethics advice needed`, `Extra controls needed` and `Ethics submission likely needed` direct researchers to the ethics route instead of saying the risk assessment task is incomplete.
- Updated the session workspace hint to say the ethics advice route must be followed before sessions can begin.
- Updated the Sourcebook gate copy so escalation states are labelled as governance escalation rather than setup incompleteness.
- Bumped the study page controller cache key to `study-ethics-escalation-20260704`.

## Validation

- `npm run build:govuk-pages` passed.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/study-page-route-state.test.js tests/study-ethics-risk-route-state.test.js tests/study-child-route-state.test.js` passed with 3 tests.
- `npx eslint public/js/study-page.js tests/study-page-route-state.test.js` completed with no errors and existing `public/js/study-page.js` console warnings only.
- `npx prettier -c public/js/study-page.js tests/study-page-route-state.test.js public/pages/study/index.html` passed.
- `git diff --check` passed.
- `npm run trace:coverage` passed.
- `curl -ks 'https://research-operations/pages/study/?id=rect3o7dt&project=recgdpwEI5hFO7bUZ'` confirmed the local HTTPS preview serves `/js/study-page.js?v=study-ethics-escalation-20260704`.

## Residual Risk

- This adds the escalation state and route back to the risk assessment outcome. A fuller escalation workflow page can build on this state model.
