# DaaS dashboard brand panel

## Task summary

Add a DaaS-specific brand panel to the project dashboard for DaaS projects. The panel appears on tablet and desktop viewports only, sits above the project organisation eyebrow, uses the DaaS SVG mark, and uses the Home Office Digital triangles SVG as a bottom-right background image.

## Run metadata

- Date: 2026-06-16
- Branch: `feature/daas-dashboard-brand-panel`
- Trace required: yes, because `feature/` branches require an auditable trace.
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

- `.agent-operating-model/bundles/cloudflare/`: no Worker runtime, deployment binding or Pages middleware behaviour changed.
- `.agent-operating-model/bundles/openai/`: no OpenAI API, model or AI route behaviour changed.
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP protocol or agent tooling changed.
- `.agent-operating-model/bundles/airtable-public-api/`: no Airtable API behaviour changed.
- `.agent-operating-model/bundles/mural-public-api/`: no Mural API behaviour changed.

## Precedence decisions

- GitHub Diamond governed the feature branch name, trace requirement, surgical mutation, changed-file review and validation evidence.
- ResearchOps Developer Control governed the project dashboard route, generated page output, generated CSS output and existing route-state test style.
- Multi-Functional Team governed public-sector product assurance and impact on DaaS users.
- GOV.UK Design System governed the Nunjucks and Sass-only implementation approach and preservation of the existing GOV.UK page structure.

## Files read

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.body.xml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.spec.yaml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.body.xml`
- `src/govuk/templates/pages/project-dashboard.njk`
- `public/js/project-dashboard.js`
- `src/styles/project-dashboard.scss`
- `tests/project-dashboard-route-state.test.js`
- `docs/agent-audit/reasoning/README.md`

## Files created or modified

- `public/images/brands/daas-logo.svg`
- `public/images/brands/home-office-digital-triangles.svg`
- `src/govuk/templates/pages/project-dashboard.njk`
- `public/js/project-dashboard.js`
- `src/styles/project-dashboard.scss`
- `public/css/project-dashboard.css`
- `public/pages/project-dashboard/index.html`
- `tests/project-dashboard-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/16/daas-dashboard-brand-panel.md`
- `docs/agent-audit/reasoning/2026/06/16/daas-dashboard-brand-panel.json`

## Decisions

- Added the DaaS panel to the Nunjucks dashboard template immediately above `#eyebrow-org`.
- Kept the panel hidden by default and revealed it from `project-dashboard.js` only when the loaded project team or organisation normalises to `daas`.
- Used Sass for the visual treatment: `#1a1d35` background, 1rem top and bottom margins, bottom-right Home Office Digital triangles background, and a tablet/desktop breakpoint of `40.0625em`.
- Kept mobile hidden by leaving the default `.rops-daas-brand-panel` display as `none` outside the breakpoint.
- Added cache-busting keys for the changed dashboard JavaScript and stylesheet.
- Added route-state coverage for the Nunjucks template, generated page, controller behaviour, Sass and generated CSS.

## Validation attempted

- `npm ci` completed in the clean worktree.
- `npm run build:project-dashboard` passed.
- `npm run build:govuk-pages` passed.
- `node tests/project-dashboard-route-state.test.js` passed.
- Browser verification against the local generated dashboard confirmed the panel exists, uses the updated asset keys, and remains hidden by default before project data loads.
- Browser verification against a local DaaS preview using the generated CSS confirmed desktop display as `flex`, background colour `rgb(26, 29, 53)`, 16px top and bottom margins, triangles background image, and placement above `#eyebrow-org`.
- Browser verification at 390px width confirmed the visible-state preview still computes to `display: none`.
- `npx prettier -c public/js/project-dashboard.js src/styles/project-dashboard.scss tests/project-dashboard-route-state.test.js docs/agent-audit/reasoning/2026/06/16/daas-dashboard-brand-panel.md docs/agent-audit/reasoning/2026/06/16/daas-dashboard-brand-panel.json` passed.
- `npm run trace:coverage` passed for `feature/daas-dashboard-brand-panel`.
- `git diff --check` passed.
- `npm run lint` passed with existing repository warnings.
- `npm test -- --ci` failed because the current test script passes `--ci` through to Node, which exits with `node: bad option: --ci`.
- `npm test` passed with 227 tests and 0 failures.

## Existing local changes

- The original checkout had an unrelated local edit in `infra/cloudflare/src/core/auth/passwordless.js`.
- This work was moved into a clean worktree at `ResearchOps-daas-dashboard-brand` to avoid mixing the DaaS dashboard feature with unrelated changes.

## Residual risks

- `npm run validate` was not run during this pass.
- Live DaaS project verification still depends on deployed project data loading the dashboard record as DaaS.
