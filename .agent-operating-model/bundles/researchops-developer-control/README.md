# ResearchOps Developer Control Prompt Bundle

Version: `1.13.0`

This bundle governs development work on the ResearchOps platform. It is designed for agents working with the ResearchOps repository, Cloudflare Workers/Pages, Airtable-backed routes, Mural integration, visual walkthrough evidence, GOV.UK-style pages and UCD-oriented product documentation.

## Purpose

The bundle gives an agent a repository-specific operating contract. It is not a generic coding assistant prompt.

The agent must:

- inspect the repository before proposing implementation changes
- identify whether the change belongs in a page, shared component, local component, CSS, JavaScript, Worker route, data adapter, workflow or documentation
- preserve existing architecture unless a justified migration is requested
- keep GOV.UK and accessibility expectations visible
- protect evidence-to-insight-to-recommendation traceability
- use route shape fixtures and visual walkthrough evidence to reduce regressions
- avoid inventing endpoints, fields or schemas that are not in the repository or in an explicit user request

## Primary repository assumptions

The ResearchOps platform is normally structured around:

- Cloudflare Workers API code under `src/`
- Cloudflare Pages/static front-end code under `public/`
- page-level JavaScript under `public/js/`
- GOV.UK-inspired styles under `public/css/`
- visual walkthrough tooling and reports in the repository root and `reports-site/`
- product, research and implementation docs under `docs/`
- CI and release workflows under `.github/workflows/`

## Bundle layout

```text
contracts/
examples/
graders/
modes/
references/
roles/
templates/
CHANGELOG.md
README.md
evals.yaml
grade.schema.json
output.schema.json
prompt.body.xml
prompt.spec.yaml
registry-manifest.yaml
tests.redteam.yaml
tests.regression.yaml
variables.schema.json
```

## Key references

The bundle loads reference material for:

- platform context
- repository conventions
- endpoint catalogues
- route availability policy
- component routing
- implementation workflow
- integration contracts
- CI governance
- deployment control
- visual walkthrough control
- metadata provenance
- PR and logging governance
- ethics and harm checks
- accessibility and GOV.UK behaviour

## Modes

Modes describe the type of task being performed.

Common modes include:

- `repo-discovery`
- `repo-build`
- `repo-fix`
- `repo-review`
- `repo-release-readiness`
- `route-conformance`
- `visual-walkthrough`

## Roles

Roles provide specialist lenses.

Common roles include:

- ResearchOps developer
- ResearchOps architect
- User researcher
- Service owner
- Accessibility specialist
- QA engineer
- Ethics reviewer
- Delivery lead

## Operating principles

The agent should treat ResearchOps as a live product repository.

It must not make speculative edits when inspection is possible.

It must not patch over symptoms when a shared component or route contract is the correct layer.

It must not remove evidence, audit trace, accessibility support, GOV.UK semantics, route guards or operational fixtures unless explicitly requested and justified.

## Output expectations

For implementation work, the agent should provide:

- the files changed
- the reason each file changed
- how the change fits the repository architecture
- tests or validations run
- risks and follow-ups
- PR-ready summary when relevant

When direct repository editing is used, the agent should prefer complete, coherent commits over hidden or unexplained changes.

## Version notes

Version `1.13.0` strengthens component routing, deployment control, visual walkthrough governance and route-shape fixture coverage.
