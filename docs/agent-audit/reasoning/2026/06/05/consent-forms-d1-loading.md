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

## Codex Comment Disposition

Reviewed unresolved Codex comment `PRRC_kwDOP3Td2M7IPiTh` on `infra/cloudflare/src/service/consent-forms.js`. Classified it as legitimate. Updated consent form listing so D1 rows do not short-circuit Airtable when Airtable is configured. The endpoint now merges D1 and Airtable consent forms, de-duplicates by form ID and reports `source: "d1+airtable"` for mixed lists. D1-only short-circuit behaviour remains only when Airtable is not configured or Airtable listing fails.

## D1 Hydration

Used the Airtable connector to inspect base `appkpzVvkof4RFtkh` and the consent form records associated with shared view `shrFDu4a5fVeql5Kq`.

The connector returned two consent form records:

- `rec2FLw9TwgDgi85y`, draft consent form
- `recw6i67q2DuoZqMe`, published privacy notice

Both records link to Airtable study record `rec6MGawTSZgdENHs`, whose app-facing study ID is `rect3o7dt` and description is "The diary study description". Added `infra/cloudflare/migrations/0012_seed_diary_study_consent_forms.sql` to hydrate `rops_consent_forms` with those records using `study_id = 'rect3o7dt'` so `/pages/study/consent-forms/?id=rect3o7dt` can load them from D1.

Added `.github/workflows/apply-d1-diary-study-consent-forms.yml` to apply the seed to remote `researchops-d1` through the established Cloudflare-secrets GitHub Actions path. The local desktop runtime did not include `wrangler`, `npm` or `npx`, so direct remote D1 execution was not available from this shell.

Reviewed Codex comment `PRRC_kwDOP3Td2M7IP8Mr` on the diary study seed. Classified it as legitimate. Updated `0012_seed_diary_study_consent_forms.sql` from conflict-upsert behaviour to `INSERT OR IGNORE` so rerunning the seed does not overwrite consent forms that have since been edited or published through the app.

## Validation

Passed:

- `node --test tests/consent-forms-d1-runtime.test.js tests/consent-forms-route-state.test.js`
- `node --test` with 176 passing tests
- `node scripts/agent-trace/assert-trace-coverage.mjs`

## Residual Risk

The local environment cannot run `npm ci` because no package manager is installed in this desktop runtime. CI should provide the package-manager-backed checks.
