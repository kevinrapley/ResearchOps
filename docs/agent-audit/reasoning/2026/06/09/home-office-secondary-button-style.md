# Home Office secondary button brand style

## Run metadata

- Date: 2026-06-09
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/home-office-secondary-button-style`
- Pull request: #380
- Trace layer: operational
- Branch-prefix trace decision: `fix/` requires a promoted trace.

## Original task summary

Apply the Home Office Design System secondary button adjustment to the ResearchOps Home Office brand variant. The Home Office guidance states that the secondary button style is slightly changed from GOV.UK to improve contrast with the Home Office grey page background.

## Operating-model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/github/references/github-tooling-mutation-policy.xml`
- `.agent-operating-model/bundles/github/references/test-contract-impact-sweep.xml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml`
- `.agent-operating-model/bundles/researchops-developer-control/references/core-rules.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/researchops-platform-context.xml`
- `.agent-operating-model/bundles/researchops-developer-control/references/researchops-repository-conventions.xml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml`

## Canonical bundle directories selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`

## Bundles selected

- `github-diamond`: branch, PR, trace, CI and automated-review governance.
- `researchops-developer-control`: ResearchOps CSS layering, generated CSS and route-state test contracts.
- `multi-functional-team`: government service assurance defaults.
- `govuk-design-system`: GOV.UK component accessibility and Home Office design-system-aligned styling.

## Bundles skipped

- `cloudflare`: no Worker, Pages routing or deployment implementation changed.
- `openai-platform`: no OpenAI API or model integration changed.
- `mcp-agent-tooling`: no MCP server, client or tool contract changed.
- `airtable-public-api`: no Airtable integration changed.
- `mural-public-api`: no Mural integration changed.

## Precedence decisions

GitHub Diamond governed branch, PR and trace behaviour. ResearchOps Developer Control governed where the implementation should live. GOV.UK Design System governed component semantics and accessibility. The Home Office Design System source was used to identify the adjusted secondary button treatment, while ordinary GOV.UK button semantics remain intact.

## Files read

- Home Office Design System button component guidance
- `UKHomeOffice/design-system/components/page/assets/Page.scss`
- `public/js/brand-variant.js`
- `scripts/styles/generated-css-targets.mjs`
- `src/styles/brands/home-office.scss`
- `public/css/brands/home-office.css`
- `tests/brand-variant-route-state.test.js`

## Files created or modified

- `src/styles/brands/home-office-buttons.scss`
- `public/css/brands/home-office-buttons.css`
- `public/js/brand-variant.js`
- `scripts/styles/generated-css-targets.mjs`
- `tests/brand-variant-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/09/home-office-secondary-button-style.md`
- `docs/agent-audit/reasoning/2026/06/09/home-office-secondary-button-style.json`

## Implementation summary

- Added a Home Office secondary button Sass source with the adjusted HODS colours, borders, shadow and padding.
- Added the generated CSS counterpart.
- Registered the generated CSS target.
- Updated the brand switcher to load `/css/brands/home-office-buttons.css` after `/css/brands/home-office.css` when the Home Office brand is active.
- Extended route-state assertions for the new Home Office secondary button contract.

## Test-contract impact sweep

Performed. Affected contract surfaces:

- Home Office brand stylesheet loading order
- generated CSS manifest
- Home Office secondary button Sass source
- generated Home Office secondary button CSS
- route-state assertions protecting brand CSS and generated CSS

Legacy or affected terms checked:

- `govuk-button--secondary`
- `home-office-buttons.css`
- `home-office-buttons.scss`
- `researchops-home-office-buttons-brand`
- `#f8f8f8`
- `#dfdfdf`
- `border-width: 1px 1px 0 1px`
- `padding: 9px 11px 9px`
- `padding: 8px 10px 7px`

## Automated review comments

No PR review threads were present at trace creation. Any later legitimate Codex or automated review comment must be acknowledged with a thumbs-up reaction, replied to with evidence, and resolved only after the fix is present and validation has been checked.

## Validation attempted

PR checks had not completed at trace creation. Checks must pass on the latest branch head before the PR is marked ready.

## Residual risks

- Visual verification on the Cloudflare branch preview remains useful because this is a component-style change.
- The secondary button override is scoped to the Home Office brand and loaded after the main Home Office brand stylesheet to preserve GOV.UK default behaviour.
