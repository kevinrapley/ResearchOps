# Agent trace — Outcomes form layout and cancel-edit fix

**Date:** 2026-06-03  
**Branch:** `fix/outcomes-form-layout-and-cancel-edit`  
**Trace type:** operational audit trace  
**Task:** Fix outcomes page form interaction and layout defects reported from the deployed Pages UI.

## Evidence boundary

This trace records observable repository files, tool actions, implementation decisions, validation status and residual risk. It does not expose private chain-of-thought.

## Operating model loaded

Loaded files:

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
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.body.xml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.spec.yaml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/references/govuk-form-affordance-reference.xml`
- `docs/design-system/govuk-form-migration.md`

Selected bundles:

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`
- `govuk-design-system`

Skipped bundles:

- `cloudflare`
- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

Cloudflare was not selected because this work changes browser UI layout, form behaviour, source SCSS and route-state tests only. It does not change Worker runtime, deployment routing, bindings, D1, KV or Wrangler configuration.

## User-reported defects

The user supplied screenshots and reported:

1. The Copy reference button did not line up with the impact reference input.
2. The copied-reference message appeared beside the button and forced the button onto a second line.
3. The sticky right-hand help panel did not stick in the correct location when inputs received focus.
4. The Cancel edit button did not do anything.

## Files inspected

- `src/styles/outcomes.scss`
- `public/css/outcomes.css`
- `public/js/outcomes-page.js`
- `public/components/impact-tracker.js`
- `src/govuk/templates/pages/projects-outcomes.njk`
- `tests/outcomes-page-route-state.test.js`

## Implementation decisions

### Reference row layout

The reference input and Copy reference button are now arranged into a dedicated `impact-reference-row`. The copy-status element is moved into the containing `impact-reference-field` below the row so the success message no longer competes with the button for horizontal space.

### Sticky help panel

The outcomes controller no longer writes inline `top: 96px` styles onto the panel. Sticky positioning now belongs to the outcomes SCSS. The panel receives `outcomes-guidance-panel--sticky`; SCSS controls `position: sticky`, `top: 24px`, `align-self: start` and viewport-constrained max height.

### Cancel edit behaviour

`impact-tracker.js` now has explicit cancel-edit state handling through `setCancelEditVisible()` and `cancelEdit()`. The reset path clears the editing record id, copy status, submit button text and date fields, and re-hides Cancel edit using both the DOM property and `hidden` attribute.

The outcomes controller also has a defensive `cancelImpactEdit()` handler so the button remains safe if the tracker script does not initialise due to missing project context.

### Hidden button guard

The outcomes SCSS now contains `.outcomes-form [hidden] { display: none !important; }` so GOV.UK button styling cannot make a hidden edit action visible.

## Files modified

- `src/styles/outcomes.scss`
- `public/js/outcomes-page.js`
- `public/components/impact-tracker.js`
- `tests/outcomes-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/03/outcomes-form-layout-and-cancel-edit-fix.md`
- `docs/agent-audit/reasoning/2026/06/03/outcomes-form-layout-and-cancel-edit-fix.json`

The generated `public/css/outcomes.css` file is intentionally not edited directly. The PR formatter workflow should build generated CSS from `src/styles/outcomes.scss` and commit the generated stylesheet if needed.

## Validation status

Local validation was not run in this connector-only session.

Connector verification completed:

- Confirmed `src/styles/outcomes.scss` contains the new reference field, reference row, sticky panel and hidden-action rules.
- Confirmed `public/js/outcomes-page.js` moves the copied-reference status below the input/button row and no longer writes `panel.style.top = '96px'`.
- Confirmed `public/js/outcomes-page.js` includes defensive `cancelImpactEdit()` handling.
- Confirmed `public/components/impact-tracker.js` includes `setCancelEditVisible()`, clears copy status on reset/edit and calls `cancelEdit()` from the Cancel edit button.
- Confirmed `tests/outcomes-page-route-state.test.js` pins the new SCSS and JS contracts.

Required CI and local follow-up checks:

```sh
npm run build
node --test tests/outcomes-page-route-state.test.js
npm test
npm run validate
```

## Residual risk

The PR should not be treated as fully validated until normal PR checks complete and the format workflow commits regenerated `public/css/outcomes.css` from the SCSS source if required.
