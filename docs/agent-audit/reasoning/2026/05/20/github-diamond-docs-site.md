# GitHub Diamond docs site trace

- Branch: `feature/github-diamond-docs-site`
- Date: 2026-05-20
- Task: Create a generated multi-file static documentation site for the GitHub Diamond bundle.
- Branch trace decision: `feature/` branch, trace required.

## Selected bundles

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`

## Source boundary

Generated documentation has been added under:

`docs/agent-operating-model/bundles/github/`

The canonical bundle source remains under:

`.agent-operating-model/bundles/github/`

Generated documentation must not replace, mutate, or outrank the canonical bundle source.

## Implementation summary

- Created a generated static documentation site separate from the canonical bundle source.
- Added a shared stylesheet using ResearchOps/GOV.UK-style documentation conventions.
- Added a landing page and section pages for modes, roles, references, contracts, graders, templates, scripts, validation and changelog.
- Added generated metadata to record the source boundary and page inventory.
- Added generated-source warning banners to pages pointing readers back to `.agent-operating-model/bundles/github/`.

## Files changed

- `docs/agent-operating-model/bundles/github/index.html`
- `docs/agent-operating-model/bundles/github/assets/styles.css`
- `docs/agent-operating-model/bundles/github/modes/index.html`
- `docs/agent-operating-model/bundles/github/roles/index.html`
- `docs/agent-operating-model/bundles/github/references/index.html`
- `docs/agent-operating-model/bundles/github/contracts/index.html`
- `docs/agent-operating-model/bundles/github/graders/index.html`
- `docs/agent-operating-model/bundles/github/templates/index.html`
- `docs/agent-operating-model/bundles/github/scripts/index.html`
- `docs/agent-operating-model/bundles/github/validation/index.html`
- `docs/agent-operating-model/bundles/github/changelog/index.html`
- `docs/agent-operating-model/bundles/github/generated-metadata.json`
- `docs/agent-audit/reasoning/2026/05/20/github-diamond-docs-site.json`
- `docs/agent-audit/reasoning/2026/05/20/github-diamond-docs-site.md`

## Validation

Local validation was not executed in the ChatGPT environment because the work was created through the GitHub connector without a local checkout or CI runner.

Recommended follow-up checks:

- Review `docs/agent-operating-model/bundles/github/index.html` in a browser.
- Run repository formatting or documentation checks if available.
- Confirm that no files under `.agent-operating-model/bundles/github/` changed.

## Residual risk

The first generated documentation site is explanatory and navigable. It is not yet a line-for-line generated source mirror of every bundle file.

A later generator script can add full source extraction pages for each bundle file if required.
