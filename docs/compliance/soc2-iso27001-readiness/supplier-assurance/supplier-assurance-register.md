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

| Supplier or provider | ResearchOps role | Data or control dependency | Current status | Evidence needed before a claim |
| --- | --- | --- | --- | --- |
| Cloudflare | Hosts Pages, Workers, D1, KV, secrets, deployment routes and may provide Workers AI where enabled. | Service availability, runtime controls, storage boundary, secrets, logs, access controls and AI processing if the AI binding is used. | Partially evidenced by deployment model, validation gates and secret checks. Not approved for compliance claim. | Confirm contract route, data-processing terms, locations, subprocessor position, security assurance reports, incident notification route and owner review cadence. |
| GitHub | Hosts source code, pull requests, actions, release evidence, code scanning, provenance and repository controls. | Source control, CI, branch protection, pull request evidence, audit traces and secrets configuration. | Partially evidenced by PR workflow, CI and release assurance. Not approved for compliance claim. | Confirm repository ownership, branch protection evidence, access review evidence, secrets handling, GitHub Actions data exposure, security assurance evidence and retention of workflow logs. |
| Airtable | Provides configured record storage and sync paths for ResearchOps project, study, participant, consent, session and communications data where enabled. | Operational research records, participant and staff contact details, consent state, session notes and synchronised project data. | Integration identified. Not approved for compliance claim. | Confirm base ownership, data classes, lawful basis, processor position, data location, retention, access review, API token ownership, backup/export route and supplier assurance evidence. |
| Mural | Provides collaboration workspace, mural objects, OAuth integration and export or sync paths where enabled. | Research artefacts, collaboration metadata, user identifiers, mural identifiers, exports and OAuth tokens. | Integration identified. Not approved for compliance claim. | Confirm workspace ownership, permitted data classes, OAuth scope approval, export handling, retention, access review, data location, processor position and supplier assurance evidence. |
| Resend | Sends passwordless sign-in email codes when `RESEND_API_KEY` and `RESEARCHOPS_EMAIL_FROM` are configured. | Staff email address, sign-in code delivery metadata and authentication availability. | Conditional dependency identified from the passwordless email route. Not approved for compliance claim. | Confirm contract route, data-processing terms, email content limits, retention, location, incident notification, sender-domain controls and operational fallback. |
| future communications provider | Sends participant or research-operation messages if the communications stub is replaced with a real provider. | Participant contact details, message templates, delivery metadata and communications log entries. | Not selected. Not approved for production personal data. | Select provider through service-owner, commercial, privacy and security review before enabling; confirm data-processing terms, special-category restrictions, message retention, opt-out handling and incident route. |
| Cloudflare Workers AI | Supports AI-assisted rewriting when the Cloudflare AI binding is configured. | User-entered text sent to the model, possible personal data in prompts, model output and operational logs. | Conditional dependency identified in the AI rewrite route. Not approved for unrestricted personal data. | Confirm whether enabled in production, permitted use cases, prompt data rules, retention, logging, model selection, human review, privacy review and safety controls. |
| OpenAI or other external AI provider | Future AI service if ResearchOps is configured to use an external AI provider outside Cloudflare Workers AI. | Prompt text, generated output, evaluation data, possible research or participant data if not restricted. | Not selected. Not approved for production personal data. | Complete separate AI supplier review before use, including data-processing terms, retention, training-use position, model safety controls, DPIA screening, human review and incident route. |

## Minimum review cadence

Review the supplier register:

- before production go-live
- before enabling any new supplier or integration
- before sending new personal data classes to an existing supplier
- after a supplier incident or material terms change
- at least every 12 months while the service remains in scope

## Current gap

The register names the supplier dependencies and assurance questions. It still needs named owners, evidence references, review dates and formal approval decisions before ResearchOps can treat supplier assurance as complete.
