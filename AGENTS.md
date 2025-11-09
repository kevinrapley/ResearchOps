# AGENTS.md

## Purpose
This document defines how agentic coding assistants (e.g., GPT-5 Codex) should work within this repository.  
It provides conventions, automation rules, testing expectations, and internal knowledge about APIs — notably **Airtable** and **Mural**.

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

### Integration Notes
- Centralized under `infra/cloudflare/src/lib/airtable.js` and `src/service/internals/airtable.js`.
- All Worker calls must go through these helpers:
  ```js
  import * as airtable from "../internals/airtable.js";
  await airtable.updateRecord(env, "Projects", recordId, {
    "Mural Board": [{ id: muralId }]
  });
  ```
- Field definitions documented in `docs/airtable/`.
- Uses **V1 REST format** (string IDs or `{ id }` objects).
- Merge existing links when appending.
- Worker normalizes errors (400/422) into JSON responses.

### CSV Sync
- Implemented in Worker tasks (see `scripts/` or `infra/cloudflare/src/service/csv.js`).  
- Pattern: parse CSV → validate → batch POST/PATCH (≤ 10 records per request).

### Frontend Usage
- Airtable-linked boards (Projects, Journals, Studies) are read via Worker API routes.  
- When a new Mural board is created, the Worker writes its `viewerLink` and links it to the project record.

---

## 🧠 Agent Instructions

### Primary Role — Bug Fixing
- Investigate Worker logs in `infra/cloudflare/src/`.  
- Prioritize Airtable/Mural integration issues.  
- Write clear commits (`fix(airtable): append linked records safely`).

### Secondary Roles
1. **Feature Creation** — new Worker routes or frontend flows.  
2. **Refactoring** — simplify while keeping tests green.  
3. **Code Review** — check performance, clarity, and security.

### When Working with Airtable
- Use `infra/cloudflare/src/lib/airtable.js` helpers only.  
- Never call the REST API directly from frontend code.  
- Validate record IDs and field names before writes.  
- Respect rate limits (5 req/sec per base recommended).  
- Prefer batched requests and merge-on-update patterns.

### When Working with Mural
- Use `infra/cloudflare/src/lib/mural.js`.  
- Retry viewer-link fetch with backoff.  
- Validate OAuth paths (`/authorization/oauth2/…`).  
- Handle `viewer_link_unavailable` gracefully.

---

## ✅ Pre-Merge Checklist
- [ ] Lint + Prettier clean.  
- [ ] TypeScript build passes.  
- [ ] All tests (BDD, Playwright, Pa11y, Lighthouse, Lychee) pass.  
- [ ] Worker builds/deploys locally via Wrangler.  
- [ ] No secrets exposed or logged.  
- [ ] PR includes changelog entry and Testing Done section.

---

## 🧩 Example Commit Flow
```bash
git checkout -b fix/airtable-linked-records
npm ci
npm run lint && npm run typecheck && npm test
git add .
git commit -m "fix(airtable): ensure linked record merge behavior"
git push origin fix/airtable-linked-records
```

---

## 🪐 Agent Notes
- Use concise diffs; avoid touching unrelated modules.  
- Prefer deterministic retries (max 60 s) for async Mural/Airtable polling.  
- If Airtable returns `422` or `INVALID_VALUE_FOR_COLUMN`, check field types in `docs/airtable/`.  
- If Mural returns `PATH_NOT_FOUND`, verify base path is `https://app.mural.co/api/public/v1/authorization/oauth2/`.  
- Agents may reference `docs/airtable/` and `docs/mural/` for detailed endpoint guides.

---

### 🏁 End of AGENTS.md
