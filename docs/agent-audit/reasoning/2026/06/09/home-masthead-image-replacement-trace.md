# Home Masthead Image Replacement Trace

- Date: 2026-06-09
- Trace layer: operational
- Branch: `feature/home-masthead-treatment`
- Branch decision: trace required by `feature/` prefix
- Task summary: record the current PR #376 home masthead image replacement and failing release-gate diagnosis after the image was replaced on the branch.

## Operating model evidence

- Loaded: `AGENTS.md`
- Loaded: `.agent-operating-model/orchestration.xml`
- Loaded: `.agent-operating-model/bundle-registry.json`
- Loaded: `.agent-operating-model/task-signal-catalog.json`
- Loaded: `.agent-operating-model/selection-rules.json`
- Loaded: `.agent-operating-model/github-mutation-policy.md`

## Bundles selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`

## Bundles skipped

- `.agent-operating-model/bundles/cloudflare/`: no Cloudflare runtime, worker, binding, D1, Pages Function or route behaviour changed in this fix.
- `.agent-operating-model/bundles/openai/`: no OpenAI API or model behaviour changed.
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP tooling changed.
- `.agent-operating-model/bundles/airtable-public-api/`: no Airtable API or schema behaviour changed.
- `.agent-operating-model/bundles/mural-public-api/`: no Mural API behaviour changed.

## Files inspected

- `public/images/home-masthead-researchops-illustration.svg`
- `src/govuk/templates/pages/home.njk`
- `public/index.html`
- `src/styles/researchops-home.scss`
- `tests/govuk-frontend-integration-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/08/home-masthead-treatment-trace.md`
- `docs/agent-audit/reasoning/2026/06/08/home-masthead-treatment-trace.json`
- Uploaded release-gate log bundle: `logs_73070003717.zip`

## Files changed in this fix

- `docs/agent-audit/reasoning/2026/06/09/home-masthead-image-replacement-trace.md`
- `docs/agent-audit/reasoning/2026/06/09/home-masthead-image-replacement-trace.json`

## Diagnosis

- Release Gate failed because `npm run validate` reported missing trace coverage for the current date.
- The release-gate log reported: `trace:coverage: branch feature/home-masthead-treatment uses feature/ and requires an audit trace`.
- The release-gate log also reported: `trace:coverage: no trace directory found: docs/agent-audit/reasoning/2026/06/09`.
- CI, GOV.UK page rendering, qa-bdd, Lychee and accessibility checks were already passing on the current PR head.

## Implementation decisions

- Added a current-date trace directory and trace duo for the material SVG replacement work on PR #376.
- Did not alter the masthead SVG, Nunjucks template, generated HTML or CSS as part of this fix.
- Treated the release-gate failure as a trace-coverage issue, not an image-link or rendering issue.

## Validation not run locally

- No local `npm` commands were run in this session.
- Validation should be confirmed by the next PR workflow run.
