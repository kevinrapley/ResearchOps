# AGENTS.md

## Purpose
This document defines how agentic coding assistants (e.g., GPT-5 Codex) should work within this repository.  
It provides conventions, automation rules, testing expectations, and internal knowledge about APIs — notably **Airtable** and **Mural**.

---

## Mandatory Operating Model Bootstrap

Before any repository-affecting response, the agent must load the repository operating model. The repository is the source of truth. Do not rely on chat memory, previously attached bundles, or inferred bundle behaviour.

The source files are:

- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `docs/devops/ResearchOps-Bundle-Setup.zip`

For each repository-affecting task, the agent must:

1. Read this `AGENTS.md` file.
2. Read `.agent-operating-model/orchestration.xml`.
3. Read `.agent-operating-model/bundle-registry.json`.
4. Inspect `docs/devops/ResearchOps-Bundle-Setup.zip` as the authoritative bundle package.
5. Identify always-load bundles.
6. Identify conditional bundles relevant to the task.
7. Apply precedence from `.agent-operating-model/precedence-policy.md`.
8. Record bundle decisions if trace mode is active.
9. Stop and report the missing source if the operating model cannot be loaded.

When the user includes `[reasoning]`, the agent must produce an auditable trace according to `.agent-operating-model/trace-policy.md` and the trace tooling under `scripts/agent-trace/`.

Useful commands:

| Task | Command |
|------|---------|
| Show selected operating model bundles | `npm run agent:model -- "<task text>"` |
| Validate operating model files | `npm run agent:model:validate` |
| Validate bundle registry | `npm run agent:bundles:validate` |

---

## 🧠 General Behaviour
- Acts as a **developer assistant** — performs structured edits, bug fixing, test authoring, and documentation improvements.  
- Must respect repository automation (GitHub Actions, Cloudflare Workers, npm scripts).  
- All changes must be **safe, reproducible, and test-backed**.  
- Never introduce secrets (API keys, tokens, Cloudflare bindings) into code.  
- Commits must be **incremental and atomic** (≤ 300 lines diff).

---

## 🏗 Repository Overview

### Stack
| Layer | Tech | Notes |
|-------|------|-------|
| Server | TypeScript (Cloudflare Workers) | Deployed via Wrangler 4.45.4 |
| Frontend | JavaScript / TypeScript | Served via Cloudflare Pages |
| Testing | Playwright, Cucumber (BDD), Pa11y, Lighthouse, Lychee | Must pass in CI |
| Lint/Format | ESLint + Prettier | Required pre-merge |
| Deployment | GitHub Actions + Cloudflare | CI → Deploy Worker |
| API Integrations | **Airtable**, GitHub CSV, **Mural (OAuth2 Public API)** | Located in `infra/cloudflare/src/lib/` |

---

## ⚙️ Development Rules

### Commands
| Task | Command |
|------|----------|
| Install deps | `npm ci` |
| Lint | `npm run lint` |
| Format | `npm run format -c` |
| Typecheck | `npm run typecheck` |
| Build | `npm run build` |
| Test (CI mode) | `npm test -- --ci --coverage` |

Before committing:
1. `npm ci`  
2. `npm run lint`  
3. `npm run format -c`  
4. `npm run typecheck`  
5. `npm test -- --ci`  

All must succeed locally.

### Pull Requests
- Reference the purpose clearly (e.g., “fix: Mural viewer URL retry”).  
- Include a “Testing Done” section.  
- Lint / tests / coverage ≥ 80 % required.  
- Keep PRs small and self-contained.

---

## 🧩 Cloudflare Worker Guidance
- Entry: `infra/cloudflare/src/worker.js`  
- Always return valid `Response` objects (avoid 1101 errors).  
- Use `console.log/error` for logging only.  
- Secrets come from Wrangler environment — **never hard-code**.  
- All API access belongs in `src/lib/` or `src/service/`.

### Worker Deployment
1. CI builds → tests → typecheck.  
2. Deploy workflow runs after success.  
3. Wrangler injects `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `GH_PAT`, `AIRTABLE_API_KEY`, `MURAL_CLIENT_SECRET`, `AIRTABLE_BASE_ID`.

---

## 🔍 Testing Guidance
- **BDD:** Cucumber + Playwright under `/features/`.  
- **Accessibility:** Pa11y via `.pa11yci.json`.  
- **Links:** Lychee via `lychee.toml`.  
- **Performance:** Lighthouse via `lighthouserc.json`.  
- Tests must be idempotent and CI-safe.

---

## 🪶 Code Style
- ESLint + Prettier define standards.  
- 2-space indentation, double quotes.  
- Prefer `const`.  
- JSDoc on exports.  
- No console noise outside Worker logs.

---

## 🧭 Mural API Knowledge Base

### Base URL
```
https://app.mural.co/api/public/v1
```

### OAuth 2.0 Endpoints
| Step | Method | Endpoint |
|------|---------|-----------|
| Authorize | GET | `/authorization/oauth2/authorize` |
| Exchange Token | POST | `/authorization/oauth2/token` |

**Scopes:**  
`identity:read workspaces:read rooms:read rooms:write murals:read murals:write`

### Key Endpoints
| Action | Endpoint |
|--------|-----------|
| List Widgets | `GET /murals/{muralId}/widgets` |
| Create Sticky Note | `POST /murals/{muralId}/widgets/sticky-note` |
| Retrieve Mural Links | `GET /murals/{muralId}/links` |

---

## 🧩 Airtable API Knowledge Base

### Base URL
```
https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}
```

### Authentication
- Use `Authorization: Bearer $AIRTABLE_API_KEY`
- All requests → `Content-Type: application/json`

### Common Operations
| Action | Method | Path | Notes |
|--------|---------|------|-------|
| List records | GET | `/v0/{base}/{table}` | Supports pagination, filterByFormula, sort |
| Get record | GET | `/v0/{base}/{table}/{recordId}` | Retrieve single record |
| Create records | POST | `/v0/{base}/{table}` | Up to 10 per request |
| Update record(s) | PATCH | `/v0/{base}/{table}` | Replace specified fields |
| Delete records | DELETE | `/v0/{base}/{table}?records[]=…` | Up to 10 IDs |
| Link records | PATCH | field type `multipleRecordLinks` | Send `[{ "id" }]` arrays |
| Upload attachments | PATCH | field type `multipleAttachments` | Send `[{ "url","filename" }]` |

---

## 🧭 Custom Instruction Sets

Each agent has a dedicated XML configuration file stored at:  
```
/docs/devops/custom-instructions/
```

| XML File | Role | Path |
|-----------|------|------|
| **developer.xml** | Defines coding, testing, and documentation conventions for developers. | [`/docs/devops/custom-instructions/developer.xml`](../docs/devops/custom-instructions/developer.xml) |
| **devops.xml** | Governs CI/CD automation, infrastructure configuration, and deployment patterns. | [`/docs/devops/custom-instructions/devops.xml`](../docs/devops/custom-instructions/devops.xml) |
| **ethics.xml** | Establishes ethical review standards for automation, AI/ML, and data governance. | [`/docs/devops/custom-instructions/ethics.xml`](../docs/devops/custom-instructions/ethics.xml) |
| **governance.xml** | Provides service governance and approval workflows, including version control and audit logging. | [`/docs/devops/custom-instructions/governance.xml`](../docs/devops/custom-instructions/governance.xml) |
| **metrics.xml** | Defines telemetry standards, service-level metrics, and data reporting pipelines. | [`/docs/devops/custom-instructions/metrics.xml`](../docs/devops/custom-instructions/metrics.xml) |
| **qa.xml** | Specifies QA automation, testing standards, and validation frameworks. | [`/docs/devops/custom-instructions/qa.xml`](../docs/devops/custom-instructions/qa.xml) |
| **researchops.xml** | Encapsulates ResearchOps workflows, participant data ethics, and study lifecycle processes. | [`/docs/devops/custom-instructions/researchops.xml`](../docs/devops/custom-instructions/researchops.xml) |
| **security.xml** | Outlines continuous security scanning, dependency control, and vulnerability management. | [`/docs/devops/custom-instructions/security.xml`](../docs/devops/custom-instructions/security.xml) |

---

### 🏁 End of AGENTS.md
