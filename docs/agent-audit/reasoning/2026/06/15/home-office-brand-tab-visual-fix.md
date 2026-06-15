# Agent trace - Home Office brand tab visual fix

**Date:** 2026-06-15  
**Trace type:** operational audit trace  
**Branch:** `fix/home-office-brand-tabs`  
**Trace required:** yes, because the branch starts with `fix/`  
**Related work:** Home Office brand GOV.UK tab component visual repair

## Task

Fix the visual appearance of GOV.UK tabs when the Home Office brand variant is
enabled with `?brand=home-office`.

Requested behaviour:

- tabs that are not the current context use background colour `#d2bfd8`;
- the tab panel that holds tab content uses a white background;
- CSS is generated from SCSS;
- generated CSS is generated on Cloudflare and should not be included in the
  committed files for this unit of work.

## Branch Trace Decision

The current branch is `fix/home-office-brand-tabs`. Repository policy allows
`fix/` as a work-branch prefix and requires an auditable trace for
repository-affecting work on `fix/` branches. This trace is therefore required
even without the legacy `[reasoning]` token.

## Operating Model

Loaded repository operating-model sources:

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
- `.agent-operating-model/bundles/`

Selected bundle stack:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`

The first three bundles are always-load bundles. `govuk-design-system` applies
because this is a GOV.UK tab component visual/CSS change. `cloudflare` applies
because the user explicitly stated generated CSS is produced on Cloudflare and
should not be committed locally.

Skipped conditional bundles:

- `openai-platform` - no OpenAI API, model or eval implementation was in scope.
- `mcp-agent-tooling` - no MCP tool, resource, prompt or consent work was in scope.
- `airtable-public-api` - no Airtable API or data integration work was in scope.
- `mural-public-api` - no Mural API or collaboration integration work was in scope.

Precedence decisions:

- GitHub Diamond governed branch naming, trace coverage, surgical mutation and
  validation evidence.
- ResearchOps Developer Control governed repository conventions and the Sass
  source/generated CSS pipeline.
- Multi-Functional Team governed public-sector assurance and residual-risk
  framing.
- GOV.UK Design System governed tab component behaviour and accessibility-safe
  styling.
- Cloudflare context governed the explicit decision not to commit generated CSS
  for this task.

No bundle conflicts were identified. There is a repository convention tension:
generated CSS is normally a tracked output, but the user explicitly scoped this
task to SCSS-only commits because Cloudflare regenerates CSS. This is recorded as
a deliberate generated-output waiver for this unit of work.

## Implementation

Changed `src/styles/brands/home-office.scss` only for brand styling:

- added a Home Office brand rule for unselected `.govuk-tabs__list-item`
  elements and their non-focused `.govuk-tabs__tab` links to use `$ho-mid`,
  which is `#d2bfd8`;
- added a Home Office brand rule for `.govuk-tabs__panel` to use `$ho-white`,
  which is `#ffffff`.

Changed `tests/brand-variant-route-state.test.js` to assert the source-level
contract without requiring generated CSS to be committed.

Generated `public/css/brands/home-office.css` locally for validation and browser
inspection, then restored it before completion so it is not part of the commit.

After PR #398 was opened, Codex left one unresolved non-outdated review thread
against `src/styles/brands/home-office.scss`. The comment correctly identified
that the inactive tab background rule could override the yellow keyboard focus
background on focused tab links. The selector was narrowed to
`.govuk-tabs__tab:not(:focus)` so keyboard users retain the GOV.UK focus
affordance.

## Files

Read:

- `AGENTS.md`
- operating-model files listed above
- selected bundle prompt specs and bodies
- `src/styles/brands/home-office.scss`
- `tests/brand-variant-route-state.test.js`
- `tests/sass-migration-route-state.test.js`
- `scripts/styles/generated-css-targets.mjs`
- `scripts/styles/build-generated-css.mjs`
- `public/css/brands/home-office.css`
- GitHub review thread data for PR #398, fetched with `gh api graphql`
- GitHub review thread data for PR #398, fetched with
  `gh-address-comments/scripts/fetch_comments.py`

Created:

- `docs/agent-audit/reasoning/2026/06/15/home-office-brand-tab-visual-fix.md`
- `docs/agent-audit/reasoning/2026/06/15/home-office-brand-tab-visual-fix.json`

Modified:

- `src/styles/brands/home-office.scss`
- `tests/brand-variant-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/15/home-office-brand-tab-visual-fix.md`
- `docs/agent-audit/reasoning/2026/06/15/home-office-brand-tab-visual-fix.json`

Generated for validation only, then restored:

- `public/css/brands/home-office.css`

## Sub-Agent Coordination

- Boyle inspected link/CI implications and identified the generated-CSS contract
  risk of changing SCSS without committing generated CSS.
- Descartes inspected trace/documentation requirements and identified the need
  to record the generated-CSS waiver explicitly.
- Maxwell confirmed the new branch was based on current `origin/main`.
- Ptolemy identified relevant validation commands for a SCSS-only visual fix.
- Gauss continued trace/readiness monitoring for the `fix/` branch.

## Validation

Attempted:

- `node --test tests/brand-variant-route-state.test.js tests/sass-migration-route-state.test.js` - passed.
- `npm run build:generated-css -- public/css/brands/home-office.css` - passed and generated local CSS for inspection.
- `rg` inspection of generated `public/css/brands/home-office.css` - passed:
  generated output contains the `.govuk-tabs__tab:not(:focus)` background
  selector and the tab panel background rule.
- `node -e` JSON parse check for the trace file - passed.
- `npx prettier -c` for the changed SCSS, test and trace files - passed.
- `npm run trace:coverage` - passed.
- Local browser verification against
  `http://127.0.0.1:4173/pages/projects/journals/?brand=home-office` - passed:
  inactive tab backgrounds computed as `rgb(210, 191, 216)` and the tab panel
  background computed as `rgb(255, 255, 255)`.

Not run:

- Full repository validation suite, because the change is a narrow SCSS visual
  fix with a targeted source-level test and browser verification.
- Generated CSS clean check, because this task deliberately excludes generated
  CSS from the committed file set.
- Follow-up local Playwright focus verification after the Codex comment,
  because the Node runtime did not have the required Playwright browser binary
  installed. The focus conflict was instead validated by narrowing the generated
  selector to `.govuk-tabs__tab:not(:focus)`, which means it cannot match a
  focused tab link and therefore cannot override GOV.UK focus styling.

## Residual Risk

The repository usually treats generated CSS as a tracked artefact. This task
deliberately leaves generated CSS out of the commit because the user stated that
Cloudflare generates CSS and generated CSS should not be included. If a future
pipeline checks generated CSS cleanliness before Cloudflare regeneration, that
pipeline may need to be adjusted or the generated CSS committed in a separate
unit of work.
