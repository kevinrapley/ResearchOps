# GitHub source panels prototype alignment trace

- Branch: `fix/source-panels-align-prototype`
- Date: 2026-05-21
- Task: Correct the GitHub Diamond bundle documentation generator so it follows the agreed source-panel navigation prototype and uses bespoke source annotations for governed source families.

## Design inputs

- `github-diamond-bundle-annotated-source-guide(3).html`
- `github-diamond-navigation-prototype(1).html`

## Source boundary

The generator reads canonical bundle files from:

`.agent-operating-model/bundles/github/`

It writes generated documentation to:

`docs/agent-operating-model/bundles/github/`

The generator must not edit canonical bundle source files.

## Annotation model

The annotation entry point is:

`.agent-operating-model/bundles/github/source-annotations.yaml`

The annotation fragments live in:

`.agent-operating-model/bundles/github/source-annotations/`

The annotation set is large. The main `source-annotations.yaml` establishes the schema and core mode/role annotations. Fragments keep contracts, graders, scripts and template groups reviewable while remaining canonical bundle source.

The governed headings are:

- Mode files: How the agent uses this file; What to look for; Completion evidence.
- Role files: How the agent uses this role; What judgement it applies; Escalation signals.
- Contract files: What this schema controls; What evidence it validates; What breaks the contract.
- Grader files: What this grader scores; What causes a fail; What evidence it expects.
- Template files: When this template is used; What must be customised; What must not be changed blindly.
- Script files: What this script verifies; When it should be run; What failure means.

## Implementation summary

- Rebuilt the generated `/bundles/github/` page as the overview operating manual rather than a card-grid landing page.
- Integrated root-level bundle files into the overview narrative sections: Purpose, How to read the bundle, Prompt spec, Mutation policy, Source panels, Worked flow and Coverage note.
- Stopped generating `/bundles/github/source/bundle-root/`.
- Kept source-family pages for modes, roles, references, contracts, graders, templates, scripts and examples when present.
- Aligned source panels with the prototype component: source-head, family pill, real code block and notes panel.
- Changed visible pills from language labels to family labels such as mode, role, reference, contract, grader, template, script and example.
- Removed generated metadata cards such as Files, Generated, Coverage, Source and Layout rule from the visible UI.
- Removed Canonical source and File details from the right-hand notes panel.
- Added canonical source annotations under `.agent-operating-model/bundles/github/source-annotations.yaml` and `.agent-operating-model/bundles/github/source-annotations/`.
- Added `scripts/agent-operating-model/apply-source-annotations.mjs` so generated source panels use canonical annotation text rather than synthetic repeated prose.
- Added exact annotation entries for modes, roles, contracts, graders, scripts and major template groups.
- Added pattern annotations for repeated workflow template families where exact-path GitHub contents writes were blocked by the connector.
- Updated `npm run agent:docs:source` so Cloudflare builds generate, apply annotations and verify the docs in one command.
- Updated the verifier so each individual source panel in governed families must include the expected family-specific headings.

## Files changed

The PR now changes generator, applier and verifier scripts; the package docs command; generated metadata; canonical annotation files; and trace files.

See the PR changed-file verification for the current exact file list.

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

- `npm run agent:docs:source` now runs generation, source annotation application and source panel verification.
- `verify-github-source-panel-docs.mjs` checks forbidden old UI copy, absence of `source/bundle-root` and per-panel family-specific headings.

Recommended checks:

- Run `npm run agent:docs:source`.
- Open `/bundles/github/` and confirm it starts with `How the GitHub bundle works`.
- Open `/bundles/github/source/` and confirm it is a source-family gateway only.
- Open `/bundles/github/source/modes/` and confirm panels use `mode` pills and mode-specific headings.
- Open `/bundles/github/source/contracts/` and confirm contract panels use schema-specific headings.
- Open `/bundles/github/source/templates/` and confirm template panels use template-specific headings.
- Open `/bundles/github/source/scripts/` and confirm script panels use script-specific headings.
- Confirm `/bundles/github/source/bundle-root/` is not uploaded.

## Residual risk

Several repeated workflow-template files use pattern annotations to avoid near-duplicate YAML and connector write blocks. These are family-specific and workflow-specific, but less individually bespoke than hand-authored one-file entries.

The final quality still depends on running `npm run agent:docs:source` in a full checkout so the annotation applier and verifier execute against real generated HTML.
