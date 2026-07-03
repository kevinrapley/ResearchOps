# ResearchOps supplier assurance register

This register defines the supplier assurance evidence needed before ResearchOps can treat supplier and integration controls as ready for SOC 2 or ISO/IEC 27001 review.

Register status: draft, not approved.

This page is not a supplier approval decision. It is the working register for service-owner, information-asset-owner, commercial, privacy and security review.

## Review rule

Before a supplier is treated as approved for production personal data, record:

- supplier role
- ResearchOps use case
- personal data and special-category data position
- contract and data-processing terms
- location and transfer position
- subprocessor position
- security assurance evidence reviewed
- incident notification route
- owner and review date
- approval decision and approver

## Current supplier register

### Cloudflare

- **ResearchOps role:** hosts Pages, Workers, D1, KV, secrets, deployment routes and may provide Workers AI where enabled.
- **Data or control dependency:** service availability, runtime controls, storage boundary, secrets, logs, access controls and AI processing if the AI binding is used.
- **Current status:** partially evidenced by deployment model, validation gates and secret checks. Not approved for compliance claim.
- **Evidence needed before a claim:** confirm contract route, data-processing terms, locations, subprocessor position, security assurance reports, incident notification route and owner review cadence.

### GitHub

- **ResearchOps role:** hosts source code, pull requests, actions, release evidence, code scanning, provenance and repository controls.
- **Data or control dependency:** source control, CI, branch protection, pull request evidence, audit traces and secrets configuration.
- **Current status:** partially evidenced by PR workflow, CI and release assurance. Not approved for compliance claim.
- **Evidence needed before a claim:** confirm repository ownership, branch protection evidence, access review evidence, secrets handling, GitHub Actions data exposure, security assurance evidence and retention of workflow logs.

### Airtable

- **ResearchOps role:** provides configured record storage and sync paths for ResearchOps project, study, participant, consent, session and communications data where enabled.
- **Data or control dependency:** operational research records, participant and staff contact details, consent state, session notes and synchronised project data.
- **Current status:** integration identified. Not approved for compliance claim.
- **Evidence needed before a claim:** confirm base ownership, data classes, lawful basis, processor position, data location, retention, access review, API token ownership, backup/export route and supplier assurance evidence.

### Mural

- **ResearchOps role:** provides collaboration workspace, mural objects, OAuth integration and export or sync paths where enabled.
- **Data or control dependency:** research artefacts, collaboration metadata, user identifiers, mural identifiers, exports and OAuth tokens.
- **Current status:** integration identified. Not approved for compliance claim.
- **Evidence needed before a claim:** confirm workspace ownership, permitted data classes, OAuth scope approval, export handling, retention, access review, data location, processor position and supplier assurance evidence.

### Resend

- **ResearchOps role:** sends passwordless sign-in email codes when `RESEND_API_KEY` and `RESEARCHOPS_EMAIL_FROM` are configured.
- **Data or control dependency:** staff email address, sign-in code delivery metadata and authentication availability.
- **Current status:** conditional dependency identified from the passwordless email route. Not approved for compliance claim.
- **Evidence needed before a claim:** confirm contract route, data-processing terms, email content limits, retention, location, incident notification, sender-domain controls and operational fallback.

### future communications provider

- **ResearchOps role:** sends participant or research-operation messages if the communications stub is replaced with a real provider.
- **Data or control dependency:** participant contact details, message templates, delivery metadata and communications log entries.
- **Current status:** not selected. Not approved for production personal data.
- **Evidence needed before a claim:** select provider through service-owner, commercial, privacy and security review before enabling; confirm data-processing terms, special-category restrictions, message retention, opt-out handling and incident route.

### Cloudflare Workers AI

- **ResearchOps role:** supports AI-assisted rewriting when the Cloudflare AI binding is configured.
- **Data or control dependency:** user-entered text sent to the model, possible personal data in prompts, model output and operational logs.
- **Current status:** conditional dependency identified in the AI rewrite route. Not approved for unrestricted personal data.
- **Evidence needed before a claim:** confirm whether enabled in production, permitted use cases, prompt data rules, retention, logging, model selection, human review, privacy review and safety controls.

### OpenAI or other external AI provider

- **ResearchOps role:** future AI service if ResearchOps is configured to use an external AI provider outside Cloudflare Workers AI.
- **Data or control dependency:** prompt text, generated output, evaluation data, possible research or participant data if not restricted.
- **Current status:** not selected. Not approved for production personal data.
- **Evidence needed before a claim:** complete separate AI supplier review before use, including data-processing terms, retention, training-use position, model safety controls, DPIA screening, human review and incident route.

## Minimum review cadence

Review the supplier register:

- before production go-live
- before enabling any new supplier or integration
- before sending new personal data classes to an existing supplier
- after a supplier incident or material terms change
- at least every 12 months while the service remains in scope

## Current gap

The register names the supplier dependencies and assurance questions. It still needs named owners, evidence references, review dates and formal approval decisions before ResearchOps can treat supplier assurance as complete.
