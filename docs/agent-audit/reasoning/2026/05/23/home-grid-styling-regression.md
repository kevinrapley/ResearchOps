# Home grid styling regression trace

- Date: 2026-05-23
- Repository: `kevinrapley/ResearchOps`
- Pull request: #262
- Branch: `chore/govuk-frontend-integration`
- Branch trace decision: `chore/` branch, trace required.
- Task: Restore the ResearchOps home page styling for the 8-step grid and the “What you can do after creating a project” columns after the GOV.UK `x-include` page chrome change.

## Operating-model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`

## Bundles selected

- `github-diamond` from `.agent-operating-model/bundles/github/`
- `researchops-developer-control` from `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` from `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` from `.agent-operating-model/bundles/govuk-design-system/`

## Bundles skipped

- `cloudflare`
- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

## Signals

- `repository-affecting-task`
- `government-product-assurance-default`
- `ui-or-content-change`

## Files read

- `docs/design-system/govuk-compliance-audit.md`
- `docs/spikes/govuk-frontend-integration.md`
- `src/styles/researchops-home.scss`
- `src/govuk/templates/pages/home.njk`
- `public/index.html`
- `public/assets/researchops/researchops-home.css`
- `tests/govuk-frontend-integration-route-state.test.js`

## Findings

The Sass source for the 8-step grid and the next-action columns still existed in `src/styles/researchops-home.scss`.

The rendered home page still referenced the home stylesheet, but the URL was unversioned. After the page chrome changed to `x-include`, a stale cached `researchops-home.css` asset became a plausible failure mode for the visual regression.

The regression test only checked that the generated CSS contained high-level selectors. It did not assert that the Sass source preserved the desktop grid contracts or that the rendered home page used the versioned ResearchOps home stylesheet.

## Implementation decisions

The source Sass remains the source of truth for the home page components.

The fix strengthens `src/styles/researchops-home.scss` by making the grid tracks use `minmax(0, 1fr)`, and by adding defensive `width: 100%`, `min-width: 0`, and `box-sizing: border-box` properties to the home grid/card containers.

The source home template now references `researchops-home.css?v=govuk-x-include-home-grid` so deployed browsers request the current home stylesheet after the page chrome change.

The checked-in rendered home page was aligned with the source template by updating the same stylesheet URL.

No manual generated-CSS patch was committed as the source of truth.

## Files modified

- `src/styles/researchops-home.scss`
- `src/govuk/templates/pages/home.njk`
- `public/index.html`
- `tests/govuk-frontend-integration-route-state.test.js`
- `docs/agent-audit/reasoning/2026/05/23/home-grid-styling-regression.md`
- `docs/agent-audit/reasoning/2026/05/23/home-grid-styling-regression.json`

## Validation attempted

No local automated validation was run in this environment.

The route-state test was updated to assert:

- the Sass source preserves the 4-column step grid contract
- the Sass source preserves the 3-column next-action contract
- the home template uses the versioned `researchops-home.css` asset
- the checked-in rendered home page uses the versioned `researchops-home.css` asset
- the checked-in rendered home page still contains the `researchops-step-grid`, `researchops-next-actions`, and `researchops-next-action` classes

## Required follow-up validation

Run:

```bash
npm run build:researchops
npm run build:govuk-pages
node tests/govuk-frontend-integration-route-state.test.js
```

Then check the home page in browser at desktop width to confirm the 8-step grid and three next-action columns are restored.
