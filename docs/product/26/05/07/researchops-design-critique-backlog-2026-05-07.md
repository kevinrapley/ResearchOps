# ResearchOps design critique backlog

Date: 2026-05-07  
Source critique: `../../../../design-critiques/26/05/07/researchops-platform-design-critique-2026-05-07.md`  
Authority: `researchops-design-critique-implementation-authority-2026-05-07.md`

## Backlog status

This backlog converts the design critique into product-planning items.

The items are ready for triage, refinement and implementation sequencing. They are not code changes.

## P1 backlog

### ROPS-DC-P1-001: Require evidence linkage for insights and recommendations

Priority: P1  
Area: Evidence integrity  
Problem: Recommendations may be weakly linked to underlying evidence.  
Product change: Make the evidence-to-insight-to-recommendation chain visible and enforceable.

Acceptance criteria:

- Given a user creates an insight, when they save it, then the insight must show linked evidence or be marked incomplete.
- Given a user creates a recommendation, when they save it, then the recommendation must show at least one linked insight or evidence item.
- Given a recommendation has no evidence linkage, when it appears in a list or report, then it must display an incomplete evidence state.
- Given a user reviews a recommendation, when they inspect its evidence chain, then they can navigate back to the source study, session or note.
- Given evidence is deleted or withdrawn, when linked outputs are viewed, then affected insights and recommendations must show a broken-link or review-required state.

Delivery commitment: Deliver as foundational traceability control before broad recommendation workflows are promoted.

### ROPS-DC-P1-002: Introduce lifecycle states for core research objects

Priority: P1  
Area: Workflow state  
Problem: Research objects need clearer lifecycle control.  
Product change: Define and display states for studies, sessions, analysis and recommendations.

Acceptance criteria:

- Given a study exists, when it is viewed, then its current lifecycle state must be visible.
- Given a session exists, when it is viewed, then its state must distinguish scheduled, rescheduled, cancelled and completed.
- Given analysis is underway, when evidence outputs are viewed, then raw, coded, synthesised and reviewed states must be distinguishable.
- Given a recommendation exists, when it is viewed, then draft, reviewed, accepted or rejected state must be visible.
- Given a state changes, when the object is viewed later, then the change must be reflected in the audit trail.

Delivery commitment: Deliver lifecycle state definitions before implementing advanced dashboards.

### ROPS-DC-P1-003: Make pseudonymised participant views the default

Priority: P1  
Area: Consent and PII  
Problem: Identifiable participant data should not be exposed by default.  
Product change: Use pseudonymised display defaults and explicit reveal controls.

Acceptance criteria:

- Given a participant is shown in a research workflow, when the page loads, then pseudonymised details must be shown by default.
- Given a user needs identifiable details, when they reveal them, then the interface must explain why the data is sensitive.
- Given identifiable details are revealed, when audit logging is enabled, then the reveal event must be recorded.
- Given a participant has consent restrictions, when their record is viewed, then the restrictions must be visible before session activity.
- Given a user lacks permission, when they try to view identifiable data, then access must be blocked.

Delivery commitment: Deliver before expanding participant or session management.

### ROPS-DC-P1-004: Add accessibility acceptance criteria to core workflows

Priority: P1  
Area: Accessibility  
Problem: Complex workflows may exclude keyboard, screen reader or cognitive access users.  
Product change: Add accessibility acceptance criteria for each core workflow.

Acceptance criteria:

- Given a new user-facing workflow is planned, when acceptance criteria are written, then keyboard, screen reader, focus order and error-message criteria must be included.
- Given a page uses status, colour or icons, when reviewed, then the state must also be conveyed textually.
- Given a modal, drawer or dynamic panel opens, when keyboard users interact with it, then focus must be managed predictably.
- Given a complex table is used, when reviewed, then headings, captions and row context must be meaningful.
- Given a release is prepared, when accessibility checks fail, then the release must identify the failure and mitigation.

Delivery commitment: Apply to all P1 user-facing implementation work.

### ROPS-DC-P1-005: Define governance roles and decision ownership

Priority: P1  
Area: Governance  
Problem: Decision ownership and approvals are not explicit enough.  
Product change: Define roles for research authorship, review, approval and decision ownership.

Acceptance criteria:

- Given a study is approved, when it is viewed, then the approver and approval date must be visible.
- Given a recommendation is accepted, when it is viewed, then the decision owner must be visible.
- Given a user edits a governed object, when the change is saved, then authorship must be recorded.
- Given a reviewer checks a finding, when they approve or reject it, then the status and reviewer must be recorded.
- Given a governance status is missing, when the object is listed, then it must show a governance incomplete state.

Delivery commitment: Deliver role definitions before implementing approval workflows.

### ROPS-DC-P1-006: Label trace evidence by trace layer

Priority: P1  
Area: AI traceability  
Problem: AI trace reports must avoid overstating model-internal evidence.  
Product change: Ensure trace reports label evidence as operational, behavioural, mechanistic or training.

Acceptance criteria:

- Given an agent trace is generated, when the trace is viewed, then each trace event must show a trace layer.
- Given a mechanistic claim is included, when the trace is reviewed, then it must be labelled as hypothesis unless model-internal tooling supports it.
- Given operational evidence is shown, when the user inspects it, then the source file, command or tool action must be clear.
- Given behavioural eval evidence is shown, when the user inspects it, then the eval name and outcome must be visible.
- Given a trace omits required layer labels, when validation runs, then the trace should fail validation.

Delivery commitment: Maintain trace layer labelling as a core AI governance control.

### ROPS-DC-P1-007: Embed safeguarding prompts and escalation routes

Priority: P1  
Area: Safeguarding  
Problem: Research workflows need visible risk escalation paths.  
Product change: Add safeguarding prompts and escalation guidance to high-risk research workflows.

Acceptance criteria:

- Given a study may involve vulnerable users, when the study is planned, then safeguarding prompts must be visible.
- Given a safeguarding risk is identified, when the user records it, then an escalation route must be shown.
- Given a session has a safeguarding flag, when the session is viewed, then the flag must be visible to authorised users.
- Given safeguarding guidance is required, when the user opens it, then it must explain immediate next steps in plain English.
- Given a safeguarding concern is marked resolved, when reviewed, then the resolution evidence must be visible.

Delivery commitment: Deliver risk prompts before expanding high-risk study workflows.

### ROPS-DC-P1-008: Add task-based start page and study setup task list

Priority: P1  
Area: Service clarity  
Problem: Users need clearer guidance about what to do first and next.  
Product change: Add a task-based entry point and study setup task list.

Acceptance criteria:

- Given a user opens the service, when they arrive, then they can understand what the service does and what they need before starting.
- Given a study is being set up, when the user views the setup page, then required and optional tasks must be distinguishable.
- Given a setup task is complete, when the user returns, then completion state must be visible.
- Given a required setup task is incomplete, when the user tries to progress, then the service must explain what is missing.
- Given a user is new, when they start, then plain-language guidance must explain the research lifecycle.

Delivery commitment: Deliver before expecting wider team adoption.

## P2 backlog

### ROPS-DC-P2-009: Add object headers with parent, state and next action

Priority: P2  
Area: Navigation  
Product change: Add consistent object headers for core pages.

Acceptance criteria:

- Given a user views a project, study, session, insight or recommendation, then the page must show the object name, parent object, state and next action.
- Given a user follows a deep link, then the object header must orient them within the hierarchy.
- Given an object is blocked, then the header must show the blocker.

Delivery commitment: Implement after lifecycle states are defined.

### ROPS-DC-P2-010: Add recruitment, session and incentive dashboards

Priority: P2  
Area: ResearchOps  
Product change: Add operational dashboards for recruitment and session management.

Acceptance criteria:

- Users can see scheduled, completed, cancelled and missing sessions.
- Users can see participant consent and incentive status.
- Users can filter operational dashboards by project and study.

Delivery commitment: Implement after core lifecycle and participant state controls.

### ROPS-DC-P2-011: Rename actions around user tasks

Priority: P2  
Area: Content design  
Product change: Replace internal module labels with task-based language.

Acceptance criteria:

- Labels use verbs and user tasks where possible.
- Navigation labels are tested with representative users.
- Renamed items preserve existing routes or redirects where needed.

Delivery commitment: Implement alongside navigation review.

### ROPS-DC-P2-012: Support lightweight capture before structured tagging

Priority: P2  
Area: Interaction design  
Product change: Make live session note capture lightweight, with structure added later.

Acceptance criteria:

- During a session, users can quickly capture notes without mandatory coding.
- After a session, users can add structure, tags and evidence links.
- The interface distinguishes live capture from later analysis.

Delivery commitment: Implement after session lifecycle states are clarified.

### ROPS-DC-P2-013: Add progressive disclosure to trace summaries

Priority: P2  
Area: Trace UX  
Product change: Present trace summaries first, with expandable detail.

Acceptance criteria:

- Trace summaries show outcome, loaded bundles, skipped bundles and validation state.
- Detailed evidence is available through accessible disclosure controls.
- Keyboard and screen reader users can navigate the trace structure.

Delivery commitment: Implement after trace layer labelling remains stable.

### ROPS-DC-P2-014: Standardise GOV.UK task, summary, table and filter patterns

Priority: P2  
Area: GOV.UK patterns  
Product change: Standardise high-use interface patterns.

Acceptance criteria:

- Study setup uses a GOV.UK-style task list where appropriate.
- Object summaries use summary-list patterns where appropriate.
- Tables include captions, headings and accessible filters.

Delivery commitment: Implement iteratively across core workflows.

### ROPS-DC-P2-015: Explain integration boundaries

Priority: P2  
Area: Service boundaries  
Product change: Explain what happens in ResearchOps, Airtable, Mural and GitHub.

Acceptance criteria:

- Users can understand which system stores which data.
- Integration status is visible where relevant.
- Error states explain whether a problem is local or external.

Delivery commitment: Implement before expanding integration-heavy workflows.

### ROPS-DC-P2-016: Add evidence maturity labels

Priority: P2  
Area: Evidence maturity  
Product change: Show whether evidence is raw, coded, synthesised, validated or accepted.

Acceptance criteria:

- Evidence outputs display maturity labels.
- Users can distinguish draft insights from reviewed findings.
- Reports preserve maturity labels.

Delivery commitment: Implement after evidence linkage controls.

## P3 backlog

### ROPS-DC-P3-017: Define product success metrics

Priority: P3  
Area: Metrics  
Product change: Define measures for traceability and research quality.

Acceptance criteria:

- Metrics include evidence linkage, insight review and recommendation adoption.
- Metrics distinguish activity from quality.
- Metrics are documented before instrumentation is added.

Delivery commitment: Define after P1 foundations are scoped.

### ROPS-DC-P3-018: Create accessible export templates

Priority: P3  
Area: Reporting  
Product change: Create accessible templates for reports and exports.

Acceptance criteria:

- Exported artefacts use semantic headings.
- Tables include headings and captions.
- Reports preserve evidence links where possible.

Delivery commitment: Implement after core reporting needs are confirmed.

### ROPS-DC-P3-019: Add role-sensitive views

Priority: P3  
Area: Multi-actor views  
Product change: Tailor views for researchers, product owners and reviewers.

Acceptance criteria:

- Researchers can see operational research tasks.
- Product owners can see recommendations and decisions.
- Reviewers can see risk, evidence and governance state.

Delivery commitment: Implement after role definitions are agreed.

### ROPS-DC-P3-020: Add onboarding prompts and example studies

Priority: P3  
Area: Training  
Product change: Add guided onboarding for new users.

Acceptance criteria:

- New users can access example study flows.
- Onboarding explains the research lifecycle.
- Guidance can be dismissed and revisited.

Delivery commitment: Implement after the core task flow stabilises.

### ROPS-DC-P3-021: Improve evidence search and filtering

Priority: P3  
Area: Search  
Product change: Improve search by study, evidence type, participant type, theme and decision.

Acceptance criteria:

- Users can filter evidence by study and evidence type.
- Users can find recommendations from linked themes or decisions.
- Search results show evidence maturity and linkage status.

Delivery commitment: Implement after evidence metadata is stable.

### ROPS-DC-P3-022: Summarise audit logs into readable histories

Priority: P3  
Area: Audit trail  
Product change: Convert raw audit logs into readable change histories.

Acceptance criteria:

- Users can see who changed what and when.
- Technical log detail is available separately where needed.
- Readable histories preserve audit integrity.

Delivery commitment: Implement after governance state controls.

### ROPS-DC-P3-023: Add GOV.UK and WCAG release-readiness checks

Priority: P3  
Area: Standards  
Product change: Make GOV.UK and accessibility checks visible in release readiness.

Acceptance criteria:

- Release readiness includes GOV.UK pattern checks.
- Release readiness includes WCAG-related validation evidence.
- Exceptions require documented rationale.

Delivery commitment: Implement after accessibility criteria are standardised.

### ROPS-DC-P3-024: Capture feedback after studies and synthesis

Priority: P3  
Area: Feedback loops  
Product change: Add feedback capture after study and synthesis cycles.

Acceptance criteria:

- Users can record what worked and what did not after a study.
- Feedback can be linked to workflow improvement themes.
- Feedback is visible to product and ResearchOps maintainers.

Delivery commitment: Implement after the study lifecycle is stable.
