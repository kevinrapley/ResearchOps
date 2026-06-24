# Trace - edit project objectives as Markdown

- Date: 2026-06-24
- Branch: `feature/edit-project-objectives-markdown`
- Trace decision: required because this is repository-affecting work on a `feature/` branch.
- Task: make `/pages/project-dashboard/` project objectives editable in place as Markdown, saving changed Markdown automatically on textarea blur.

## Operating Model

Loaded:

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

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`

Skipped conditional bundles:

- `cloudflare`: the existing Worker PATCH route already accepts `objectives`; no Worker runtime, binding or deployment behaviour was changed.
- `openai-platform`: no OpenAI API or model behaviour was changed.
- `mcp-agent-tooling`: no MCP or agent-tool contract behaviour was changed.
- `airtable-public-api`: no Airtable API contract was changed; the existing project patch contract is reused.
- `mural-public-api`: no Mural integration behaviour was changed.

Precedence applied:

- GitHub Diamond governed branch naming, trace creation, validation, commit, push and PR creation.
- ResearchOps Developer Control governed repository layers, generated static page parity and route-state tests.
- Multi-Functional Team governed public-sector product assurance and avoiding unnecessary scope.
- GOV.UK Design System governed textarea, keyboard access and focus-state handling.

## Files Read

- `README.md`
- `.github/CODEOWNERS`
- `.github/pull_request_template.md`
- `package.json`
- `package-lock.json`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.body.xml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.spec.yaml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/core-rules.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/researchops-repository-conventions.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/quality-gates.xml`
- `.agent-operating-model/bundles/govuk-design-system/references/govuk-form-affordance-reference.xml`
- `.agent-operating-model/bundles/govuk-design-system/roles/accessibility-specialist.xml`
- `public/pages/project-dashboard/index.html`
- `src/govuk/templates/pages/project-dashboard.njk`
- `public/js/project-dashboard.js`
- `src/styles/project-dashboard.scss`
- `public/css/project-dashboard.css`
- `tests/project-dashboard-route-state.test.js`
- `infra/cloudflare/src/service/projects.js`
- `infra/cloudflare/src/service/projects/normalisation.js`

## Diagnosis

- The dashboard already rendered objective Markdown-like lines as numbered objectives with nested bullet lists.
- The browser-side project save helper already sends PATCH requests to `/api/projects/:id`.
- The Worker project PATCH route already accepts `objectives` and stores normalised objective lines.
- The missing behavior was local interaction: rendered objectives were not editable and there was no inline textarea blur-save path.

## Changes

- Added objective Markdown grouping so each rendered top-level objective retains its source Markdown lines.
- Rendered each objective as a keyboard-accessible edit target with a visible GOV.UK focus state.
- Added inline textarea editing for an objective; unchanged blur restores the rendered view, changed blur PATCHes the updated `objectives` payload and re-renders from the saved Markdown.
- Added an accessible hidden label and polite status region for the inline editor.
- Follow-up correction: hid the parent ordered-list marker while a list item is in edit mode so the Markdown `1.` appears only inside the textarea.
- Bumped the project dashboard JS and CSS asset version to `project-dashboard-objective-edit-20260624`.
- Regenerated `public/css/project-dashboard.css` and `public/pages/project-dashboard/index.html`.
- Updated route-state tests for the inline edit contract, blur-save path, keyboard activation, focus styling and cache-busted assets.

## Validation

- `npm run agent:model -- "Make project-dashboard project objectives editable in-place as markdown textarea saving on blur"`: passed; always-load bundles selected. GOV.UK Design System was manually selected from the conditional UI/content rule because the task changes an interactive page.
- `npm run build:project-dashboard`: passed.
- `npm run build:govuk-pages`: passed.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/project-dashboard-route-state.test.js`: passed, 1 test.
- `npm run format:check`: passed.
- `npm run lint`: passed with existing repository warnings and no errors.
- `npm test -- --ci`: failed because the repository script passes `--ci` through to `node --test`, which reports `node: bad option: --ci`.
- `npm test`: passed, 245 tests.
- Local Playwright preview check against `http://127.0.0.1:4173/pages/project-dashboard/?id=test-project-1`: passed for desktop click-to-edit and blur-save, visible focus state, mobile keyboard edit and blur-save, and no mobile horizontal overflow.
- Follow-up local Playwright preview check: passed for desktop and mobile edit mode with the `<li>` marker hidden and the Markdown `1.` retained inside the textarea.
- `git diff --check`: passed.

## Residual Risk

- Live deployment verification was not run because this branch has not yet been merged or deployed.
