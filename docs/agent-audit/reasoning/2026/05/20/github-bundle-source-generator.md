# GitHub bundle source generator trace

- Branch: `feature/github-bundle-source-generator`
- Date: 2026-05-20
- Task: Add a generator script that creates source extraction pages for each file in the GitHub Diamond bundle documentation site.
- Branch trace decision: `feature/` branch, trace required.

## Selected bundles

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`

## Source boundary

The generator reads canonical bundle files from:

` .agent-operating-model/bundles/github/`

It writes generated documentation to:

`docs/agent-operating-model/bundles/github/source/`

The generator must not edit canonical bundle source files.

## Implementation summary

- Added `scripts/agent-operating-model/generate-bundle-source-docs.mjs`.
- Added `npm run agent:docs:source` for the GitHub bundle source browser.
- Added `npm run agent:docs:source:dry-run` for discovery without writing files.
- Linked the GitHub Diamond bundle landing page to `source/index.html`.
- Updated `generated-metadata.json` to record the source browser generator.
- Added safe public path handling for canonical dot-directories such as `.github`, emitted as `_dot_github` in generated docs.

## Generated output contract

When run, the generator writes:

- `docs/agent-operating-model/bundles/github/source/index.html`
- `docs/agent-operating-model/bundles/github/source/source-metadata.json`
- `docs/agent-operating-model/bundles/github/source/files/**.html`

Each generated source page includes:

- escaped canonical source content
- line anchors
- source file metadata
- purpose notes
- agent usage notes
- a canonical source warning banner

## Files changed

- `scripts/agent-operating-model/generate-bundle-source-docs.mjs`
- `package.json`
- `docs/agent-operating-model/bundles/github/index.html`
- `docs/agent-operating-model/bundles/github/generated-metadata.json`
- `docs/agent-audit/reasoning/2026/05/20/github-bundle-source-generator.json`
- `docs/agent-audit/reasoning/2026/05/20/github-bundle-source-generator.md`

## Validation

A full repository checkout was not available in this environment.

Mock validation completed outside the repository checkout:

- `node --check` passed against the generated script.
- The generator ran against a mock bundle containing `prompt.body.xml` and `templates/github/.github/workflows/ci-node.yml`.
- Observed output included `source/index.html`, `source-metadata.json`, `prompt.body.xml.html` and a `_dot_github` workflow page.

Recommended follow-up checks:

- Run `npm run agent:docs:source:dry-run` in a repository checkout.
- Run `npm run agent:docs:source` before deployment or as the Cloudflare Pages build command.
- Open `/bundles/github/source/index.html` after generation.
- Confirm generated pages retain canonical source paths while using safe public output paths.

## Residual risk

The generator has been added, but generated source output was not committed from a full repository checkout.

Cloudflare Pages must run `npm run agent:docs:source` during build, or generated source files must be committed after running the script locally.
