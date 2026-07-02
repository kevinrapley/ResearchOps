# Sourcebook GOV.UK home trace

Date: 2026-07-02
Branch: `feature/govuk-static-utility-pages`
Trace requirement: required by `feature/` branch prefix.

## Task

Create a first-class `sourcebook` home in the repository, add GOV.UK/Home Office sourcebook templates under `src/govuk/templates/sourcebook`, keep RDFa/SKOS/Dublin Core metadata, tighten the sourcebook model, make the 8 pillars complete, add sourcebook quality gates, move closer to the FCA handbook pattern, create `sourcebook-index.json`, add tests for the sourcebook clause model and deepen `REC-ADMN` as the reference-quality example.

## Operating model

Loaded repository operating-model sources:

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

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`

Conditional bundles not used for implementation: `cloudflare`, `openai-platform`, `mcp-agent-tooling`, `airtable-public-api`, `mural-public-api`.

## Evidence

- Existing sourcebook pages lived under `docs/devops/sourcebook`, including the 8 pillar pages and reusable templates.
- Existing `REC-ADMN` content covered participant recruitment, incentives, consent, participant panels and reporting, but the clause model was embedded in HTML.
- ReOps Community identifies the 8 pillars as Environment, Scope, People, Organisational context, Recruitment and admin, Data and knowledge management, Governance, and Tools and infrastructure.
- ReOps Community resources are published under Creative Commons Attribution-ShareAlike 4.0 International.
- The user's Obsidian notes and indexed Research That Scales material supported operating-system language, planning matrix thinking, maturity, value framing and the distinction between scalable systems and individual research activity.

## Changes made

- Added `sourcebook/sourcebook-index.json` as the canonical sourcebook model.
- Copied existing sourcebook reusable templates into `sourcebook/templates/`.
- Added `src/govuk/data/sourcebook.mjs` to load sourcebook data for GOV.UK rendering.
- Added `src/govuk/templates/sourcebook/index.njk` and `src/govuk/templates/sourcebook/pillar.njk`.
- Added sourcebook generation to `scripts/govuk/render-govuk-pages.mjs`.
- Added Sourcebook to the shared service navigation in `public/partials/header.html`.
- Added `src/styles/sourcebook.scss` and generated `public/css/sourcebook.css`.
- Added `tests/sourcebook-clause-model.test.js` to enforce 8-pillar completeness, clause metadata, REC-ADMN depth, ReOps attribution, generated routes and rendered RDFa/SKOS/Dublin Core metadata.
- Updated the sourcebook stylesheet so custom sourcebook components inherit the GOV.UK Frontend font stack rather than browser default serif fonts.
- Updated clause metadata rows to use GOV.UK small text scale so supporting details do not compete with clause content.
- Updated clause header signifier badges so each R/P/G/C marker is a consistent square sized to the clause identifier and heading block.
- Deepened `GOVERN` into an end-to-end governance lifecycle with governance operating model, triage, ethics, safeguarding, privacy, findings assurance, incidents, exceptions and continuous improvement.
- Added governance-specific template references and a test guard for the `GOVERN` lifecycle.
- Deepened `SCOPE` into an end-to-end scope lifecycle with operating model, intake, prioritisation, support levels, method boundaries, self-service and portfolio learning.
- Added scope-specific template references and a test guard for the `SCOPE` lifecycle.
- Deepened `PEOP-COMM` into an end-to-end people lifecycle with operating model, competence, community, coaching, wellbeing, collaboration and capability planning.
- Added people-specific template references and a test guard for the `PEOP-COMM` lifecycle.
- Deepened `ORG-CONT` into an end-to-end organisational context lifecycle with strategy, operating model, funding, decision rights, stakeholder trust, portfolio rhythm and value review.
- Added organisational context-specific template references and a test guard for the `ORG-CONT` lifecycle.
- Deepened `DATA-STO-ACC` into an end-to-end data and knowledge lifecycle with operating model, evidence capture, metadata, access, retention, reuse and repository health.
- Added data and knowledge-specific template references and a test guard for the `DATA-STO-ACC` lifecycle.
- Deepened `INFRA-PROV` into an end-to-end tools and infrastructure lifecycle with operating model, tool evaluation, access, integration, support, security, resilience and retirement.
- Added tools and infrastructure-specific template references and a test guard for the `INFRA-PROV` lifecycle.
- Deepened `ENVIRO` into an end-to-end environment lifecycle with operating model, accessibility, controlled spaces, remote research, fieldwork, researcher safety and operating learning.
- Added environment-specific template references and a test guard for the `ENVIRO` lifecycle.
- Extended `scripts/validate-sourcebook-links.mjs` so `npm run sourcebook:validate` now fails on placeholder text, `href="#"`, missing R/P/G/C badge labels, missing change history, missing `dc:modified`, undefined template references, unreferenced template definitions and unregistered template files.
- Registered the remaining deployable template assets in `sourcebook/sourcebook-index.json` and attached them to relevant clauses so template assets are not orphaned.
- Removed the published static `docs/devops/sourcebook/template.html` placeholder page and added `dc:modified` plus explicit R/P/G/C labels to the legacy static sourcebook pages.
- Added the Pace Layers Matrix as a first-class sourcebook adoption method, using the 8 pillars to prioritise slower strategic and governance work separately from faster practice, support and learning work.
- Added reusable Pace Layers Matrix templates under both sourcebook template homes and rendered the method on the GOV.UK sourcebook index.
- Added `researchops/consentform` as a consent/privacy simplification source and modelled it as a sourcebook operating pattern for GOVERN, REC-ADMN and DATA-STO-ACC.
- Added reusable consent and privacy statement generator templates under both sourcebook template homes and linked them to consent, participant agency and data-handling clauses.
- Added explicit sourcebook positioning as the formal FCA-style codification layer on top of existing ReOps community assets, separating the community foundation from the sourcebook contribution.

## Validation

Passed:

- `npm run build:generated-css && npm run build:govuk-pages`
- `npm test -- tests/sourcebook-clause-model.test.js`
- `npm run sourcebook:validate`
- `npm test -- tests/sourcebook-link-inventory.test.js`
- `npm test -- tests/sourcebook-clause-model.test.js` after adding Pace Layers Matrix coverage, now 14 tests
- `npm test -- tests/sourcebook-clause-model.test.js` after adding consent/privacy operating pattern coverage, now 15 tests
- `npm test -- tests/sourcebook-clause-model.test.js` after adding formal codification-layer positioning, now 16 tests
- Browser computed-style check confirmed the clause type list and pillar cards use `"GDS Transport", arial, sans-serif`.
- Browser computed-style check confirmed clause metadata labels and values use `"GDS Transport", arial, sans-serif` at `16px` with `20px` line height.
- Browser computed-style check confirmed the REC-ADMN clause signifier badge renders as a `55px` by `55px` square.
- Browser preview check confirmed `GOVERN` renders seven lifecycle sections, glossary, change history and 22 clauses.
- Browser preview check confirmed `SCOPE` renders seven lifecycle sections, glossary, change history and 22 clauses.
- Browser preview check confirmed `PEOP-COMM` renders seven lifecycle sections, glossary, change history and 22 clauses.
- Browser preview check confirmed `ORG-CONT` renders seven lifecycle sections, glossary, change history, `ORG-CONT 7.1.3` and 22 clauses.
- Browser preview check confirmed `DATA-STO-ACC` renders seven lifecycle sections, glossary, change history, `DATA-STO-ACC 7.1.3` and 22 clauses.
- Browser preview check confirmed `INFRA-PROV` renders seven lifecycle sections, glossary, change history, `INFRA-PROV 7.1.3` and 22 clauses.
- Browser preview check confirmed `ENVIRO` renders seven lifecycle sections, glossary, change history, `ENVIRO 7.1.3` and 22 clauses.

Preview:

- Started a local static preview at `http://127.0.0.1:4173/`.
- Opened `http://127.0.0.1:4173/pages/sourcebook/` in the browser.
- Opened `http://127.0.0.1:4173/pages/sourcebook/recruitment-and-administration/` in the browser.
- Opened `http://127.0.0.1:4173/pages/sourcebook/organisational-context/?v=org-cont-20260702` in the browser.
- Opened `http://127.0.0.1:4173/pages/sourcebook/data-and-knowledge-management/?v=data-sto-acc-20260702` in the browser.
- Opened `http://127.0.0.1:4173/pages/sourcebook/tools-and-infrastructure/?v=infra-prov-20260702` in the browser.
- Opened `http://127.0.0.1:4173/pages/sourcebook/environment/?v=enviro-20260702` in the browser.
- Checked a mobile viewport for the REC-ADMN clause layout.
- Restarted and left the local preview running for browser review at `http://127.0.0.1:4173/pages/sourcebook/`.

## Residual risk

- The new GOV.UK sourcebook pages are generated under `public/pages/sourcebook/`; the older standalone sourcebook under `docs/devops/sourcebook` now has validator-driven metadata and badge-label cleanup, but deployment routing can still decide when to switch consumers to the generated version.
- The Nunjucks templates are manually formatted because the repository formatter does not infer a parser for `.njk` files.
