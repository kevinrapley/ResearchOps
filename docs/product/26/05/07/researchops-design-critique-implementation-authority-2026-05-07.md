# ResearchOps design critique implementation authority

**Date:** 2026-05-07  
**Source critique:** [`docs/design-critiques/26/05/07/researchops-platform-design-critique-2026-05-07.md`](/docs/design-critiques/26/05/07/researchops-platform-design-critique-2026-05-07.md)  
**Authority status:** created by user request and subject to PR review before becoming the repository record  
**Scope:** product planning, backlog definition and delivery commitments  
**Out of scope:** direct code, UI, configuration or data model changes in this PR

## Authority statement

This document converts the merged ResearchOps platform design critique into implementation authority for product planning artefacts.

The design critique itself was explicitly non-actionable. This document supersedes that non-action boundary only because a later user instruction explicitly requested implementation authority, backlog items, acceptance criteria, delivery commitments and product changes.

This authority allows the repository to contain planning artefacts derived from the critique. It does not automatically authorise immediate production code changes. Each implementation change still requires its own branch, PR, review and validation.

## Source evidence

The source critique identified P1, P2 and P3 issues across:

- evidence integrity
- workflow state
- consent and PII
- accessibility
- governance
- AI traceability
- safeguarding
- service clarity
- navigation
- ResearchOps operations
- content design
- interaction design
- trace UX
- GOV.UK patterns
- service boundaries
- evidence maturity
- metrics
- reporting
- multi-actor views
- training
- search
- audit trail
- standards
- feedback loops

## Product change authority

The following product change themes are authorised for backlog planning:

1. strengthen evidence traceability from raw evidence to accepted recommendations
2. introduce clearer lifecycle states across studies, sessions, analysis and recommendations
3. improve consent, pseudonymisation and PII exposure controls
4. make complex ResearchOps workflows accessible by default
5. define governance roles, approvals and decision ownership
6. improve AI and agent trace readability without overstating model internals
7. embed safeguarding prompts and escalation paths
8. clarify the service start, task flow and next-step guidance
9. improve navigation, object hierarchy and orientation
10. improve ResearchOps operational dashboards
11. use clearer task-based language
12. make live note capture lighter
13. improve trace UX with progressive disclosure
14. standardise GOV.UK task, summary, table and filter patterns
15. explain integration boundaries across ResearchOps, Airtable, Mural and GitHub
16. show evidence maturity states
17. define success metrics
18. improve accessible exports
19. add role-sensitive views
20. improve onboarding
21. improve evidence search and filtering
22. summarise audit logs into readable histories
23. expose GOV.UK and WCAG release-readiness checks
24. capture feedback after study and synthesis cycles

## Governance rules for implementation

All work authorised by this document must follow these rules.

1. P1 items take precedence over P2 and P3 unless a dependency requires earlier enabling work.
2. Each implementation item must have acceptance criteria before code changes begin.
3. Each implementation PR must include validation evidence.
4. Accessibility acceptance criteria must be included for every user-facing change.
5. Any work touching consent, PII, safeguarding or vulnerable users must include explicit risk review.
6. AI traceability work must distinguish operational, behavioural, mechanistic and training evidence.
7. Mechanistic claims must not be made unless supported by model-internal tooling.
8. No integration-specific implementation may begin without loading the relevant API bundle.
9. No delivery date is guaranteed by this document.
10. Delivery commitments are commitments to manage and validate the work, not fixed-date promises.

## Prioritisation model

Priority is assigned as follows.

P1 means high-value, high-risk or foundational. These items address evidence integrity, safety, accessibility, governance or service clarity.

P2 means important enabling work. These items improve adoption, consistency and operational usability.

P3 means useful improvement. These items improve maturity, reporting and long-term service quality.

## Delivery commitment summary

The delivery commitment is to maintain a governed implementation backlog derived from the critique.

The first delivery tranche should focus on P1 items that reduce risk or create foundation controls:

- evidence linkage
- lifecycle states
- consent and PII defaults
- accessibility acceptance criteria
- governance roles
- trace evidence labelling
- safeguarding escalation
- service start and setup guidance

Later tranches may address P2 and P3 items after P1 foundations are in place or deliberately deferred.

## Non-implementation boundary for this PR

This PR creates planning authority and backlog artefacts only.

It does not:

- change application code
- change frontend UI
- change data schema
- change Cloudflare configuration
- change Airtable or Mural integration behaviour
- create GitHub issues
- guarantee delivery dates

## Review requirement

Before implementation begins, reviewers should confirm:

- the authority statement is acceptable
- the backlog items accurately reflect the critique
- the acceptance criteria are testable
- delivery commitments are realistic and not date-bound
- P1 items correctly represent risk and foundational value
