# GOV.UK Brand Tag Colours Trace

## Run metadata

- Date: 2026-06-24
- Branch: `fix/govuk-brand-tag-colours`
- Trace trigger: required by `fix/` branch prefix
- Task summary: stop the Home Office brand variant making GOV.UK tags use the Home Office light purple colour, so tags use the same colours as the GOV.UK brand, then use small text for every Home Office-branded GOV.UK tag.

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

Skipped bundles:

- `cloudflare`: no Worker, Pages routing or deployment change.
- `openai-platform`: no OpenAI API or AI model change.
- `mcp-agent-tooling`: no MCP protocol or agent tooling change.
- `airtable-public-api`: no Airtable API change.
- `mural-public-api`: no Mural API change.

Precedence applied:

- GitHub Diamond governed branch, trace and PR discipline.
- ResearchOps Developer Control governed repository conventions and generated CSS parity.
- GOV.UK Design System governed the tag component colour contract.

## Files read

- `README.md`
- `.github/CODEOWNERS`
- `RECENT_LEARNINGS.md`
- `package.json`
- `src/styles/brands/home-office.scss`
- `public/css/brands/home-office.css`
- `tests/brand-variant-route-state.test.js`
- `scripts/styles/build-generated-css.mjs`
- `scripts/styles/format-generated-css.mjs`
- `scripts/styles/generated-css-targets.mjs`

## Files changed

- `src/styles/brands/home-office.scss`
- `public/css/brands/home-office.css`
- `tests/brand-variant-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/24/govuk-brand-tag-colours.md`
- `docs/agent-audit/reasoning/2026/06/24/govuk-brand-tag-colours.json`

## Implementation summary

- Removed the Home Office brand variables that defined a light purple GOV.UK tag colour.
- Removed the Home Office brand override for `.govuk-tag` and `.govuk-phase-banner__content__tag`.
- Removed the dependent Home Office phase-banner `.govuk-tag` text-colour override.
- Added a typography-only Home Office brand `.govuk-tag` rule for small tag text.
- Regenerated only `public/css/brands/home-office.css`.
- Updated the brand route-state test to assert that Home Office brand CSS no longer owns GOV.UK tag colours and does set small tag typography.

## Validation

Passed:

- `node --test tests/brand-variant-route-state.test.js`
- `node scripts/styles/format-generated-css.mjs --check public/css/brands/home-office.css`
- `npx prettier -c src/styles/brands/home-office.scss tests/brand-variant-route-state.test.js`
- `npm run trace:coverage`

Not run:

- Full `npm test -- --ci`: not run because the worktree already contained many unrelated uncommitted changes outside this task.
- Full `npm run validate`: not run for the same reason.

## Issues and residual risks

- The worktree had substantial pre-existing uncommitted changes on `main` before this branch was created. This trace records only the tag-colour fix; unrelated files should not be included in this task commit.
- Visual browser verification was not run; the route-state and CSS contract checks verify the cascade ownership change.
