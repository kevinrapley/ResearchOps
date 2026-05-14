# ResearchOps Platform — Master Prompt

Version: 3.0.0
Date: 2026-05-14
Status: Canonical master prompt — King of the World tier
Scope: ResearchOps platform (this repository)
Authority: This document is a synthesis layer over canonical sources. It is authoritative as a reading order and operating posture. Where a canonical bundle, reference, schema, fixture, route handler or repository contract disagrees with this prompt, the canonical source wins and this prompt must be updated.

---

## 0. Preamble

ResearchOps is not a generic productivity tool. It is a public-service research operations platform with audit, ethics, accessibility, consent and traceability obligations. An agent, contributor or model working on this repository operates inside a governed system with real participants, real consent, real lawful basis and real retention timers.

Read this document end-to-end. Resolve the canonical sources it points to. Then act.

---

## 1. Identity, mission and manifesto

ResearchOps is a Cloudflare-hosted, Airtable-backed, GOV.UK-styled platform that supports user research operations across the lifecycle of a service project. It helps multidisciplinary public-service teams plan, run, govern and synthesise primary research so that decisions are traceable from evidence to insight to recommendation.

The platform exists to:

- give research-active teams a single operational surface for projects, studies, participants, sessions, guides, consent, journals, codes, memos, excerpts, analysis and synthesis
- protect participants through consent lifecycle management, ethics review, accessibility, lawful-basis recording, retention and data minimisation by default
- preserve auditable traceability from raw evidence to insight to recommendation
- align with GOV.UK service standards and assisted-digital expectations
- integrate with Airtable for source-of-truth records, Mural for collaborative synthesis and reflexive journals, OpenAI / Workers AI for assistive text operations, and GitHub-backed CSV for resilient fallbacks
- give delivery teams a deployment-controlled, contract-tested, accessibility-validated path to production

Core manifesto:

1. **Evidence before claim.** Recommendations require traceable insights; insights require traceable evidence.
2. **Consent before contact.** Participant data is not used until consent is recorded, lawful basis is set, retention schedule is set, and current.
3. **Accessibility is non-negotiable.** GOV.UK semantics, WCAG compliance and assistive-technology behaviour are first-class.
4. **Inspect before edit.** No speculative changes; no invented endpoints, fields, table names or schemas.
5. **Contract before convenience.** Route contracts, fixture catalogues, schemas and conformance matrices govern API and UI behaviour.
6. **Human accountability is preserved.** Agents propose; humans approve phase changes and authoritative use.
7. **Truthful status, always.** Do not state work is complete, merged, deployed or validated without observable evidence.
8. **Provenance survives refactors.** The evidence chain must survive exports, syncs, withdrawals and integration round-trips.

---

## 2. Audience, personas and role lenses

End-user personas:

- **Service owner / delivery lead** — needs oversight of research activity across phases.
- **User researcher** — plans studies, runs sessions, manages participants, synthesises findings.
- **Designer** — consumes insights, runs design critiques.
- **Product manager** — owns discovery decisions and prioritisation.
- **Ethics reviewer** — governs participant protection.
- **Accessibility specialist** — validates inclusive practice.
- **Team admin** — manages team membership, role assignments and registration requests.
- **ResearchOps Core Team Admin** — wider administrative capability across teams (special role).
- **Participant** — a member of the public whose data, consent and dignity the platform must protect.

Internal contributor personas: Developer, QA engineer, DevOps engineer, Security engineer.

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

## 3. Domain model and vocabulary

Core entities and their semantics:

- **Project** — the unit of service work in a phase (Discovery, Alpha, Beta, Live), with name, org, status, description, objectives, stakeholders, user groups, outputs.
- **Project Detail** — extended project record linked to a project.
- **Study** — a planned piece of research inside a project, with method, sample, recruitment criteria, schedule and outputs.
- **Participant** — a person who has consented to take part. Identified by pseudonym, user type, status, consent status.
- **Session** — a recorded research interaction (interview, usability test, workshop, observation) — has start time, type (Remote / In person), status (Scheduled / Completed / Cancelled / Did not attend).
- **Session Note** — notes captured during or after a session, linked to a session.
- **Discussion Guide** — the protocol used to run a session (Markdown / Mustache template, versioned, with publish state).
- **Partial** — a reusable template fragment included by guides and consent forms.
- **Consent Form** — a versioned consent document with required statements and optional permissions, in draft or published state.
- **Participant Consent Record** — a consent decision linking a participant to a specific consent form version, with status (`Ready for session`, `Needs review`, `Needs consent`, `Withdrawn`, `Not recorded`), captured responses, capture method, recorded-by, recorded-at, withdrawal reason and timestamp.
- **Journal Entry** — a notes record produced during or after a session, categorised (`decisions`, `insights`, `risks`, reflexive), tagged, linked to project and optionally study.
- **Journal Excerpt** — a quote from a journal entry, tagged, used as evidence.
- **Memo** — an analyst working note.
- **Code** — a qualitative analysis code (label, definition).
- **Code Application** — an application of a code to a piece of evidence.
- **Insight** — a synthesised statement traceable to one or more pieces of evidence (sessions, journal entries, excerpts).
- **Cluster** — a synthesis grouping of related evidence.
- **Theme** — a higher-order synthesis grouping of clusters.
- **Recommendation** — a proposed action traceable to one or more insights.
- **Impact / Outcome** — a measurable outcome tracked over time.
- **Mural Board** — a Mural workspace board linked to a project.
- **AI Usage Log** — recorded model interactions for audit (`AI_Usage` table).
- **Provenance Event** — an audit event for any creation, update, withdrawal or sync action.

Domain invariants:

- A study belongs to exactly one project.
- A session belongs to exactly one study and references one participant and one guide.
- A participant may appear in many sessions across many studies; each appearance carries its own consent record version.
- A journal entry references one project, optionally one study; an excerpt references the parent journal entry and may carry tags.
- An insight references one or more pieces of evidence (sessions, journal entries, excerpts, memos). An insight without evidence is invalid.
- A recommendation references one or more insights. A recommendation without insights is invalid.
- A consent record is binding. Withdrawal sets `withdrawn = true`, records `withdrawal_reason`, marks status `Withdrawn`, timestamps the withdrawal, and propagates a provenance event downstream.
- Discussion guides and consent forms are versioned; only published versions may be referenced by sessions and consent records.
- Phase changes are human-owned.

Vocabulary — terms to use exactly:

- **Phase**, not stage. Allowed values: Discovery, Alpha, Beta, Live.
- **Study**, not workstream.
- **Participant**, not subject or user (when referring to the person we research with).
- **Discussion guide**, not script.
- **Consent form**, not consent document.
- **Journal entry**, not note (notes are a different thing — session notes).
- **Excerpt**, not snippet or quote (when referring to tagged journal evidence).
- **Insight** and **recommendation** are distinct. Do not collapse them.
- **Lawful basis**, not legal basis (the consent schema uses `LawfulBasis`).
- **Retention schedule**, not retention period (ISO 8601 duration form, e.g. `P12M`).

Design patterns applied to the domain (`references/researchops-design-patterns.xml`):

- `project-context` — pages scoped to a project must preserve project identity and return routes.
- `study-context` — pages scoped to a study must preserve both project and study identity.
- `empty-state` — empty states explain what is missing and what the user can do next.
- `check-before-write` — high-impact actions validate and show a check step before write.

---

## 4. User journeys

The platform organises around six canonical journeys (from `reports-site/manifest.json`):

1. **Start research work** — `home` → `start` → `projects` → `project-dashboard`.
2. **Prepare a study** — `study` → `study-guides` → `study-participants`.
3. **Manage participants and consent** — `study-consent-forms` → `study-participant-consent` → `study-participants`.
4. **Run sessions** — `sessions` → `study-session` → `notes`.
5. **Synthesize evidence** — `synthesize` → `journals` → `outcomes`.
6. **Review outcomes** — `outcomes` → `search`.

Cross-journey surfaces: account dashboard, registration request, sign-in, team admin role assignment, search.

Visual walkthrough coverage: 26 pages, 43 states, 86 captures across desktop (1440×1200) and mobile (412×915) profiles. Failures = 0 is the standing expectation.

---

## 5. Page inventory

Static pages under `public/pages/` (and `pages/`):

**Auth and account**

- `public/pages/account/index.html` — Account dashboard (adaptive: single-team summary / multi-team list / Core Team Admin inset).
- `public/pages/account/register/index.html` — Account registration request.
- `public/pages/account/sign-in/index.html` — Passwordless sign-in.
- `public/pages/team/registration-requests/index.html` — Team admin: review pending registration requests.
- `public/pages/team/role-assignments/index.html` — Team admin: assign roles.

**Project and study**

- `public/pages/projects/index.html` — Project listing with CSV fallback.
- `public/pages/project-dashboard/index.html` — Project overview, phase, tasks.
- `public/pages/study/index.html` — Study detail with inline description editor and readiness checklist.
- `public/pages/study/new/index.html` — Study creation form.
- `public/pages/study/guides/index.html` — Discussion guide editor.
- `public/pages/study/consent-forms/index.html` — Consent form template management.
- `public/pages/study/participant-consent/index.html` — Record and review participant consent.
- `pages/start/index.html` — Project creation wizard.
- `pages/start/overview/index.html` — Project start overview.

**Participants and sessions**

- `public/pages/project-dashboard/participants/index.html` — Project-scoped participant management.
- `public/pages/study/participants/index.html` — Study-scoped participant view.
- `public/pages/sessions/index.html` — Session list and scheduling.
- `public/pages/study/session/index.html` — Run a session, record notes.

**Analysis and synthesis**

- `public/pages/projects/journals/index.html` — Journal entry list with tabs.
- `public/pages/synthesize/index.html` — Evidence clustering and themes.
- `public/pages/projects/outcomes/index.html` — Insight and recommendation review.
- `public/pages/notes/index.html` — Unified notes and reflection.
- `public/pages/search/index.html` — Cross-project evidence search.

**Utilities**

- `public/pages/consent/index.html` — Generic consent form display.

GOV.UK page chrome conventions (representative — `public/pages/projects/index.html`):

- `x-include` partials for `header.html`, `footer.html`, `debug.html`.
- `<main class="govuk-main-wrapper" id="main-content" role="main" tabindex="-1">`.
- `<h1 class="govuk-heading-xl page-title">`.
- `<p class="lede">` for the page lede.
- `<a class="govuk-button" role="button">` for primary action.
- `aria-live="polite"`, `aria-busy="true"` on list containers during load.
- Module preload for the page script with a versioned query string.
- GOV.UK CSS modules loaded explicitly (`govuk-typography.css`, `govuk-colours.css`, `govuk-page-chrome.css`, `govuk-buttons.css`).

Active GOV.UK doctrine (from `RECENT_LEARNINGS.md`):

- Form input widths are part of affordance. Default sensible fluid widths (e.g. `govuk-!-width-two-thirds`).
- Vertical rhythm between introductory content and the first form field is a deliberate design decision.
- Check-answers `Change` links must change the answer, not just update the URL hash.
- Do not put focus rings on non-control containers; scroll into view rather than focus passive containers.
- Account dashboards adapt to access shape (single-team / multi-team / Core Team Admin). Do not use a table unless row-and-column comparison is genuinely needed.
- Do not mix role membership with detailed capability labels in the same display.

---

## 6. API surface

Entry point: `infra/cloudflare/src/worker.js`. Dispatch falls through to `infra/cloudflare/src/core/router.js` for the bulk of routes. All routes are namespaced under `/api/`.

**Diagnostics and health**

- `GET /api/_diag/ping` — liveness ping.
- `GET /api/_diag/env` — environment configuration check.
- `GET /api/health` — service health.

**Authentication and identity**

- `GET|POST /api/auth/registration-requests` — registration requests CRUD.
- `POST /api/auth/email/*` — passwordless email magic-link flow.
- `POST /api/auth/logout` — passwordless session logout.
- `GET /api/me` — authenticated user context (user, active team, roles, permissions).
- `GET /api/me/permissions` — permissions surface only.
- `POST /api/auth/role-assignments` — assign role.

**Projects**

- `GET /api/projects` — list projects.
- `GET /api/projects/{id}` — project record (via `handleProjectRecord`).
- `GET /api/projects.csv` — projects CSV (GitHub-backed fallback).

**Studies**

- `GET /api/studies` — list studies.
- `GET|POST|PATCH /api/studies/{id}` — study CRUD.

**Discussion guides and partials**

- `GET|POST|PATCH /api/guides/{id}` — guide CRUD and publish.
- `GET|POST|PATCH /api/partials/{id}` — partial CRUD.

**Participants and sessions**

- `GET|POST|PATCH /api/participants` — participant CRUD.
- `GET|POST|PATCH /api/sessions/{id}` — session CRUD and `.ics` calendar export.
- `GET|POST|PATCH /api/session-notes/{id}` — session note CRUD.

**Consent**

- `GET|POST|PATCH /api/consent-forms/{id}` — consent form CRUD and publish.
- `GET|POST|PATCH /api/participant-consent/{id}` — participant consent record CRUD with withdrawal handling.

**Journals, excerpts, memos**

- `GET|POST|PATCH /api/journal-entries/{id}` — journal entry CRUD.
- `GET|POST|PATCH /api/excerpts/{id}` — excerpt CRUD.
- `GET|POST|PATCH /api/memos/{id}` — memo CRUD.

**Qualitative analysis**

- `GET|POST|PATCH /api/codes/{id}` — code CRUD.
- `GET|POST|PATCH /api/code-applications` — code-to-evidence mappings.
- `GET /api/analysis/timeline` — analysis timeline.
- `GET /api/analysis/cooccurrence` — code co-occurrence.
- `GET /api/analysis/retrieval` — evidence retrieval.
- `GET /api/analysis/export` — export to CSV/JSON.

**Synthesis**

- `GET|POST|PATCH /api/synthesis/clusters/{id}` — cluster CRUD.
- `POST /api/synthesis/themes` — theme creation.

**Impact**

- `GET|POST /api/impact` — impact tracking.

**Mural OAuth and sync**

- `GET /api/mural/auth` — start OAuth.
- `GET /api/mural/callback` — OAuth callback.
- `GET /api/mural/verify` — verify session.
- `GET /api/mural/resolve` — resolve user workspace/room.
- `POST /api/mural/setup` — set up project folder.
- `GET /api/mural/find` — find boards.
- `GET /api/mural/await` — wait for board readiness.
- `POST /api/mural/journal-sync` — sync journal to Mural board.

**Communications and AI**

- `POST /api/comms/send` — email dispatch via Resend.
- `POST /api/ai-rewrite` — Workers AI text rewrite (Llama 3.1 8B by default).

Route availability states (`references/researchops-route-availability-policy.xml`):

- `available` — responds successfully in configured context.
- `conditional` — exists but requires project, study, auth or data context.
- `absent` — intentionally not implemented.
- `future-extension` — planned but not yet live.

Single-record route policy (`references/researchops-single-record-route-policy.xml`):

- Do not imply a single-record route exists unless router and service code confirm it.
- Where a route is absent, document expected absence or future-extension status.
- Where a route is conditional, distinguish *no data* from *route not implemented*.

Canonical example payloads live under `bundles/researchops-developer-control/examples/`. Examples must be synthetic and aligned with route catalogue and fixtures.

CORS:

- Allowed origins are configured via the `ALLOWED_ORIGINS` Worker var: `https://researchops.pages.dev`, `https://rops-api.digikev-kevin-rapley.workers.dev`, `http://localhost:8080`, `https://reops-sourcebook.pages.dev`. Branch preview origins under `https://*.researchops.pages.dev` must be allowed when a journey is intended for preview testing.
- Headers: `Access-Control-Allow-Origin`, `Vary: Origin`, `Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`, `Access-Control-Allow-Headers: Authorization, Content-Type, X-ResearchOps-Team-Id`, `Access-Control-Allow-Credentials: true`.
- `X-ResearchOps-Team-Id` header is the explicit team-context override for multi-team scenarios.

---

## 7. Service module catalogue

All service modules live under `infra/cloudflare/src/service/`. Treat each module as a service boundary.

**Research core**

- `projects.js`, `studies.js`, `participants.js`, `sessions.js`, `session-notes.js`.

**Research materials**

- `guides.js` (Markdown / Mustache), `consent-forms.js`, `participant-consent.js`, `partials.js`.

**Evidence and analysis**

- `journals.js`, `excerpts.js`, `memos.js`, `reflection/codes.js`, `reflection/code-applications.js`, `reflection/analysis.js`, `synthesis.js`.

**Integrations**

- `mural-journal-sync.js`, `mural-journal-sync-safe-tags.js`, `mural-journal-sync-layout.js`.

**Communications and AI**

- `comms.js` (Resend email), `csv.js`, `ai-rewrite.js`.

**Impact and governance**

- `impact.js`, `impact-internals.js`, `provenance.js`, `provenance-read.js`.

**Internals (adapters and storage)**

- `internals/airtable.js` — Airtable API adapter.
- `internals/github.js` — GitHub CSV fetch.
- `internals/mural.js` — Mural API adapter and OAuth session.
- `internals/researchops-d1.js` — D1 database access.
- `internals/journals-dualwrite.js` — dual-write for journals during migration phases.
- `internals/responders.js` — response formatting.

**Diagnostics**

- `dev/diag.js`, `health.js`.

**Mode coupling.** API and Worker work uses mode `rops-api`. Integration work uses `rops-integration`. Cross-cutting build work uses `rops-build`. Always inspect the relevant service module before editing API behaviour. Preserve response envelopes unless explicitly migrating them. Update examples and route-shape fixtures when response shape changes. Keep error responses structured and consistent.

---

## 8. Data layer

### 8.1 Airtable (source of truth for product records)

Tables configured via `infra/cloudflare/wrangler.toml`:

| Var | Table |
|-----|-------|
| `AIRTABLE_TABLE_AI_LOG` | `AI_Usage` |
| `AIRTABLE_TABLE_PROJECTS` | `Projects` |
| `AIRTABLE_TABLE_DETAILS` | `Project Details` |
| `AIRTABLE_TABLE_MURAL_BOARDS` | `Mural Boards` |
| `AIRTABLE_TABLE_JOURNAL` | `Journal Entries` |
| `AIRTABLE_TABLE_STUDIES` | `Project Studies` |
| `AIRTABLE_TABLE_SESSIONS` | `Sessions` |
| `AIRTABLE_TABLE_SESSION_NOTES` | `Session Notes` |
| `AIRTABLE_TABLE_GUIDES` | `Discussion Guides` |
| `AIRTABLE_TABLE_PARTIALS` | `Partials` |
| `AIRTABLE_TABLE_CODES` | `Codes` |
| `AIRTABLE_TABLE_CODE_APPLICATIONS` | `Code Applications` |

Airtable rules (`references/airtable-api-spec.xml`):

- Preserve configured table and field names unless an explicit migration is requested.
- Handle linked-record fields as arrays where Airtable returns arrays.
- Do not send raw personal data into logs.
- Document formula, lookup and linked-field assumptions when route behaviour depends on them.

DevOps Airtable guidance lives under `docs/devops/airtable/` (attachment, checkbox, collaborator, create, delete-multiple, get, linked-records, list, number, rollup-lookup, select, sync-csv, text, update-multiple, update, upload).

### 8.2 D1 (auth foundation)

D1 database `RESEARCHOPS_D1` (`database_id: 48b35a2e-52e8-4bc0-a8cf-88a7a1536f04`). Inferred schema from `core/auth/access-scoped.js` and `route-permissions.js`:

```sql
auth_users(id, email UNIQUE, provider, created_at)
auth_teams(id, name, team_status)
auth_team_memberships(user_id, team_id, status, created_at)
auth_roles(id, role_key UNIQUE, label, description, is_sensitive, scope_type)
auth_role_assignments(id, user_id, role_id, scope_type, scope_id,
                     assignment_status, expires_at, created_at)
auth_permissions(id, code UNIQUE, label, is_sensitive, is_reserved)
auth_role_permissions(role_id, permission_id)
auth_route_declarations(method, route_pattern, required_permissions_json,
                       auth_required, implementation_status)
```

Scopes: `team`, `project`, `study`. Assignment statuses: `active`, `pending`, `rejected`, `expired`.

Special role: `team_admin` on the `ResearchOps Core Team` (id `team_researchops_core`) confers `ResearchOps Core Team Admin` capability.

D1 lifecycle workflows: `apply-d1-auth-foundation.yml`, `apply-d1-auth-role-assignment-route.yml`, `bootstrap-d1-auth-runtime.yml`.

### 8.3 KV (sessions)

KV namespace `SESSION_KV` (id `8e2d88969b9e4be694868931bdba92f2`). Stores passwordless session tokens and short-lived magic-link codes.

### 8.4 Workers AI

Binding `AI`. Default model `@cf/meta/llama-3.1-8b-instruct`. Used by `ai-rewrite.js`. Every interaction is logged to the Airtable `AI_Usage` table (`AIRTABLE_TABLE_AI_LOG`). `AUDIT = "true"` is the standing audit posture.

### 8.5 Assets

`ASSETS` binding serves `docs/devops/sourcebook` as the **Sourcebook** Pages site origin (`https://reops-sourcebook.pages.dev`).

### 8.6 GitHub CSV (resilient fallback)

GitHub-backed CSV fallback for canonical record sets:

- `data/projects.csv` (`GH_PATH_PROJECTS`)
- `data/project-details.csv` (`GH_PATH_DETAILS`)
- `data/studies.csv` (`GH_PATH_STUDIES`)

Available via `GET /api/projects.csv` and used by the projects page when Airtable is unavailable or unconfigured. Configured by `GH_OWNER=kevinrapley`, `GH_REPO=ResearchOps`, `GH_BRANCH=main`.

Repository CSV fixtures under `data/` (14 files): `projects.csv`, `project-details.csv`, `project-studies.csv`, `participants.csv`, `sessions.csv`, `session-notes.csv`, `discussion-guides.csv`, `journal-entries.csv`, `journal-excerpts.csv`, `memos.csv`, `codes.csv`, `code-applications.csv`, `mural-boards.csv`, `communications-log.csv`. These are also used by API tests and visual walkthroughs.

### 8.7 Schemas

JSON Schemas:

- `config/jsonschema/consent-schema.json` — Consent record (W3C Activity Streams).
- `config/jsonschema/note.schema.json` — Journal note (W3C Activity Streams).
- `schemas/agent-trace-event.schema.json` — Agent audit trace event.

Consent schema requires `@context`, `id`, `type` (`Consent`), `created`, `creator`, `hasTarget`, `LawfulBasis`, `RetentionSchedule` (ISO 8601 duration `^P\\d+[DWMY]|P\\d+M$`).

Note schema requires `@context`, `id`, `type` (`Note`), `created`, `creator`, `hasTarget`, `hasBody`. Additional properties are permitted.

Linked-data principle: research artefacts carry semantic context. Provenance metadata must preserve source, creator, timestamp and related project or study context.

---

## 9. Architecture

| Layer | Tech | Notes |
|-------|------|-------|
| API | Cloudflare Workers, JavaScript | Entry `infra/cloudflare/src/worker.js`. Service modules under `service/`, integrations under `lib/`, core dispatch under `core/`. |
| Front end | Cloudflare Pages | GOV.UK-styled static pages under `public/pages/`, route JS under `public/js/`, components under `public/components/`, scripts under `public/scripts/`, libs under `public/lib/` (marked, mustache, purify, coloris), styles under `public/css/`. |
| Identity | Cloudflare Access JWT + passwordless email magic-link | Sessions in `SESSION_KV`. User/team/role/permission in `RESEARCHOPS_D1`. |
| Integrations | Airtable, Mural OAuth2, Workers AI, OpenAI Platform, MCP tooling, GitHub CSV, Resend email | Adapter boundaries preserved. |
| Storage | Airtable (records), D1 (auth), KV (sessions), GitHub CSV (fallback), R2 (none currently bound) | — |
| Testing | Playwright, Cucumber, Pa11y, Lighthouse, Lychee, contract / route-state / fixture-index tests, behavioural evals | — |
| Lint / format | ESLint, Prettier | Prettier compliance enforced by execution, not inference. |
| Deployment | GitHub Actions and Cloudflare | CI then deploy. Preview Worker deploy branch filters must include all in-use branch prefixes (`feature/**`, `fix/**`, `chore/**`, `test/**`, `perf/**`). |

Architectural posture: **API contracts first, accessibility non-negotiable, performance audited, deployment controlled.**

Cloudflare contract (`references/cloudflare-development-spec.xml`):

- Distinguish static Pages assets from Worker API routes.
- Keep same-origin `/api/*` calls compatible with Pages previews unless an explicit API origin is configured.
- Do not claim deployment success without workflow or platform evidence.
- Use `no-store` headers for app pages where stale UI state could mislead users.

Preview-and-production contract (`references/integration-contracts.xml`):

- Any new user journey on a branch must work end-to-end in both branch preview and production. A static-page render is not sufficient evidence.
- Prefer relative `/api/*` routes first.
- If a Pages preview cannot proxy the API route, document a Worker fallback and ensure CORS allows `https://researchops.pages.dev` and `https://*.researchops.pages.dev` for preview testing.
- Add route-state or runtime tests asserting preview-safe API routing, production route compatibility and CORS allowance.

Performance and CSS doctrine (`references/researchops-performance-rules.xml`):

- Maintain `docs/performance/initial-load-audit.md` when performance work changes load behaviour.
- Do not remove global CSS contracts to optimise a single route.
- Distinguish global CSS, shared pattern CSS, route CSS and obsolete selectors.
- Cache headers: long-lived immutable for assets; `no-store` for app pages where stale UI could mislead.
- Defer shared layout modules only where it does not break page chrome or accessibility.

---

## 10. Wrangler configuration

`infra/cloudflare/wrangler.toml`:

- `name = "rops-api"`
- `main = "src/worker.js"`
- `compatibility_date = "2025-09-26"`
- `[assets] binding = "ASSETS"` serving `../../docs/devops/sourcebook`.
- `[ai] binding = "AI"`.
- `[secrets] required = ["RESEARCHOPS_AUTH_SECRET", "RESEND_API_KEY", "RESEARCHOPS_EMAIL_FROM"]`.
- `[vars]`: `MODEL`, `AUDIT`, `ALLOWED_ORIGINS`, all `AIRTABLE_TABLE_*`, `GH_OWNER`, `GH_REPO`, `GH_BRANCH`, `GH_PATH_*`, `MURAL_*`, `PAGES_ORIGIN`.
- `[[kv_namespaces]]` for `SESSION_KV`.
- `[observability]` enabled with `head_sampling_rate = 1`, `invocation_logs = true`, `persist = true`.
- `[[d1_databases]]` for `RESEARCHOPS_D1`.

Mural OAuth config: `MURAL_CLIENT_ID`, `MURAL_COMPANY_ID = "homeofficegovuk"`, `MURAL_API_BASE = "https://app.mural.co/api/public/v1"`, `MURAL_SCOPES = "identity:read workspaces:read rooms:read rooms:write murals:read murals:write"`, `MURAL_OAUTH_LEGACY = "true"`, `MURAL_REDIRECT_URI` pointing to `/api/mural/callback` on the Worker.

Secrets policy: never hard-code; provided through Wrangler. Never log secrets.

---

## 11. Authentication and authorisation

### 11.1 Identity layers

**Primary — Cloudflare Access (OIDC).** `Cf-Access-Jwt-Assertion` header. JWT verified RS256 against Cloudflare public certificates fetched from `https://<team-domain>/cdn-cgi/access/certs`. Payload provides `email`, `aud`, `exp`, `kid`, optional `custom_claims.groups`.

**Alternative — passwordless email.** `POST /api/auth/email/{email}` issues a time-bound code, emailed via Resend, stored in `SESSION_KV`. Callback exchanges the code for an opaque session token; D1 lookups bind the token to a user row.

### 11.2 Team and role model

- A user belongs to zero or more teams via `auth_team_memberships`.
- A user holds zero or more **role assignments**, each scoped to a team, project or study.
- Role assignments may be `active`, `pending`, `rejected` or `expired`.
- `ResearchOps Core Team Admin` is the special administrative role keyed by `team_admin` on the team `team_researchops_core` / `ResearchOps Core Team`.

### 11.3 Route permissions

Each protected route declares required permissions in the D1 table `auth_route_declarations`. `route-permissions.js` resolves the declaration for the incoming method and path, then:

1. If the route has no declaration — **fail closed** (403, error code `route_permission_missing`).
2. If `auth_required = 1` and the request is not authenticated — **401**.
3. If required permissions are not a subset of the user's granted permissions — **403** with the missing permissions listed.

### 11.4 `/api/me` shape

```
{
  "user": { "id": "...", "email": "..." },
  "activeTeam": { "id": "...", "name": "..." },
  "roles": [
    { "key": "team_admin", "label": "Team Admin",
      "scopeType": "team", "scopeId": "...", "expiresAt": null }
  ],
  "permissions": [
    { "code": "projects.view", "label": "..." }
  ]
}
```

### 11.5 Security obligations (`role: security`)

- Authentication, authorisation, logging, secret handling, least privilege, sensitive data protection.
- Never log secrets, tokens or unnecessary personal data.
- Use the configured allowlist for origins; never widen for convenience.
- Recovery logic (e.g. backfilling membership from active role assignments) must not replace correct atomic writes. Role assignment must create or reactivate `auth_team_memberships`, create or update the role assignment, and write audit evidence together.

### 11.6 Active product lessons (from `RECENT_LEARNINGS.md`)

- Preview Worker deploy filters must include the in-use branch prefixes. A Pages preview can look fresh while the Worker is stale.
- Account dashboards must adapt to access shape (single-team summary / multi-team list / Core Team Admin inset). Do not use a table unless row-and-column comparison is genuinely needed.
- Keep role membership and current capability labels in separate sections.

---

## 12. Consent lifecycle, lawful basis and retention

### 12.1 Consent form lifecycle

- Consent forms are versioned (Markdown / Mustache).
- Drafts live in Airtable.
- A consent form must be **published** before participant consent can be recorded against it.
- Each consent form version captures required statements and optional permissions.

### 12.2 Participant consent record

States:

- `Ready for session` — consent recorded, lawful for upcoming session.
- `Needs review` — recorded but flagged.
- `Needs consent` — required but not yet captured.
- `Withdrawn` — participant has withdrawn.
- `Not recorded` — default.

Each record captures `responses` (JSON of required / optional permissions), `capture_method`, `recorded_by`, `recorded_at`, and on withdrawal `withdrawn = true`, `withdrawal_reason`, withdrawal timestamp.

### 12.3 Lawful basis and retention

Consent schema (`config/jsonschema/consent-schema.json`) requires `LawfulBasis` and `RetentionSchedule`. Retention is ISO 8601 duration.

Retention policy (`config/policies/retention.policy.json`):

```
default: P12M
overrides:
  recordings: P6M
  transcripts: P12M
  notes: P12M
actions:
  on_expiry: delete
  grace_period_days: 7
```

Defaults are 12 months. Recordings are 6 months. Action on expiry is hard delete after a 7-day grace period.

### 12.4 Withdrawal propagation

When a participant withdraws consent:

1. Consent record marked `Withdrawn`.
2. Provenance event recorded.
3. Dependent insights and recommendations flagged via provenance.
4. Downstream analysis surfaces display a `data withdrawn` provenance note.

Operating rule: **a recommendation must remain traceable to its evidence chain even after a withdrawal**; the chain shows the withdrawal, not silence. Do not hide withdrawals to preserve a clean narrative.

### 12.5 Page states for consent

Visual walkthrough `participant-consent` states (`visual-walkthrough.participant-consent-states.mjs`):

- `missing-context-error` — page opened without project / study context. Blocks with `Open this page from a study`.
- `no-published-consent-form` — routes the researcher to publish a consent form first.
- `no-participants` — routes the researcher to schedule participants first.
- `participant-selected` — shows required statements, optional permissions, and withdrawal controls.

### 12.6 Templates and guidance

Under `docs/devops/sourcebook/templates/`:

- `data-retention-policy-excerpt.md`
- `gdpr-compliance-checklist-research` (where present)
- `consent-form-template`
- `consent-log-template`
- `research-ethics-guidance.md`
- `lifecycle-management-template.md`
- `incentive-policy-guidance.md`

Ethics rules (`references/researchops-ethics-pack.xml`):

- Consider consent, safeguarding, privacy, provenance and data minimisation for research workflows.
- High-stakes user groups require explicit harm framing.
- Do not remove safety, safeguarding or distress guidance to shorten research artefacts.

---

## 13. Visual walkthrough governance

`reports-site/manifest.json` is the standing evidence:

- `pageCount: 26`
- `stateCount: 43`
- `captureCount: 86`
- `failureCount: 0`
- Profiles: `desktop` (1440×1200), `mobile` (412×915, touch enabled)
- Journeys: six (see §4).
- Base URL: `https://researchops.pages.dev/`.

Walkthrough configs and fixtures at repository root:

- `visual-walkthrough.config.mjs`
- `visual-walkthrough.operational-fixtures.mjs`
- `visual-walkthrough.participant-consent-fixtures.mjs`
- `visual-walkthrough.participant-consent-states.mjs`
- `visual-walkthrough.synthesis-fixtures.mjs`
- `visual-walkthrough.synthesis-states.mjs`

Commands:

- `npm run qa:visual-walkthrough` — generate captures.
- `npm run qa:cucumber:walkthrough` — Cucumber with screenshot capture.
- `npm run reports:validate` — validate reports site shape.

Rules:

- Update walkthrough coverage for any visible UI state change.
- Do not introduce visual regressions; failures must be 0 at release.
- Walkthrough states should cover default, error, empty, loading and key interaction states.

---

## 14. Integration contracts

### 14.1 Airtable

Tables and field mappings configured in `wrangler.toml`. Linked-record fields handled as arrays. Personal data never logged. Formula, lookup and linked-field assumptions documented when route behaviour depends on them. Devops sourcebook covers attachment, checkbox, collaborator, create, delete-multiple, get, linked-records, list, number, rollup-lookup, select, sync-csv, text, update-multiple, update, upload.

### 14.2 Mural (`references/mural-api-spec.xml`)

- Duplicate the reflexive journal board from the configured template when required.
- Create or use a project-named folder in the user's private room where the integration requires it.
- Keep sticky-note category mapping explicit.
- Do not silently fall back to the wrong room or board.

OAuth scopes: `identity:read workspaces:read rooms:read rooms:write murals:read murals:write`. Sync orchestrated through `service/mural-journal-sync.js` with layout and tag-safety helpers.

### 14.3 Workers AI / OpenAI

- Default model `@cf/meta/llama-3.1-8b-instruct` via Workers AI binding.
- Every interaction logged to the `AI_Usage` table.
- `AUDIT = "true"` is the standing posture.
- Structured outputs, function calling, file search, vector stores, embeddings, batch, webhooks, realtime and evals — when used, governed by the `openai-platform` bundle.

### 14.4 MCP agent tooling

When using Model Context Protocol — servers, clients, tools, resources, prompts, sampling, roots, elicitation, consent — load the `mcp-agent-tooling` bundle. Treat tool consent as first-class.

### 14.5 GitHub CSV

GitHub-backed CSV is a resilient fallback for projects, project-details, studies. Branch is `main`. Path policy in `wrangler.toml`. Do not rely on CSV for write paths.

### 14.6 Resend (email)

`POST /api/comms/send` dispatches via Resend. Secret `RESEND_API_KEY`. Sender `RESEARCHOPS_EMAIL_FROM`. Audit recorded in `data/communications-log.csv` and via provenance events.

### 14.7 Cross-integration safety

- Preserve adapter boundaries and environment-variable expectations.
- Keep payload examples synthetic.
- Document provider-specific status and error handling.
- Never silently fall back to the wrong provider, room, board, base or table.

---

## 15. Repository topology

```text
.agent-operating-model/           Operating model: orchestration, registry, signals, rules, bundles
AGENTS.md                         Repository-level agent contract
README.md                         Public-facing repository readme
RECENT_LEARNINGS.md               Reusable repository-specific lessons (not a changelog)
charts/                           Charts and dashboards (placeholder)
config/                           Configuration: jsonschema/, policies/ (retention.policy.json)
data/                             CSV fixtures (14 files — see §8.6)
docs/                             Product, design, devops, performance, release-assurance, agent-audit, qa, design-system, design-critiques, assessments
  product/YY/MM/DD/               Dated product records (force-add — gitignore policy)
  agent-audit/reasoning/YYYY/MM/DD/  Promoted agent reasoning traces
  devops/sourcebook/              Sourcebook templates and guidance (served by Pages)
features/                         Cucumber BDD features (smoke.feature)
functions/                        Cloudflare Functions
infra/cloudflare/                 Worker source tree
  src/worker.js                   Dispatch entry
  src/core/                       router.js, service.js, logger.js, auth/, constants, fields, utils
  src/lib/                        Airtable, Mural, provenance libraries
  src/service/                    60+ service modules (see §7)
  wrangler.toml                   Bindings, vars, secrets, KV, D1, AI, assets
public/                           Pages static site
  pages/                          Static page templates (see §5)
  js/                             Route-specific page JavaScript
  components/                     Shared web components (layout, session-controller, etc.)
  scripts/                        Shared utility scripts
  lib/                            Vendor libs (marked, mustache, purify, coloris)
  css/                            GOV.UK-inspired styles
pages/start/                      Project creation wizard
reports/                          Generated test and audit reports
reports-site/                     Reports site (visual walkthrough manifest, screenshots, index)
schemas/                          JSON schemas (agent-trace-event)
scripts/                          validate.sh, performance-audit.sh, security-audit-policy.sh,
                                  agent-operating-model/*, agent-trace/*, visual-walkthrough.mjs
src/                              Top-level source modules
tests/                            70+ tests (route-state, contract, runtime, regression, audit, permissions)
test-results/                     Playwright artefacts (gitignored)
visual-walkthrough.*.mjs          Visual walkthrough configs, fixtures and state declarations
.github/workflows/                CI and deploy workflows (20+ — see §17)
conformance-matrix.yaml           Assurance state record
gap-register.yaml                 Gap register
release-evidence.yaml             Release evidence
release-provenance-policy.yaml    Release provenance policy
branch-protection-evidence.yaml   Branch protection record
configuration-evidence.yaml       Configuration record
security-audit-policy.json        Security audit policy
security-audit-triage.yaml        Security audit triage
deployment-toolchain.yaml         Deployment toolchain record
```

Repository convention hard rules:

- Static pages live under `public/pages/`.
- Page JavaScript lives under `public/js/`.
- Route-specific CSS must not override GOV.UK component internals unnecessarily.
- Worker route logic lives under the Cloudflare source tree.
- Product records live under `docs/product/YY/MM/DD/`. No flat records at the root. No `README.md` inside dated folders. Two-digit `YY`, `MM`, `DD`.
- `docs/**` is gitignored. Tracked product records and agent traces are force-added.
- Work branches must use approved prefixes (§19).
- Never introduce secrets, API keys or tokens into code. Secrets come from Wrangler environment configuration only.
- Do not duplicate canonical bundle rules in `AGENTS.md` or product docs — link to the canonical bundle.

Soft rules:

- Prefer `const`. Use JSDoc on exports. Avoid console noise outside deliberate Worker logs.
- Commits atomic. PRs self-contained. Never rewrite branch history without the repository owner's explicit approval.

---

## 16. Testing topology

Test directory `tests/` contains 70+ tests across layers:

**Route-state** — UI / data-state assertions for pages: `start-page-route-state`, `project-dashboard-route-state`, `study-page-route-state`, `participant-consent-route-state`, `consent-forms-route-state`, `journal-tabs-filter-state-route-state`, `auth-sign-in-route-state`, `auth-account-dashboard-route-state`, `auth-role-assignment-ui-route-state`, `auth-active-team-selection-route-state`, `govuk-page-chrome-navigation-route-state`, `studies-route-state`, etc.

**Contract** — API payload shape: `projects-route-contract`, `journals-project-route-contract`.

**Runtime / integration** — `auth-registration-requests-runtime`, `auth-role-assignment-api-route-state`, `auth-runtime-bootstrap-route-state`.

**Regression** — `agent-operating-model-regression`, `reporting-review-repetition-pass`, `agent-trace-control-regression`.

**Bundle and operating-model** — `bundle-validation-reports`, `airtable-bundle-health`, `github-bundle-codex-comment-handling`, `reports-site-validation`.

**Permission / auth** — `auth-route-permissions`, `auth-active-team-selection-route-state`.

Commands:

- `npm test` — Node test runner (unit and contract).
- `npm run test:e2e` — Playwright E2E.
- `npm run qa:cucumber` — Cucumber BDD.
- `npm run qa:cucumber:walkthrough` — Cucumber with screenshots.
- `npm run qa:visual-walkthrough` — Visual walkthrough generation.

BDD coverage is intentionally minimal smoke (`features/smoke.feature`). Acceptance coverage runs through visual walkthrough states and route-state tests.

Joined Pages-to-Worker tests (`references/researchops-joined-proxy-worker-tests.xml`) exercise the same `/api` boundary used by Pages clients; cover diagnostics, health, a list route and one mutate route before downstream browser E2E.

Contract test pack rules:

- Canonical route fixtures must be present for documented route families.
- Fixture paths referenced by route catalogues must exist.
- Route shape changes require fixture and test updates.
- Conditional or absent routes recorded explicitly.

Fixture index validation:

- Every fixture referenced by a catalogue or manifest must exist.
- Every route example fixture should be indexed or discoverable.
- Validation reports missing, unindexed and unreachable fixtures separately.

Example payload rules:

- Synthetic only. No real participant data.
- Aligned with route catalogue and fixtures.
- Updated when route shape changes.

---

## 17. CI/CD workflows

`.github/workflows/` contains 20+ workflows:

**Quality**

- `ci.yml` — lint, format, test.
- `worker-ci.yml` — Worker-specific CI.
- `validate.yml` — schemas, bundle, links.
- `format-pr.yml`, `format-branch.yml` — Prettier and lint enforcement.

**Testing and audits**

- `qa-bdd.yml` — Cucumber.
- `qa-e2e.yml` — Playwright.
- `qa-lighthouse.yml` — Lighthouse.
- `qa-links.yml` — Lychee.
- `accessibility.yml` — Pa11y.
- `security.yml` — security scanning.

**Release and deployment**

- `release-gate.yml` — pre-release blocking quality gate (matrix of checks logged to NDJSON: per-check id, title, command, blocking flag, exit code, status, stdout/stderr tail).
- `deploy-worker.yml` — production Worker.
- `deploy-agent-gateway.yml` — agent gateway Worker.
- `deploy-passwordless-preview-worker.yml` — auth Worker preview.
- `deploy-sourcebook.yml` — Sourcebook Pages site.

**Database / infrastructure**

- `apply-d1-auth-foundation.yml` — apply auth schema.
- `apply-d1-auth-role-assignment-route.yml` — apply route permission table.
- `bootstrap-d1-auth-runtime.yml` — bootstrap runtime (first team admin, user seed).

CI governance (`references/researchops-ci-governance-pack.xml`):

- CI validates syntax, format, route contracts and release gates where configured.
- Broken fixture, route-state or contract tests must not be bypassed silently.
- Prettier exclusions for generated or static contract fixtures must be narrow and documented.

Prettier reality:

- Formatter compliance cannot be inferred from rules, memory, house style or visual inspection.
- Prettier is executable. API-based file writes must pre-wrap chained calls and assertions in Prettier's shape, then verify via `npm run format:check` or CI.

Release readiness: never claim release readiness without green CI or an explicit caveat (`references/quality-gates.xml`).

---

## 18. Documentation, evidence and product records

Product records — dated convention (`docs/product/README.md`):

- Path pattern `docs/product/YY/MM/DD/`.
- Use the date the record was created or approved.
- `YY`, `MM`, `DD` are two-digit values.
- No `README.md` inside individual `DD` folders.
- No root-level product documents except the top `README.md`.
- Treat dated copies as canonical when legacy flat copies remain.

`docs/**` is in `.gitignore`. Tracked product records and agent traces are force-added (`git add -f`). Use `-f` when the document belongs in version control.

Agent reasoning traces:

- Path pattern `docs/agent-audit/reasoning/YYYY/MM/DD/<slug>.md` and `<slug>.json`.
- Generated by `npm run trace:promote`.
- Coverage enforced by `npm run trace:coverage`.

Other evidence surfaces:

- `RECENT_LEARNINGS.md` — quick operational memory. Reusable lessons only. Not a changelog. Update immediately when a reusable lesson is identified.
- `conformance-matrix.yaml` — `requirement`, `status`, `evidence`, `owner`, `gap`.
- `gap-register.yaml` — `id`, `title`, `status`, `severity`, `owner`, `context`, `mitigation`, `evidence`.
- `release-evidence.yaml`, `branch-protection-evidence.yaml`, `configuration-evidence.yaml`, `release-provenance-policy.yaml`, `security-audit-policy.json`, `security-audit-triage.yaml`, `deployment-toolchain.yaml` — release-assurance evidence.
- `visual-walkthrough.*.mjs` and `reports-site/` — visual walkthrough governance.

Conformance summary rules (`references/researchops-conformance-summary-pack.xml`):

- Summaries include coverage, gaps and failed checks.
- Distinguish blocked, skipped, failed and passed checks.

Gap register rules (`references/researchops-gap-register.xml`):

- Known missing routes, tests, fixtures or documentation recorded as gaps.
- Gaps need status, owner, target and evidence.
- Do not hide gaps by overstating conformance.

Other doc surfaces:

- `docs/devops/` — Airtable guides, reporting review model, secrets setup, Sourcebook templates.
- `docs/qa/visual-walkthrough.md` — walkthrough strategy.
- `docs/design-system/` — GOV.UK frontend migration, compliance audit, component inventory.
- `docs/design-critiques/26/05/07/` — platform design critique.
- `docs/performance/initial-load-audit.md`, `docs/performance/performance-inventory-tooling.md`.
- `docs/release-assurance/release-provenance.md`, `docs/release-assurance/branch-protection-verification.md`.
- `docs/assessments/alpha-assessment.md` — UK Service Standard alpha assessment.
- `docs/agent-audit/reasoning/YYYY/MM/DD/` — promoted traces.

---

## 19. Branch policy and trace policy

Approved work-branch prefixes:

- `feature/`, `chore/`, `test/`, `fix/`, `perf/`, `hotfix/`.

Do not use `claude/`, `codex/`, `bugfix/`, `experiment/` or any other prefix. The mainline branches `main` and `master` are exempt from work-branch prefix checks.

Trace requirements:

- Always record reasoning traces for repository-affecting work on `feature/`, `chore/`, `test/`, `fix/` and `perf/` branches.
- `hotfix/` is exempt. Exemption must not be used to broaden scope.
- Legacy `[reasoning]` token remains allowed as an explicit trigger.

Required trace content (`trace-policy.md`):

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

Trace layers (`trace-layers.md`): `operational`, `behavioural`, `mechanistic`, `training`. Mechanistic claims must be labelled as hypotheses unless tooling can directly inspect model internals. Traces must never expose private chain-of-thought.

Drift categories: `instruction`, `context`, `priority`, `tool`, `explanation`, `mechanistic`.

---

## 20. PR and logging governance

PR governance (`references/researchops-pr-and-logging-governance-pack.xml`):

- PRs state what changed, why, validation evidence and known risks.
- Do not log secrets, tokens or unnecessary personal data.
- Audit events should be clear, minimal and useful for governance.
- Keep PRs self-contained.
- Do not rewrite branch history without explicit approval.
- Do not create a pull request unless explicitly requested.

PR template provided under `.github/pull_request_template.md`.

---

## 21. Quality gates

Required pre-merge sequence:

1. `npm ci`
2. `npm run lint`
3. `npm run format -c`
4. `npm run typecheck` (where typed sources are present)
5. `npm test -- --ci`
6. `npm run validate`

Contextual gates depending on change surface:

- Accessibility: Pa11y (`.pa11yci.json`).
- Performance: Lighthouse (`lighthouserc.json`) and `npm run audit:performance`.
- Links: Lychee (`lychee.toml`).
- BDD: `npm run qa:cucumber`.
- E2E: `npm run test:e2e`.
- Visual walkthrough: `npm run qa:visual-walkthrough`; `npm run reports:validate`.
- Security: `npm run audit:security`; `security-audit-policy.json`, `security-audit-triage.yaml`.
- Operating model: `npm run agent:model:validate`, `npm run agent:bundles:validate`, `npm run agent:evals`.
- Trace coverage: `npm run trace:coverage`.

Gate rules (`references/quality-gates.xml`):

- Run or preserve `npm run validate`.
- Preserve lint and formatting standards.
- Run or update route contract tests for API changes.
- Update walkthrough coverage for visible UI states.
- Preserve WCAG and GOV.UK component expectations.
- Do not claim release readiness without green CI or explicit caveat.

Tests must be idempotent and CI-safe.

---

## 22. Accessibility and GOV.UK doctrine

GOV.UK rules (`references/govuk-design-system-spec.xml`):

- Semantic headings, labels, hints, fieldsets and error summaries.
- Preserve keyboard and pointer operability.
- Do not recreate component internals with page-specific CSS unless justified.
- Use plain English; do not expose technical permission codes to ordinary users.

Active product lessons (from `RECENT_LEARNINGS.md`):

- Input widths are part of affordance. Use sensible fluid widths (e.g. `govuk-!-width-two-thirds`).
- Deliberate vertical rhythm between intro content and first form field.
- Check-answers `Change` links must change the answer (reveal form, focus the target control).
- Do not put focus rings on non-control containers. Scroll into view rather than focus passive containers.
- Account dashboards adapt to access shape.
- Keep role membership and current capability labels in separate sections.
- Use existing GOV.UK-inspired patterns before inventing local variants.
- Protect keyboard, pointer, focus, screen-reader behaviour.

UI mode (`rops-ui`) requires identifying the right layer (page markup, shared component, route script, stylesheet) before editing.

---

## 23. Ethics, provenance and the traceability covenant

The platform's central rule is the **evidence → insight → recommendation** chain. The chain must survive refactors, exports, withdrawals and integration syncs.

Provenance rules (`references/researchops-metadata-provenance-pack.xml`):

- Research artefacts preserve source, creator, timestamp and related project or study context.
- Evidence, insight and recommendation relationships stay traceable.
- Generated artefacts must distinguish generated content from human-authored decisions.

Ethics rules:

- Consent, safeguarding, privacy, provenance, data minimisation.
- High-stakes user groups require explicit harm framing.
- Do not remove safety, safeguarding or distress guidance to shorten artefacts.

Operating defaults:

- Phase changes are human-owned.
- Authoritative use of platform output requires human review.
- Do not invent identifiers. Do not expose internal field names to end users.
- Do not remove evidence, audit trace, accessibility support, GOV.UK semantics, route guards or operational fixtures unless explicitly requested and justified.

Three planes of traceability:

- **Product plane** — evidence → insight → recommendation. Every recommendation traces through one or more insights to one or more evidence sources. The chain survives withdrawal as a flagged provenance event.
- **Repository plane** — request → branch → trace → PR → CI → release evidence. Branch prefix drives trace requirement.
- **Operating plane** — operational, behavioural, mechanistic, training trace layers.

---

## 24. Authority hierarchy

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
5. `cloudflare` — runtime, Wrangler, bindings, storage, state, queues, workflows, Workers AI, Vectorize, deployment.
6. `openai-platform` — OpenAI API, model, tool, retrieval, structured output, eval, AI-safety.
7. `mcp-agent-tooling` — MCP protocol, tool, resource, prompt, consent, agent-tooling safety.
8. `airtable-public-api`, `mural-public-api` — implementation details for their APIs.

Conflicts must be recorded: bundles involved, conflicting rule, precedence decision, implementation impact, residual risk. Do not silently choose a lower-precedence convenience rule over a higher-precedence governance or safety rule.

---

## 25. Bundle topology, task signals and selection

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

Commands:

| Task | Command |
|------|---------|
| Show selected operating model bundles | `npm run agent:model -- "<task text>"` |
| Run behavioural operating-model evals | `npm run agent:evals` |
| Validate operating model files | `npm run agent:model:validate` |
| Validate bundle registry | `npm run agent:bundles:validate` |
| Validate trace coverage | `npm run trace:coverage` |

---

## 26. Modes

Pick one mode before editing (`bundles/researchops-developer-control/modes/`):

- **`rops-build`** (default) — implementing features across UI, Worker and docs. Inspect first, plan the layer, coherent commits, record tests, risks, follow-ups.
- **`rops-api`** — API, Worker, router, service-module work. Preserve response envelopes. Update examples and route-shape fixtures with shape changes. Keep error responses structured and consistent.
- **`rops-ui`** — page, component, CSS, browser behaviour. Identify the right layer. Do not duplicate component logic. Protect keyboard, pointer, focus, screen-reader behaviour.
- **`rops-patterns`** — design pattern and GOV.UK component work. Use existing GOV.UK patterns first. Preserve semantics. Update pattern documentation when a reusable pattern changes.
- **`rops-integration`** — Airtable, Mural, Cloudflare and cross-service integration. Preserve adapter boundaries and env-var expectations. Keep payload examples synthetic. Document provider-specific status and error handling.
- **`rops-fix`** — bug fixes and regressions. Identify failing behaviour and owning layer. Add or update regression assertions. Do not use broad rewrites to hide a narrow defect.
- **`rops-review`** — reviewing changes. Architecture, user need, accessibility, route contracts, CI impact. Separate blocking defects from advisory improvements. Ground comments in file paths and observable behaviour.
- **`rops-conformance`** — route-shape, fixture-index, repository-convention, CI conformance. Maintain conformance matrix and gap register. Distinguish verified, conditionally verified, absent and future-extension routes. Do not mark conformance complete without evidence.

---

## 27. Templates

Under `bundles/researchops-developer-control/templates/`:

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

## 28. The Sourcebook

`docs/devops/sourcebook/` is the research operations knowledge base served through Cloudflare Pages as `https://reops-sourcebook.pages.dev/`. Bound to the Worker via `ASSETS`. It contains templates and reference material for the research operations practice itself, not just the platform.

Sourcebook templates (`docs/devops/sourcebook/templates/`):

- `data-retention-policy-excerpt.md`
- `research-ethics-guidance.md`
- `research-governance-roles-raci.md`
- `research-maturity-self-assessment.md`
- `incentive-policy-guidance.md`
- `lifecycle-management-template.md`
- `method-playbook-index.md`
- `participant-panel-database-schema.md`
- `remote-research-setup-guide.md`
- `research-shareback-patterns.md`
- `research-space-checklist.md`
- `stakeholder-mapping-template.md`
- `tool-evaluation-matrix.md`
- `research-role-descriptions.md`
- `research-roadmap-template.md`
- `research-taxonomy-reference.md`
- `research-backlog-board-guidance.md`
- `decision-log-template.md`
- `community-of-practice-charter.md`
- `integration-workflow-template.md`
- `repository-entry-template.md`

The Sourcebook is the **practice manual**. The platform supports the practice; the Sourcebook describes how the practice should run. Edits to Sourcebook content must respect ethics, accessibility and plain-English rules.

---

## 29. Operating contract for agents

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

## 30. Output contract

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

## 31. Anti-patterns and prohibited behaviours

The agent must not:

- invent endpoints, fields, table names, identifiers or runtime guarantees
- patch over symptoms when a shared component, adapter, route contract or service module is the correct layer
- remove evidence, audit trace, accessibility support, GOV.UK semantics, route guards or operational fixtures unless explicitly requested and justified
- silently fall back to the wrong Airtable base, Mural room or board, or Cloudflare environment
- treat a recovery path (e.g. backfilling memberships from active role assignments) as a replacement for the correct atomic write path
- declare a route exists without router and service code confirmation
- claim deployment success without workflow or platform evidence
- claim formatting compliance without executing Prettier or relying on CI
- broaden the scope of a `hotfix/` branch to avoid trace requirements
- create branches with unapproved prefixes (`claude/`, `codex/`, `bugfix/`, `experiment/`)
- duplicate canonical bundle rules in `AGENTS.md`, root docs or product records
- ask the user to re-attach bundle packages when the repository is available
- log secrets, tokens or unnecessary personal data
- introduce real participant data into examples, fixtures or product docs
- use a table where a summary list or summary card is the correct GOV.UK pattern
- focus passive containers, or otherwise misuse focus styling
- treat a static-page render as evidence that a user journey works end-to-end
- create pull requests without explicit user request
- expose internal Airtable field names or D1 column names to end users
- collapse insights and recommendations into a single concept
- record a participant consent record against an unpublished consent form
- proceed with research workflow steps when consent is `Withdrawn`, `Needs consent` or `Not recorded`

---

## 32. Failure modes and recovery

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

When preview and production behave differently:

- Treat preview-only success as a failure of the preview-and-production end-to-end contract.
- Verify Worker deploy filters cover the in-use branch class.
- Verify CORS allows the preview origin.
- Add a route-state test asserting preview-safe routing.

When a participant withdraws consent:

- Do not delete the consent record.
- Mark `Withdrawn`, record `withdrawal_reason`, timestamp the withdrawal.
- Emit a provenance event.
- Flag dependent insights and recommendations through provenance, not deletion.

When retention expires:

- Apply the policy: 7-day grace period, then hard delete the designated artefact class (recordings 6 months, transcripts and notes 12 months by default).
- Record the deletion as a provenance event.
- Update conformance matrix where the deletion completes a control.

---

## 33. Versioning and amendment

This master prompt is a synthesis. Domain rules live in their canonical bundle. When this prompt and a canonical source disagree, the canonical source wins and this prompt must be updated.

To amend:

1. Update the canonical source first (bundle reference, policy file, schema, route handler, fixture).
2. Update this prompt to reflect the canonical change.
3. Record the amendment in `RECENT_LEARNINGS.md` if it carries a reusable lesson.
4. Bump the version in the header.
5. Commit via an approved branch prefix with an auditable trace.

This prompt is not a place to record domain rules that belong in a bundle reference. It is not authority to bypass quality gates, trace requirements or human review.

---

## 34. Canonical source pointers

Repository-level:

- `AGENTS.md`
- `README.md`
- `RECENT_LEARNINGS.md`
- `package.json`
- `conformance-matrix.yaml`, `gap-register.yaml`
- `release-evidence.yaml`, `release-provenance-policy.yaml`, `branch-protection-evidence.yaml`, `configuration-evidence.yaml`, `security-audit-policy.json`, `security-audit-triage.yaml`, `deployment-toolchain.yaml`
- `visual-walkthrough.config.mjs` and `visual-walkthrough.*-fixtures.mjs`, `visual-walkthrough.*-states.mjs`
- `reports-site/manifest.json`, `reports-site/index.html`

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
- `bundles/researchops-developer-control/references/` (all reference XML files cited throughout this prompt)
- `bundles/researchops-developer-control/modes/` (eight modes)
- `bundles/researchops-developer-control/roles/` (eleven roles)
- `bundles/researchops-developer-control/templates/` (twenty-one templates)
- `bundles/researchops-developer-control/examples/` (synthetic payload examples)

Worker source:

- `infra/cloudflare/wrangler.toml`
- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/src/core/router.js`
- `infra/cloudflare/src/core/auth/` (access, access-scoped, passwordless, registration-requests, role-assignments, role-assignments-scoped, route-permissions)
- `infra/cloudflare/src/service/` (sixty-plus modules)
- `infra/cloudflare/src/lib/` (Airtable, Mural, provenance)

Pages source:

- `public/pages/`
- `public/js/`
- `public/components/`
- `public/scripts/`
- `public/lib/`
- `public/css/`
- `pages/start/`

Schemas and policies:

- `config/jsonschema/consent-schema.json`
- `config/jsonschema/note.schema.json`
- `schemas/agent-trace-event.schema.json`
- `config/policies/retention.policy.json`

Documentation:

- `docs/product/YY/MM/DD/`
- `docs/agent-audit/reasoning/YYYY/MM/DD/`
- `docs/devops/airtable/`
- `docs/devops/sourcebook/`
- `docs/qa/visual-walkthrough.md`
- `docs/design-system/` (GOV.UK migration, compliance audit, component inventory)
- `docs/design-critiques/`
- `docs/performance/initial-load-audit.md`
- `docs/release-assurance/`
- `docs/assessments/alpha-assessment.md`

Workflows:

- `.github/workflows/ci.yml`
- `.github/workflows/worker-ci.yml`
- `.github/workflows/validate.yml`
- `.github/workflows/release-gate.yml`
- `.github/workflows/deploy-worker.yml`
- `.github/workflows/deploy-agent-gateway.yml`
- `.github/workflows/deploy-passwordless-preview-worker.yml`
- `.github/workflows/deploy-sourcebook.yml`
- `.github/workflows/apply-d1-auth-foundation.yml`
- `.github/workflows/apply-d1-auth-role-assignment-route.yml`
- `.github/workflows/bootstrap-d1-auth-runtime.yml`
- `.github/workflows/qa-bdd.yml`, `qa-e2e.yml`, `qa-lighthouse.yml`, `qa-links.yml`, `accessibility.yml`, `security.yml`, `format-pr.yml`, `format-branch.yml`

---

## 35. Closing covenant

ResearchOps is a platform for research that matters to people, run by teams accountable to the public. Every change touches participant trust, service quality, accessibility, ethics, retention, lawful basis and audit.

Inspect before you edit.
Cite before you claim.
Trace before you ship.
Protect the chain from evidence to insight to recommendation, through withdrawal, through export, through every refactor.
Respect the authority order.
Use the canonical sources.
Match GOV.UK semantics exactly.
Honour consent lifecycle, lawful basis and retention.
Treat preview-only success as failure.
Never invent.
Never overclaim.

This is the Master Prompt. The rest builds from here.
