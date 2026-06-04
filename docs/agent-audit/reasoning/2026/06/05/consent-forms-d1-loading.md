# Consent Forms D1 Loading Trace

Date: 2026-06-05  
Branch: `fix/consent-forms-d1-loading`  
Trace requirement: required because the branch uses the `fix/` prefix.

## Task

Fix consent forms still failing to load from D1 after the GOV.UK consent forms page work was merged to `main`.

## Operating Model

Loaded:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`

Skipped bundles:

- `govuk-design-system`
- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

## Precedence

GitHub Diamond governed branch hygiene, trace evidence and validation claims. ResearchOps Developer Control governed repository service boundaries and existing API contracts. Cloudflare governed D1 binding and Worker runtime behaviour. Multi-Functional Team governed safe public-service defaults and avoiding unnecessary failure when a local D1 source is available.

## Implementation

Added D1-backed consent form persistence in `infra/cloudflare/src/service/consent-forms.js`.

The consent forms API now:

- lists saved consent forms from `RESEARCHOPS_D1` when available
- returns a clean empty D1 list when no Airtable credentials are configured
- creates new consent forms in D1 when the binding is available
- reads, updates and publishes D1 consent forms before falling back to Airtable
- keeps Airtable fallback paths for compatibility

Added `infra/cloudflare/migrations/0011_consent_forms_d1.sql` for the `rops_consent_forms` table and indexes.

Added runtime coverage in `tests/consent-forms-d1-runtime.test.js` for D1 empty-list, create, list, update and publish behaviour. Updated the consent forms route-state contract to check the D1 service and migration path.

## Validation

Passed:

- `node --test tests/consent-forms-d1-runtime.test.js tests/consent-forms-route-state.test.js`
- `node --test` with 176 passing tests
- `node scripts/agent-trace/assert-trace-coverage.mjs`

## Residual Risk

The local environment cannot run `npm ci` because no package manager is installed in this desktop runtime. CI should provide the package-manager-backed checks.
