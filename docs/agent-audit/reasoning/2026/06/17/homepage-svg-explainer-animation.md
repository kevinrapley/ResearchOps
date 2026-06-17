# Homepage SVG Explainer Animation

## Run metadata

- Date: 2026-06-17
- Branch: `feature/homepage-svg-explainer-animation`
- Trace decision: required because branch prefix is `feature/`
- Task summary: Replace the homepage masthead static illustration/video experiment with an inline SVG animation controlled by a bespoke play/pause button and the supplied voiceover audio.

## Operating model files loaded

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

- `github-diamond`: `.agent-operating-model/bundles/github/`
- `researchops-developer-control`: `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team`: `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system`: `.agent-operating-model/bundles/govuk-design-system/`

## Bundles skipped

- `cloudflare`: no runtime, Worker, deployment or binding change.
- `openai-platform`: no OpenAI API or model integration change.
- `mcp-agent-tooling`: no MCP protocol or tool contract change.
- `airtable-public-api`: no Airtable API change.
- `mural-public-api`: no Mural API change.

## Precedence decisions

- GitHub Diamond governed branch prefix, PR hygiene, trace requirement and changed-file scope.
- ResearchOps Developer Control governed homepage source/template and generated asset conventions.
- Multi-Functional Team governed public-sector product assurance defaults.
- GOV.UK Design System governed frontend accessibility, keyboard-operable control and reduced-motion handling.

## Files read

- `public/images/home-masthead-researchops-illustration.svg`
- `src/govuk/templates/pages/home.njk`
- `src/styles/researchops-home.scss`
- `public/index.html`
- `public/assets/researchops/researchops-home.css`
- `package.json`

## Files created or modified

- `public/audio/researchops-explainer.m4a`
- `public/js/researchops-explainer-animation.js`
- `src/govuk/templates/pages/home.njk`
- `src/styles/researchops-home.scss`
- `public/index.html`
- `public/assets/researchops/researchops-home.css`
- `tests/researchops-home-hero-layout-route-state.test.js`
- `tests/reports-site-validation.test.js`
- `docs/agent-audit/reasoning/2026/06/17/homepage-svg-explainer-animation.md`
- `docs/agent-audit/reasoning/2026/06/17/homepage-svg-explainer-animation.json`

## Implementation summary

- Replaced the homepage masthead image slot with a self-contained SVG/audio explainer component.
- Injected the existing SVG inline at its original `0 0 1700 950` viewBox so graphical assets keep their intended proportions.
- Added a bespoke play/pause button instead of native video controls.
- Added voiceover playback from `public/audio/researchops-explainer.m4a`.
- Added JavaScript-driven SVG movement tied to the audio play state.
- Added timed emphasis cues that scale selected SVG groups and bring the active group to the front without shadows.
- Ensured the play button returns to the laptop-screen position after the narrative ends.
- Addressed Codex PR review feedback by updating the stale homepage route-state assertions, suppressing the SVG motion loop for reduced-motion users, and adding the user-supplied text alternative for the audio explainer.
- Addressed failing PR checks by updating the reports-site validation test to match the current committed reporting-site artefacts: 45 pages, 63 states and 126 captures/screenshots.

## Validation

- `npm run build:researchops`: passed.
- `npm run build:govuk-pages`: passed.
- `npx eslint public/js/researchops-explainer-animation.js`: passed.
- `npx eslint public/js/researchops-explainer-animation.js tests/researchops-home-hero-layout-route-state.test.js`: passed.
- `node tests/researchops-home-hero-layout-route-state.test.js`: passed.
- `node tests/reports-site-validation.test.js`: passed.
- `npm test`: passed.
- `npm run validate`: passed.
- `npm run audit:security`: passed; advisory development-tooling vulnerabilities remain non-blocking under the repository policy.
- `npm run trace:coverage`: passed.
- Local browser verification at `http://127.0.0.1:4173/`: SVG injected, no native video element, 10 SVG groups recognised, audio duration loaded as approximately 77.33 seconds.
- Local browser verification after PR review fixes at `http://127.0.0.1:4173/`: SVG injected, no native video element, audio source wired to `/audio/researchops-explainer.m4a`, and the text alternative appears on the page.

## Validation not run

- Full repository test suite was not run because this is a focused static homepage/UI asset change and the relevant generated CSS, page render and script lint checks were run.

## Issues, pivots and residual risk

- An earlier WebM/native-video approach was discarded because it used native controls and did not meet the desired SVG-animation interaction.
- CSS animation rules originally conflicted with JavaScript transform scaling; those rules were removed so JavaScript-driven emphasis controls the SVG groups.
- There is a pre-existing unrelated modified file, `infra/cloudflare/src/core/auth/passwordless.js`, which is intentionally excluded from this PR.
