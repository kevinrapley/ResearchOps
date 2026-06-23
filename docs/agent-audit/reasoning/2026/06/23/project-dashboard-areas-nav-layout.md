# Project dashboard areas nav layout

## Task summary

Move the Project Dashboard `Project areas` navigation into a left column that takes one quarter of the desktop width, with the remaining dashboard content in a three-quarter column to the right. Keep the DaaS brand panel full width before the two-column dashboard layout.

Follow-up: make the `Project areas` navigation sticky after users scroll beyond it, with the same visible top spacing as the space between the navigation panel and the DaaS brand panel.

Follow-up: move the `Reflexive journal` panel into the left column underneath the `Project areas` navigation.

Follow-up: make the left sidebar sticky as a group so the `Project areas` navigation and `Reflexive journal` panel remain in view together.

Follow-up: reduce the visible gap between `Project areas` and `Reflexive journal` so it matches the other dashboard panel gaps.

Follow-up: make the sidebar with `Project areas` and `Reflexive journal` one third width and the main content column two thirds width within the GOV.UK width container.

Follow-up: add an 8px bottom margin to the button at the bottom of the `rops-link-panel`.

Follow-up: remove the `#mural-status` paragraph element from the Mural board panel.

Follow-up: keep the `Connect Mural` button in the HTML but hide it from the UI while Mural is connected or the disabled default state is active.

## Run metadata

- Date: 2026-06-23
- Branch: `fix/project-dashboard-areas-nav-layout`
- Trace required: yes, because `fix/` branches require an auditable trace.
- Repository: `kevinrapley/ResearchOps`

## Operating model loaded

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

## Bundles selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`

## Bundles skipped

- `.agent-operating-model/bundles/cloudflare/`: no Worker, Pages runtime, binding or deployment behaviour changed.
- `.agent-operating-model/bundles/openai/`: no OpenAI API, model or AI route behaviour changed.
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP protocol or agent tooling changed.
- `.agent-operating-model/bundles/airtable-public-api/`: no Airtable API behaviour changed.
- `.agent-operating-model/bundles/mural-public-api/`: no Mural API behaviour changed.

## Precedence decisions

- GitHub Diamond governed branch naming, trace requirement, surgical mutation, changed-file review and PR readiness.
- ResearchOps Developer Control governed the project dashboard route, generated GOV.UK page output, generated CSS output and route-state test style.
- Multi-Functional Team governed public-sector product assurance and the need to keep the project hub usable for researchers and product team members.
- GOV.UK Design System governed preserving semantic navigation, GOV.UK summary-card structure and responsive behaviour.
- No instruction conflicts were found.

## Files read

- `src/govuk/templates/pages/project-dashboard.njk`
- `src/styles/project-dashboard.scss`
- `public/pages/project-dashboard/index.html`
- `public/css/project-dashboard.css`
- `tests/project-dashboard-route-state.test.js`
- `package.json`

## Files created or modified

- `src/govuk/templates/pages/project-dashboard.njk`
- `src/styles/project-dashboard.scss`
- `public/css/project-dashboard.css`
- `public/pages/project-dashboard/index.html`
- `tests/project-dashboard-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/23/project-dashboard-areas-nav-layout.md`
- `docs/agent-audit/reasoning/2026/06/23/project-dashboard-areas-nav-layout.json`

## Existing local changes

- The checkout already had an unrelated local edit in `infra/cloudflare/src/core/auth/passwordless.js`.
- That file was not staged for this PR.

## Decisions

- Moved `{{ daasBrandPanel() }}` before the new dashboard layout wrapper so the DaaS panel remains full width.
- Added `.rops-dashboard-layout` around the project-area nav and the rest of the dashboard content.
- Kept the navigation as a semantic `nav` with `aria-labelledby="project-areas-title"`.
- Added `.rops-project-areas-nav` for the left column and `.rops-dashboard-content` for the right column.
- Used a responsive CSS grid that stays single-column by default and becomes `minmax(0, 1fr) minmax(0, 2fr)` from the existing desktop breakpoint.
- Kept sticky behaviour desktop-only from the dashboard layout breakpoint.
- Used `top: 1rem` for the sticky offset, matching the DaaS brand panel bottom spacing.
- Added `.rops-dashboard-sidebar` to stack the `Project areas` navigation and `Reflexive journal` panel in the left column.
- Moved the existing `Reflexive journal` markup out of the main dashboard content grid without changing its IDs, links or Mural integration hooks.
- Moved the sticky positioning from `.rops-project-areas-nav` to `.rops-dashboard-sidebar` so the left column sticks as one stack.
- Added `align-self: start` to `.rops-dashboard-sidebar` so the sticky grid item uses the sidebar stack height instead of stretching to the full content column height.
- Reset direct `.govuk-summary-card` bottom margins inside `.rops-dashboard-sidebar` so the sidebar grid gap defines the visible spacing between the nav and journal panels.
- Adjusted the desktop dashboard grid from a one-quarter/three-quarter split to a one-third/two-thirds split while keeping the DaaS brand panel outside the two-column area.
- Added a scoped `.rops-link-panel .govuk-button` rule so the journal button keeps an 8px bottom margin inside the link panel.
- Removed the `#mural-status` paragraph from the dashboard template and deleted its now-unused `.rops-mural-status` stylesheet rule.
- Changed the Mural integration disabled/default state to hide the existing `#mural-connect` button until a disconnected or recoverable-error path shows it.
- Preserved existing dashboard cards, links, IDs and JavaScript hooks.

## Validation attempted

- `npm run build:project-dashboard && npm run build:govuk-pages` passed.
- `node --test tests/project-dashboard-route-state.test.js` passed.
- `npm run format:check` passed.
- `npm run lint` passed with existing repository warnings and no errors.
- Browser layout, sticky sidebar, left-column journal placement and 20px nav-to-journal panel gap check with Playwright passed at 1280px desktop and 390px mobile widths.
- Browser layout ratio check with Playwright passed at 1280px desktop width, confirming the sidebar is one third and the main content column is two thirds of the dashboard grid.
- Route-state checks confirm the `rops-link-panel` button bottom margin rule is present in both Sass and generated CSS.
- Route-state checks confirm the `#mural-status` paragraph and `.rops-mural-status` style no longer render.
- Route-state checks confirm the Mural disabled/default state hides the existing Connect Mural button.
- `npm test -- --ci` could not run because the current script passes `--ci` through to Node, which exits with `node: bad option: --ci`.
- `npm test` passed with 245 tests and 0 failures.
- `npm run validate` passed.

## Residual risks

- Final deployed appearance still depends on the generated static assets being served without stale cache.
