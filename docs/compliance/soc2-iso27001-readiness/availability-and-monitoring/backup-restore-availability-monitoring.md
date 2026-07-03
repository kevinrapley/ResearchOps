# ResearchOps backup, restore, availability and monitoring readiness

Status: draft, not approved.

This page is not completed backup evidence, restore evidence, availability assurance or monitoring assurance. It is a working evidence record for Home Office service-owner, technical-owner, information-asset-owner, security and operations review.

## Current deployment boundary

ResearchOps currently has version-controlled evidence for:

- Cloudflare Pages publishing from `public/`
- a Cloudflare Worker configured from `infra/cloudflare/wrangler.toml`
- a production D1 binding named `RESEARCHOPS_D1`
- a KV namespace binding named `SESSION_KV`
- Worker observability logs enabled with sampling configured
- a scheduled retention trigger configured in UTC
- production and preview Worker deployment workflows
- validation, release-gate and release-evidence controls

Current position: the deployment model is documented, but the evidence does not prove tested restore, approved availability commitments or monitored service operation.

## Availability scope decision

The service owner must decide whether Availability is in SOC 2 scope. If it is in scope, the evidence pack needs:

- service hours and support model
- user-impact definitions for unavailable, degraded and data-loss states
- SLOs for material user journeys and API routes
- alert thresholds and escalation rules
- dependency assumptions for Cloudflare, GitHub, Airtable, Mural, email and AI services where enabled
- exception handling for prototype or non-production operation

Current position: Availability is still an open assurance decision.

## Backup readiness

The backup position should cover each material store:

### Static GOV.UK pages and source-controlled artefacts

- **Current evidence:** source files, Nunjucks templates, generated `public/` output, GitHub history, pull requests and release evidence.
- **Backup assumption:** source control can recover committed static content and generated pages can be rebuilt from source.
- **Evidence still needed:** confirm repository retention, release artefact retention, branch protection and owner-approved recovery route.

### Cloudflare Worker and deployment configuration

- **Current evidence:** `infra/cloudflare/wrangler.toml`, deployment workflow, pinned Wrangler version and build metadata stamping.
- **Backup assumption:** Worker code and deployment configuration are recoverable from GitHub and deployment workflow history.
- **Evidence still needed:** confirm deployment rollback procedure, version identifiers, secrets rehydration route and emergency-change approval.

### D1 database

- **Current evidence:** D1 binding, D1 migration files, production migration workflow and preview D1 separation checks.
- **Backup assumption:** schema and seed migrations are recoverable from source, but production data backup and restore evidence is not present in this pack.
- **Evidence still needed:** define D1 export or backup schedule, backup storage location, access control, encryption, restore owner, restore test data set and restore success criteria.

### KV session namespace

- **Current evidence:** `SESSION_KV` binding exists for session-related state.
- **Backup assumption:** session state is operationally important but may not require long-term backup if sessions can be reissued safely.
- **Evidence still needed:** confirm whether KV data is recoverable, disposable or should be rebuilt; document impact of loss, expiry policy and user recovery route.

### Integration state and supplier data

- **Current evidence:** supplier assurance register names Cloudflare, GitHub, Airtable, Mural, email and AI dependencies.
- **Backup assumption:** supplier-held data may be outside direct ResearchOps backup control.
- **Evidence still needed:** confirm supplier export, restore, retention and incident-notification responsibilities through contract, data-processing and service-owner review.

## Restore readiness

Before this control can be treated as operating evidence, ResearchOps needs restore tests for:

- static page rebuild from source to committed `public/` output
- Worker redeployment from a known commit
- D1 schema and selected data restore into a controlled environment
- KV session loss or reissue scenario
- supplier-export or supplier-restore route where supplier data is material
- rollback or forward-fix decision route for a failed deployment

Each restore test should record:

- test date and environment
- data set used
- person running the test and approver
- start time, finish time and elapsed recovery time
- target RTO/RPO and whether the test met it
- validation evidence after restore
- defects, follow-up actions and owner

Current position: restore test structure is defined, but no completed restore test evidence is present in this pack.

## Monitoring readiness

The monitoring position should cover:

- Worker errors, exceptions and route failures
- D1 query or migration failures
- authentication failures and account-state anomalies
- rate-limit events and sensitive-route failures
- Pages deployment and Worker deployment outcomes
- scheduled retention execution
- integration failures for Airtable, Mural, email and AI services where enabled
- security and audit events with PII minimisation

Cloudflare Worker logs are enabled in configuration, with sampling set in `infra/cloudflare/wrangler.toml`. The monitoring claim still needs explicit operational evidence because the current pack does not define alert thresholds, dashboard ownership, log retention, review cadence or escalation routes.

## Evidence still needed

Before ResearchOps can claim this control is complete, the service needs:

- approved availability scope decision
- approved SLOs and RTO/RPO targets
- backup schedule and owner for each material store
- completed restore test evidence
- monitoring dashboard or report evidence
- alert thresholds and escalation rota
- log sampling and retention decision
- dependency failure playbooks
- service-owner, security and operations sign-off
