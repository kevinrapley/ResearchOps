# AGENTS.md

## Purpose

This document defines how agentic coding assistants should work within this repository.

It provides repository conventions, automation rules and testing expectations. Bundle-specific operating rules live under `.agent-operating-model/bundles/` and must not be duplicated here.

---

## Mandatory operating model bootstrap

Before any repository-affecting response, the agent must load the repository operating model. The repository is the source of truth. Do not rely on chat memory, previously attached bundles, archived ZIP files or inferred bundle behaviour.

The source files are:

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

Canonical bundle directories currently include:

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`
- `.agent-operating-model/bundles/openai/`
- `.agent-operating-model/bundles/mcp-agent-tooling/`
- `.agent-operating-model/bundles/airtable-public-api/`
- `.agent-operating-model/bundles/mural-public-api/`

For each repository-affecting task, the agent must:

1. Read this `AGENTS.md` file.
2. Read `.agent-operating-model/orchestration.xml`.
3. Read `.agent-operating-model/bundle-registry.json`.
4. Read `.agent-operating-model/task-signal-catalog.json`.
5. Read `.agent-operating-model/selection-rules.json`.
6. Resolve selected bundles to their canonical directories under `.agent-operating-model/bundles/`.
7. Verify each selected bundle has its registered `prompt.spec.yaml` and `prompt.body.xml`.
8. Identify always-load bundles.
9. Identify typed task signals.
10. Identify conditional bundles relevant to the task from signal-based rules.
11. Apply precedence from `.agent-operating-model/precedence-policy.md`.
12. Record selected bundles and canonical paths if trace mode is active.
13. Stop and report the missing source if the operating model or a selected bundle directory cannot be loaded.

When the user includes `[reasoning]`, the agent must produce an auditable trace according to `.agent-operating-model/trace-policy.md` and the trace tooling under `scripts/agent-trace/`.

Useful commands:

| Task | Command |
|------|---------|
| Show selected operating model bundles | `npm run agent:model -- "<task text>"` |
| Run behavioural operating-model evals | `npm run agent:evals` |
| Validate operating model files | `npm run agent:model:validate` |
| Validate bundle registry | `npm run agent:bundles:validate` |

---

## General behaviour

- Act as a developer assistant that performs structured edits, bug fixing, test authoring and documentation improvements.
- Respect repository automation, including GitHub Actions, Cloudflare Workers, npm scripts and validation gates.
- Keep all changes safe, reproducible and test-backed.
- Never introduce secrets, API keys or tokens into code.
- Keep commits incremental and atomic.
- Use the canonical bundle directories for domain-specific rules instead of duplicating API or service doctrine in this file.

---

## Repository overview

### Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Server | TypeScript / JavaScript on Cloudflare Workers | Deployed via Wrangler |
| Frontend | JavaScript / TypeScript | Served via Cloudflare Pages |
| Testing | Playwright, Cucumber, Pa11y, Lighthouse, Lychee | Must pass in CI |
| Lint / format | ESLint and Prettier | Required pre-merge |
| Deployment | GitHub Actions and Cloudflare | CI then deploy |
| API integrations | Airtable, GitHub CSV, Mural OAuth2 Public API, OpenAI Platform, MCP-style agent tooling | Integration rules live in canonical bundles and `infra/cloudflare/src/lib/` |

---

## Development rules

### Commands

| Task | Command |
|------|----------|
| Install dependencies | `npm ci` |
| Lint | `npm run lint` |
| Format check | `npm run format -c` |
| Typecheck | `npm run typecheck` |
| Build | `npm run build` |
| Test in CI mode | `npm test -- --ci --coverage` |

Before committing, run the relevant subset of:

1. `npm ci`
2. `npm run lint`
3. `npm run format -c`
4. `npm run typecheck`
5. `npm test -- --ci`
6. `npm run validate`

### Pull requests

- State the purpose clearly.
- Include a testing or validation summary.
- Keep PRs self-contained.
- Do not rewrite branch history unless explicitly approved by the repository owner.

---

## Cloudflare Worker guidance

- Entry: `infra/cloudflare/src/worker.js`.
- Always return valid `Response` objects.
- Use Worker logging deliberately.
- Secrets come from Wrangler environment configuration. Never hard-code them.
- API access belongs in `infra/cloudflare/src/lib/`, `infra/cloudflare/src/core/` or `infra/cloudflare/src/service/`.
- Use `.agent-operating-model/bundles/researchops-developer-control/` for ResearchOps-specific Worker, routing and service rules.
- Use `.agent-operating-model/bundles/cloudflare/` for Cloudflare runtime, Wrangler, binding, storage, queue, workflow, Workers AI, Vectorize and deployment rules.
- Use `.agent-operating-model/bundles/openai/` for OpenAI API, model, tool, retrieval, structured output, eval and AI-safety rules.
- Use `.agent-operating-model/bundles/mcp-agent-tooling/` for MCP protocol, agent tool contracts, resource exposure, prompt workflows, consent checkpoints and tool-use audit rules.

---

## Testing guidance

- BDD: Cucumber and Playwright under `features/`.
- Accessibility: Pa11y via `.pa11yci.json`.
- Links: Lychee via `lychee.toml`.
- Performance: Lighthouse and repository performance audit scripts.
- Tests must be idempotent and CI-safe.

---

## Code style

- ESLint and Prettier define repository standards.
- Prefer `const`.
- Use JSDoc on exports.
- Avoid console noise outside deliberate Worker logs.

---

## Canonical bundle ownership

Do not duplicate the detailed Cloudflare, OpenAI, MCP, Airtable, Mural, GOV.UK Design System, GitHub Diamond, ResearchOps Developer Control, or Multi-Functional Team bundle rules in this file.

Use these canonical bundle directories instead:

| Domain | Canonical bundle |
|--------|------------------|
| GitHub repository operation | `.agent-operating-model/bundles/github/` |
| ResearchOps platform development | `.agent-operating-model/bundles/researchops-developer-control/` |
| Multidisciplinary government product assurance | `.agent-operating-model/bundles/multi-functional-team/` |
| GOV.UK Design System | `.agent-operating-model/bundles/govuk-design-system/` |
| Cloudflare Developer Platform | `.agent-operating-model/bundles/cloudflare/` |
| OpenAI Platform | `.agent-operating-model/bundles/openai/` |
| MCP Agent Tooling | `.agent-operating-model/bundles/mcp-agent-tooling/` |
| Airtable Public API | `.agent-operating-model/bundles/airtable-public-api/` |
| Mural Public API | `.agent-operating-model/bundles/mural-public-api/` |

---

### End of AGENTS.md
