# SOC 2 and ISO 27001 readiness evidence index

This index tracks evidence needed to support a future SOC 2 and ISO/IEC 27001 claim for the ResearchOps platform. It does not assert SOC 2 compliance or ISO/IEC 27001 certification.

| Evidence area | Status | Current evidence | Gap to close before a claim |
| --- | --- | --- | --- |
| Compliance scope and system boundary | Defined in this PR | `docs/compliance/soc2-iso27001-readiness/scope-and-system-boundary.md` | Requires service owner, information asset owner and security representative sign-off. |
| Security hardening baseline | Partially evidenced | `docs/agent-audit/reasoning/2026/07/02/security-hardening-main.md` and merged PR #460 | Requires deployment evidence and operational monitoring review after production rollout. |
| Asset and data inventory | Not complete | Existing repository, Cloudflare, D1, KV, Mural and Airtable references | Produce an owned inventory covering systems, stores, bindings, secrets, data classes and suppliers. |
| DPIA and GDPR records | Not complete | Product copy and retention policy references warn about personal data | Confirm DPIA screening, lawful basis, records of processing, data sharing, processor/subprocessor positions and special-category handling. |
| Risk assessment and treatment plan | Not complete | `gap-register.yaml`, `security-audit-triage.yaml` and release assurance documents | Create an information security risk register for the scoped service and map each risk to an owner, treatment and review date. |
| ISO/IEC 27001 Statement of Applicability | Not started | None in this evidence pack | Create a Statement of Applicability after the risk assessment and control selection are agreed. |
| SOC 2 control mapping | Not started | Security hardening tests and route permission tests | Map implemented controls to the selected SOC 2 Trust Services Criteria and mark evidence owner/frequency. |
| Access review evidence | Partially evidenced | Auth and role-assignment tests, route-permission migrations and audit-event implementation traces | Define access-review cadence, privileged-access review evidence and joiner/mover/leaver control evidence. |
| Logging, audit and monitoring | Partially evidenced | Security hardening trace, audit event tests and production logging configuration | Define what is logged, what PII is excluded, retention for logs, alert thresholds and review evidence. |
| Incident response | Partially evidenced | Sourcebook incident templates and `docs/compliance/soc2-iso27001-readiness/incident-response/` runbooks, breach handling process and planned exercise record | Complete a tabletop or simulated incident exercise, record outcomes and obtain service-owner, security and privacy sign-off. |
| Supplier assurance | Not complete | Cloudflare, GitHub, Airtable, Mural and email/AI integrations are identified in the boundary | Capture supplier roles, contracts, data processing terms, locations, certifications and review cadence. |
| Business continuity and availability | Not complete | Cloudflare deployment and release assurance evidence | Decide whether availability is in SOC 2 scope, then define SLOs, backup/restore evidence and recovery tests. |
| Secure development lifecycle | Partially evidenced | CI, lint, tests, trace policy, security audit policy and branch protection evidence | Produce SDLC control evidence covering review, dependency management, release approval and change traceability. |

## Next control artefacts

The next PRs in this broader workstream should add:

1. Asset and data inventory.
2. Supplier and subprocessor register.
3. ISMS scope, risk assessment, risk treatment plan and Statement of Applicability.
4. SOC 2 criteria mapping and ISO/IEC 27001 Statement of Applicability skeleton.
5. DPIA and records-of-processing sign-off references.
6. Completed incident response test evidence and breach handling sign-off.
