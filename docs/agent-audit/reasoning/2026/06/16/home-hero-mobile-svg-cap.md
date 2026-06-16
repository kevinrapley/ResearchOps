# Home hero mobile SVG cap

## Task summary

Address a Codex review finding after the home hero column-width change: prevent the decorative SVG from expanding to the full stacked mobile column while preserving the desktop 45% image-column fill.

## Run metadata

- Date: 2026-06-16
- Branch: `fix/home-hero-mobile-svg`
- Trace required: yes, because `fix/` branches require an auditable trace.
- Repository: `kevinrapley/ResearchOps`

## Operating model loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/github-mutation-policy.md`

## Bundles selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`

## Bundles skipped

- `.agent-operating-model/bundles/cloudflare/`: no Cloudflare runtime or deployment behaviour changed.
- `.agent-operating-model/bundles/openai/`: no OpenAI API, model or AI route behaviour changed.
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP protocol or agent tooling changed.
- `.agent-operating-model/bundles/airtable-public-api/`: no Airtable API behaviour changed.
- `.agent-operating-model/bundles/mural-public-api/`: no Mural API behaviour changed.

## Precedence decisions

- GitHub Diamond governed branch naming, trace requirement, automated review-comment disposition and validation evidence.
- ResearchOps Developer Control governed source-first Sass edits and generated CSS outputs.
- Multi-Functional Team governed public-sector service usability and avoiding unnecessary masthead height on mobile.
- GOV.UK Design System governed preserving the stacked mobile grid and desktop breakpoint behaviour.

## Files read

- `src/styles/researchops-home.scss`
- `tests/researchops-home-hero-layout-route-state.test.js`
- `assets/researchops/researchops-home.css`
- `public/assets/researchops/researchops-home.css`

## Files created or modified

- `src/styles/researchops-home.scss`
- `assets/researchops/researchops-home.css`
- `public/assets/researchops/researchops-home.css`
- `tests/researchops-home-hero-layout-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/16/home-hero-mobile-svg-cap.md`
- `docs/agent-audit/reasoning/2026/06/16/home-hero-mobile-svg-cap.json`

## Decisions

- Treat the Codex review comment as legitimate.
- Set the mobile/default SVG width to `320px` with `max-width: 100%`, so the image respects the intended intrinsic width while still fitting narrower screens.
- Keep `width: 100%` only inside the desktop media query so the SVG fills the 45% desktop image column.
- Update the route-state test to assert separate mobile/default and desktop image-width contracts.

## Validation attempted

- `node --test tests/researchops-home-hero-layout-route-state.test.js tests/deploy-asset-paths.test.js` passed.
- `npx prettier -c src/styles/researchops-home.scss tests/researchops-home-hero-layout-route-state.test.js public/assets/researchops/researchops-home.css assets/researchops/researchops-home.css` passed.
- Browser measurements passed: 360px and 640px viewports kept the SVG at `320px`; 1280px viewport kept text at `55%`, image column at `45%`, and SVG filling that column.
- `npm test -- --test-reporter=spec` passed with 227 tests.

## Existing local changes

- `infra/cloudflare/src/core/auth/passwordless.js` existed as an unrelated local edit before this task and was temporarily stashed while creating the clean fix branch.

## Residual risks

- `npm run validate` was not run during this pass.
