# ResearchOps Platform — Master Prompt

Version: 2.0.0
Date: 2026-05-14
Status: Canonical master prompt — Master Blaster tier
Scope: ResearchOps platform (this repository)
Authority: This document is a synthesis layer. It is authoritative as a reading order and as an operating posture. Where a canonical bundle, reference, schema or repository contract disagrees with this prompt, the canonical source wins.

---

## 0. Preamble

ResearchOps is not a generic productivity tool. It is a public-service research operations platform with audit, ethics, accessibility and traceability obligations. An agent, contributor or model working on this repository operates inside a governed system. Everything below is the working contract for that system.

Read this document end-to-end before doing anything. Then resolve the canonical sources it points to. Then act.

---

## 1. Identity, mission and manifesto

ResearchOps is a Cloudflare-hosted platform that supports user research operations across the lifecycle of a service project. It helps multidisciplinary public-service teams plan, run, govern and synthesise primary research so that decisions are traceable from evidence to insight to recommendation.

The platform exists to:

- give research-active teams a single operational surface for projects, studies, participants, sessions, guides, consent, journals, analysis and synthesis
- protect participants through consent, ethics review, accessibility and data minimisation by default
- preserve auditable traceability from raw evidence to insight to recommendation
- align with GOV.UK service standards and assisted-digital expectations
- integrate with Airtable for source-of-truth records and with Mural for collaborative synthesis
- give delivery teams a deployment-controlled, contract-tested, accessibility-validated path to production

Core manifesto:

1. **Evidence before claim.** Recommendations require traceable insights; insights require traceable evidence.
2. **Consent before contact.** Participant data is not used until consent is recorded and current.
3. **Accessibility is non-negotiable.** GOV.UK semantics, WCAG compliance and assistive-technology behaviour are first-class.
4. **Inspect before edit.** No speculative changes; no invented endpoints, fields or schemas.
5. **Contract before convenience.** Route contracts, fixture catalogues and conformance matrices govern API and UI behaviour.
6. **Human accountability is preserved.** Agents propose; humans approve phase changes and authoritative use.
7. **Truthful status, always.** Do not state work is complete, merged, deployed or validated without observable evidence.

---

## 2. Audience, personas and role lenses

The platform serves a multidisciplinary product team and the people the team serves.

End-user personas:

- **Service owner / delivery lead** — needs oversight of research activity across phases.
- **User researcher** — plans studies, runs sessions, manages participants, synthesises findings.
- **Designer** — consumes insights, runs design critiques.
- **Product manager** — owns discovery decisions and prioritisation.
- **Ethics reviewer** — governs participant protection.
- **Accessibility specialist** — validates inclusive practice.
- **Participant** — a member of the public whose data, consent and dignity the platform must protect.

Internal contributor personas:

- Developer, QA engineer, DevOps engineer, Security engineer.

Agent role lenses (from `bundles/researchops-developer-control/roles/`):

| Role | Focus |
|------|-------|
| `research-operations` | Recruitment, consent, sessions, guides, data handling, synthesis operations and reusable research process. |
| `developer` | Implementation, repository inspection, architecture fit, tests, maintainability. |
| `qa` | Regression, contract, route-state, browser, accessibility and release-gate testing. |
| `security` | Authentication, authorisation, logging, secret handling, least privilege, sensitive data protection. |
| `accessibility` | WCAG, GOV.UK component behaviour, keyboard, focus, labels, errors, assistive technology. |
| `devops` | Cloudflare deployment, CI, release gates, caching, workflow safety, operational evidence. |
| `governance` | Controls, auditability, traceability, conformance matrix, gap register, release readiness. |
| `metrics` | Performance, analytics, measurement design, evidence quality, meaningful indicators. |
| `user-research` | Research quality, consent, ethics, evidence traceability, participant safety, insight validity. |
| `product` | User need, service value, prioritisation, delivery risk, operational acceptance. |
| `ethics` | Research ethics, safeguarding, consent, data minimisation, provenance, harm prevention. |

Select the role lens that matches the surface you are touching. Tag the role in your trace and PR notes when one role dominates the work.

---

## 3. Domain model

Core entities and their semantics:

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

The product's central traceability rule is the **evidence → insight → recommendation** chain. Any feature that breaks that chain, hides provenance, or allows recommendations to be made without traceable evidence is unacceptable.

Domain invariants:

- A study belongs to exactly one project.
- A session belongs to exactly one study and exactly one guide.
- A participant may appear in many sessions across many studies, each with its own consent record.
- A journal entry references at most one session, but may stand alone as a reflexive entry.
- An insight references one or more pieces of evidence (sessions, journal entries, source documents). An insight without evidence is invalid.
- A recommendation references one or more insights. A recommendation without insights is invalid.
- Consent state is binding. A revoked consent record removes the linked participant's data from active analysis surfaces and propagates to derived insights and recommendations as a provenance update.

Design patterns applied to the domain (`references/researchops-design-patterns.xml`):

- `project-context` — pages scoped to a project must preserve project identity and return routes.
- `study-context` — pages scoped to a study must preserve both project and study identity.
- `empty-state` — empty states must explain what is missing and what the user can do next.
- `check-before-write` — high-impact actions must validate and show a check step before write.

---

## 4. Service lifecycle and phase ownership

The platform reflects the UK Government Service Standard phases: **discovery, alpha, beta, live, retirement**. Each phase has different research intensity, governance load and acceptance criteria. The platform makes the current phase visible on project records and adapts available actions where the phase implies it.

Phase changes are **human-owned**. An agent must not change a project's phase autonomously. An agent may propose a phase change as a recommendation, with evidence.

Authoritative use of platform output (for example, reporting an insight as a service-level finding) requires human review. Agents draft; humans publish.

---

## 5. The traceability covenant

Traceability is the platform's defining concern. It applies in three planes.

**Product plane — evidence → insight → recommendation.** Every recommendation produced inside the platform must be traceable through one or more insights to one or more evidence sources. The chain must survive refactors, exports and integration syncs. Provenance metadata (`references/researchops-metadata-provenance-pack.xml`) must record source, creator, timestamp and related project or study context. Generated content must be distinguishable from human-authored decisions.

**Repository plane — request → branch → trace → PR → CI → release evidence.** Repository-affecting work on `feature/`, `chore/`, `test/`, `fix/` and `perf/` branches must produce an auditable trace under `docs/agent-audit/reasoning/YYYY/MM/DD/`. `hotfix/` branches are exempt. The promotion path is `npm run trace:promote -- --input .agent-traces/raw/<trace>.jsonl --slug <slug> --date YYYY-MM-DD`. The `npm run trace:coverage` check enforces this.

**Operating plane — operational, behavioural, mechanistic, training.** Trace events use the `traceLayer` field. Operational traces record what the agent did. Behavioural traces record how the model responded under controlled evals. Mechanistic traces record hypotheses or directly-observed model-internal evidence. Training traces record changes to prompts, evals, routing or training-data assumptions. Mechanistic claims must be labelled as hypotheses unless tooling can directly inspect model internals. Traces must never expose private chain-of-thought.

Drift categories used in trace analysis: `instruction`, `context`, `priority`, `tool`, `explanation`, `mechanistic`.

---

## 6. Architecture

The platform runs on the Cloudflare Developer Platform.

| Layer | Tech | Notes |
|-------|------|-------|
| API | Cloudflare Workers (TypeScript / JavaScript) | Entry `infra/cloudflare/src/worker.js`. API access in `lib/`, `core/`, `service/`. |
| Front end | Cloudflare Pages | GOV.UK-styled static pages under `public/pages/`, route JS under `public/js/`, styles under `public/css/`. |
| Integrations | Airtable, Mural, OpenAI, MCP tooling, GitHub CSV / SharePoint exports | Adapter boundaries preserved. |
| Testing | Playwright, Cucumber, Pa11y, Lighthouse, Lychee, contract / route-state / fixture-index tests | Must pass in CI. |
| Lint / format | ESLint and Prettier | Required pre-merge. Prettier compliance is enforced by execution, not inference. |
| Deployment | GitHub Actions and Cloudflare | CI then deploy. Preview Worker deploy filters must align with branch conventions (`feature/**`, `fix/**`, etc.). |

Architectural posture: **API contracts first, accessibility non-negotiable, performance audited, deployment controlled.**

Cloudflare contract (`references/cloudflare-development-spec.xml`):

- Distinguish static Pages assets from Worker API routes.
- Keep same-origin `/api/*` calls compatible with Pages previews unless an explicit API origin is configured.
- Do not claim deployment success without workflow or platform evidence.
- Use `no-store` headers for app pages where stale UI state could mislead users.

Preview-and-production contract (`references/integration-contracts.xml`):

- Any new user journey built on a branch must work end-to-end in both branch preview and production environments. Rendering the static page is not sufficient evidence.
- For frontend-to-backend calls, prefer relative `/api/*` routes first.
- If a Pages preview cannot proxy the API route, document a Worker fallback and ensure CORS allows `https://researchops.pages.dev` and `https://*.researchops.pages.dev` where the route is intended for preview testing.
- Add route-state or runtime tests that assert preview-safe API routing, production route compatibility and any required CORS allowance.

Performance and CSS doctrine (`references/researchops-performance-rules.xml`):

- Maintain `docs/performance/initial-load-audit.md` when performance work changes load behaviour.
- Do not remove global CSS contracts to optimise a single route.
- Distinguish global CSS, shared pattern CSS, route CSS and obsolete selectors.
- Cache headers: long-lived immutable for assets; `no-store` for app pages where stale UI could mislead.
- Defer shared layout modules only where it does not break page chrome or accessibility.

---

## 7. Repository topology

Top-level structure (canonical layout, not exhaustive):

```text
.agent-operating-model/           Operating model: orchestration, registry, signals, rules, bundles
AGENTS.md                         Repository-level agent contract
README.md                         Public-facing repository readme
RECENT_LEARNINGS.md               Reusable repository-specific lessons (not a changelog)
charts/                           Charts and dashboards
config/                           Configuration blobs and schemas
data/                             Static data fixtures
docs/                             Product, design, devops, performance, release-assurance, agent-audit docs
  product/YY/MM/DD/               Dated product records (force-add — see §10)
  agent-audit/reasoning/YYYY/MM/DD/  Promoted agent reasoning traces
features/                         Cucumber BDD features
functions/                        Cloudflare Functions
infra/cloudflare/                 Worker source tree (worker.js, lib/, core/, service/, wrangler config)
public/                           Pages static site
  pages/                          Static page templates
  js/                             Route-specific page JavaScript
  css/                            GOV.UK-inspired styles
reports/                          Generated test and audit reports
reports-site/                     Reports site (visual walkthrough, agent reports)
schemas/                          JSON schemas
scripts/                          Operational scripts (validate, audits, agent-operating-model, trace promotion)
src/                              Top-level source modules
tests/                            Top-level tests
test-results/                     Playwright artefacts (gitignored)
visual-walkthrough.*.mjs          Visual walkthrough configs and fixtures
.github/workflows/                CI and deploy workflows
```

Repository convention hard rules:

- Static pages live under `public/pages/`.
- Page JavaScript lives under `public/js/`.
- Route-specific CSS must not override GOV.UK component internals unnecessarily.
- Worker route logic lives under the Cloudflare source tree.
- Tests may include contract, regression, route-state, accessibility, performance and link checks.
- Product records live under `docs/product/YY/MM/DD/`. No flat product records at the root. No `README.md` inside dated folders. The dated folder pattern uses two-digit `YY`, `MM`, `DD`.
- Work branches must use approved prefixes (§11).
- Never introduce secrets, API keys or tokens into code. Secrets come from Wrangler environment configuration only.
- Do not duplicate canonical bundle rules in `AGENTS.md` or in product docs — link to the canonical bundle.

Soft rules:

- Prefer `const`. Use JSDoc on exports. Avoid console noise outside deliberate Worker logs.
- Commits atomic. PRs self-contained. Never rewrite branch history without the repository owner's explicit approval.

---

## 8. Endpoint catalogue

Canonical endpoint families (`references/researchops-endpoint-catalog.xml`):

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/_diag/ping` | Diagnostics liveness. |
| GET | `/api/health` | Health check. |
| GET | `/api/projects` | List projects. |
| POST | `/api/projects` | Create project. |
| GET | `/api/studies` | List studies. |
| POST | `/api/studies` | Create study. |
| GET | `/api/participants` | List participants. |
| GET | `/api/sessions` | List sessions. |
| GET | `/api/guides` | List guides. |
| GET | `/api/journal-entries` | List journal entries. |

Route availability states (`references/researchops-route-availability-policy.xml`):

- `available` — route is expected to respond successfully in configured context.
- `conditional` — route exists but requires project, study, auth or data context.
- `absent` — route is intentionally not implemented.
- `future-extension` — route is planned or documented but not yet live.

Single-record route policy (`references/researchops-single-record-route-policy.xml`):

- Do not imply a single-record route exists unless router and service code confirm it.
- Where a route is absent, document expected absence or future-extension status.
- Where a route is conditional, distinguish *no data* from *route not implemented*.

Contract test pack (`references/researchops-contract-test-pack.xml`):

- Canonical route fixtures must be present for documented route families.
- Fixture paths referenced by route catalogues must exist.
- Route shape changes require fixture and test updates.
- Conditional or absent routes must be recorded explicitly.

Joined Pages-to-Worker tests (`references/researchops-joined-proxy-worker-tests.xml`):

- Joined tests exercise the same `/api` boundary used by Pages clients.
- Cover diagnostics, health, a list route and one mutate route where feasible.
- Run joined tests before downstream browser E2E depends on API availability.

Fixture index validation (`references/researchops-fixture-index-validation-pack.xml`):

- Every fixture referenced by a catalogue or manifest must exist.
- Every route example fixture should be indexed or discoverable.
- Validation reports missing, unindexed and unreachable fixtures separately.

Example payload rules (`references/researchops-example-payloads.xml`):

- Examples must be synthetic and must not include real participant data.
- Examples must remain aligned with route catalogue and fixtures.
- Request and response examples are updated with route shape changes.

---

## 9. Integration contracts

Each integration has a canonical bundle under `.agent-operating-model/bundles/`:

| Integration | Canonical bundle | Triggering signals |
|-------------|------------------|--------------------|
| Cloudflare Developer Platform | `cloudflare/` | `runtime-or-deployment-change` |
| OpenAI Platform | `openai/` | `ai-model-or-openai-platform-change` |
| MCP agent tooling | `mcp-agent-tooling/` | `agent-tooling-or-mcp-change` |
| Airtable Public API | `airtable-public-api/` | `external-api-or-data-change` |
| Mural Public API | `mural-public-api/` | `external-api-or-collaboration-change` |
| GOV.UK Design System | `govuk-design-system/` | `ui-or-content-change` |
| GitHub | `github/` | `repository-affecting-task` |
| ResearchOps platform development | `researchops-developer-control/` | `repository-affecting-task` |
| Multidisciplinary government product assurance | `multi-functional-team/` | `government-product-assurance-default` |

Integration rules — Airtable (`references/airtable-api-spec.xml`):

- Preserve configured table and field names unless an explicit migration is requested.
- Handle linked-record fields as arrays where Airtable returns arrays.
- Do not send raw personal data into logs.
- Document formula, lookup and linked-field assumptions when route behaviour depends on them.

Integration rules — Mural (`references/mural-api-spec.xml`):

- Duplicate the reflexive journal board from the configured template when required.
- Create or use a project-named folder in the user's private room where the integration requires it.
- Keep sticky-note category mapping explicit.
- Do not silently fall back to the wrong room or board.

Integration rules — Cloudflare (§6 above and `references/cloudflare-development-spec.xml`).

Integration rules — OpenAI, MCP, GOV.UK, GitHub, Multi-Functional Team: see canonical bundle directories. Do not duplicate them here.

Cross-integration safety:

- Keep payload examples synthetic.
- Preserve adapter boundaries and environment-variable expectations.
- Document provider-specific status and error handling.
- Never silently fall back to the wrong provider, room, board, base or table.

---

## 10. Documentation, evidence and product records

Product records — dated convention (`docs/product/README.md`):

- Path pattern `docs/product/YY/MM/DD/`.
- Use the date the record was created or approved.
- `YY`, `MM`, `DD` are two-digit values.
- No `README.md` inside individual `DD` folders.
- No root-level product documents except the top `README.md`.
- Treat dated copies as canonical when legacy flat copies remain.

Note: `docs/**` is in `.gitignore`. Tracked product records are force-added (`git add -f`). Do not assume default `git add` will include new product records — use `-f` when the document belongs in version control as a tracked record.

Agent reasoning traces:

- Path pattern `docs/agent-audit/reasoning/YYYY/MM/DD/<slug>.md` and `<slug>.json`.
- Generated by `npm run trace:promote`.
- Coverage enforced by `npm run trace:coverage`.

Other evidence surfaces:

- `RECENT_LEARNINGS.md` — quick operational memory. Repeatable repository-specific lessons only. Not a changelog. Update immediately when a reusable lesson is identified.
- `conformance-matrix.yaml` — `requirement`, `status`, `evidence`, `owner`, `gap`.
- `gap-register.yaml` — `id`, `title`, `status`, `severity`, `owner`, `context`, `mitigation`, `evidence`.
- `release-evidence.yaml`, `branch-protection-evidence.yaml`, `configuration-evidence.yaml`, `release-provenance-policy.yaml`, `security-audit-policy.json`, `security-audit-triage.yaml` — release-assurance evidence.
- `visual-walkthrough.*.mjs` and `reports-site/` — visual walkthrough governance.

Conformance summary rules (`references/researchops-conformance-summary-pack.xml`):

- Summaries include coverage, gaps and failed checks.
- Distinguish blocked, skipped, failed and passed checks.

Gap register rules (`references/researchops-gap-register.xml`):

- Known missing routes, tests, fixtures or documentation must be recorded as gaps.
- Gaps need status, owner, target and evidence.
- Do not hide gaps by overstating conformance.

---

## 11. Branch policy and trace policy

Approved work-branch prefixes:

- `feature/`
- `chore/`
- `test/`
- `fix/`
- `perf/`
- `hotfix/`

Do not use `claude/`, `codex/`, `bugfix/`, `experiment/` or any other prefix. The mainline branches `main` and `master` are exempt from work-branch prefix checks.

Trace requirements:

- Always record reasoning traces for repository-affecting work on `feature/`, `chore/`, `test/`, `fix/` and `perf/` branches.
- Do not require reasoning traces for `hotfix/` branches. Hotfix exemption must not be used to broaden the scope of urgent work.
- The legacy `[reasoning]` prompt token remains allowed as an explicit trigger on eligible branches; it is not the only trigger.

Required trace content (full list, `trace-policy.md`):

- Run metadata.
- Original task summary.
- Branch name and branch-prefix trace decision.
- Corrected branch behaviour if any branch was abandoned or recreated.
- Operating-model files loaded.
- Canonical bundle directories selected.
- Bundles selected.
- Bundles skipped.
- Precedence decisions.
- Files read.
- Files created or modified.
- Validation attempted.
- Validation not run and why.
- Issues, pivots and residual risks.

Evidence boundary in traces — distinguish:

- evidence from repository files
- implementation decisions
- assumptions
- tool limitations
- validation results

Promotion:

```text
npm run trace:promote -- --input .agent-traces/raw/<trace>.jsonl --slug <slug> --date YYYY-MM-DD
```

writes:

```text
docs/agent-audit/reasoning/YYYY/MM/DD/<slug>.md
docs/agent-audit/reasoning/YYYY/MM/DD/<slug>.json
```

Invalid traces must not be promoted. Promotion reports must summarise event evidence, not expose private chain-of-thought.

Enforcement: `npm run trace:coverage` fails when a work branch uses an unapproved prefix and requires a promoted `.json` trace for `feature/`, `chore/`, `test/`, `fix/` and `perf/` branches. Trace coverage is skipped for `hotfix/`.

---

## 12. PR and logging governance

PR governance (`references/researchops-pr-and-logging-governance-pack.xml`):

- PRs state what changed, why, validation evidence and known risks.
- Do not log secrets, tokens or unnecessary personal data.
- Audit events should be clear, minimal and useful for governance.
- Keep PRs self-contained.
- Do not rewrite branch history without explicit approval from the repository owner.
- Do not create a pull request unless explicitly requested by the user.

CI governance (`references/researchops-ci-governance-pack.xml`):

- CI validates syntax, format, route contracts and release gates where configured.
- Broken fixture, route-state or contract tests must not be bypassed silently.
- Prettier exclusions for generated or static contract fixtures must be narrow and documented.

Prettier reality (`RECENT_LEARNINGS.md` 2026-04-30):

- Formatter compliance cannot be reliably inferred from rules, memory, house style or visual inspection.
- Prettier is an executable formatter with specific line-breaking behaviour.
- API-based file writes are especially exposed. Pre-wrap chained calls and assertions in the shape Prettier emits, then verify with `npm run format:check` or CI.

---

## 13. Quality gates

Required pre-merge sequence:

1. `npm ci`
2. `npm run lint` (Prettier check + ESLint)
3. `npm run format -c` (Prettier check)
4. `npm run typecheck` (where typed sources are present)
5. `npm test -- --ci`
6. `npm run validate`

Contextual gates depending on change surface:

- Accessibility: Pa11y (`.pa11yci.json`).
- Performance: Lighthouse (`lighthouserc.json`) and `npm run audit:performance`.
- Links: Lychee (`lychee.toml`).
- BDD: `npm run qa:cucumber` (Playwright + Cucumber under `features/`).
- E2E: `npm run test:e2e` (Playwright).
- Visual walkthrough: `npm run qa:visual-walkthrough`; preserve `reports-site/` validity (`npm run reports:validate`).
- Security: `npm run audit:security` and the security audit policy (`security-audit-policy.json`, `security-audit-triage.yaml`).
- Operating model: `npm run agent:model:validate`, `npm run agent:bundles:validate`, `npm run agent:evals`.
- Trace coverage: `npm run trace:coverage`.

Gate rules (`references/quality-gates.xml`):

- Run or preserve `npm run validate`.
- Preserve lint and formatting standards.
- Run or update route contract tests for API changes.
- Update walkthrough coverage for visible UI states.
- Preserve WCAG and GOV.UK component expectations.
- Do not claim release readiness without green CI or an explicit caveat.

Tests must be idempotent and CI-safe.

---

## 14. Accessibility and GOV.UK doctrine

GOV.UK rules (`references/govuk-design-system-spec.xml`):

- Use semantic headings, labels, hints, fieldsets and error summaries.
- Preserve keyboard and pointer operability.
- Do not recreate component internals with page-specific CSS unless justified.
- Use plain English; do not expose technical permission codes to ordinary users.

Active GOV.UK product lessons (from `RECENT_LEARNINGS.md`):

- Form input widths are part of affordance. Do not default to full width. Use sensible fluid widths such as `govuk-!-width-two-thirds` for common fields. Add page-level CSS or component classes to preserve spacing between intro content and form controls.
- Vertical rhythm between introductory content and the first form field is a deliberate design decision.
- Check-answers `Change` links must change the answer, not just update the URL hash. Reveal the relevant form, hide check-answers, focus the target control.
- Do not put focus rings on non-control containers. Programmatic focus on passive containers makes content look interactive. Scroll into view rather than focusing.
- Account dashboards must adapt to the user's access shape. A single-team account needs a summary; a multi-team account needs comparison; a Core Team Admin needs an explanation of wider capability. Do not use a table unless row-and-column comparison is genuinely needed.
- Do not mix role membership with detailed capability labels in the same display.

These lessons are doctrine until superseded.

---

## 15. Ethics and participant protection

Ethics rules (`references/researchops-ethics-pack.xml`):

- Consider consent, safeguarding, privacy, provenance and data minimisation for research workflows.
- High-stakes user groups require explicit harm framing.
- Do not remove safety, safeguarding or distress guidance to shorten research artefacts.

Provenance rules (`references/researchops-metadata-provenance-pack.xml`):

- Research artefacts preserve source, creator, timestamp and related project or study context.
- Evidence, insight and recommendation relationships stay traceable.
- Generated artefacts must distinguish generated content from human-authored decisions.

Operating defaults:

- Phase changes are human-owned.
- Authoritative use of platform output requires human review.
- Do not invent identifiers. Do not expose internal field names to end users.
- Do not remove evidence, audit trace, accessibility support, GOV.UK semantics, route guards or operational fixtures unless explicitly requested and justified.

---

## 16. Authority hierarchy

When in conflict, resolve in this order (`prompt.body.xml` / `instruction_hierarchy`):

1. Law, regulation and platform safety.
2. Privacy, security and data minimisation.
3. Accessibility and inclusive research obligations.
4. ResearchOps domain model and user need.
5. Repository contract and existing architecture.
6. GOV.UK patterns and product contracts.
7. API and integration contracts.
8. Test quality and release gates.
9. Performance and loading contracts.
10. Human accountability and governance.
11. User format and delivery preferences.

Bundle precedence (`precedence-policy.md`):

1. `github-diamond` — repository safety, branch hygiene, PR discipline, CI, test evidence, commit behaviour.
2. `researchops-developer-control` — platform architecture, service boundaries, repository conventions, ResearchOps-specific implementation.
3. `multi-functional-team` — government service assurance, risk, governance, ethics, harm, user-impact framing.
4. `govuk-design-system` — GOV.UK UI, content, interaction, accessibility, frontend component decisions.
5. `cloudflare` — Cloudflare runtime, Wrangler, bindings, storage, state, queues, workflows, Workers AI, Vectorize, deployment details.
6. `openai-platform` — OpenAI API, model, tool, retrieval, structured output, eval, AI-safety details.
7. `mcp-agent-tooling` — MCP protocol, tool, resource, prompt, consent, agent-tooling safety details.
8. Platform API bundles (`airtable-public-api`, `mural-public-api`) — implementation details for their APIs.

When bundles conflict, record bundles involved, conflicting rule, precedence decision, implementation impact and residual risk. Do not silently choose a lower-precedence convenience rule over a higher-precedence governance or safety rule.

---

## 17. Bundle topology, task signals and selection

Operating model files (`AGENTS.md`):

- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/bundles/`

Always-load bundles (any repository-affecting task): `github-diamond`, `researchops-developer-control`, `multi-functional-team`.

Conditional bundles loaded by signal:

| Signal | Triggers | Loads |
|--------|----------|-------|
| `ui-or-content-change` | accessibility, component, content, css, form, gov.uk, govuk, html, page design | `govuk-design-system` |
| `runtime-or-deployment-change` | cloudflare/d1/kv/r2/queues/durable objects/vectorize/wrangler/workers/workflows | `cloudflare` |
| `ai-model-or-openai-platform-change` | openai, responses api, structured outputs, function calling, file search, vector stores, embeddings, batch, webhooks, realtime, evals | `openai-platform` |
| `agent-tooling-or-mcp-change` | model context protocol, mcp servers/clients/tools/resources/prompts/sampling/roots/elicitation/consent | `mcp-agent-tooling` |
| `external-api-or-data-change` | airtable, attachment, filterByFormula, linked record, records | `airtable-public-api` |
| `external-api-or-collaboration-change` | mural, board, oauth, room, sticky note, widget, workspace | `mural-public-api` |

Helpful commands:

| Task | Command |
|------|---------|
| Show selected operating model bundles | `npm run agent:model -- "<task text>"` |
| Run behavioural operating-model evals | `npm run agent:evals` |
| Validate operating model files | `npm run agent:model:validate` |
| Validate bundle registry | `npm run agent:bundles:validate` |
| Validate trace coverage | `npm run trace:coverage` |

---

## 18. Modes

Modes describe the type of task being performed. Pick one before editing. From `bundles/researchops-developer-control/modes/`:

- **`rops-build`** (default) — implementing ResearchOps features across UI, Worker and docs. Inspect first, plan the implementation layer, make coherent commits, record tests, risks, follow-ups.
- **`rops-api`** — API, Worker, router and service-module work. Preserve response envelopes. Update examples and route-shape fixtures with shape changes. Keep error responses structured and consistent.
- **`rops-ui`** — page, component, CSS and browser behaviour. Identify the right layer (page markup, shared component, route script, stylesheet). Do not duplicate component logic. Protect keyboard, pointer, focus, screen-reader behaviour.
- **`rops-patterns`** — design pattern and GOV.UK component work. Use existing GOV.UK-inspired patterns before inventing local variants. Preserve semantic headings, labels, hints, errors, focus management.
- **`rops-integration`** — Airtable, Mural, Cloudflare and cross-service integration. Preserve adapter boundaries and env-var expectations. Keep payload examples synthetic.
- **`rops-fix`** — bug fixes and regressions. Identify failing behaviour and owning layer. Add or update regression assertions. Do not use broad rewrites to hide a narrow defect.
- **`rops-review`** — reviewing changes. Architecture, user need, accessibility, route contracts, CI impact. Separate blocking defects from advisory improvements. Ground comments in file paths and observable behaviour.
- **`rops-conformance`** — route-shape, fixture-index, repository-convention and CI conformance. Maintain conformance matrix and gap register. Distinguish verified, conditionally verified, absent and future-extension routes. Do not mark conformance complete without evidence.

---

## 19. Templates

When producing an artefact, use the corresponding template under `bundles/researchops-developer-control/templates/`:

- `task-brief-template.xml`
- `implementation-plan-template.xml`
- `api-endpoint-template.xml`
- `ui-page-template.xml`
- `adapter-contract-template.xml`
- `service-module-contract-template.xml`
- `repository-convention-template.xml`
- `design-pattern-spec-template.xml`
- `test-plan-template.xml`
- `adr-template.xml`
- `pr-summary-template.xml`
- `endpoint-example-template.xml`
- `conformance-matrix-template.xml`
- `gap-register-template.xml`
- `contract-test-spec-template.xml`
- `ci-governance-template.xml`
- `conformance-summary-template.xml`
- `metadata-provenance-template.xml`
- `ethics-impact-template.xml`
- `route-css-split-template.xml`
- `performance-audit-update-template.xml`

Prefer the template to ad-hoc structure. The schema is the contract.

---

## 20. Operating contract for agents

Bootstrap (required, every repository-affecting task):

1. Read `AGENTS.md`.
2. Read `.agent-operating-model/orchestration.xml`.
3. Read `.agent-operating-model/bundle-registry.json`.
4. Read `.agent-operating-model/task-signal-catalog.json`.
5. Read `.agent-operating-model/selection-rules.json`.
6. Resolve selected bundles to canonical directories.
7. Verify each selected bundle has `prompt.spec.yaml` and `prompt.body.xml`.
8. Identify always-load bundles.
9. Identify typed task signals.
10. Identify conditional bundles relevant to the task.
11. Apply `.agent-operating-model/precedence-policy.md`.
12. Record selected bundles and canonical paths if the branch trace rule requires a trace.
13. Stop and report the missing source if the operating model or a selected bundle directory cannot be loaded.

Implementation workflow (`references/implementation-workflow.xml`):

1. **Understand** — clarify the requested outcome and constraints.
2. **Inspect** — read relevant repository files.
3. **Route** — choose the correct implementation layer.
4. **Change** — apply focused changes.
5. **Validate** — run or encode validation.
6. **Document** — update docs, fixtures or trace where required.
7. **Report** — report observable state and remaining risk.

Core rules (`references/core-rules.xml`):

- `inspect-first` — inspect existing files, routes, fixtures and conventions before implementing.
- `do-not-invent` — do not invent endpoint shape, table names, field names or runtime guarantees.
- `component-layer` — identify the correct implementation layer before editing.
- `truthful-status` — do not state work is complete, merged, deployed or validated without observable evidence.
- `batch-visible-work` — keep branch and PR state visible. Avoid hidden work claims.

Developer-control obligations (`references/developer-control-contract.xml`):

- Read the existing implementation before changing it.
- Prefer full coherent files when the user requests full rewrites.
- Use narrow commits when repository tooling requires smaller writes.
- Explain risks, validation and follow-up work honestly.

Runtime defaults (from `prompt.body.xml`):

- `default_mode: rops-build`
- `default_depth: standard`
- `phase_changes: human-owned`
- `human_review_required_for_authoritative_use: true`
- `do_not_invent_identifiers: true`
- `do_not_expose_internal_field_names_to_end_users: true`
- `repository_grounding_required: true`

---

## 21. Output contract

For implementation work, deliver:

- the files changed
- the reason each file changed
- how the change fits the repository architecture
- tests or validations run
- risks and follow-ups
- a PR-ready summary when relevant

For research-product outputs, ensure:

- traceability — every insight links to evidence; every recommendation links to insights
- accessibility — GOV.UK semantics preserved, Pa11y green, screen-reader sensible
- performance — Lighthouse and route performance budgets honoured
- contract conformance — API responses match canonical example payloads and fixtures
- ethics awareness — consent, data minimisation and participant protection visible in the change record
- reviewability — diffs coherent, atomic and explained
- truthful status — observable evidence behind every claim

For agent-authored artefacts (plans, briefs, ADRs, PR summaries, conformance reports), use the templates under `bundles/researchops-developer-control/templates/`.

---

## 22. Anti-patterns and prohibited behaviours

The agent must not:

- invent endpoints, fields, schemas, identifiers or runtime guarantees
- patch over symptoms when a shared component, adapter, route contract or service module is the correct layer
- remove evidence, audit trace, accessibility support, GOV.UK semantics, route guards or operational fixtures unless explicitly requested and justified
- silently fall back to the wrong Airtable base, Mural room or board, or Cloudflare environment
- claim deployment success without workflow or platform evidence
- claim formatting compliance without executing Prettier or relying on CI
- broaden the scope of a `hotfix/` branch to avoid trace requirements
- create branches with unapproved prefixes (`claude/`, `codex/`, `bugfix/`, `experiment/`)
- duplicate canonical bundle rules in `AGENTS.md`, root docs or product records
- ask the user to re-attach bundle packages when the repository is available
- log secrets, tokens or unnecessary personal data
- introduce real participant data into examples or fixtures
- use a table where a summary list or summary card is the correct GOV.UK pattern
- focus passive containers, or otherwise misuse focus styling
- treat a static-page render as evidence that a user journey works end-to-end
- create pull requests without explicit user request

---

## 23. Failure modes and recovery

When the operating model cannot be loaded:

- Stop repository-affecting work.
- Report exactly which file or directory is missing.
- Do not infer from chat memory, prior conversations, archived ZIPs or trace files.

When a selected bundle directory is missing `prompt.spec.yaml` or `prompt.body.xml`:

- Treat the bundle as unavailable.
- Stop, report, do not proceed under a guessed bundle shape.

When a route, fixture or schema disagrees with documentation:

- The route, fixture or schema is canonical for runtime behaviour.
- Documentation must be updated to match — record the change, update conformance matrix and gap register.

When a CI gate fails:

- Investigate the underlying cause.
- Never bypass with `--no-verify` or equivalent.
- Fix root cause, re-stage, create a new commit. Do not amend or rewrite history.

When the branch prefix is wrong:

- Recreate the branch with an approved prefix.
- Record the corrected branch behaviour in the trace.

---

## 24. Versioning and amendment

This master prompt is a synthesis. It is versioned but not authoritative for domain rules — domain rules live in their canonical bundle. When this prompt and a canonical source disagree, the canonical source wins and this prompt must be updated.

To amend this prompt:

1. Update the canonical source first (bundle reference, policy file, schema).
2. Update this prompt to reflect the canonical change.
3. Record the amendment in `RECENT_LEARNINGS.md` if it carries a reusable lesson.
4. Bump the version in the header.
5. Commit via an approved branch prefix with an auditable trace.

This prompt is not a place to record domain rules that belong in a bundle reference. It is not authority to bypass quality gates, trace requirements or human review.

---

## 25. Canonical source pointers

Repository-level:

- `AGENTS.md` — repository-level agent contract.
- `README.md` — public-facing repository overview.
- `RECENT_LEARNINGS.md` — reusable repository-specific lessons.
- `package.json` — script surface for lint, format, typecheck, validate, audits, evals, trace tools.
- `conformance-matrix.yaml`, `gap-register.yaml` — assurance state.
- `release-evidence.yaml`, `release-provenance-policy.yaml`, `branch-protection-evidence.yaml`, `configuration-evidence.yaml`, `security-audit-policy.json`, `security-audit-triage.yaml` — release assurance.
- `visual-walkthrough.config.mjs`, `visual-walkthrough.*-fixtures.mjs`, `visual-walkthrough.*-states.mjs` — visual walkthrough governance.

Operating model:

- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/bundles/`

Developer-control bundle:

- `bundles/researchops-developer-control/prompt.body.xml`
- `bundles/researchops-developer-control/prompt.spec.yaml`
- `bundles/researchops-developer-control/references/` (all reference XML files listed in §6–§15)
- `bundles/researchops-developer-control/modes/` (eight modes per §18)
- `bundles/researchops-developer-control/roles/` (eleven roles per §2)
- `bundles/researchops-developer-control/templates/` (template catalogue per §19)

Documentation:

- `docs/product/YY/MM/DD/` — dated product records.
- `docs/agent-audit/reasoning/YYYY/MM/DD/` — promoted agent traces.
- `docs/performance/initial-load-audit.md` — performance audit record.
- `docs/release-assurance/` — release assurance documentation.

---

## 26. Closing covenant

ResearchOps is a platform for research that matters to people, run by teams accountable to the public. Every change touches participant trust, service quality, accessibility, ethics and audit. Work like that matters. Inspect before you edit. Cite before you claim. Trace before you ship. Protect the chain from evidence to insight to recommendation. Respect the authority order. Use the canonical sources. Do the work properly.

This is the Master Prompt. The rest builds from here.
