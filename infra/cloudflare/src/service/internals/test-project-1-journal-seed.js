/**
 * @file src/service/internals/test-project-1-journal-seed.js
 * @module service/internals/test-project-1-journal-seed
 * @summary Canonical Test Project 1 journal analysis dataset used for D1 seeding and preview fallbacks.
 */

export const TEST_PROJECT_1_CANONICAL_ID = "recgdpwEI5hF07bUZ";
export const TEST_PROJECT_1_LEGACY_ID = "recgdpwEI5hFO7bUZ";
export const TEST_PROJECT_1_LOCAL_ID = "d04ab32e-6756-408e-a649-6859dd0079f2";

export const TEST_PROJECT_1_JOURNAL_ENTRIES = [
	{
		id: "d1tp1_journal_001",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "perceptions",
		content:
			"The team is beginning to see research evidence as an operating model rather than a set of documents. People trust findings more when they can see where an observation came from, what is still uncertain and which decision it was meant to support.",
		tags: ["evidence-readiness", "confidence", "decision-support"],
		createdAt: "2026-06-03T09:15:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_002",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "procedures",
		content:
			"The weekly intake meeting now checks every new research request for the decision it supports, the evidence already available, the recruitment route and any delivery deadline before work is accepted.",
		tags: ["triage", "request-intake", "planning"],
		createdAt: "2026-06-03T14:40:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_003",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "decisions",
		content:
			"We decided to keep operations tracking separate from qualitative synthesis. Recruitment status and scheduling need to stay visible, but coding and memo writing should remain in the analysis space with links back to decisions.",
		tags: ["decision-trace", "operations", "synthesis"],
		createdAt: "2026-06-04T10:05:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_004",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "introspections",
		content:
			"The strongest value of the platform may be that it slows down the right decisions while making routine research administration easier to manage. That slower pace is uncomfortable, but it is also where the quality improves.",
		tags: ["reflection", "governance", "decision-quality"],
		createdAt: "2026-06-04T16:20:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_005",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "procedures",
		content:
			"Recruitment planning exposed a gap between the participant access needs recorded by delivery teams and the practical adjustments researchers need before a session. We added a check for access needs before diary invitations are sent.",
		tags: ["recruitment", "access-needs", "participant-support"],
		createdAt: "2026-06-05T09:30:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_006",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "perceptions",
		content:
			"Several researchers described losing the thread when they moved between the project dashboard, notes, spreadsheets and mural boards. The issue is not only tool count; it is the mental effort of rebuilding context every time.",
		tags: ["context-rebuilding", "tool-switching", "researcher-workload"],
		createdAt: "2026-06-05T13:10:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_007",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "introspections",
		content:
			"I noticed that I was treating missing provenance as a delivery inconvenience rather than an analytical risk. If we cannot tell who contributed an insight or when it was last reviewed, we should lower our confidence in decisions that depend on it.",
		tags: ["provenance", "positionality", "confidence"],
		createdAt: "2026-06-06T11:45:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_008",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "decisions",
		content:
			"The team agreed that high-risk service decisions need an evidence handover note before they move to implementation. The note should capture the decision, supporting findings, known gaps and the researcher confidence level.",
		tags: ["handover", "decision-rationale", "confidence-threshold"],
		createdAt: "2026-06-06T15:25:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_009",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "procedures",
		content:
			"We added a short pause before contacting participants whose circumstances may make participation burdensome. The pause gives the researcher time to review consent wording, support options and whether the invitation should be delayed.",
		tags: ["consent", "ethical-pacing", "participant-burden"],
		createdAt: "2026-06-07T10:10:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_010",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "perceptions",
		content:
			"The dashboard is useful when it shows what changed since the last visit. Researchers do not need another place to duplicate updates; they need a way to re-enter the project without reading every artefact again.",
		tags: ["duplicate-updates", "context-rebuilding", "dashboard"],
		createdAt: "2026-06-07T14:55:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_011",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "introspections",
		content:
			"The emotional labour of holding uncertainty for a project team is becoming more visible. Researchers are being asked for certainty before the evidence is ready, and the platform needs to legitimise saying that confidence is not yet high enough.",
		tags: ["emotional-labour", "uncertainty", "confidence-threshold"],
		createdAt: "2026-06-08T09:50:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_012",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "decisions",
		content:
			"We agreed to show code co-occurrence as a prompt for interpretation, not as proof of a relationship. The graph should help researchers notice patterns, then return to journal entries and memos to check the meaning.",
		tags: ["co-occurrence", "analysis-practice", "interpretation"],
		createdAt: "2026-06-08T16:35:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_013",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "perceptions",
		content:
			"Researchers are asking for a clearer distinction between an observation, an interpretation and a theme. The current language is familiar to analysts, but less clear to delivery colleagues who read the codebook later.",
		tags: ["code-hierarchy", "shared-language", "interpretation"],
		createdAt: "2026-06-09T09:20:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_014",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "procedures",
		content:
			"The research team added a short evidence review before every show-and-tell. The review checks whether quoted findings still have a source, whether the finding has been challenged and whether a memo records the interpretation.",
		tags: ["evidence-review", "show-and-tell", "memo-practice"],
		createdAt: "2026-06-09T13:05:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_015",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "introspections",
		content:
			"I found myself defending a pattern because it supported a design idea I already preferred. The negative case in yesterday's interview helped me separate the participant's account from my own product instinct.",
		tags: ["negative-case", "positionality", "analysis-confidence"],
		createdAt: "2026-06-10T10:15:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_016",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "decisions",
		content:
			"We agreed that code co-occurrence should be shown as a ranked table first. A visual graph can follow, but the first need is to see which code pairs are repeated often enough to warrant closer reading.",
		tags: ["co-occurrence", "ranked-table", "analysis-tooling"],
		createdAt: "2026-06-10T15:45:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_017",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "procedures",
		content:
			"Consent wording is being checked earlier in recruitment planning. The change has reduced late rework because accessibility needs, support options and participant burden are visible before invitations are drafted.",
		tags: ["consent", "accessibility", "recruitment"],
		createdAt: "2026-06-11T09:10:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_018",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "perceptions",
		content:
			"Delivery leads value the journal when it explains why research has slowed a decision. The entry needs to say what risk is being reduced, not only that more evidence is needed.",
		tags: ["decision-delay", "risk-threshold", "delivery"],
		createdAt: "2026-06-11T14:30:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_019",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "introspections",
		content:
			"The codebook is starting to reveal where I have over-coded process details and under-coded emotional labour. I need to revisit entries where uncertainty was held by researchers but described only as governance delay.",
		tags: ["codebook-review", "emotional-labour", "governance"],
		createdAt: "2026-06-12T09:40:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_020",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "decisions",
		content:
			"We will keep first-order codes close to the language of the entry, second-order codes for interpretation and thematic codes for aggregate themes. The UI should show this hierarchy without requiring users to infer it from indentation.",
		tags: ["code-hierarchy", "ui-clarity", "analysis-practice"],
		createdAt: "2026-06-12T12:25:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_021",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "procedures",
		content:
			"Participant support options now get recorded alongside recruitment constraints. This makes it easier to decide whether a study can proceed responsibly or whether the team needs to pause.",
		tags: ["participant-support", "recruitment", "ethical-pacing"],
		createdAt: "2026-06-12T16:05:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_022",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "perceptions",
		content:
			"Teams are more willing to trust a finding when the journal links it to a memo, a decision and a dated review. The last reviewed date is becoming a proxy for whether evidence is still usable.",
		tags: ["last-reviewed", "traceability", "trust"],
		createdAt: "2026-06-13T10:55:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_023",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "introspections",
		content:
			"I am using follow-up questions as a way to hold uncertainty rather than forcing a premature theme. The codebook should make unfinished interpretation visible without making it look like failure.",
		tags: ["follow-up-question", "uncertainty", "theme-development"],
		createdAt: "2026-06-13T15:10:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_024",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "decisions",
		content:
			"The team decided to review co-occurring codes weekly. Repeated pairs will prompt a memo only when the underlying excerpts show a meaningful relationship rather than repeated administrative wording.",
		tags: ["co-occurrence", "memo-trigger", "weekly-review"],
		createdAt: "2026-06-14T11:35:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_025",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "procedures",
		content:
			"Approval delays are now recorded with the reason for the delay and the evidence needed to move forward. This has helped separate governance tempo from avoidable handover gaps.",
		tags: ["approval-delay", "governance-tempo", "handover"],
		createdAt: "2026-06-14T16:50:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_026",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "perceptions",
		content:
			"Researchers said they want the analysis area to feel like a working space rather than a reporting tool. They need to see patterns, unfinished questions and supporting excerpts in the same flow.",
		tags: ["analysis-space", "working-practice", "supporting-excerpts"],
		createdAt: "2026-06-15T09:30:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_027",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "introspections",
		content:
			"The strongest memos are the ones that name uncertainty clearly. They do not pretend that a pattern is settled; they explain what would make the interpretation stronger.",
		tags: ["memo-quality", "uncertainty", "analysis-confidence"],
		createdAt: "2026-06-15T14:05:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_028",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "decisions",
		content:
			"We agreed that every aggregate theme should have at least two second-order codes beneath it before it is used in reporting. This should reduce shallow themes that only rename a single observation.",
		tags: ["theme-quality", "second-order-codes", "reporting"],
		createdAt: "2026-06-16T10:20:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_029",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "procedures",
		content:
			"Session adjustments are easier to plan when access needs are visible before recruitment begins. The operational check is now linked to the ethical pacing memo rather than sitting in a separate delivery note.",
		tags: ["session-adjustments", "access-needs", "ethical-pacing"],
		createdAt: "2026-06-16T15:45:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_030",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "perceptions",
		content:
			"People are starting to use the journal to explain trade-offs. The most useful entries state what was gained, what was delayed and what evidence would change the decision.",
		tags: ["trade-offs", "decision-rationale", "evidence-change"],
		createdAt: "2026-06-17T09:15:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_031",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "introspections",
		content:
			"The difference between a repeated pattern and a compelling theme is becoming clearer. A theme needs interpretive work, not just a count of similar excerpts.",
		tags: ["theme-development", "interpretation", "pattern-count"],
		createdAt: "2026-06-17T13:30:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_032",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "decisions",
		content:
			"We will use the co-occurrence table to pick review candidates, not to automate conclusions. The table should help researchers choose where to read, compare and write memos.",
		tags: ["co-occurrence", "review-candidates", "memo-writing"],
		createdAt: "2026-06-18T10:00:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_033",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "procedures",
		content:
			"Shared interpretation sessions now start with two excerpts that appear to contradict the emerging theme. This has made the discussion slower but more grounded.",
		tags: ["shared-interpretation", "negative-case", "theme-review"],
		createdAt: "2026-06-18T15:35:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_034",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "perceptions",
		content:
			"The platform is most helpful when it shows provenance without making researchers behave like data clerks. The provenance fields need to support judgement rather than become another compliance burden.",
		tags: ["provenance", "researcher-workload", "governance"],
		createdAt: "2026-06-19T09:25:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_035",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "introspections",
		content:
			"I need to separate my concern about delivery pressure from the evidence itself. The journal helps because it gives me somewhere to name the pressure before writing the analytical memo.",
		tags: ["delivery-pressure", "positionality", "memo-practice"],
		createdAt: "2026-06-19T14:10:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
	{
		id: "d1tp1_journal_036",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "decisions",
		content:
			"The next review will compare evidence readiness with inclusive engagement. We need to see whether accessibility constraints are being treated as operational blockers or as evidence about how the service works for people.",
		tags: ["inclusive-engagement", "evidence-readiness", "accessibility"],
		createdAt: "2026-06-20T11:00:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	},
];

export const TEST_PROJECT_1_CODES = [
	{ id: "d1tp1_code_theme_evidence_readiness", name: "Evidence readiness", description: "Aggregate theme for whether evidence is traceable, current and strong enough to support decisions.", parentId: "", colour: "#1d70b8ff", createdAt: "2026-06-03T10:00:00.000Z" },
	{ id: "d1tp1_code_decision_confidence", name: "Decision confidence", description: "Interpretive code for how teams judge whether findings are strong enough to act on.", parentId: "d1tp1_code_theme_evidence_readiness", colour: "#1d70b8ff", createdAt: "2026-06-03T10:05:00.000Z" },
	{ id: "d1tp1_code_provenance_gaps", name: "Provenance gaps", description: "Descriptive code for missing or unclear origin of evidence, notes or research artefacts.", parentId: "d1tp1_code_decision_confidence", colour: "#1d70b8ff", createdAt: "2026-06-03T10:10:00.000Z" },
	{ id: "d1tp1_code_confidence_threshold", name: "Confidence threshold", description: "Descriptive code for explicit limits on how much confidence a team should place in current evidence.", parentId: "d1tp1_code_decision_confidence", colour: "#1d70b8ff", createdAt: "2026-06-03T10:15:00.000Z" },
	{ id: "d1tp1_code_traceable_decisions", name: "Traceable decisions", description: "Interpretive code for linking choices to evidence, uncertainty and rationale.", parentId: "d1tp1_code_theme_evidence_readiness", colour: "#2b8cc4ff", createdAt: "2026-06-03T10:20:00.000Z" },
	{ id: "d1tp1_code_decision_rationale", name: "Decision rationale", description: "Descriptive code for the stated reason behind a product or research decision.", parentId: "d1tp1_code_traceable_decisions", colour: "#2b8cc4ff", createdAt: "2026-06-03T10:25:00.000Z" },
	{ id: "d1tp1_code_evidence_handover", name: "Evidence handover", description: "Descriptive code for packaging findings, gaps and confidence for a decision owner.", parentId: "d1tp1_code_traceable_decisions", colour: "#2b8cc4ff", createdAt: "2026-06-03T10:30:00.000Z" },
	{ id: "d1tp1_code_theme_operational_rhythm", name: "Operational rhythm", description: "Aggregate theme for the routines and coordination that make research work manageable.", parentId: "", colour: "#00703cff", createdAt: "2026-06-03T10:35:00.000Z" },
	{ id: "d1tp1_code_triage_discipline", name: "Triage discipline", description: "Interpretive code for the rules and judgement used to accept, sequence or defer work.", parentId: "d1tp1_code_theme_operational_rhythm", colour: "#00703cff", createdAt: "2026-06-03T10:40:00.000Z" },
	{ id: "d1tp1_code_request_intake", name: "Request intake", description: "Descriptive code for how incoming research requests are captured and assessed.", parentId: "d1tp1_code_triage_discipline", colour: "#00703cff", createdAt: "2026-06-03T10:45:00.000Z" },
	{ id: "d1tp1_code_recruitment_constraints", name: "Recruitment constraints", description: "Descriptive code for limits that shape who can be involved and when sessions can happen.", parentId: "d1tp1_code_triage_discipline", colour: "#00703cff", createdAt: "2026-06-03T10:50:00.000Z" },
	{ id: "d1tp1_code_tool_switching_burden", name: "Tool-switching burden", description: "Interpretive code for friction caused by moving between tools and rebuilding context.", parentId: "d1tp1_code_theme_operational_rhythm", colour: "#28a197ff", createdAt: "2026-06-03T10:55:00.000Z" },
	{ id: "d1tp1_code_duplicate_updates", name: "Duplicate updates", description: "Descriptive code for repeated status updates across multiple locations.", parentId: "d1tp1_code_tool_switching_burden", colour: "#28a197ff", createdAt: "2026-06-03T11:00:00.000Z" },
	{ id: "d1tp1_code_context_rebuilding", name: "Context rebuilding", description: "Descriptive code for the effort needed to recover project state after switching tools or time away.", parentId: "d1tp1_code_tool_switching_burden", colour: "#28a197ff", createdAt: "2026-06-03T11:05:00.000Z" },
	{ id: "d1tp1_code_theme_reflexive_practice", name: "Reflexive practice", description: "Aggregate theme for researcher judgement, positionality and ethical pacing.", parentId: "", colour: "#4c2c92ff", createdAt: "2026-06-03T11:10:00.000Z" },
	{ id: "d1tp1_code_researcher_positionality", name: "Researcher positionality", description: "Interpretive code for how researcher assumptions and responsibilities shape analysis.", parentId: "d1tp1_code_theme_reflexive_practice", colour: "#4c2c92ff", createdAt: "2026-06-03T11:15:00.000Z" },
	{ id: "d1tp1_code_assumption_surfaced", name: "Assumption surfaced", description: "Descriptive code for moments where a researcher recognises and records an assumption.", parentId: "d1tp1_code_researcher_positionality", colour: "#4c2c92ff", createdAt: "2026-06-03T11:20:00.000Z" },
	{ id: "d1tp1_code_emotional_labour", name: "Emotional labour", description: "Descriptive code for the personal effort of holding uncertainty, risk or tension in the work.", parentId: "d1tp1_code_researcher_positionality", colour: "#4c2c92ff", createdAt: "2026-06-03T11:25:00.000Z" },
	{ id: "d1tp1_code_ethical_pacing", name: "Ethical pacing", description: "Interpretive code for deliberately slowing activity to protect participants or improve judgement.", parentId: "d1tp1_code_theme_reflexive_practice", colour: "#6f72afff", createdAt: "2026-06-03T11:30:00.000Z" },
	{ id: "d1tp1_code_pause_for_consent", name: "Pause for consent", description: "Descriptive code for stopping to review consent, burden or support before contacting participants.", parentId: "d1tp1_code_ethical_pacing", colour: "#6f72afff", createdAt: "2026-06-03T11:35:00.000Z" },
	{ id: "d1tp1_code_decision_slowed", name: "Decision slowed", description: "Descriptive code for deliberately delaying a decision until evidence or consent is stronger.", parentId: "d1tp1_code_ethical_pacing", colour: "#6f72afff", createdAt: "2026-06-03T11:40:00.000Z" },
	{ id: "d1tp1_code_theme_inclusive_engagement", name: "Inclusive engagement", description: "Aggregate theme for making participation practical, ethical and accessible.", parentId: "", colour: "#d4351cff", createdAt: "2026-06-03T11:45:00.000Z" },
	{ id: "d1tp1_code_participant_burden", name: "Participant burden", description: "Interpretive code for recognising when participation may be too demanding or poorly timed.", parentId: "d1tp1_code_theme_inclusive_engagement", colour: "#d4351cff", createdAt: "2026-06-03T11:50:00.000Z" },
	{ id: "d1tp1_code_consent_wording_review", name: "Consent wording review", description: "Descriptive code for checking whether consent language is clear, proportionate and usable.", parentId: "d1tp1_code_participant_burden", colour: "#d4351cff", createdAt: "2026-06-03T11:55:00.000Z" },
	{ id: "d1tp1_code_support_options", name: "Support options", description: "Descriptive code for practical support offered before, during or after research.", parentId: "d1tp1_code_participant_burden", colour: "#d4351cff", createdAt: "2026-06-03T12:00:00.000Z" },
	{ id: "d1tp1_code_access_adjustment", name: "Access adjustment", description: "Interpretive code for adapting recruitment or sessions to meet access needs.", parentId: "d1tp1_code_theme_inclusive_engagement", colour: "#f47738ff", createdAt: "2026-06-03T12:05:00.000Z" },
	{ id: "d1tp1_code_access_needs", name: "Access needs", description: "Descriptive code for recorded participant access needs.", parentId: "d1tp1_code_access_adjustment", colour: "#f47738ff", createdAt: "2026-06-03T12:10:00.000Z" },
	{ id: "d1tp1_code_session_adjustments", name: "Session adjustments", description: "Descriptive code for changes made to session format, timing or support.", parentId: "d1tp1_code_access_adjustment", colour: "#f47738ff", createdAt: "2026-06-03T12:15:00.000Z" },
	{ id: "d1tp1_code_insight_ownership", name: "Insight ownership", description: "Interpretive code for who can explain, maintain or challenge an insight.", parentId: "d1tp1_code_theme_evidence_readiness", colour: "#003078ff", createdAt: "2026-06-03T12:20:00.000Z" },
	{ id: "d1tp1_code_unclear_owner", name: "Unclear owner", description: "Descriptive code for findings without an accountable owner or reviewer.", parentId: "d1tp1_code_insight_ownership", colour: "#003078ff", createdAt: "2026-06-03T12:25:00.000Z" },
	{ id: "d1tp1_code_last_reviewed_date", name: "Last reviewed date", description: "Descriptive code for whether evidence has a visible review date.", parentId: "d1tp1_code_insight_ownership", colour: "#003078ff", createdAt: "2026-06-03T12:30:00.000Z" },
	{ id: "d1tp1_code_governance_tempo", name: "Governance tempo", description: "Interpretive code for the pace created by governance, assurance and approval routines.", parentId: "d1tp1_code_theme_operational_rhythm", colour: "#b58840ff", createdAt: "2026-06-03T12:35:00.000Z" },
	{ id: "d1tp1_code_risk_threshold", name: "Risk threshold", description: "Descriptive code for the level of risk that changes whether work can proceed.", parentId: "d1tp1_code_governance_tempo", colour: "#b58840ff", createdAt: "2026-06-03T12:40:00.000Z" },
	{ id: "d1tp1_code_approval_delay", name: "Approval delay", description: "Descriptive code for delay caused by approval, assurance or sign-off needs.", parentId: "d1tp1_code_governance_tempo", colour: "#b58840ff", createdAt: "2026-06-03T12:45:00.000Z" },
	{ id: "d1tp1_code_analysis_confidence", name: "Analysis confidence", description: "Interpretive code for how strongly an interpretation is supported by excerpts and memos.", parentId: "d1tp1_code_theme_reflexive_practice", colour: "#912b88ff", createdAt: "2026-06-03T12:50:00.000Z" },
	{ id: "d1tp1_code_pattern_noticed", name: "Pattern noticed", description: "Descriptive code for a repeated feature noticed across entries.", parentId: "d1tp1_code_analysis_confidence", colour: "#912b88ff", createdAt: "2026-06-03T12:55:00.000Z" },
	{ id: "d1tp1_code_negative_case", name: "Negative case", description: "Descriptive code for an excerpt that challenges an emerging interpretation.", parentId: "d1tp1_code_analysis_confidence", colour: "#912b88ff", createdAt: "2026-06-03T13:00:00.000Z" },
	{ id: "d1tp1_code_collaboration_pattern", name: "Collaboration pattern", description: "Interpretive code for how shared sense-making changes analysis quality.", parentId: "d1tp1_code_theme_reflexive_practice", colour: "#85994bff", createdAt: "2026-06-03T13:05:00.000Z" },
	{ id: "d1tp1_code_shared_interpretation", name: "Shared interpretation", description: "Descriptive code for sessions where meaning is made across roles.", parentId: "d1tp1_code_collaboration_pattern", colour: "#85994bff", createdAt: "2026-06-03T13:10:00.000Z" },
	{ id: "d1tp1_code_follow_up_question", name: "Follow-up question", description: "Descriptive code for questions that hold uncertainty open for later analysis.", parentId: "d1tp1_code_collaboration_pattern", colour: "#85994bff", createdAt: "2026-06-03T13:15:00.000Z" },
];

export const TEST_PROJECT_1_MEMOS = [
	{ id: "d1tp1_memo_001", memoType: "analytical", title: "Evidence readiness is the organising problem", content: "The journal entries show that evidence quality is not only about producing findings. Confidence depends on provenance, explicit uncertainty and a handover that connects findings to the decision being made.", createdAt: "2026-06-04T12:30:00.000Z" },
	{ id: "d1tp1_memo_002", memoType: "methodological", title: "Separate operations tracking from synthesis", content: "Recruitment status, scheduling and request intake belong in operational tracking. Codes, memos and journal entries belong in analysis. The product should make the relationship visible without merging the activities.", createdAt: "2026-06-05T10:45:00.000Z" },
	{ id: "d1tp1_memo_003", memoType: "analytical", title: "Context rebuilding is a hidden cost", content: "Tool switching appears repeatedly with duplicate updates and loss of project state. The strongest design response may be surfacing what changed since the researcher last worked on the project.", createdAt: "2026-06-06T13:20:00.000Z" },
	{ id: "d1tp1_memo_004", memoType: "reflexive", title: "Researcher confidence needs permission to be low", content: "The entries about uncertainty and emotional labour suggest that researchers need a legitimate way to say evidence is not ready. The platform should support careful delay, not only faster throughput.", createdAt: "2026-06-07T11:40:00.000Z" },
	{ id: "d1tp1_memo_005", memoType: "analytical", title: "Co-occurrence should prompt interpretation", content: "The co-occurrence graph is useful when it reveals repeated pairings such as confidence threshold with decision slowed, or context rebuilding with duplicate updates. It should send researchers back to the underlying entries rather than imply causal proof.", createdAt: "2026-06-08T17:05:00.000Z" },
	{ id: "d1tp1_memo_006", memoType: "methodological", title: "Use the code hierarchy as an analytic scaffold", content: "First-order codes should stay close to what was recorded, second-order codes should capture the researcher's interpretation, and thematic codes should aggregate patterns that have been checked against memos.", createdAt: "2026-06-10T11:15:00.000Z" },
	{ id: "d1tp1_memo_007", memoType: "analytical", title: "Inclusive engagement changes the evidence", content: "Access needs and support options are not only operational constraints. They shape who can participate, what evidence is available and whether findings can be trusted across user groups.", createdAt: "2026-06-11T16:20:00.000Z" },
	{ id: "d1tp1_memo_008", memoType: "reflexive", title: "Negative cases are protecting the analysis", content: "The negative case examples are stopping early closure. They help distinguish repeated observations from themes that have been interpreted and challenged.", createdAt: "2026-06-13T16:40:00.000Z" },
	{ id: "d1tp1_memo_009", memoType: "analytical", title: "Governance tempo is not the same as delay", content: "Approval delay matters when it hides what evidence is needed. Governance tempo is productive when it names risk thresholds and helps teams decide what would make a decision ready.", createdAt: "2026-06-14T17:25:00.000Z" },
	{ id: "d1tp1_memo_010", memoType: "methodological", title: "Co-occurrence review cadence", content: "Weekly review of repeated code pairs should start with the highest-weight pairs, then inspect excerpts and decide whether a memo is warranted. Counts alone should not be treated as evidence.", createdAt: "2026-06-16T11:30:00.000Z" },
	{ id: "d1tp1_memo_011", memoType: "reflexive", title: "Delivery pressure needs a place in the journal", content: "Naming delivery pressure before writing an analytical memo helps separate project urgency from evidence strength. This protects analysis confidence.", createdAt: "2026-06-19T15:30:00.000Z" },
	{ id: "d1tp1_memo_012", memoType: "analytical", title: "Evidence readiness and inclusive engagement overlap", content: "The strongest current co-occurrence to review is between evidence readiness and inclusive engagement. Accessibility constraints are being treated both as operational blockers and as evidence about service fit.", createdAt: "2026-06-20T12:15:00.000Z" },
];

export const TEST_PROJECT_1_ENTRY_CODE_IDS = {
	d1tp1_journal_001: ["d1tp1_code_theme_evidence_readiness", "d1tp1_code_decision_confidence", "d1tp1_code_provenance_gaps", "d1tp1_code_confidence_threshold", "d1tp1_code_traceable_decisions"],
	d1tp1_journal_002: ["d1tp1_code_theme_operational_rhythm", "d1tp1_code_triage_discipline", "d1tp1_code_request_intake", "d1tp1_code_recruitment_constraints", "d1tp1_code_governance_tempo"],
	d1tp1_journal_003: ["d1tp1_code_theme_evidence_readiness", "d1tp1_code_traceable_decisions", "d1tp1_code_decision_rationale", "d1tp1_code_evidence_handover", "d1tp1_code_duplicate_updates"],
	d1tp1_journal_004: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_ethical_pacing", "d1tp1_code_decision_slowed", "d1tp1_code_decision_confidence", "d1tp1_code_risk_threshold"],
	d1tp1_journal_005: ["d1tp1_code_theme_operational_rhythm", "d1tp1_code_triage_discipline", "d1tp1_code_recruitment_constraints", "d1tp1_code_access_needs", "d1tp1_code_session_adjustments"],
	d1tp1_journal_006: ["d1tp1_code_theme_operational_rhythm", "d1tp1_code_tool_switching_burden", "d1tp1_code_context_rebuilding", "d1tp1_code_duplicate_updates", "d1tp1_code_collaboration_pattern"],
	d1tp1_journal_007: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_researcher_positionality", "d1tp1_code_assumption_surfaced", "d1tp1_code_provenance_gaps", "d1tp1_code_confidence_threshold"],
	d1tp1_journal_008: ["d1tp1_code_theme_evidence_readiness", "d1tp1_code_traceable_decisions", "d1tp1_code_evidence_handover", "d1tp1_code_confidence_threshold", "d1tp1_code_risk_threshold"],
	d1tp1_journal_009: ["d1tp1_code_theme_inclusive_engagement", "d1tp1_code_participant_burden", "d1tp1_code_consent_wording_review", "d1tp1_code_pause_for_consent", "d1tp1_code_recruitment_constraints"],
	d1tp1_journal_010: ["d1tp1_code_theme_operational_rhythm", "d1tp1_code_tool_switching_burden", "d1tp1_code_duplicate_updates", "d1tp1_code_context_rebuilding", "d1tp1_code_last_reviewed_date"],
	d1tp1_journal_011: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_researcher_positionality", "d1tp1_code_emotional_labour", "d1tp1_code_confidence_threshold", "d1tp1_code_analysis_confidence"],
	d1tp1_journal_012: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_researcher_positionality", "d1tp1_code_assumption_surfaced", "d1tp1_code_decision_slowed", "d1tp1_code_pattern_noticed"],
	d1tp1_journal_013: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_analysis_confidence", "d1tp1_code_pattern_noticed", "d1tp1_code_shared_interpretation", "d1tp1_code_follow_up_question"],
	d1tp1_journal_014: ["d1tp1_code_theme_evidence_readiness", "d1tp1_code_insight_ownership", "d1tp1_code_last_reviewed_date", "d1tp1_code_traceable_decisions", "d1tp1_code_evidence_handover"],
	d1tp1_journal_015: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_researcher_positionality", "d1tp1_code_negative_case", "d1tp1_code_analysis_confidence", "d1tp1_code_assumption_surfaced"],
	d1tp1_journal_016: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_analysis_confidence", "d1tp1_code_pattern_noticed", "d1tp1_code_shared_interpretation", "d1tp1_code_decision_rationale"],
	d1tp1_journal_017: ["d1tp1_code_theme_inclusive_engagement", "d1tp1_code_participant_burden", "d1tp1_code_consent_wording_review", "d1tp1_code_access_adjustment", "d1tp1_code_support_options"],
	d1tp1_journal_018: ["d1tp1_code_theme_operational_rhythm", "d1tp1_code_governance_tempo", "d1tp1_code_risk_threshold", "d1tp1_code_decision_slowed", "d1tp1_code_decision_confidence"],
	d1tp1_journal_019: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_emotional_labour", "d1tp1_code_governance_tempo", "d1tp1_code_analysis_confidence", "d1tp1_code_negative_case"],
	d1tp1_journal_020: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_analysis_confidence", "d1tp1_code_pattern_noticed", "d1tp1_code_shared_interpretation", "d1tp1_code_follow_up_question"],
	d1tp1_journal_021: ["d1tp1_code_theme_inclusive_engagement", "d1tp1_code_participant_burden", "d1tp1_code_support_options", "d1tp1_code_ethical_pacing", "d1tp1_code_pause_for_consent"],
	d1tp1_journal_022: ["d1tp1_code_theme_evidence_readiness", "d1tp1_code_insight_ownership", "d1tp1_code_last_reviewed_date", "d1tp1_code_unclear_owner", "d1tp1_code_traceable_decisions"],
	d1tp1_journal_023: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_collaboration_pattern", "d1tp1_code_follow_up_question", "d1tp1_code_analysis_confidence", "d1tp1_code_negative_case"],
	d1tp1_journal_024: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_analysis_confidence", "d1tp1_code_pattern_noticed", "d1tp1_code_shared_interpretation", "d1tp1_code_evidence_handover"],
	d1tp1_journal_025: ["d1tp1_code_theme_operational_rhythm", "d1tp1_code_governance_tempo", "d1tp1_code_approval_delay", "d1tp1_code_evidence_handover", "d1tp1_code_risk_threshold"],
	d1tp1_journal_026: ["d1tp1_code_theme_operational_rhythm", "d1tp1_code_tool_switching_burden", "d1tp1_code_context_rebuilding", "d1tp1_code_shared_interpretation", "d1tp1_code_follow_up_question"],
	d1tp1_journal_027: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_analysis_confidence", "d1tp1_code_confidence_threshold", "d1tp1_code_follow_up_question", "d1tp1_code_negative_case"],
	d1tp1_journal_028: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_analysis_confidence", "d1tp1_code_pattern_noticed", "d1tp1_code_shared_interpretation", "d1tp1_code_traceable_decisions"],
	d1tp1_journal_029: ["d1tp1_code_theme_inclusive_engagement", "d1tp1_code_access_adjustment", "d1tp1_code_access_needs", "d1tp1_code_session_adjustments", "d1tp1_code_ethical_pacing"],
	d1tp1_journal_030: ["d1tp1_code_theme_evidence_readiness", "d1tp1_code_traceable_decisions", "d1tp1_code_decision_rationale", "d1tp1_code_risk_threshold", "d1tp1_code_confidence_threshold"],
	d1tp1_journal_031: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_analysis_confidence", "d1tp1_code_pattern_noticed", "d1tp1_code_negative_case", "d1tp1_code_shared_interpretation"],
	d1tp1_journal_032: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_analysis_confidence", "d1tp1_code_pattern_noticed", "d1tp1_code_evidence_handover", "d1tp1_code_traceable_decisions"],
	d1tp1_journal_033: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_collaboration_pattern", "d1tp1_code_shared_interpretation", "d1tp1_code_negative_case", "d1tp1_code_analysis_confidence"],
	d1tp1_journal_034: ["d1tp1_code_theme_evidence_readiness", "d1tp1_code_insight_ownership", "d1tp1_code_provenance_gaps", "d1tp1_code_unclear_owner", "d1tp1_code_governance_tempo"],
	d1tp1_journal_035: ["d1tp1_code_theme_reflexive_practice", "d1tp1_code_researcher_positionality", "d1tp1_code_emotional_labour", "d1tp1_code_assumption_surfaced", "d1tp1_code_analysis_confidence"],
	d1tp1_journal_036: ["d1tp1_code_theme_evidence_readiness", "d1tp1_code_theme_inclusive_engagement", "d1tp1_code_access_adjustment", "d1tp1_code_access_needs", "d1tp1_code_decision_confidence"],
};

export const TEST_PROJECT_1_CODE_APPLICATIONS = Object.entries(TEST_PROJECT_1_ENTRY_CODE_IDS).flatMap(([entryId, codeIds], entryIndex) =>
	codeIds.map((codeId, codeIndex) => ({
		id: `d1tp1_app_${String((entryIndex * 5) + codeIndex + 1).padStart(3, "0")}`,
		project: TEST_PROJECT_1_CANONICAL_ID,
		entry: entryId,
		code: codeId,
		excerpt: TEST_PROJECT_1_JOURNAL_ENTRIES.find((entry) => entry.id === entryId)?.content.slice(0, 180) || "",
		createdAt: new Date(Date.parse("2026-06-03T09:20:00.000Z") + (((entryIndex * 5) + codeIndex) * 60000)).toISOString(),
		localProjectId: TEST_PROJECT_1_LOCAL_ID,
	}))
);

export function testProject1CodeById(id) {
	const recordId = String(id || "").trim();
	return TEST_PROJECT_1_CODES.find((code) => code.id === recordId) || null;
}

/**
 * @param {string | null | undefined} id
 */
export function testProject1JournalEntryById(id) {
	const recordId = String(id || "").trim();
	return TEST_PROJECT_1_JOURNAL_ENTRIES.find((entry) => entry.id === recordId) || null;
}

/**
 * @param {string | null | undefined} projectId
 */
export function isTestProject1Id(projectId) {
	const id = String(projectId || "").trim();
	return id === TEST_PROJECT_1_CANONICAL_ID || id === TEST_PROJECT_1_LEGACY_ID || id === TEST_PROJECT_1_LOCAL_ID;
}
