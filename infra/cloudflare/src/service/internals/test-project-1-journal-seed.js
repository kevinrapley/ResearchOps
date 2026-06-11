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
		content: "The project team is learning that evidence management is part of the service problem. People need to know what was learned, why it matters and how confident the team is before they can act on the research.",
		tags: ["evidence-management", "confidence", "service-design"],
		createdAt: "2026-06-03T09:15:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID
	},
	{
		id: "d1tp1_journal_002",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "procedures",
		content: "A weekly triage routine now checks incoming research requests for decision dependency, available evidence, recruitment route and project timing before the team commits to new work.",
		tags: ["triage", "research-ops", "planning"],
		createdAt: "2026-06-03T14:40:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID
	},
	{
		id: "d1tp1_journal_003",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "decisions",
		content: "The team decided to keep operations tracking separate from qualitative synthesis. Operational status and analysis should be linked, but they should not be collapsed into one view.",
		tags: ["decision", "operations", "synthesis"],
		createdAt: "2026-06-04T10:05:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID
	},
	{
		id: "d1tp1_journal_004",
		project: TEST_PROJECT_1_CANONICAL_ID,
		category: "introspections",
		content: "The strongest value of the platform may be that it slows down the right decisions while making routine research administration easier to manage.",
		tags: ["reflection", "governance", "decision-quality"],
		createdAt: "2026-06-04T16:20:00.000Z",
		localProjectId: TEST_PROJECT_1_LOCAL_ID
	}
];

/**
 * @param {string | null | undefined} id
 */
export function testProject1JournalEntryById(id) {
	const recordId = String(id || "").trim();
	return TEST_PROJECT_1_JOURNAL_ENTRIES.find(entry => entry.id === recordId) || null;
}

/**
 * @param {string | null | undefined} projectId
 */
export function isTestProject1Id(projectId) {
	const id = String(projectId || "").trim();
	return id === TEST_PROJECT_1_CANONICAL_ID || id === TEST_PROJECT_1_LEGACY_ID || id === TEST_PROJECT_1_LOCAL_ID;
}
