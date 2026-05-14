# ResearchOps Platform — Master Prompt

Version: 1.0.0
Date: 2026-05-14
Status: Canonical master prompt
Scope: ResearchOps platform (this repository)

This document is a single, authoritative master prompt for any agent, contributor or model working on the ResearchOps platform. It captures who we are building for, what the platform does, how it is built, the contracts it must respect, and the operating posture an agent must adopt. It is a synthesis layer — it does not replace the canonical bundle, references or repository contracts. Where this prompt and a canonical reference disagree, the canonical reference wins.

---

## 1. Platform identity

ResearchOps is a Cloudflare-hosted platform that supports user research operations across the lifecycle of a service project. It helps multidisciplinary teams plan, run, govern and synthesise primary research so that decisions are traceable from evidence to insight to recommendation.

The platform exists to:

- give research-active teams a single operational surface for projects, studies, participants, sessions, guides, consent, journals, analysis and synthesis
- protect participants through consent, ethics review, accessibility and data minimisation by default
- preserve auditable traceability from raw evidence to insight to recommendation
- align with GOV.UK service standards and assisted-digital expectations
- integrate with Airtable for source-of-truth records and with Mural for collaborative synthesis
- give delivery teams a deployment-controlled, contract-tested, accessibility-validated path to production

The platform is treated as a live product repository. Speculative edits, invented endpoints, invented field names, or invented schemas are not acceptable.

---

## 2. Audience and roles

The platform serves a multidisciplinary product team and the people the team serves:

- service owners and delivery leads who need oversight of research activity
- user researchers who plan studies, run sessions, manage participants and synthesise findings
- designers who consume insights and run design critiques
- product managers who own discovery decisions
- ethics reviewers who govern participant protection
- accessibility specialists who validate inclusive practice
- developers, QA, DevOps and security who build and operate the platform
- participants whose data, consent and dignity the platform must protect

Agent role lenses available in the developer-control bundle include `research-operations`, `developer`, `qa`, `security`, `accessibility`, `devops`, `governance`, `metrics`, `user-research`, `product` and `ethics`.

---

## 3. Domain model

The product domain centres on the research lifecycle. Core entities:

- **Project** — the unit of service work in a phase (discovery, alpha, beta, live), with objectives, stakeholders, user groups and outputs.
- **Study** — a planned piece of research inside a project, with a method, sample, recruitment criteria, schedule and outputs.
- **Participant** — a person who has consented to take part. Consent is staged, revocable and auditable.
- **Session** — a recorded research interaction (interview, usability test, workshop, observation).
- **Guide** — the protocol used to run a session.
- **Journal entry** — a notes record produced during or after a session.
- **Insight** — a synthesised statement traceable to one or more evidence sources.
- **Recommendation** — a proposed action traceable to one or more insights.
- **Consent record** — a tracked agreement linking a participant to a defined data use.
- **Ethics record** — a tracked review or check applied to a project or study.

The product's central traceability rule is: **evidence → insight → recommendation**. Any feature that breaks that chain, hides provenance, or allows recommendations to be made without traceable evidence is unacceptable.

---

## 4. Architecture

The platform runs on the Cloudflare Developer Platform.

- **API**: Cloudflare Workers. Worker route logic lives under the Cloudflare source tree (`infra/cloudflare/src/`, with API and integration access in `lib/`, `core/` and `service/`).
- **Front end**: Cloudflare Pages serving GOV.UK-styled static pages from `public/pages/` with route-specific JavaScript under `public/js/` and styles under `public/css/`.
- **Integrations**:
  - **Airtable Public API** for records of projects, studies, participants and related operational data.
  - **Mural OAuth2 Public API** for collaborative synthesis surfaces.
  - **OpenAI Platform** for AI-assisted research operations, governed by structured output, eval and safety controls.
  - **MCP-style agent tooling** for tool contracts, resource exposure, prompt workflows and tool-use audit.
  - **GitHub CSV** export and SharePoint-targeted export paths for downstream reporting.
- **Workflows**: GitHub Actions for CI and Cloudflare for deploy.
- **Testing**: Playwright + Cucumber for BDD, Pa11y for accessibility, Lighthouse for performance, Lychee for links, plus contract, regression and route-state checks.
- **Evidence**: visual walkthrough tooling and reports under `reports-site/` and repository root configs.

Architectural posture is: **API contracts first, accessibility non-negotiable, performance audited, deployment controlled**.

---

## 5. Repository conventions

Hard rules:

- Static pages live under `public/pages/`.
- Page JavaScript lives under `public/js/`.
- Route-specific CSS must not override GOV.UK component internals unnecessarily.
- Worker route logic lives under the Cloudflare source tree.
- Tests cover contract, regression, route-state, accessibility, performance and link integrity.
- Product records live under `docs/product/YY/MM/DD/`. No flat product records at the root of `docs/product/`. No `README.md` inside dated folders.
- Work branches must use approved prefixes: `feature/`, `chore/`, `test/`, `fix/`, `perf/`, `hotfix/`. Branches under `feature/`, `chore/`, `test/`, `fix/` and `perf/` require an auditable trace; `hotfix/` is exempt.
- Never introduce secrets, API keys or tokens into code. Secrets come from Wrangler environment configuration only.
- Do not duplicate canonical bundle rules in `AGENTS.md` or in product docs — link to the canonical bundle directory.

Soft rules:

- Prefer `const`. Use JSDoc on exports. Avoid console noise outside deliberate Worker logs.
- Keep commits atomic. Keep PRs self-contained. Never rewrite branch history without the repository owner's explicit approval.

---

## 6. Integration contracts

Each integration has a canonical bundle under `.agent-operating-model/bundles/`:

| Integration | Canonical bundle |
|-------------|------------------|
| Cloudflare Developer Platform | `cloudflare/` |
| OpenAI Platform | `openai/` |
| MCP agent tooling | `mcp-agent-tooling/` |
| Airtable Public API | `airtable-public-api/` |
| Mural Public API | `mural-public-api/` |
| GOV.UK Design System | `govuk-design-system/` |
| GitHub repository operation | `github/` |
| ResearchOps platform development | `researchops-developer-control/` |
| Multidisciplinary government product assurance | `multi-functional-team/` |

Endpoint families currently catalogued include `/api/_diag/ping`, `/api/health`, `/api/projects`, `/api/studies`, `/api/participants`, `/api/sessions`, `/api/guides` and `/api/journal-entries`. Treat the endpoint catalogue and example payloads under the developer-control bundle as canonical. Do not invent new endpoints or fields without a documented change.

---

## 7. Quality gates

Before any change merges:

1. `npm ci`
2. `npm run lint`
3. `npm run format -c`
4. `npm run typecheck`
5. `npm test -- --ci`
6. `npm run validate`

Additionally, depending on the change surface:

- accessibility validation via Pa11y
- performance validation via Lighthouse and audit scripts
- link validation via Lychee
- BDD scenarios under `features/`
- contract and route-state checks for API or fixture changes
- visual walkthrough updates where evidence is affected

Tests must be idempotent and CI-safe. Releases must satisfy release-evidence, release-provenance and branch-protection policies recorded in the repository.

---

## 8. Governance, ethics and accessibility

Authority order for any decision:

1. Law, regulation and platform safety
2. Privacy, security and data minimisation
3. Accessibility and inclusive research obligations
4. ResearchOps domain model and user need
5. Repository contract and existing architecture
6. GOV.UK patterns and product contracts
7. API and integration contracts
8. Test quality and release gates
9. Performance and loading contracts
10. Human accountability and governance
11. User format and delivery preferences

Non-negotiables:

- Phase changes are human-owned. Agents propose; humans approve.
- Authoritative use of platform output requires human review.
- Do not invent identifiers. Do not expose internal field names to end users.
- Do not remove evidence, audit trace, accessibility support, GOV.UK semantics, route guards or operational fixtures unless explicitly requested and justified.
- Ethics and consent are first-class concerns, not afterthoughts.

---

## 9. Operating contract for agents

When an agent works on this repository it must:

1. Load the operating model from `.agent-operating-model/` before any repository-affecting response.
2. Resolve selected bundles to their canonical directories and verify each has `prompt.spec.yaml` and `prompt.body.xml`.
3. Inspect the repository before proposing implementation changes. Never patch over symptoms when a shared component, adapter, route contract or service module is the correct layer.
4. Choose the right surface for the change: page, shared component, local component, CSS, JavaScript, Worker route, data adapter, workflow or documentation.
5. Preserve existing architecture unless a justified migration is requested and approved.
6. Record an auditable trace when the branch trace rule requires one.
7. Produce, for any implementation work: files changed, reason each file changed, how the change fits the architecture, tests or validations run, risks and follow-ups, and a PR-ready summary where relevant.
8. Stop and report when the operating model, a selected bundle directory, or a required reference cannot be loaded.

Default modes available in the developer-control bundle include `rops-build`, `rops-api`, `rops-ui`, `rops-patterns`, `rops-integration`, `rops-fix`, `rops-review` and `rops-conformance`. Select the mode that matches the task signal.

---

## 10. Output expectations

For research-product work, outputs should be:

- traceable — every insight links to evidence, every recommendation links to insights
- accessible — GOV.UK semantics preserved, Pa11y green, screen-reader sensible
- performant — Lighthouse and route performance budgets honoured
- contract-conformant — API responses match canonical example payloads and fixtures
- ethics-aware — consent, data minimisation and participant protection visible in the change record
- reviewable — diffs are coherent, atomic and explained

For agent-authored artefacts (plans, briefs, ADRs, PR summaries), prefer the templates under `.agent-operating-model/bundles/researchops-developer-control/templates/`.

---

## 11. What this prompt is not

This master prompt is a synthesis. It is not:

- a replacement for `AGENTS.md`, the operating model, or canonical bundles
- a place to record domain rules that belong in a bundle reference
- a substitute for inspecting the repository before making changes
- authority to bypass quality gates, trace requirements or human review

When in doubt, defer to the canonical source and ask.

---

## 12. Source references

- `AGENTS.md` — repository-level agent contract
- `.agent-operating-model/orchestration.xml` — orchestration spine
- `.agent-operating-model/bundle-registry.json` — bundle registry
- `.agent-operating-model/task-signal-catalog.json` — task signal catalogue
- `.agent-operating-model/selection-rules.json` — bundle selection rules
- `.agent-operating-model/precedence-policy.md` — precedence policy
- `.agent-operating-model/trace-policy.md` and `trace-layers.md` — trace policy
- `.agent-operating-model/bundles/researchops-developer-control/` — developer-control bundle
- `docs/product/` — dated product records
- `reports-site/` and visual walkthrough configs — evidence surface
