# ResearchOps DPIA, data map, ROPA and lawful-basis readiness

Status: draft, not approved.

This page is not an approved DPIA, ROPA entry or lawful-basis decision. It is a working evidence record for Home Office privacy, legal, service-owner, information-asset-owner and security review.

## DPIA readiness

ResearchOps should be screened for DPIA need before production use with real participant or staff personal data because the platform can involve:

- participant contact details, consent state, access needs and research-session records
- research notes, repository artefacts, synthesis outputs and operational decisions
- special-category, safeguarding or sensitive operational information depending on study context
- supplier integrations for hosting, storage, email, collaboration, repository management and AI-assisted processing where enabled
- retention, deletion, access-control and audit-log decisions that affect personal data

Current position: the evidence pack identifies the triggers and likely data flows, but the DPIA is not approved. A named Home Office privacy route must confirm whether a full DPIA is required, record the residual risks and approve the mitigation position before a compliance claim is made.

## Data map

### Account and access data

- **Data classes:** staff email address, user identifier, team role, active-account state, access request reason, approval decision and audit event.
- **Source:** staff member, team approver, authentication workflow and system-generated access events.
- **Stores and routes:** authentication routes, team-access routes, audit records and Cloudflare storage bindings where configured.
- **Sharing and suppliers:** Cloudflare for hosting and runtime, GitHub for change evidence, email provider for sign-in messages where configured.
- **Retention and deletion position:** retain only for account operation, access review, audit and security purposes; deletion and account closure rules need owner sign-off.
- **Open decision:** confirm owner, retention period, access-review cadence and whether any exported support evidence is permitted.

### Participant and consent data

- **Data classes:** participant reference, contact details, access needs, consent state, study participation, communication preference and consent notes.
- **Source:** researcher entry, participant consent workflow or imported research-operation records.
- **Stores and routes:** participant, consent, study and communications routes; Airtable sync paths where enabled.
- **Sharing and suppliers:** Cloudflare, Airtable where enabled, email or communications provider if participant messaging is enabled.
- **Retention and deletion position:** retain only for the research purpose and agreed evidence needs; deletion, withdrawal and anonymisation rules need privacy sign-off.
- **Open decision:** confirm lawful basis, transparency wording, consent evidence standard and special-category handling.

### Research planning and session data

- **Data classes:** project metadata, study plans, session schedules, observers, note-taker assignments, session notes and operational context.
- **Source:** researchers, ResearchOps coordinators and study delivery workflows.
- **Stores and routes:** project, study, session, note and journal records.
- **Sharing and suppliers:** Cloudflare for runtime and storage; Airtable or Mural where sync or collaboration is enabled.
- **Retention and deletion position:** retain only while needed for research governance, synthesis and reuse decisions; final schedule requires information-asset-owner approval.
- **Open decision:** confirm whether session notes may include participant identifiers or sensitive research context, then set minimisation and redaction rules.

### Research artefacts and repository records

- **Data classes:** evidence records, files or references, synthesis outputs, findings, recommendations, repository metadata and reuse decisions.
- **Source:** researchers, repository curators, collaboration tools and imported artefacts.
- **Stores and routes:** research repository pages, sourcebook references, linked integration records and generated outputs.
- **Sharing and suppliers:** Cloudflare, GitHub for committed evidence where applicable, Mural or Airtable if artefacts are synchronised.
- **Retention and deletion position:** repository records should avoid direct PII by design unless a controlled purpose is approved; reuse and archive rules need sign-off.
- **Open decision:** confirm classification, redaction, reuse, archive and disposal rules for artefacts that may contain personal data.

### Audit, security and operational logs

- **Data classes:** route access, authentication events, security events, deployment evidence, error context and operational metadata.
- **Source:** application, Worker routes, CI, deployment and security controls.
- **Stores and routes:** audit event records, Cloudflare logs and GitHub Actions logs.
- **Sharing and suppliers:** Cloudflare and GitHub, with support or incident evidence shared only through approved routes.
- **Retention and deletion position:** logs should minimise PII and retain only what is needed for security, audit and operational assurance; retention periods need approval.
- **Open decision:** confirm log-retention schedule, alert review cadence and redaction rules for incident evidence.

### AI-assisted text processing if enabled

- **Data classes:** user-entered prompt text, generated output, model metadata and operational logs.
- **Source:** staff-entered text in AI-assisted workflows.
- **Stores and routes:** AI rewrite route, model provider boundary and any output saved back to ResearchOps records.
- **Sharing and suppliers:** Cloudflare Workers AI where enabled, or a separately approved external AI provider if configured later.
- **Retention and deletion position:** do not send participant personal data, special-category data or sensitive operational information to AI services unless the approved DPIA, supplier and lawful-basis position permits it.
- **Open decision:** confirm permitted prompts, provider terms, retention, logging, model training-use position and human review controls.

## Records of processing readiness

The ResearchOps ROPA entry should record:

- controller, processor and joint-controller positions for the platform and each integration
- processing purposes for account management, research planning, participant management, consent records, repository evidence, audit and security monitoring
- data-subject categories, including staff, researchers, approvers, participants and potential participants
- personal-data categories, including contact details, identifiers, access needs, consent state, research context and audit metadata
- special-category data position and safeguards where a study context may include it
- recipients, suppliers, subprocessors, transfers and storage locations
- retention periods, deletion triggers and archive rules by data class
- technical and organisational controls, including access control, audit, minimisation, incident response and supplier assurance
- evidence owner, review cadence and approval reference

Current position: the required ROPA fields are identified, but the ROPA is not complete or approved.

## Lawful-basis readiness

The lawful-basis position must be confirmed by the authorised Home Office privacy and legal route. The working assumptions are:

- staff account and access data needs a basis for service administration, access control and security monitoring
- participant recruitment, consent and contact data needs a basis for research operations and participant communication
- research notes and artefacts need a basis that reflects the study purpose, participant information and reuse limits
- access needs, special-category data or safeguarding context needs a confirmed Article 9 condition and safeguards if processed
- AI-assisted processing needs a separate permitted-use decision before personal data is sent to a model provider
- audit and security logs need a basis that supports accountability, misuse detection and incident investigation while minimising PII

Current position: lawful-basis decisions are named as required controls, but they are not approved.

## Current gap

Before ResearchOps can claim this control is complete, the service needs approved DPIA screening, a signed ROPA reference, an owned data map, confirmed lawful-basis decisions, data-sharing and processor positions, retention rules and privacy-notice alignment.
