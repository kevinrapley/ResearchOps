# AGENTS.md

## Purpose
This document defines how agentic coding assistants (e.g., GPT-5 Codex) should work within this repository.  
It provides conventions, automation rules, testing expectations, and internal knowledge about APIs (notably Mural).

---

## 🧠 General Behaviour
- The agent acts as a **developer assistant** — perform structured edits, bug-fixing, test authoring, and documentation improvements.
- It must respect the repository’s automation (GitHub Actions, Cloudflare Workers, npm scripts).
- All changes must be **safe, reproducible, and test-backed**.
- Never introduce breaking API keys, tokens, or Cloudflare secrets into code.
- Prefer **incremental commits**; each commit should be logically self-contained (< 300 lines of diff).

---

## 🏗 Repository Overview

### Stack
| Layer | Tech | Notes |
|-------|------|-------|
| Server | TypeScript (Cloudflare Workers) | Deployed via Wrangler 4.45.4 |
| Frontend | JavaScript/TypeScript | Static assets served via Pages |
| Testing | Playwright, Cucumber (BDD), Pa11y, Lighthouse, Lychee | Coverage required in CI |
| Lint/Format | ESLint + Prettier | Must pass before merge |
| Deployment | GitHub Actions + Cloudflare | CI → Deploy Worker pipeline |
| API Integrations | Airtable, GitHub CSV, Mural (OAuth2 Public API) | Use helper libs under `infra/cloudflare/src/lib` |

### Structure Highlights
- `infra/cloudflare/src/worker.js` — entry point for Worker.
- `infra/cloudflare/src/lib/mural.js` — Mural API integration layer.
- `public/` — front-end static assets.
- `features/` — Cucumber BDD tests.
- `src/sdk/` — SDK layer (ResearchOps API).
- `.github/workflows/` — full CI/CD definitions.

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

Before any PR or commit:
1. `npm ci`
2. `npm run lint`
3. `npm run format -c`
4. `npm run typecheck`
5. `npm test -- --ci`

All must succeed locally **before pushing**.

### Pull Requests
- Each PR must reference the purpose (e.g., “Fix: Mural board URL retrieval delay”).
- Include a short “Testing Done” section.
- PRs are lint-checked and tested in CI.
- Code coverage ≥ 80 % is expected.
- Avoid large multi-purpose commits.

---

## 🧩 Cloudflare Worker Guidance
- Entry: `infra/cloudflare/src/worker.js`
- Always return valid `Response` objects (`error 1101` prevention).
- Logs must use `console.log` or `console.error`.
- Use environment bindings from `wrangler.toml` — never hard-code secrets.
- Keep API calls inside `src/lib/` or `src/service/`.

### Worker Deployment Flow
1. **CI** runs build, tests, lint, typecheck.
2. **Deploy Workflow** runs after CI success.
3. Secrets are injected via Wrangler (`CF_API_TOKEN`, `CF_ACCOUNT_ID`, `GH_PAT`, `AIRTABLE_API_KEY`, `MURAL_CLIENT_SECRET`, `AIRTABLE_BASE_ID`).

---

## 🔍 Testing Guidance
- **BDD tests:** in `/features/` using Cucumber + Playwright.  
  Each `.feature` must have step definitions under `/features/steps/` and shared context in `/features/support/`.
- **Accessibility:** Pa11y runs via `.pa11yci.json`.  
- **Links:** Lychee config in `lychee.toml`.
- **Performance:** Lighthouse via `lighthouserc.json`.
- Tests must be **idempotent**, independent, and compatible with CI.

---

## 🪶 Code Style
- Use ESLint + Prettier configuration as defined.
- Indentation: 2 spaces.
- Strings: `"double quotes"` by default.
- Prefer `const` over `let`.
- JSDoc on all exported functions and modules.
- No `console.log` noise in production code (keep in worker-level logging only).

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

Typical scopes:
```
identity:read workspaces:read rooms:read rooms:write murals:read murals:write
```

### Key Endpoints

#### 🧱 List Widgets
```
GET /murals/{muralId}/widgets
```

#### 🗒 Create Sticky Note
```
POST /murals/{muralId}/widgets/sticky-note
```

#### 🔗 Retrieve Mural Links
```
GET /murals/{muralId}/links
```

---

## 🧠 Agent Instructions

### Primary Role — Bug Fixing
- Investigate stack traces and Worker logs under `/infra/cloudflare/src/`.
- Prioritize fixes that unblock integrations (Airtable, Mural, GitHub CSV sync).
- Always write clear commit messages (`fix(mural): handle delayed viewer link`).

### Secondary Roles
1. **Feature Creation** — add new endpoints or UI elements respecting Worker routing and asset loading.
2. **Refactoring** — simplify code, but preserve compatibility with CI.
3. **Code Review** — ensure performance, clarity, and security (no secrets in logs).

### When Working with Mural Code
- Use `infra/cloudflare/src/lib/mural.js` for all API calls — never duplicate logic.
- Test with mock responses from `docs/mural/test_api_endpoints.py`.
- Respect Mural API rate limits.
- Use exponential backoff for polling endpoints (e.g., to wait for viewer links).

---

## ✅ Pre-Merge Checklist
- [ ] Lint and Prettier check clean.
- [ ] TypeScript build passes.
- [ ] All tests (BDD, Playwright, Pa11y, Lighthouse, Lychee) pass.
- [ ] Cloudflare Worker builds and deploys locally with Wrangler.
- [ ] No secrets exposed or logged.
- [ ] PR includes changelog entry and Testing Done section.

---

## 🧩 Example Commit Flow
```bash
git checkout -b fix/mural-viewer-url
npm ci
npm run lint && npm run typecheck && npm test
git add .
git commit -m "fix(mural): ensure viewer URL retrieval with retry"
git push origin fix/mural-viewer-url
```

---

## 🪐 Agent Notes
- Use concise diffs — avoid refactoring unrelated modules.
- Prefer **deterministic retries** (max 30–60 sec) when dealing with asynchronous Mural responses.
- If the Mural OAuth endpoints respond with `PATH_NOT_FOUND`, verify that the base path is `https://app.mural.co/api/public/v1/authorization/oauth2`.
- The agent may consult `docs/mural/` documents for detailed endpoint syntax and sample payloads.

---

### 🏁 End of AGENTS.md
