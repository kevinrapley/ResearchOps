# Journals GOV.UK template shell trace

## Run metadata

- Date: 2026-05-27
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/journals-govuk-template-shell`
- Pull request: #292
- Trace requirement: required by `fix/` branch policy
- Trace layer: operational

## Original task summary

Migrate the first part of `pages/projects/journals/?id=<recordID>` to the GOV.UK Frontend rendering approach by adding a Nunjucks page template that uses the shared ResearchOps layout and its `x-include` header and footer. The main page content approach is intentionally left for later review.

The breadcrumb was then changed to use the GOV.UK breadcrumbs macro. The second breadcrumb item starts as `Project Dashboard` and is hydrated to the project name at runtime when the project record id is present in the query string.

A screenshot review then identified two outstanding issues: the committed static page was still serving the old shell, and the journal refresh message was appearing above the breadcrumb rather than after the lead paragraph.

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

## Canonical bundle directories selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`

## Bundles skipped

- `.agent-operating-model/bundles/cloudflare/` — no Worker, routing, binding or deployment behaviour changed.
- `.agent-operating-model/bundles/mural-public-api/` — no Mural API contract changed.
- `.agent-operating-model/bundles/airtable-public-api/` — no Airtable record or schema behaviour changed.
- `.agent-operating-model/bundles/openai/` — no OpenAI behaviour changed.
- `.agent-operating-model/bundles/mcp-agent-tooling/` — no MCP behaviour changed.

## Precedence decisions

- GitHub Diamond governs branch, trace and pull request hygiene.
- ResearchOps Developer Control governs repository template and rendering conventions.
- GOV.UK Design System governs the page shell, breadcrumbs, shared header and shared footer approach.
- The GitHub mutation policy applies because repository files were changed through connector tooling.

## Files read

- `src/govuk/templates/layouts/researchops.njk`
- `src/govuk/templates/pages/projects-journals.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `public/pages/projects/journals/index.html`
- `public/js/project-context.js`
- `public/js/journal-tabs.js`
- `tests/journals-route-state.test.js`
- `tests/govuk-breadcrumb-back-link-route-state.test.js`
- `tests/govuk-forms-application-route-state.test.js`
- `package.json`

## Files created or modified

Created:

- `src/govuk/templates/pages/projects-journals.njk`
- `docs/agent-audit/reasoning/2026/05/27/journals-govuk-template-shell.md`
- `docs/agent-audit/reasoning/2026/05/27/journals-govuk-template-shell.json`

Modified:

- `scripts/govuk/render-govuk-pages.mjs`
- `public/pages/projects/journals/index.html`
- `public/js/project-context.js`
- `tests/journals-route-state.test.js`
- `tests/govuk-breadcrumb-back-link-route-state.test.js`
- `tests/govuk-forms-application-route-state.test.js`
- `docs/agent-audit/reasoning/2026/05/27/journals-govuk-template-shell.md`
- `docs/agent-audit/reasoning/2026/05/27/journals-govuk-template-shell.json`

## Implementation decisions

- Added `src/govuk/templates/pages/projects-journals.njk` and made it extend `layouts/researchops.njk`.
- Relied on the existing layout for the shared `x-include` header and footer rather than placing those includes directly in the page template.
- Replaced the hand-authored breadcrumb markup with the GOV.UK `govukBreadcrumbs` macro.
- Used the requested breadcrumb item shape: `Projects`, `Project Dashboard`, `Journal and analysis`.
- Committed the rendered `public/pages/projects/journals/index.html` so static preview deployments no longer serve the old standalone shell.
- Updated `project-context.js` so the macro-rendered `/pages/project-dashboard/` breadcrumb link receives the record id immediately and is hydrated to the project name when the project resolves.
- Made `project-context.js` unwrap project API responses shaped as `{ project: ... }` or `{ record: ... }`.
- Moved journal flash messages into the GOV.UK content container immediately after `.journal-header`, which places `Could not refresh journal entries.` after the lead paragraph.
- Preserved the existing journals tab, form and panel structure so the main content design can be reviewed separately.
- Updated route-state tests to enforce the new shell, breadcrumb, feedback placement and forms stylesheet contracts.

## Validation attempted

- Compared `fix/journals-govuk-template-shell` against `main`.
- Confirmed the changed-file list matched the GOV.UK renderer, journals Nunjucks template, rendered static page, project context hydration, route-state tests and trace files.
- Investigated and corrected CI failures caused by older tests expecting legacy journals breadcrumb and legacy forms stylesheet contracts.

## Validation results

On commit `52057b4d424bca4f1d909fafcb3e35513e1f4caa`, these GitHub Actions passed:

- Format pull request
- CI
- qa-bdd
- Accessibility audit (pa11y-ci)
- QA — Broken links (Lychee)
- Validate ResearchOps
- Release Gate
- Worker CI

## Validation not run

No local npm, browser or template-render validation was run through the connector path. GitHub Actions were used as the validation source.

## Issues, pivots and residual risks

- The existing main content remains structurally close to the previous journals page by design. This avoids expanding the scope before reviewing the GOV.UK Frontend approach for the content itself.
- The macro-rendered breadcrumb link starts as `Project Dashboard`; runtime hydration changes it to the actual project name when the project id can be resolved.
