# ResearchOps design critique product change register

Date: 2026-05-07  
Source critique: `docs/design-critiques/researchops-platform-design-critique-2026-05-07.md`  
Authority: `docs/product/researchops-design-critique-implementation-authority-2026-05-07.md`  
Backlog: `docs/product/researchops-design-critique-backlog-2026-05-07.md`

## Purpose

This register records the product changes authorised for planning from the ResearchOps design critique.

It does not implement the changes. It provides a controlled bridge between the critique and future implementation PRs.

## Delivery commitment model

The delivery commitments in this register are commitments to manage the work through governed delivery.

They are not fixed-date promises.

Each product change must have:

- a backlog item
- acceptance criteria
- implementation branch
- validation evidence
- PR review
- accessibility consideration if user-facing
- risk review if touching consent, PII, safeguarding or vulnerable users

## Product changes

### PC-001: Evidence linkage control

Related backlog item: `ROPS-DC-P1-001`  
Priority: P1  
Change type: product control  
Delivery commitment: establish evidence linkage as a foundational control before expanding recommendation workflows.

Product change:

ResearchOps should make evidence linkage visible and enforceable across insights and recommendations.

Expected outcome:

Teams can inspect the source evidence behind recommendations and identify incomplete evidence chains.

### PC-002: Research object lifecycle model

Related backlog item: `ROPS-DC-P1-002`  
Priority: P1  
Change type: workflow model  
Delivery commitment: define lifecycle states before advanced dashboards or reporting depend on them.

Product change:

ResearchOps should show lifecycle states for studies, sessions, analysis outputs and recommendations.

Expected outcome:

Users can understand what is draft, active, complete, reviewed, blocked or accepted.

### PC-003: Pseudonymised participant defaults

Related backlog item: `ROPS-DC-P1-003`  
Priority: P1  
Change type: privacy and safety control  
Delivery commitment: implement safer participant display defaults before broadening participant workflows.

Product change:

ResearchOps should show pseudonymised participant information by default and make identifiable information a deliberate reveal.

Expected outcome:

Participant privacy risk is reduced and sensitive data exposure becomes more intentional.

### PC-004: Accessibility acceptance criteria standard

Related backlog item: `ROPS-DC-P1-004`  
Priority: P1  
Change type: delivery standard  
Delivery commitment: require accessibility criteria for all P1 user-facing changes.

Product change:

ResearchOps should include accessibility acceptance criteria for core workflows and release readiness.

Expected outcome:

Accessibility is treated as a design and delivery requirement, not a late QA activity.

### PC-005: Governance roles and decision ownership

Related backlog item: `ROPS-DC-P1-005`  
Priority: P1  
Change type: governance model  
Delivery commitment: define roles before implementing approval workflows.

Product change:

ResearchOps should identify authors, reviewers, approvers and decision owners for governed objects.

Expected outcome:

Research decisions and recommendations become auditable and accountable.

### PC-006: Trace evidence layer labelling

Related backlog item: `ROPS-DC-P1-006`  
Priority: P1  
Change type: AI governance control  
Delivery commitment: maintain trace layer labelling across agent trace work.

Product change:

ResearchOps should label trace evidence as operational, behavioural, mechanistic or training.

Expected outcome:

Trace reports become more trustworthy and less likely to overstate model-internal evidence.

### PC-007: Safeguarding prompts and escalation routes

Related backlog item: `ROPS-DC-P1-007`  
Priority: P1  
Change type: safeguarding control  
Delivery commitment: deliver risk prompts before expanding high-risk study workflows.

Product change:

ResearchOps should include safeguarding prompts and escalation routes in high-risk research workflows.

Expected outcome:

Researchers are guided toward proportionate escalation when risk appears.

### PC-008: Task-based service start and setup flow

Related backlog item: `ROPS-DC-P1-008`  
Priority: P1  
Change type: service clarity improvement  
Delivery commitment: deliver before expecting wider adoption by non-expert users.

Product change:

ResearchOps should provide a task-based start page and study setup task list.

Expected outcome:

Users understand what the service does, what they need and what to do next.

### PC-009: Object headers and orientation controls

Related backlog item: `ROPS-DC-P2-009`  
Priority: P2  
Change type: navigation improvement  
Delivery commitment: implement after lifecycle states are defined.

Product change:

Core object pages should show parent object, state and next action.

Expected outcome:

Users can maintain orientation across complex project, study and evidence hierarchies.

### PC-010: ResearchOps operational dashboards

Related backlog item: `ROPS-DC-P2-010`  
Priority: P2  
Change type: operations visibility  
Delivery commitment: implement after participant and session state controls.

Product change:

ResearchOps should provide dashboards for recruitment, sessions and incentives.

Expected outcome:

Research teams can monitor operational risks and missing activity.

### PC-011: Task-based language revision

Related backlog item: `ROPS-DC-P2-011`  
Priority: P2  
Change type: content design improvement  
Delivery commitment: implement alongside navigation review.

Product change:

Interface labels should use user tasks rather than internal module terminology where possible.

Expected outcome:

The service becomes easier to understand for new or occasional users.

### PC-012: Lightweight live capture workflow

Related backlog item: `ROPS-DC-P2-012`  
Priority: P2  
Change type: interaction improvement  
Delivery commitment: implement after session lifecycle states are clarified.

Product change:

Session note capture should support lightweight live capture with structure added later.

Expected outcome:

Researchers can capture useful notes without being overloaded during sessions.

### PC-013: Trace progressive disclosure

Related backlog item: `ROPS-DC-P2-013`  
Priority: P2  
Change type: trace UX improvement  
Delivery commitment: implement after trace layer labelling remains stable.

Product change:

Trace reports should show summaries first and expose details through accessible disclosure.

Expected outcome:

Trace information becomes usable by product stakeholders and specialists.

### PC-014: GOV.UK pattern standardisation

Related backlog item: `ROPS-DC-P2-014`  
Priority: P2  
Change type: design-system alignment  
Delivery commitment: implement iteratively across core workflows.

Product change:

ResearchOps should standardise GOV.UK task list, summary list, table and filter patterns where appropriate.

Expected outcome:

Interfaces become more consistent, accessible and easier to maintain.

### PC-015: Integration boundary explanations

Related backlog item: `ROPS-DC-P2-015`  
Priority: P2  
Change type: service boundary clarification  
Delivery commitment: implement before expanding integration-heavy workflows.

Product change:

ResearchOps should explain which data and actions belong in ResearchOps, Airtable, Mural and GitHub.

Expected outcome:

Users better understand system behaviour and external dependency failures.

### PC-016: Evidence maturity labels

Related backlog item: `ROPS-DC-P2-016`  
Priority: P2  
Change type: evidence quality signal  
Delivery commitment: implement after evidence linkage controls.

Product change:

ResearchOps should label evidence as raw, coded, synthesised, validated or accepted.

Expected outcome:

Teams can distinguish early evidence from reviewed or accepted findings.

### PC-017: Product success metrics

Related backlog item: `ROPS-DC-P3-017`  
Priority: P3  
Change type: measurement framework  
Delivery commitment: define after P1 foundations are scoped.

Product change:

ResearchOps should define measures for traceability, research quality and decision adoption.

Expected outcome:

Product success is assessed through quality and outcome measures, not activity alone.

### PC-018: Accessible export templates

Related backlog item: `ROPS-DC-P3-018`  
Priority: P3  
Change type: reporting improvement  
Delivery commitment: implement after reporting needs are confirmed.

Product change:

ResearchOps should provide accessible templates for reports and exports.

Expected outcome:

Research artefacts remain accessible when exported outside the platform.

### PC-019: Role-sensitive views

Related backlog item: `ROPS-DC-P3-019`  
Priority: P3  
Change type: multi-actor service view  
Delivery commitment: implement after role definitions are agreed.

Product change:

ResearchOps should support different views for researchers, product owners and governance reviewers.

Expected outcome:

Different actors can work from the same evidence system without unnecessary detail overload.

### PC-020: Onboarding prompts and example studies

Related backlog item: `ROPS-DC-P3-020`  
Priority: P3  
Change type: adoption support  
Delivery commitment: implement after the core task flow stabilises.

Product change:

ResearchOps should provide onboarding prompts and example study flows.

Expected outcome:

New researchers can understand the intended workflow without one-to-one training.

### PC-021: Evidence search and filtering

Related backlog item: `ROPS-DC-P3-021`  
Priority: P3  
Change type: findability improvement  
Delivery commitment: implement after evidence metadata is stable.

Product change:

ResearchOps should improve search and filtering by study, evidence type, participant type, theme and decision.

Expected outcome:

Users can retrieve evidence and recommendations more efficiently.

### PC-022: Readable audit histories

Related backlog item: `ROPS-DC-P3-022`  
Priority: P3  
Change type: audit readability improvement  
Delivery commitment: implement after governance state controls.

Product change:

ResearchOps should summarise audit logs into readable change histories.

Expected outcome:

Users can understand changes without reading raw technical logs.

### PC-023: GOV.UK and WCAG release readiness checks

Related backlog item: `ROPS-DC-P3-023`  
Priority: P3  
Change type: standards assurance  
Delivery commitment: implement after accessibility criteria are standardised.

Product change:

ResearchOps should expose GOV.UK and WCAG checks in release readiness.

Expected outcome:

Standards compliance becomes visible before release.

### PC-024: Post-study feedback loops

Related backlog item: `ROPS-DC-P3-024`  
Priority: P3  
Change type: continuous improvement  
Delivery commitment: implement after the study lifecycle is stable.

Product change:

ResearchOps should capture feedback after study and synthesis cycles.

Expected outcome:

The service learns from research team experience and improves over time.

## Implementation boundary

No product change listed here is implemented by this PR.

Future implementation PRs must reference the relevant product change ID and backlog item ID.
