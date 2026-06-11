/**
 * @file src/service/internals/test-project-1-journal-seed.js
 * @module service/internals/test-project-1-journal-seed
 * @summary Canonical Test Project 1 journal entries used as a preview fallback.
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
];

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
