# GitHub source panels prototype alignment trace

- Branch: `fix/source-panels-align-prototype`
- Date: 2026-05-21
- Task: Correct the GitHub Diamond bundle documentation generator so it follows the agreed source-panel navigation prototype and removes the metadata-oriented source browser output.

## Design inputs

- `github-diamond-bundle-annotated-source-guide(3).html`
- `github-diamond-navigation-prototype(1).html`

## Source boundary

The generator reads canonical bundle files from:

`.agent-operating-model/bundles/github/`

It writes generated documentation to:

`docs/agent-operating-model/bundles/github/`

The generator must not edit canonical bundle source files.

## Implementation summary

- Rebuilt the generated `/bundles/github/` page as the overview operating manual rather than a card-grid landing page.
- Integrated root-level bundle files into the overview narrative sections: Purpose, How to read the bundle, Prompt spec, Mutation policy, Source panels, Worked flow and Coverage note.
- Stopped generating `/bundles/github/source/bundle-root/`.
- Kept source-family pages for modes, roles, references, contracts, graders, templates, scripts and examples when present.
- Aligned source panels with the prototype component: source-head, family pill, real code block and notes panel.
- Changed visible pills from language labels to family labels such as mode, role, reference, contract, grader, template, script and example.
- Removed generated metadata cards such as Files, Generated, Coverage, Source and Layout rule from the visible UI.
- Removed Canonical source and File details from the right-hand notes panel.
- Added file-specific explanatory annotation logic for How the agent uses this file and What to look for.
- Added a verifier script that fails the build if old source-browser output, `/source/bundle-root/`, metadata panels or language-only pills reappear.
- Updated `npm run agent:docs:source` so Cloudflare builds generate and verify the docs in one command.

## Files changed

- `scripts/agent-operating-model/generate-bundle-source-docs.mjs`
- `scripts/agent-operating-model/verify-github-source-panel-docs.mjs`
- `docs/agent-operating-model/bundles/github/generated-metadata.json`
- `package.json`
- `docs/agent-audit/reasoning/2026/05/21/github-source-panels-prototype-alignment.json`
- `docs/agent-audit/reasoning/2026/05/21/github-source-panels-prototype-alignment.md`

## Validation

A full repository checkout was not available in this environment.

Mock validation completed:

- `node --check` passed against the replacement generator in a local mock environment.
- The generator ran against a mock GitHub bundle with root files and source-family directories.
- Mock output included `/index.html`, `/source/index.html` and source-family pages.
- Mock output did not include `/source/bundle-root/`.
- Mock source pages used family pills such as `mode` rather than language pills such as `xml` or `python`.
- Mock source pages did not contain `Canonical source`, `File details`, `Layout rule` or `Source browser` copy.

Build verification:

- `scripts/agent-operating-model/verify-github-source-panel-docs.mjs` checks the generated output shape after generation.
- `package.json` now runs generation and verification through `npm run agent:docs:source`.

Recommended checks:

- Run `npm run agent:docs:source`.
- Open `/bundles/github/` and confirm it starts with `How the GitHub bundle works`.
- Open `/bundles/github/source/` and confirm it is a source-family gateway only.
- Open `/bundles/github/source/modes/` and confirm panels use `mode` pills and rich notes.
- Confirm `/bundles/github/source/bundle-root/` is not uploaded.

## Residual risk

The annotations are generated from path, family and source signals rather than a hand-authored annotation file for every individual file.

The approach is now prototype-aligned, but future work should move annotations into an explicit `source-annotations.yaml` if Kevin wants fully curated commentary per file.
