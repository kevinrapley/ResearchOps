# ResearchOps availability and monitoring readiness

This folder records the backup, restore, availability and monitoring evidence needed before ResearchOps can support a SOC 2 or ISO/IEC 27001 claim.

It does not assert that availability is in SOC 2 scope, that recovery has been tested, that backups are approved or that monitoring is operationally assured. It records the current deployment and observability evidence, plus the decisions and test evidence still needed.

## Artefacts

| Artefact | Purpose | Status |
| --- | --- | --- |
| `backup-restore-availability-monitoring.md` | Defines the current backup, restore, availability and monitoring readiness position for the ResearchOps Cloudflare deployment boundary. | Drafted for review. |

## Evidence position

The availability and monitoring control is now partially evidenced because the platform has version-controlled deployment configuration, separate production and preview Worker deployment paths, a D1 binding, a KV session namespace, observability configuration, validation gates and release evidence.

The control is not complete until:

- the service owner decides whether Availability is in SOC 2 scope
- SLOs and user-impact thresholds are approved
- RTO/RPO targets are approved for each material data store and workflow
- D1, KV, static content and integration-state backup responsibilities are documented
- restore tests have been run and evidenced against approved data sets
- monitoring signals, alert thresholds, owners and review cadence are approved
- incident escalation, communications and continuity routes are exercised
- service owner, technical owner, information asset owner, security and operations roles sign off the evidence

Until then, ResearchOps can describe this as availability and monitoring readiness evidence. It must not be described as completed business-continuity, disaster-recovery or availability assurance.
