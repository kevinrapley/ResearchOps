# LEDS Brand Panel Feature Trace

## Run metadata

- Date: 2026-06-24
- Branch: `feature/leds-brand-panel`
- Trace trigger: required by `feature/` branch prefix
- Task summary: move the LEDS-only brand-panel changes out of the merged tag-colour PR branch and onto their own branch from updated `main`; follow up by overlaying the Home Office digital triangles asset on the LEDS brand panel `::after` layer, tune that overlay with soft-light blending, brightness filtering and adjusted positioning, then address a valid Codex review comment by bumping cache-busting query strings for changed CSS and JavaScript assets.

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

## Bundle selection

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`

Skipped bundles:

- `openai-platform`: no OpenAI API or model change.
- `mcp-agent-tooling`: no MCP protocol or agent tooling change.
- `airtable-public-api`: no Airtable API change.
- `mural-public-api`: no Mural API change.

Precedence applied:

- GitHub Diamond governed branch selection, trace and PR discipline.
- ResearchOps Developer Control governed generated CSS and rendered page parity.
- GOV.UK Design System governed the frontend component and accessibility context.
- Cloudflare governed the static asset caching context for `public/_headers`.

## Branch and worktree handling

- Preserved the dirty `fix/govuk-brand-tag-colours` worktree in `stash@{1}` with message `codex preserve worktree before leds branch`.
- Preserved leftover local sandbox runtime state in `stash@{0}` with message `codex preserve local sandbox runtime state`.
- Fast-forwarded local `main` to `origin/main` after PR #430 had merged.
- Created `feature/leds-brand-panel` from the updated `main`.
- Restored only the LEDS brand-panel paths from the preserved stash.
- Deliberately excluded local sandbox infrastructure, local sandbox seed files, auth-header changes and hostname brand-variant changes from this branch.

## Files read

- `AGENTS.md`
- `README.md`
- `.github/CODEOWNERS`
- `RECENT_LEARNINGS.md`
- `package.json`
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
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.body.xml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.body.xml`
- `.agent-operating-model/bundles/cloudflare/prompt.body.xml`
- `scripts/validate.sh`
- `public/_headers`
- `src/govuk/templates/macros/daas-brand-panel.njk`
- `src/govuk/templates/pages/project-dashboard.njk`
- `src/govuk/templates/pages/project-dashboard-participants.njk`
- `src/govuk/templates/pages/projects-journals.njk`
- `src/govuk/templates/pages/projects-outcomes.njk`
- `src/govuk/templates/pages/study.njk`
- `src/govuk/templates/pages/study-new.njk`
- `src/govuk/templates/pages/study-consent-forms.njk`
- `src/govuk/templates/pages/study-guides.njk`
- `src/govuk/templates/pages/study-note-takers-observers.njk`
- `src/govuk/templates/pages/study-participant-consent.njk`
- `src/govuk/templates/pages/study-participants.njk`
- `src/govuk/templates/pages/study-synthesis.njk`
- `src/styles/daas-brand-panel.scss`
- `src/styles/project-dashboard.scss`
- `public/js/daas-brand-panel.js`
- `public/js/project-dashboard.js`
- `tests/daas-brand-panel-route-state.test.js`
- `tests/project-dashboard-route-state.test.js`

## Files changed

- `src/govuk/templates/macros/daas-brand-panel.njk`
- `src/govuk/templates/pages/project-dashboard.njk`
- `src/govuk/templates/pages/project-dashboard-participants.njk`
- `src/govuk/templates/pages/projects-journals.njk`
- `src/govuk/templates/pages/projects-outcomes.njk`
- `src/govuk/templates/pages/study.njk`
- `src/govuk/templates/pages/study-new.njk`
- `src/govuk/templates/pages/study-consent-forms.njk`
- `src/govuk/templates/pages/study-guides.njk`
- `src/govuk/templates/pages/study-note-takers-observers.njk`
- `src/govuk/templates/pages/study-participant-consent.njk`
- `src/govuk/templates/pages/study-participants.njk`
- `src/govuk/templates/pages/study-synthesis.njk`
- `src/styles/daas-brand-panel.scss`
- `src/styles/project-dashboard.scss`
- `public/css/daas-brand-panel.css`
- `public/css/project-dashboard.css`
- `public/js/daas-brand-panel.js`
- `public/js/project-dashboard.js`
- `public/images/brands/leds-logo.svg`
- `public/images/brands/leds-logo-white.svg`
- `public/images/brands/leds-panel-background.png`
- `public/pages/project-dashboard/index.html`
- `public/pages/project-dashboard/participants/index.html`
- `public/pages/projects/journals/index.html`
- `public/pages/projects/outcomes/index.html`
- `public/pages/study/consent-forms/index.html`
- `public/pages/study/guides/index.html`
- `public/pages/study/index.html`
- `public/pages/study/new/index.html`
- `public/pages/study/note-takers-observers/index.html`
- `public/pages/study/participant-consent/index.html`
- `public/pages/study/participants/index.html`
- `public/pages/study/synthesis/index.html`
- `tests/daas-brand-panel-route-state.test.js`
- `tests/project-dashboard-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/24/leds-brand-panel-feature.md`
- `docs/agent-audit/reasoning/2026/06/24/leds-brand-panel-feature.json`

## Implementation summary

- Added a hidden LEDS brand panel beside the existing DaaS panel in the shared macro.
- Added LEDS panel styling to the shared DaaS panel stylesheet and project dashboard stylesheet.
- Set `.rops-leds-brand-panel--visible` to `background-color: #1a1d35`.
- Added the screened LEDS panel image layer and white LEDS logo to the panel.
- Added the Home Office digital triangles asset to the LEDS `::after` overlay using the same background position, repeat and size as DaaS.
- Tuned the LEDS `::after` overlay with `background-blend-mode: soft-light`, `backdrop-filter: brightness(0.65)` and `background-position: right -2.5rem bottom -5.75rem`.
- Extended the shared brand-panel controller and project-dashboard controller so LEDS projects show the LEDS panel while DaaS projects retain the DaaS panel.
- Rebuilt generated CSS and rendered GOV.UK pages.
- Updated route-state tests to cover LEDS macro output, rendered page output, controller hooks and stylesheet contracts.
- Added route-state assertions that inspect the LEDS `::after` declaration so the triangle overlay remains tied to the LEDS panel.
- Bumped shared brand-panel CSS and JavaScript query strings from `20260616` to `leds-brand-panel-20260624` in source templates and rendered pages.
- Bumped project dashboard CSS and JavaScript query strings to `project-dashboard-leds-brand-panel-20260624`.
- Added a `+1` reaction to the valid Codex review comment at `public/js/daas-brand-panel.js:98` before remediation.

## Validation

Passed:

- `node scripts/styles/build-generated-css.mjs public/css/daas-brand-panel.css`
- `node scripts/styles/build-generated-css.mjs public/css/project-dashboard.css`
- `npm run build:govuk-pages`
- `node --test tests/daas-brand-panel-route-state.test.js tests/project-dashboard-route-state.test.js`
- `node scripts/styles/format-generated-css.mjs --check public/css/daas-brand-panel.css public/css/project-dashboard.css`
- `npx prettier -c src/styles/daas-brand-panel.scss src/styles/project-dashboard.scss public/js/daas-brand-panel.js public/js/project-dashboard.js tests/daas-brand-panel-route-state.test.js tests/project-dashboard-route-state.test.js public/images/brands/leds-logo.svg public/images/brands/leds-logo-white.svg`
- `git diff --check`
- `npm test`
- `node -e "JSON.parse(require('fs').readFileSync('docs/agent-audit/reasoning/2026/06/24/leds-brand-panel-feature.json', 'utf8'))"`
- `npm run trace:coverage`
- `npm run format:check`
- `npm run generated-css:check`
- `npm run lint` (passed with existing repository warnings)
- `npm run validate`
- `node --test tests/daas-brand-panel-route-state.test.js tests/project-dashboard-route-state.test.js` (follow-up triangle overlay check)
- `git diff --check` (follow-up triangle overlay check)
- `npm run format:check` (follow-up triangle overlay check)
- `npm run generated-css:check` (follow-up triangle overlay check)
- `npm run trace:coverage` (follow-up triangle overlay check)
- `node -e "JSON.parse(require('fs').readFileSync('docs/agent-audit/reasoning/2026/06/24/leds-brand-panel-feature.json', 'utf8'))"` (follow-up triangle overlay check)
- `node scripts/styles/build-generated-css.mjs public/css/daas-brand-panel.css` (follow-up overlay tuning check)
- `node scripts/styles/build-generated-css.mjs public/css/project-dashboard.css` (follow-up overlay tuning check)
- `node --test tests/daas-brand-panel-route-state.test.js tests/project-dashboard-route-state.test.js` (follow-up overlay tuning check)
- `npm run generated-css:check` (follow-up overlay tuning check)
- `git diff --check` (follow-up overlay tuning check)
- `npm run format:check` (follow-up overlay tuning check)
- `npm run trace:coverage` (follow-up overlay tuning check)
- `node -e "JSON.parse(require('fs').readFileSync('docs/agent-audit/reasoning/2026/06/24/leds-brand-panel-feature.json', 'utf8'))"` (follow-up overlay tuning check)
- `gh api graphql -F owner='kevinrapley' -F repo='ResearchOps' -F number=431 ...` (review-thread state check)
- `gh api repos/kevinrapley/ResearchOps/pulls/comments/3470569357/reactions --method POST ...` (valid review comment acknowledged)
- `npm run build:govuk-pages` (cache-bust follow-up check)
- `rg -n "daas-brand-panel\.(css|js)\?v=20260616|project-dashboard\.(css|js)\?v=project-dashboard-description-edit-20260624" . -g '!node_modules' -g '!vendor'` (cache-bust follow-up check; no matches)
- `node --test tests/daas-brand-panel-route-state.test.js tests/project-dashboard-route-state.test.js` (cache-bust follow-up check)
- `npm run generated-css:check` (cache-bust follow-up check)
- `git diff --check` (cache-bust follow-up check)
- `node -e "JSON.parse(require('fs').readFileSync('docs/agent-audit/reasoning/2026/06/24/leds-brand-panel-feature.json', 'utf8'))"` (cache-bust follow-up check)
- `npm run format:check` (cache-bust follow-up check)
- `npm run trace:coverage` (cache-bust follow-up check)
- `if rg -n "daas-brand-panel\.(css|js)\?v=20260616|project-dashboard\.(css|js)\?v=project-dashboard-description-edit-20260624" . -g '!node_modules' -g '!vendor'; then exit 1; else exit 0; fi` (cache-bust follow-up check)

Failed then replaced:

- `npm test -- --ci`: Node rejected `--ci` as an invalid option for the repository's current `node --test` script.
- `npx prettier -c ... src/govuk/templates/macros/daas-brand-panel.njk ...`: Prettier could not infer a parser for `.njk`; Nunjucks output was instead validated through page rendering and route-state tests.
- First `npm run lint` attempt: failed after `build:generated-css` rewrote generated CSS and `generated-css:check` found drift; rerunning after `npm run validate` produced a passing lint run with existing repository warnings.

## Issues and residual risks

- Local sandbox LEDS seed work remains preserved in the stash and was intentionally excluded from this branch to keep the PR scoped to the visible LEDS brand-panel feature.
- Manual browser verification was not run; automated route-state checks verify the rendered HTML and controller/style contracts.
