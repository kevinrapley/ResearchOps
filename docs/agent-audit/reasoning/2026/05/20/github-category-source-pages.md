# GitHub category source panels trace

- Branch: `feature/github-category-source-pages`
- Date: 2026-05-20
- Task: Update the GitHub Diamond bundle documentation generator so source documentation is generated as category pages with full source panels, syntax highlighting and annotations.
- Branch trace decision: `feature/` branch, trace required.

## Selected bundles

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`

## Source boundary

The generator reads canonical bundle files from:

`.agent-operating-model/bundles/github/`

It writes generated documentation to:

`docs/agent-operating-model/bundles/github/source/`

The generator must not edit canonical bundle source files.

## Implementation summary

- Changed the source documentation generator from a per-file source browser to a source hub plus category pages.
- The generator now writes category pages such as `source/modes/index.html`, `source/roles/index.html`, `source/references/index.html`, `source/contracts/index.html`, `source/graders/index.html`, `source/templates/index.html`, `source/scripts/index.html` and `source/examples/index.html` when those source categories exist.
- Each category page renders complete source panels with code blocks, syntax highlighting and side annotations explaining how the agent uses each file.
- Removed the right-hand file navigation pattern from generated category pages so the main content area can prioritise code panels and annotations.
- Renamed the overview entry from `Source browser` to `Source panels`.
- Updated generated metadata to describe the category source panel model and include the examples source page.
- Raised the Cucumber default step timeout to 15 seconds using the supported `setDefaultTimeout` mechanism in `features/support/timeouts.js` after the live-site BDD smoke suite timed out during navigation to `researchops.pages.dev`.

## Codex review response

Codex comment: set Cucumber default timeout via supported mechanism.

Resolution: removed the unsupported `timeout` profile field from `cucumber.mjs` and added `features/support/timeouts.js` using `setDefaultTimeout(15000)`.

Codex comment: add examples source page to generated metadata list.

Resolution: added `source/examples/index.html` to `docs/agent-operating-model/bundles/github/generated-metadata.json`.

## Files changed

- `scripts/agent-operating-model/generate-bundle-source-docs.mjs`
- `docs/agent-operating-model/bundles/github/index.html`
- `docs/agent-operating-model/bundles/github/generated-metadata.json`
- `cucumber.mjs`
- `features/support/timeouts.js`
- `docs/agent-audit/reasoning/2026/05/20/github-category-source-pages.json`
- `docs/agent-audit/reasoning/2026/05/20/github-category-source-pages.md`

## Validation

A full repository checkout was not available in this environment.

Mock validation completed:

- `node --check` passed against the revised generator in a local mock environment.
- The generator ran against a mock bundle containing `prompt.spec.yaml`, `modes/repo-build.xml` and `templates/github/.github/workflows/ci-node.yml`.
- Observed output included `source/index.html`, `source/bundle-root/index.html`, `source/modes/index.html`, `source/templates/index.html` and `source/source-metadata.json`.

Workflow validation:

- Initial `qa-bdd` run failed because Cucumber killed `page.goto()` after the default 5000ms step timeout while testing the live `researchops.pages.dev` site.
- A first attempted fix added `timeout: 15000` to `cucumber.mjs`, and the BDD smoke suite step passed on that rerun.
- Codex review correctly identified that `timeout` is not a supported `cucumber.mjs` profile option.
- The timeout fix was moved to `features/support/timeouts.js` using `setDefaultTimeout(15000)`.

Recommended checks:

- Run `npm run agent:docs:source:dry-run` in a full repository checkout.
- Run `npm run agent:docs:source` in a full repository checkout or Cloudflare Pages build.
- Open `/bundles/github/source/` after deployment.
- Open `/bundles/github/source/modes/` after deployment.
- Confirm source category pages do not include a right-hand file navigation rail.
- Confirm latest PR-head workflows complete after the Codex review fixes.

## Residual risk

Generated source output is produced by running `npm run agent:docs:source` and is not committed directly in this PR.

Syntax highlighting is static and deliberately lightweight. It is not a full Shiki or Prism implementation.

The generator assumes canonical bundle files are text-oriented documentation, source, schema, template or script files.
