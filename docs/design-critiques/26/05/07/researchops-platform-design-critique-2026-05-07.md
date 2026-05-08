# ResearchOps platform design critique

**Date:** 2026-05-07  
**Scope:** critique record only  
**Status:** documentation-only artefact  
**Action constraint:** no implementation action is to be taken from the priorities in this document unless separately requested and approved.

## Applied lenses

This critique applies the GOV.UK Design System and Gold Standard Gov Product Assistant lenses. It also uses ResearchOps, accessibility, service design and product governance perspectives.

## Participants

- User Researcher
- Research Operations
- GOV.UK Specialist
- Interaction Designer
- Product Owner
- Service Designer
- Accessibility Specialist

## Round 1: Service purpose and user need

@UserResearcher: The platform has a strong purpose. It tries to turn fragmented research artefacts into a traceable service workflow. The risk is that it may feel designed for expert researchers who already understand the model.

@ResearchOperations: The strongest value is operational consistency. Projects, studies, sessions, guides, participants, journals and synthesis all belong together. The lifecycle needs to be explained clearly at entry points.

@GOVUKSpecialist: The service needs a clearer start proposition. Users should know what they can do, what they need before they start and what happens next.

@InteractionDesigner: The product contains several complex workspaces. Users need orientation cues, clear primary actions and a consistent hierarchy between project, study, session and evidence objects.

@ProductOwner: The platform solves a real pain. Research evidence is often separated from decisions. The product goal should be sharper: help teams run ethical, traceable research from planning to recommendations.

@ServiceDesigner: The service should be mapped across several actors. Researchers are not the only users. Product owners, designers, delivery managers and governance leads also need to understand the evidence trail.

@AccessibilitySpecialist: The service purpose has accessibility consequences. If the platform captures high-stakes research and ethical decisions, inaccessible workflows become evidence quality risks.

## Round 2: Operating model and governance

@UserResearcher: The repository operating-model work is directionally strong. The same principle applies to research work: the study protocol and evidence model should be the source of truth.

@ResearchOperations: Governance states should be visible. Draft study, approved study, active recruitment, sessions underway, analysis in progress, findings reviewed and recommendations accepted are distinct states.

@GOVUKSpecialist: Governance must be proportionate. The service should show what is required, recommended and optional.

@InteractionDesigner: The interface should separate workflow status from content status. A discussion guide may be draft while the study is approved.

@ProductOwner: Governance controls need product value. If controls feel like compliance overhead, teams will bypass them.

@ServiceDesigner: The platform should include service-level roles and responsibilities. It should show who approves research, owns recommendations and decides whether evidence is strong enough.

@AccessibilitySpecialist: Governance should include accessibility checks at each stage. Recruitment, consent, session materials, synthesis and reporting all have accessibility risks.

## Round 3: Information architecture and navigation

@UserResearcher: The hierarchy of project, study, participant, session, note, excerpt, code, insight and recommendation needs to be obvious. If users cannot explain where they are, traceability will break.

@ResearchOperations: ResearchOps depends on findability. Users need quick access to current studies, session status, consent status, incentive status and evidence outputs.

@GOVUKSpecialist: Navigation should avoid internal jargon where possible. Task labels such as Plan a study, Create a discussion guide and Record a session are clearer.

@InteractionDesigner: Each page should have a consistent object header. It should show the object, parent object, state and main next action.

@ProductOwner: The information architecture should prioritise the highest-value workflows. Planning, sessions, evidence capture, synthesis and recommendations should form the core spine.

@ServiceDesigner: Different actors need different entry points. A product owner may enter through recommendations. A researcher may enter through studies. A reviewer may enter through risks and evidence.

@AccessibilitySpecialist: Navigation must work for keyboard and screen reader users. Risks include over-nesting, unclear landmarks and repeated generic link text.

## Round 4: Research workflow and evidence lifecycle

@UserResearcher: Evidence-to-insight-to-recommendation is the core differentiator. Recommendations should not exist without visible linked evidence.

@ResearchOperations: The session lifecycle needs operational controls. Scheduled, rescheduled, cancelled, completed, transcribed, coded and synthesised are different states.

@GOVUKSpecialist: Consent and participant data need careful separation. Pseudonyms should be shown by default. Identifiable data should be revealed only when needed.

@InteractionDesigner: Note capture must be lightweight during sessions. Structure can be added later. Heavy live tagging will be avoided by researchers.

@ProductOwner: Traceability should become a product metric. Useful measures include recommendations linked to evidence and insights reviewed.

@ServiceDesigner: The platform should show evidence maturity. Raw notes, coded themes, validated insights and accepted recommendations are different things.

@AccessibilitySpecialist: Research artefacts must support accessible outputs. Reports, exports, guides and consent forms should be accessible by default.

## Round 5: AI, agent traceability and drift

@UserResearcher: Agent traceability is valuable because it makes AI behaviour reviewable. Traces should show what was loaded, selected, skipped and evidenced.

@ResearchOperations: Trace architecture should be treated as governance evidence. Each AI-assisted change should have a trace status such as complete, partial, failed or missing.

@GOVUKSpecialist: The service must not imply that AI reasoning is fully observable. It can show operational and behavioural evidence. Mechanistic claims need stronger caveats.

@InteractionDesigner: Trace interfaces need progressive disclosure. Most users need a summary first. Specialists need expandable detail.

@ProductOwner: Traceability should support decision confidence. Teams need to know whether an AI-assisted recommendation followed the right controls.

@ServiceDesigner: Traceability should connect to service assurance. If a recommendation affects vulnerable users, the trace should show safeguards and human review.

@AccessibilitySpecialist: Trace views must be accessible. Timelines, badges, panels and code blocks need headings, landmarks and keyboard support.

## Round 6: GOV.UK quality and interaction patterns

@UserResearcher: The product should be tested with new researchers, experienced researchers and non-research stakeholders. Teams must understand the evidence, not just operate the tool.

@ResearchOperations: GOV.UK-style consistency would help adoption. Standard patterns for statuses, task lists, tables, filters and confirmations would reduce training overhead.

@GOVUKSpecialist: Use GOV.UK components unless there is a clear reason not to. Complex dashboards should not replace simple task flows and clear content design.

@InteractionDesigner: Study setup could use a task-list pattern. Example steps: define questions, complete ethics check, prepare guide, add participants, confirm consent, schedule sessions.

@ProductOwner: The product needs a clearer MVP spine. The highest-value flow is likely create study, run sessions, capture evidence, generate insights and link recommendations.

@ServiceDesigner: Service boundaries should be explicit. Users should know what happens in ResearchOps, Airtable, Mural and GitHub.

@AccessibilitySpecialist: GOV.UK quality includes content accessibility. Use short sentences, descriptive headings, clear error messages and visible focus states.

## Round 7: Risk, ethics and inclusion

@UserResearcher: Ethical research should be embedded in the workflow. Risk, safeguarding, consent and participant vulnerability should be visible where decisions are made.

@ResearchOperations: Recruitment and incentive tracking are high-risk operational areas. Missed payments and unclear consent records damage trust.

@GOVUKSpecialist: Government services need accountability. The platform should show who made a decision, when, with what evidence and with what assumptions.

@InteractionDesigner: Ethical checks should be proportionate. The system should prompt, guide and escalate without blocking low-risk work unnecessarily.

@ProductOwner: PII exposure, consent failure, inaccessible materials and unsupported safeguarding scenarios are product risks. They are not edge cases.

@ServiceDesigner: The platform should include escalation pathways. When research uncovers harm or service failure, the next step should be obvious.

@AccessibilitySpecialist: Inclusion covers participants and platform users. Researchers using assistive technology must be able to plan, conduct and analyse research without workarounds.

## Round 8: Final judgement and highest-value improvements

@UserResearcher: The platform has a strong evidence integrity proposition. It needs to make the research lifecycle easier to understand and harder to misuse.

@ResearchOperations: The biggest operational gap is workflow state management. The platform should clearly show what is scheduled, missing, approved, blocked and complete.

@GOVUKSpecialist: The biggest GOV.UK gap is service clarity. Users need clear guidance about what they can do, what they need and what happens next.

@InteractionDesigner: The biggest interaction gap is orientation. Every page should answer: where am I, what am I editing, what state is it in and what should I do next?

@ProductOwner: The product needs a sharp north-star metric. Evidence traceability is a strong candidate.

@ServiceDesigner: The service needs actor-based journeys. Researchers, product owners, governance reviewers and delivery teams need different views of the same evidence system.

@AccessibilitySpecialist: The highest-priority accessibility work is making complex workflows perceivable, operable and understandable.

## Collated issues, gaps and enhancements

### P1

| Rank | Priority | Area | Issue |
|---:|---|---|---|
| 1 | P1 | Evidence integrity | Weak visible evidence linkage. |
| 2 | P1 | Workflow state | Lifecycle controls need clarity. |
| 3 | P1 | Consent and PII | Safer defaults are needed. |
| 4 | P1 | Accessibility | Complex workflows may exclude users. |
| 5 | P1 | Governance | Decision ownership needs auditability. |
| 6 | P1 | AI traceability | Mechanistic claims need caveats. |
| 7 | P1 | Safeguarding | Escalation paths need embedding. |
| 8 | P1 | Service clarity | Start guidance is too implicit. |

P1 enhancement themes:

1. Add mandatory evidence linkage for insights and recommendations.
2. Introduce lifecycle states for core research objects.
3. Make pseudonymised participant views the default.
4. Add accessibility acceptance criteria for core workflows.
5. Add role-based governance and decision ownership.
6. Label trace evidence by layer.
7. Add safeguarding prompts and escalation routes.
8. Add a task-based start page and study setup task list.

### P2

| Rank | Priority | Area | Issue |
|---:|---|---|---|
| 9 | P2 | Navigation | Hierarchy may be unclear. |
| 10 | P2 | ResearchOps | Operational dashboards are needed. |
| 11 | P2 | Content design | Labels may be too internal. |
| 12 | P2 | Interaction design | Live note capture may be heavy. |
| 13 | P2 | Trace UX | Detail needs progressive disclosure. |
| 14 | P2 | GOV.UK patterns | Patterns need standardising. |
| 15 | P2 | Boundaries | Integrations need explanation. |
| 16 | P2 | Evidence maturity | Maturity levels need visibility. |

P2 enhancement themes:

9. Add object headers with parent, state and next action.
10. Add recruitment, session and incentive dashboards.
11. Rename actions around user tasks.
12. Support lightweight capture before structured tagging.
13. Design trace summaries with expandable evidence.
14. Use GOV.UK task list and summary list patterns.
15. Explain integration boundaries.
16. Add evidence maturity labels.

### P3

| Rank | Priority | Area | Issue |
|---:|---|---|---|
| 17 | P3 | Metrics | Success metrics need definition. |
| 18 | P3 | Reporting | Exports need accessible templates. |
| 19 | P3 | Multi-actor views | Different roles need views. |
| 20 | P3 | Training | New researchers need onboarding. |
| 21 | P3 | Search | Evidence filtering needs refinement. |
| 22 | P3 | Audit trail | Logs need readable summaries. |
| 23 | P3 | Standards | Compliance checks need visibility. |
| 24 | P3 | Feedback loops | Teams need ways to feed back. |

P3 enhancement themes:

17. Define metrics for traceability and research quality.
18. Create accessible export templates.
19. Add role-sensitive views.
20. Add onboarding prompts and example studies.
21. Improve evidence search and filtering.
22. Summarise audit logs into readable histories.
23. Add GOV.UK and WCAG checks to release readiness.
24. Capture feedback after studies and synthesis.

## Overall judgement

The ResearchOps platform has a strong strategic core: evidence traceability, research governance and operational consistency. Its biggest risk is complexity.

Without clearer lifecycle states, task-based navigation and embedded safeguards, users may work around the system. The highest-value design direction is to make the platform feel less like a collection of modules and more like a guided research service.

## Explicit non-action note

This document records a critique only. It does not create implementation authority, backlog items, acceptance criteria, delivery commitments or product changes.
