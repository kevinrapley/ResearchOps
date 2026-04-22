# Alpha service assessment — ResearchOps Platform

Re-run of the alpha assessment against the repository codebase (not the
summary description used in the prior chat). Where the prior chat inferred
capability from the `README.md` strapline, the re-run below cites the actual
files that implement, or fail to implement, each point of the GDS Service
Standard.

| Field | Value |
|---|---|
| Service | ResearchOps Platform (prototype) |
| Phase assessed | Alpha → Beta readiness |
| Repository | `kevinrapley/researchops` |
| Commit | `81dd9fe` |
| Assessment date | 2026-04-22 |
| Branch | `claude/rerun-alpha-assessment-K8srQ` |
| Method | Evidence-based code review against the 14-point Service Standard |

---

## Summary outcome

**Not yet met** — recommend a second alpha assessment before proceeding to
beta. The platform has strong architectural bones (Cloudflare Workers, D1, KV,
Airtable, Mural OAuth, Workers AI, GOV.UK-styled static frontend, JSON-LD
semantics, extensive CI), but six Standard points (1, 5, 9, 10, 11, 14) have
concrete, file-level gaps that materially affect a live service handling
participant and consent data.

- **Met:** 3, 12, 13
- **Met with concerns:** 2, 4, 6, 7, 8
- **Not met:** 1, 5, 9, 10, 11, 14

---

## Evidence-by-standard

### 1. Understand users and their needs — Not met

The repo contains no discovery artefacts: no user-need statements, personas,
research plans, synthesis, or journey maps. The only user-facing framing is
the `README.md` strapline and the three "cards" in `public/index.html:31-94`
("Start a new research project", "Set clear research objectives", "Recruit
participants"). `data/projects.csv` and `infra/cloudflare/migrations/researchops-d1/0001_seed.sql:24-26`
contain seed *content* for two demo projects, not research evidence about
user researchers' needs.

**Recommended before beta:** check in discovery outputs under
`docs/research/` (user needs, who was spoken to, when, what was learnt, what
decisions those findings drove).

### 2. Solve a whole problem for users — Met with concerns

The service covers a credible end-to-end ResearchOps loop: start project
(`public/pages/start/`), project dashboard (`public/pages/project-dashboard/`
604 lines), studies, discussion guides (`infra/cloudflare/src/service/guides.js`),
participants and scheduler (`public/pages/study/participants/scheduler.js`),
sessions with ICS export (`service/sessions.js:sessionIcs`), session notes,
journals, excerpts, memos, codes, co-occurrence and timeline analysis
(`service/reflection/analysis.js`), Mural sync (`service/internals/mural.js`),
and a sourcebook of rules/principles/guidance (`docs/sourcebook/`).

Concerns: the "whole problem" boundary bleeds into upstream tooling —
Airtable is the system of record (`wrangler.toml:26-37`), Mural is a required
step for synthesis, and CSVs are fetched raw from GitHub (`core/router.js:92-121`).
If any of those is unavailable the flow breaks; the retry/degradation story
is not documented.

### 3. Provide a joined-up experience across all channels — Met

Single domain (`researchops.pages.dev`) with a Pages Function proxy
(`functions/api/[[path]].js`) fronting the Worker API. Shared header/footer
partials (`public/partials/header.html`, `footer.html`) render consistent
navigation on every page via the `<x-include>` custom element in
`public/components/layout.js`. Canonical URL redirection and duplicate-segment
cleanup are handled centrally (`core/router.js:22-38`).

### 4. Make the service simple to use — Met with concerns

Pages use GOV.UK typography/colour tokens (`public/css/govuk/*.css`), GOV.UK
heading classes, clear step-of-three progress (`start/index.html:43-160`),
inline hints and error summaries, and AI-assisted rewriting for descriptions
and objectives (`public/js/start-description-assist.js`,
`start-objectives-assist.js`).

Concerns: only the `govuk-typography.css` and `govuk-colours.css` stylesheets
are vendored — this is a GOV.UK *look* rather than the `govuk-frontend`
component library, so patterns like the error summary, notification banner,
and task list are re-implemented locally. No usability testing outputs are
committed.

### 5. Make sure everyone can use the service — Not met

- Pa11y-ci is wired in (`.github/workflows/accessibility.yml`,
  `.pa11yci.json`) targeting **WCAG 2.1 AA** on three URLs only:
  `/`, `/pages/start/`, `/pages/projects/`. Paths such as
  `/pages/project-dashboard/`, `/pages/consent/`, `/pages/study/session/`,
  `/pages/study/participants/` — which are where the sensitive journeys
  live — are not scanned.
- Lighthouse thresholds are `warn`, not `error` (`lighthouserc.json:10-14`),
  so accessibility regressions do not fail CI.
- No assistive-technology testing record, no manual WCAG audit, no AT
  personas, and no accessibility statement in the repo.
- Some interactive patterns use `alert()` for validation
  (`public/pages/consent/index.html:79`), which is not accessible or
  GOV.UK-compliant.

### 6. Have a multidisciplinary team — Met with concerns

`AGENTS.md` references developer, devops, ethics, governance, metrics, QA,
researchops, and security "custom instruction" agents
(`docs/devops/custom-instructions/*.xml`), signalling role coverage by
design. However, `git log` shows all recent commits authored by a single
contributor (`git log --oneline` sample: 20/20 by one author), and
`.github/workflows/CODEOWNERS.txt` is 92 bytes. Evidence of a genuinely
multidisciplinary team working in alpha is absent from the repo.

### 7. Use agile ways of working — Met with concerns

Issue templates are minimal but present (`.github/ISSUE_TEMPLATE/bug_report.yml`,
`feature_request.yml`). No sprint notes, show-and-tell artefacts, or a
roadmap are in the repo. Commits are atomic-ish but tend toward
"Update X" / "Fix typo" messages, not outcome-framed.

### 8. Iterate and improve frequently — Met with concerns

Deployment automation is in place (`.github/workflows/deploy-worker.yml`,
`deploy-sourcebook.yml`) and CI runs on every PR (`ci.yml`). The service
has versioned config (`config/researchops_config_v1.0.0.json`) and an SDK
file named `researchops_sdk_v1.0.0.js`, indicating intentional versioning.

Concerns: no changelog, no release notes, no feature-flag mechanism, and
no documented cadence for releases to users.

### 9. Create a secure service which protects users' privacy — Not met

This is the most material gap for a service that will hold participant
contact details, consent records, and research data.

- **No authentication or authorisation on the API.** `core/router.js`
  routes every handler (`/api/projects`, `/api/participants`,
  `/api/session-notes`, `/api/journal-entries`, `/api/guides`, `/api/codes`,
  `/api/mural/...`) without any auth check. The only access control is
  the CORS `ALLOWED_ORIGINS` list (`worker.js:36-49`,
  `wrangler.toml:23`), which is a browser-origin hint and not a security
  boundary — a `curl` bypasses it trivially.
- **Retention enforcer is a client-side placeholder** — `src/jobs/retention_enforcer.js:1-39`
  explicitly says "Run server-side in production" and operates against
  `localStorage`. Cloudflare Cron Triggers are not configured in
  `wrangler.toml`, so retention is not enforced automatically.
- **Consent schema validation** exists (`config/jsonschema/consent-schema.json`)
  but is not wired into the Worker API path; the Worker will accept any
  shape.
- **AI rewrite path lacks a redaction step.** `core/ai-rewrite.js` sends
  user-typed project descriptions and objectives to the Workers AI
  `llama-3.1-8b-instruct` model (`wrangler.toml:20`) with no PII scrubbing,
  despite the form hint at `start/index.html:55` telling users "Do not
  include personal data".
- **No CSP, HSTS, Permissions-Policy, or `X-Frame-Options` headers** are
  emitted by `worker.js` or the Pages proxy (`functions/api/[[path]].js`).
  Only `X-Content-Type-Options: nosniff` appears, and only on some routes.
- **Secrets hygiene:** `wrangler.toml:48-54` contains the Mural client ID
  and redirect URI in plain source — client ID is not a secret, but the
  file sets the expectation that other values may live here too. Set-up
  guidance (`docs/devops/setup-secrets.md`) names the required secrets
  but no `.env.example` exists at repo root.
- **No DPIA, records-of-processing, or data map** committed.

### 10. Define what success looks like and publish performance data — Not met

The observability stack is configured at the infrastructure level
(`wrangler.toml:62-68` enables persistent logs with 100% head sampling and
invocation logs), and there is an AI-usage audit table
(`AIRTABLE_TABLE_AI_LOG = "AI_Usage"`, `wrangler.toml:26`). Provenance
recording exists in `infra/cloudflare/src/lib/provenance.js` and
`service/provenance.js`.

What is missing: defined KPIs, a published performance dashboard, SLOs,
error budgets, or a performance page. Lighthouse budgets are `warn`-only.
No analytics or real-user monitoring is configured.

### 11. Choose the right tools and technology — Not met

The stack choice (Cloudflare Workers + Pages + D1 + KV + Workers AI,
Airtable, Mural) is defensible for a low-cost prototype, but the codebase
shows signs the stack has outgrown the "prototype" framing without the
accompanying rigour:

- **`package.json` is misaligned with `AGENTS.md`.** AGENTS.md
  (lines 34-51) tells contributors to run `npm run typecheck` and
  `npm test -- --ci --coverage` with ≥ 80 % coverage. Neither script
  is defined in `package.json` (scripts are `lint`, `format`, `validate`,
  `test:e2e`, `qa:browsers`, `qa:cucumber`). `ci.yml` runs both with
  `--if-present`, so they are silently skipped — the 80 % gate is not
  enforced.
- **Two copies of CORS logic.** `worker.js:36-76` and
  `core/router.js:40-57` each implement their own origin parser/allow-list
  differently; drift is already visible (different `Access-Control-Allow-Methods`
  sets).
- **Mixed data stores without a documented source of truth.** Projects
  can be read from Airtable (`projectsJsonDirect`), GitHub raw CSV
  (`projectsCsvDirect`), or D1 (seed SQL). Which one wins on write? Not
  documented.
- **Hard dependencies on long-tail tools (Mural, Airtable).** Both are
  paid SaaS with rate limits; procurement and continuity are not
  addressed in the repo.
- **Frontend has no bundler, no tree-shaking, no TypeScript.** Vendored
  libraries (`purify.min.js`, `marked.min.js`, `mustache.min.js`,
  `coloris.min.js`) are committed to the repo without integrity hashes
  or a pinning strategy.

### 12. Make new source code open — Met

The repository is public on GitHub (`kevinrapley/researchops`). Licence
file is absent from the root — adding an OGL or MIT `LICENSE` is the one
missing signal for a fully open codebase.

### 13. Use and contribute to open standards, common components and patterns — Met

Strong evidence of open-standards use:

- **JSON-LD** contexts with **Dublin Core**, **SKOS**, **Web Annotation
  (OA)**, **Schema.org**, **PROV**, and **DPV** (`src/sdk/researchops_sdk_v1.0.0.js:12-51`,
  `config/researchops_config_v1.0.0.json:5-12`).
- **DPV** lawful-basis vocabulary in the consent UI
  (`public/pages/consent/index.html:26-29` — `dpv:PublicInterest`,
  `dpv:Consent`).
- **ISO 8601 durations** for retention (`P12M` default, validated by
  `config/jsonschema/consent-schema.json:13`).
- **ICS** calendar export for sessions (`service/sessions.js`:`sessionIcs`).
- GOV.UK typography and colour tokens, and GOV.UK-styled service patterns.
- RDFa + Dublin Core + SKOS on the sourcebook (`docs/sourcebook/index.html:2-16`).

### 14. Operate a reliable service — Not met

- No SLOs, no error budget, no incident runbook, no on-call rota.
- No `/api/health` consumer (a health route exists at
  `core/router.js:294-299` but no uptime probe is documented to call it).
- Backups: D1 backup strategy is not documented; Airtable is the system
  of record but has no scheduled export.
- No circuit-breaker, retry, or timeout configuration in calls to
  Airtable/Mural/GitHub; a single slow upstream will hang a Worker
  request until platform timeout.
- The Pages Functions proxy (`functions/api/[[path]].js`) sets
  permissive `Access-Control-Allow-Origin: origin || '*'` on errors
  (line 97-105), which contradicts the stricter Worker CORS policy.

---

## Top recommendations before a re-assessment

1. **Put authentication in front of the API.** Cloudflare Access, an
   mTLS pair between Pages and the Worker, or signed short-lived tokens —
   anything but origin-only CORS. Until this exists, participant, consent,
   and session-note routes must not be exposed publicly.
2. **Define `test` and `typecheck` npm scripts and enforce coverage.** If
   the intent is the 80 % coverage stated in `AGENTS.md`, wire the gate
   into `ci.yml` without `--if-present`.
3. **Promote the retention enforcer to a Cloudflare Cron Trigger**
   (`[triggers] crons = ["0 2 * * *"]` in `wrangler.toml`) against D1,
   and validate consent payloads with the existing JSON Schema.
4. **Add a redaction pass before Workers AI.** Strip obvious PII
   (emails, phone numbers, participant names) from text sent to
   `llama-3.1-8b-instruct`, and log the AI_Usage event *after* redaction.
5. **Add security headers.** CSP, HSTS, `Referrer-Policy`, and
   `Permissions-Policy` emitted centrally from `worker.js`, and drop
   the duplicate CORS implementation in `core/router.js`.
6. **Expand accessibility coverage.** Include every page template in
   `.pa11yci.json`, flip Lighthouse assertions from `warn` to `error`,
   and commit a manual WCAG 2.2 AA audit and statement.
7. **Commit the discovery and alpha research evidence** under
   `docs/research/` — user needs, who was spoken to, findings, and the
   decisions they drove. Without this, Standard 1 cannot be evidenced.
8. **Publish success measures and a performance page.** Even four or
   five metrics (task completion, time-to-first-study, retention of
   consent records, participant recruitment lead time, and API error
   rate) would close Standard 10.
9. **Add a `LICENSE` file** (Open Government Licence v3 is conventional
   for UK public-sector repos) to close Standard 12.
10. **Document the system of record.** One-page "data flow" showing which
    store owns what, and what happens on Airtable/Mural outage.

---

## Differences from the prior chat's assessment

The prior chat evaluated against a one-paragraph description of the
service. The delta after reading the code:

| Area | Prior chat | Re-run against code |
|---|---|---|
| Authentication | Not raised | **Not met** — no auth on the API at all (`core/router.js`) |
| Open standards | Inferred | **Met** — concrete DPV/SKOS/OA/PROV/Dublin Core usage |
| Retention | Assumed operational | **Not met** — enforcer is a client-side placeholder (`src/jobs/retention_enforcer.js:1-3`) |
| Testing | Assumed adequate | **Concerns** — `npm run test` / `typecheck` scripts don't exist; CI passes via `--if-present` |
| Accessibility | "Pa11y + Lighthouse configured" | **Not met** — only 3 URLs scanned, Lighthouse gates are warn-only |
| Security headers | Not raised | **Not met** — no CSP/HSTS/frame policy in Worker response path |
| Data stores | Single store assumed | **Concern** — Airtable, D1, GitHub-raw CSV are all live; source-of-truth undocumented |
| Mural + AI integration | Described | **Met** — implemented in `service/internals/mural.js`, `core/ai-rewrite.js` |
| Multidisciplinary team | Inferred from AGENTS.md | **Concerns** — `git log` shows a single contributor |

---
*End of alpha service assessment (re-run).*
