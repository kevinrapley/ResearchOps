# ResearchOps compliance scope and system boundary

This document defines the proposed compliance scope and system boundary for the ResearchOps platform. It supports future SOC 2 and ISO/IEC 27001 readiness work.

It does not assert SOC 2 compliance or ISO/IEC 27001 certification.

## Scope statement

The scoped service is the ResearchOps platform used by ResearchOps practitioners and the research community to plan, run, evidence, reuse and govern research operations.

The proposed assurance scope covers the live ResearchOps web service, API, deployment pipeline, data stores, security controls, integrations and operational processes needed to handle research operations data, including PII and GDPR-relevant records.

For SOC 2 readiness, the initial scope should include the Security category. Confidentiality and Privacy should be treated as expected scope candidates because the service can process personal data, participant consent records, session notes and research artefacts. Availability and Processing Integrity should remain open decisions until service owner expectations, SLOs and operating model commitments are agreed.

For ISO/IEC 27001 readiness, the proposed ISMS boundary is the management, development, deployment and operation of the ResearchOps platform and its supporting supplier/integration relationships. The ISMS boundary should include governance, risk management, access control, secure development, supplier management, incident handling, retention and monitoring for this service.

## Included in scope

| Area | Boundary inclusion |
| --- | --- |
| User-facing service | ResearchOps frontend pages, GOV.UK-rendered service pages and authenticated workflows. |
| API and Worker runtime | Cloudflare Workers and Pages Functions serving ResearchOps API routes, auth, route permissions, Mural sync, retention and diagnostics controls. |
| Data stores | Cloudflare D1 databases, KV namespaces and any configured ResearchOps persistence used by the scoped service. |
| Identity and access | Passwordless authentication, account status checks, team roles, route permissions, privileged actions and audit events implemented by the service. |
| Research data workflows | Projects, studies, participants, consent, session notes, journals, synthesis, repository records, impact records and related metadata handled by the service. |
| Integrations | Cloudflare, GitHub, Airtable, Mural, email delivery and any configured AI service where used by ResearchOps workflows. |
| Delivery pipeline | GitHub repository controls, pull-request review, CI, security audit policy, trace evidence, deployment workflows, Wrangler configuration and release assurance. |
| Operational controls | Security headers, CSRF controls, rate limits, retention enforcement, logging minimisation, secret configuration, monitoring and incident response for the scoped service. |

## Out of scope

| Area | Boundary exclusion |
| --- | --- |
| Wider Home Office enterprise systems | Corporate identity, HR, finance, device management, network controls and Microsoft 365 are outside this service boundary unless they directly enforce ResearchOps access or incident response. |
| Supplier internal control environments | Cloudflare, GitHub, Airtable, Mural, email and AI provider internal controls are supplier-assurance dependencies, not controls operated by the ResearchOps team. |
| Local developer workstations | Endpoint hardening is outside the technical service boundary, but secure development access requirements, least privilege and secret-handling expectations remain in the SDLC evidence set. |
| External research tools not integrated with the service | Standalone research tools, spreadsheets, documents or boards are outside scope unless data is imported, exported or synchronised through ResearchOps workflows. |
| Historical demo artefacts | Static demonstrations and generated examples that do not process live ResearchOps data are outside the production assurance boundary, but must not encourage entry of real personal data. |

## Data boundary

The scoped service must be treated as capable of processing personal data. Data classes include:

- authenticated user identifiers, names, email addresses, team membership and role assignments
- participant identifiers, contact details, access needs, consent state and consent history
- research plans, study details, session notes, journal entries, synthesis outputs, repository candidate records and impact decisions
- audit events, security events, deployment evidence and operational metadata
- integration tokens, OAuth state, webhook or callback metadata and provider object identifiers

Research content may contain special-category, safeguarding or sensitive operational information depending on study context. Until DPIA and information-asset-owner review confirm tighter boundaries, the platform should be governed on the assumption that higher-risk personal data can appear in participant, notes, journal and synthesis workflows.

## User and administrator boundary

Included user groups are:

- ResearchOps service owner and product/delivery roles
- ResearchOps administrators and team administrators
- researchers, research leads, note takers, observers and repository curators
- authorised technical maintainers with repository, deployment or Cloudflare access
- security, privacy, governance and audit reviewers with legitimate assurance need

Participants are data subjects in the boundary when their records, consent state or research contributions are processed by the platform. They are not currently treated as direct authenticated platform users unless a later product change introduces participant-facing access.

## Main data flows

| Flow | Description | Boundary position |
| --- | --- | --- |
| Browser to ResearchOps service | Authenticated users access pages and submit workflow data through the web frontend. | In scope. |
| Frontend to Worker API | Pages and scripts call ResearchOps API routes for projects, studies, consent, notes, journals, synthesis and integrations. | In scope. |
| Worker API to D1 and KV | The Worker reads and writes service data, session/auth state, route permissions, retention state and integration metadata. | In scope. |
| Worker API to Mural | OAuth and Mural sync features connect ResearchOps users to Mural boards and widgets. | In scope as a supplier integration and data export/sync path. |
| Worker/API to Airtable or CSV-backed sources | Existing import/sync patterns can pull or map structured research operations data. | In scope where production data is used. |
| Worker/API to email delivery | Passwordless sign-in and notifications use email delivery paths. | In scope as authentication and notification infrastructure. |
| Worker/API to AI services | AI-assisted rewriting or analysis must avoid unnecessary personal data and needs explicit provider boundary review. | Conditionally in scope where enabled. |
| GitHub Actions to Cloudflare | CI and deployment workflows build, validate and deploy service changes. | In scope for change management and release evidence. |
| Retention job to data stores | Scheduled retention enforcement removes expired records from configured stores. | In scope for GDPR storage limitation evidence. |

## Control boundary

Controls operated by the ResearchOps team include:

- route permissions, authentication and active-account enforcement in the service
- CSRF checks, rate limiting and security headers
- D1/KV schema, migrations and retention enforcement
- PII-minimised audit and operational logging
- repository review, CI validation, dependency audit policy and release evidence
- secret-name configuration and deployment workflow controls
- documentation, trace evidence and risk treatment artefacts

Controls inherited from suppliers include platform physical security, underlying infrastructure availability, provider identity controls, provider certifications and provider incident-management evidence. These must be tracked through supplier assurance rather than claimed as ResearchOps-operated controls.

## Open scope decisions

These decisions must be closed before making a SOC 2 or ISO/IEC 27001 claim:

- named service owner, information asset owner, senior risk owner and ISMS accountability route
- production domain names, environments and data stores in the final assurance boundary
- whether Airtable remains a production system of record, transitional data source or out-of-scope migration source
- whether Mural is a processor, subprocessor or user-directed export destination for each workflow
- whether AI-assisted features are enabled in production and which provider/data-retention terms apply
- whether SOC 2 scope includes Confidentiality, Privacy, Availability or Processing Integrity beyond Security
- final data classification, lawful basis, DPIA outcome, ROPA references and retention schedule
- backup, restore, business continuity and incident-response evidence expectations

## Acceptance criteria for this item

The "Defined compliance scope and system boundary" item is handled when:

- the ResearchOps platform boundary is documented in version-controlled evidence
- included and excluded systems, users, data classes, integrations and data flows are explicit
- the document avoids unsupported SOC 2 or ISO/IEC 27001 compliance claims
- remaining sign-offs and evidence gaps are listed for the broader compliance-readiness workstream
- a repository test protects the non-claim wording and core boundary content

