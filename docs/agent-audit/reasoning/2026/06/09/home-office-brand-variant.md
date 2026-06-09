# Home Office brand variant trace

Date: 2026-06-09
Branch: `feature/ho-brand-variant`
Task: Add a same-repository brand-variant system for ResearchOps so the GOV.UK default can remain while a Home Office variant changes only colours and logo.

## Branch decision

Trace required: yes.

Reason: branch starts with `feature/` and the operating model requires auditable traces for repository-affecting work on feature branches.

## Operating-model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/github-mutation-policy.md`

## Bundles selected

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`
- `govuk-design-system`

## Bundles skipped

- `cloudflare`: no Worker, binding, route or deployment implementation changed.
- `openai-platform`: no OpenAI API or model implementation changed.
- `mcp-agent-tooling`: no MCP tool contract changed.
- `airtable-public-api`: no Airtable integration changed.
- `mural-public-api`: no Mural integration changed.

## Precedence decisions

- GitHub branch and trace rules governed branch naming and trace creation.
- ResearchOps Developer Control governed the shared partial, Sass source and route-state test approach.
- GOV.UK Design System rules remained active because the work changes frontend page chrome.
- Home Office UCD Manual evidence was used only for Home Office colour and logo treatment.

No precedence conflict was found.

## External evidence checked

- Home Office Design System styles page: internal services on `homeoffice.gov.uk` should use Home Office styles.
- Home Office colour page: brand purple `#732282`, page background `#f5f5f5`, border `#cbcbcb`, GOV.UK text and link colours remain suitable.
- Home Office header component page: Home Office header identifies internal Home Office services and includes the Home Office SVG logo source.

## Files changed

- `public/partials/header.html`
- `public/js/brand-variant.js`
- `src/styles/brands/home-office.scss`
- `public/css/brands/home-office.css`
- `scripts/styles/generated-css-targets.mjs`
- `tests/brand-variant-route-state.test.js`
- `docs/design-system/brand-variants.md`
- `docs/agent-audit/reasoning/2026/06/09/home-office-brand-variant.md`
- `docs/agent-audit/reasoning/2026/06/09/home-office-brand-variant.json`

## Implementation decisions

The GOV.UK variant remains the default.

The Home Office variant is applied at runtime using one of three supported selectors: `?brand=home-office`, a `researchops-brand` meta tag, or a Home Office-flavoured hostname.

The variant swaps the visible logo and applies a small colour layer. It does not fork GOV.UK component markup, form structures, content, routing, API behaviour or route-specific layouts.

The Home Office CSS asset is registered as a generated output. The source is `src/styles/brands/home-office.scss`, and the generated output is `public/css/brands/home-office.css`.

## Validation attempted

Route-state coverage now checks that the Home Office brand CSS target is registered from Sass.

Repository-level tests were not run in the execution environment because the repository was only available through the GitHub connector, not as a local clone with dependencies installed.

## Test-contract impact sweep

Checked known contract-bearing surfaces:

- shared header partial
- shared GOV.UK route-state assertions
- generated-page route-state expectations
- generated CSS target manifest
- Sass source path and generated CSS output path
- brand-specific route-state assertions
- visible logo classes
- stylesheet path contracts
- brand activation selectors

The brand route-state test was extended to cover the Sass source, generated CSS target and generated output contract.

## Residual risks

The Home Office logo is implemented from the Home Office header SVG wordmark source. Manual visual review is still needed in a browser because connector-only editing cannot render the final page.
