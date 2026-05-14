import assert from "node:assert/strict";
import fs from "node:fs";
import worker from "../infra/cloudflare/src/worker.js";

const TEST_TEAM_ID = "team_researchops_core";
const TEST_TEAM_NAME = "ResearchOps Core";
const TEST_USER_ID = "usr_project_contract";
const TEST_SESSION_TOKEN = "project-contract-session";

const PROJECT_RECORD_IDS = [
	"recMtdmBbaFilF2Tm",
	"recpZe8mLEiASXfRd",
	"recgdpwEI5hFO7bUZ",
	"recIFoFmpDIGBP726",
	"recUUeazIqBMfsZL4",
];

const env = {
	AIRTABLE_BASE_ID: "appTest",
	AIRTABLE_API_KEY: "patTest",
	AIRTABLE_TABLE_PROJECTS: "Projects",
	AIRTABLE_TABLE_DETAILS: "Project Details",
	GH_OWNER: "kevinrapley",
	GH_REPO: "ResearchOps",
	GH_BRANCH: "main",
	GH_PATH_PROJECTS: "data/projects.csv",
	ALLOWED_ORIGINS: "https://researchops.pages.dev",
	RESEARCHOPS_AUTH_SECRET: "project-contract-secret",
	RESEARCHOPS_D1: createMockD1(),
};

function jsonResponse(body, init = {}) {
	return new Response(JSON.stringify(body), {
		status: init.status || 200,
		headers: {
			"content-type": "application/json; charset=utf-8",
			...(init.headers || {}),
		},
	});
}

function csvResponse(body) {
	return new Response(body, {
		status: 200,
		headers: {
			"content-type": "text/csv; charset=utf-8",
		},
	});
}

function authenticatedRequest(url) {
	return new Request(url, {
		headers: {
			cookie: `rops_session=${TEST_SESSION_TOKEN}`,
		},
	});
}

function roleRows() {
	return [
		{
			role_key: "team_admin",
			label: "Team Admin",
			description: "Can manage team membership, roles and general audit oversight.",
			is_sensitive: 1,
			scope_type: "team",
			scope_id: TEST_TEAM_ID,
			expires_at: null,
		},
		{
			role_key: "user_researcher",
			label: "User researcher",
			description: "Can plan, run and analyse user research.",
			is_sensitive: 0,
			scope_type: "team",
			scope_id: TEST_TEAM_ID,
			expires_at: null,
		},
	];
}

function permissionRows() {
	return [
		{
			code: "governed.create",
			label: "Create governed records",
			description: "Can create governed project records.",
			is_sensitive: 0,
			is_reserved: 0,
		},
		{
			code: "role.assign",
			label: "Assign roles",
			description: "Can assign or approve role access where policy permits.",
			is_sensitive: 1,
			is_reserved: 0,
		},
	];
}

function membershipTeamRows() {
	return [
		{
			id: TEST_TEAM_ID,
			name: TEST_TEAM_NAME,
			membershipStatus: "active",
			membershipCreatedAt: "2025-01-01T00:00:00.000Z",
			membershipSource: "membership",
		},
	];
}

function allRowsForSql(sql) {
	if (sql.includes("FROM auth_team_memberships m") && sql.includes("membershipSource")) {
		return membershipTeamRows();
	}

	if (sql.includes("FROM auth_team_memberships m") && sql.includes("most_recent_role_approved_at")) {
		return membershipTeamRows();
	}

	if (sql.includes("'role_assignment' AS membershipSource")) {
		return [];
	}

	if (sql.includes("SELECT id, name") && sql.includes("FROM auth_teams")) {
		return [{ id: TEST_TEAM_ID, name: TEST_TEAM_NAME }];
	}

	if (sql.includes("SELECT DISTINCT t.id, t.name") && sql.includes("p.code = 'role.assign'")) {
		return [{ id: TEST_TEAM_ID, name: TEST_TEAM_NAME }];
	}

	if (sql.includes("SELECT r.role_key")) {
		return roleRows();
	}

	if (sql.includes("SELECT DISTINCT p.code")) {
		return permissionRows();
	}

	return [];
}

function firstRowForSql(sql) {
	if (sql.includes("FROM auth_sessions s INNER JOIN auth_users u")) {
		return {
			session_id: "ses_project_contract",
			id: TEST_USER_ID,
			email: "researcher@example.test",
			display_name: "Researcher Example",
			account_status: "active",
		};
	}

	if (sql.includes("SELECT ra.id") && sql.includes("ResearchOps Core Team")) {
		return { id: "ra_core_admin" };
	}

	return null;
}

function createMockStatement(sql, args = []) {
	return {
		bind(...nextArgs) {
			return createMockStatement(sql, nextArgs);
		},
		async first() {
			return firstRowForSql(sql);
		},
		async all() {
			return { results: allRowsForSql(sql) };
		},
		async run() {
			return { success: true, meta: { changes: 1 }, args };
		},
	};
}

function createMockD1() {
	return {
		prepare(sql) {
			return createMockStatement(sql);
		},
	};
}

function projectFields(recordId, fields) {
	return {
		"Record ID": recordId,
		Org: "Home Office Biometrics",
		"Team ID": TEST_TEAM_ID,
		"Team Name": TEST_TEAM_NAME,
		...fields,
	};
}

function projectRecords() {
	return [
		{
			id: PROJECT_RECORD_IDS[0],
			createdTime: "2025-02-05T10:00:00.000Z",
			fields: projectFields(PROJECT_RECORD_IDS[0], {
				Name: "New Project",
				Description: "Project description",
				Phase: "Discovery",
				Status: "Planning research",
				Objectives: "Understand the new project",
				UserGroups: "Caseworkers",
				Stakeholders: "[]",
			}),
		},
		{
			id: PROJECT_RECORD_IDS[1],
			createdTime: "2025-02-04T10:00:00.000Z",
			fields: projectFields(PROJECT_RECORD_IDS[1], {
				Name: "My Project",
				Description: "This is my project",
				Phase: "Discovery",
				Status: "Goal setting & problem defining",
				Objectives: "Confirm the problem",
				UserGroups: "Researchers",
				Stakeholders: "[]",
			}),
		},
		{
			id: PROJECT_RECORD_IDS[2],
			createdTime: "2025-02-03T10:00:00.000Z",
			fields: projectFields(PROJECT_RECORD_IDS[2], {
				Name: "Test Project 1",
				Description: "Test Project Description",
				Phase: "Discovery",
				Status: "Goal setting & problem defining",
				Objectives: "Test objective",
				UserGroups: "Participants",
				Stakeholders: "[]",
			}),
		},
		{
			id: PROJECT_RECORD_IDS[3],
			createdTime: "2025-02-02T10:00:00.000Z",
			fields: projectFields(PROJECT_RECORD_IDS[3], {
				Name: "Testing with AI",
				Description: "Problem statement",
				Phase: "Pre-Discovery",
				Status: "Goal setting & problem defining",
				Objectives: "Test AI support",
				UserGroups: "Researchers",
				Stakeholders: "[]",
			}),
		},
		{
			id: PROJECT_RECORD_IDS[4],
			createdTime: "2025-02-01T10:00:00.000Z",
			fields: projectFields(PROJECT_RECORD_IDS[4], {
				Name: "Project Name",
				Description: "Problem statement",
				Phase: "Pre-Discovery",
				Status: "Goal setting & problem defining",
				Objectives: "Define the project",
				UserGroups: "Researchers",
				Stakeholders: "[]",
			}),
		},
	];
}

function createMockFetch(calls) {
	return async (resource) => {
		const url = String(resource);
		calls.push(url);

		if (url.includes("/Projects/rec")) {
			const recordId = decodeURIComponent(url.split("/Projects/")[1].split("?")[0]);
			const record = projectRecords().find((candidate) => candidate.id === recordId);
			if (!record) return jsonResponse({ error: { type: "NOT_FOUND" } }, { status: 404 });
			return jsonResponse(record);
		}

		if (url.includes("/Projects?")) {
			return jsonResponse({ records: projectRecords() });
		}

		if (url.includes("/Project%20Details?")) {
			return jsonResponse({
				records: [
					{
						id: "detailTestProject",
						createdTime: "2025-02-03T12:00:00.000Z",
						fields: {
							Project: [PROJECT_RECORD_IDS[2]],
							"Lead Researcher": "Lead Test",
							"Lead Researcher Email": "lead.test@example.test",
							Notes: "Joined detail notes",
						},
					},
				],
			});
		}

		if (url.includes("raw.githubusercontent.com")) {
			return csvResponse(`LocalId,Name,CreatedAt\n${PROJECT_RECORD_IDS[0]},Csv project,2025-01-01T00:00:00.000Z\n`);
		}

		throw new Error(`Unexpected fetch URL: ${url}`);
	};
}

async function assertProjectsRouteFailsClosedWithoutSession() {
	const response = await worker.fetch(new Request("https://worker.test/api/projects"), env, {});
	assert.equal(response.status, 401);

	const payload = await response.json();
	assert.equal(payload.ok, false);
	assert.equal(payload.error, "authentication_required");
}

async function assertProjectsRouteUsesAirtableProjectsTable() {
	const calls = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = createMockFetch(calls);

	try {
		const response = await worker.fetch(authenticatedRequest("https://worker.test/api/projects"), env, {});
		assert.equal(response.status, 200);

		const payload = await response.json();
		assert.equal(payload.ok, true);
		assert.equal(payload.canStartProject, true);
		assert.equal(Array.isArray(payload.projects), true);
		assert.equal(payload.projects.length, 5);
		assert.deepEqual(
			payload.projects.map((project) => project.id),
			PROJECT_RECORD_IDS,
		);
		assert.equal(
			payload.projects.some((project) => String(project.name).includes("Kevin Rapley")),
			false,
		);
		assert.equal(
			payload.projects.some((project) => String(project.id).startsWith("PID-")),
			false,
		);

		const firstProject = payload.projects[0];
		assert.equal(firstProject.id, PROJECT_RECORD_IDS[0]);
		assert.equal(firstProject.airtableId, PROJECT_RECORD_IDS[0]);
		assert.equal(firstProject.recordId, PROJECT_RECORD_IDS[0]);
		assert.equal(firstProject.name, "New Project");
		assert.equal(firstProject["rops:servicePhase"], "Discovery");
		assert.equal(firstProject["rops:projectStatus"], "Planning research");
		assert.equal(firstProject.teamName, TEST_TEAM_NAME);
		assert.equal(Object.hasOwn(firstProject, "Name"), false);
		assert.equal(Object.hasOwn(firstProject, "Phase"), false);

		const testProject = payload.projects.find((project) => project.id === PROJECT_RECORD_IDS[2]);
		assert.equal(testProject.lead_researcher, "Lead Test");
		assert.equal(testProject.lead_researcher_email, "lead.test@example.test");
		assert.equal(testProject.notes, "Joined detail notes");

		assert.equal(
			calls.some((url) => url.includes("/Projects?")),
			true,
		);
		assert.equal(
			calls.some((url) => url.includes("/Project%20Details?")),
			true,
		);
	} finally {
		globalThis.fetch = originalFetch;
	}
}

async function assertProjectReadResolvesAirtableRecordId() {
	const calls = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = createMockFetch(calls);

	try {
		const response = await worker.fetch(authenticatedRequest(`https://worker.test/api/projects/${PROJECT_RECORD_IDS[2]}`), env, {});
		assert.equal(response.status, 200);

		const project = await response.json();
		assert.equal(project.id, PROJECT_RECORD_IDS[2]);
		assert.equal(project.airtableId, PROJECT_RECORD_IDS[2]);
		assert.equal(project.recordId, PROJECT_RECORD_IDS[2]);
		assert.equal(project.name, "Test Project 1");
		assert.equal(project.lead_researcher, "Lead Test");
		assert.equal(
			calls.some((url) => url.includes(`/Projects/${PROJECT_RECORD_IDS[2]}`)),
			true,
		);
		assert.equal(
			calls.some((url) => url.includes("/Projects?") && !url.includes("/Project%20Details?")),
			false,
		);
	} finally {
		globalThis.fetch = originalFetch;
	}
}

async function assertNonRecordProjectIdIsNotFound() {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = createMockFetch([]);

	try {
		const response = await worker.fetch(authenticatedRequest("https://worker.test/api/projects/PID-ALPHA"), env, {});
		assert.equal(response.status, 404);

		const payload = await response.json();
		assert.equal(payload.ok, false);
		assert.equal(payload.error, "Project not found");
	} finally {
		globalThis.fetch = originalFetch;
	}
}

async function assertProjectsCsvRouteStillWorks() {
	const calls = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = createMockFetch(calls);

	try {
		const response = await worker.fetch(new Request("https://worker.test/api/projects.csv"), env, {});
		assert.equal(response.status, 200);
		assert.match(response.headers.get("content-type") || "", /text\/csv/);

		const body = await response.text();
		assert.match(body, /LocalId,Name,CreatedAt/);
		assert.equal(
			calls.some((url) => url.includes("raw.githubusercontent.com")),
			true,
		);
	} finally {
		globalThis.fetch = originalFetch;
	}
}

function assertLegacyProjectsDirectHandlerIsAbsent() {
	const router = fs.readFileSync("infra/cloudflare/src/core/router.js", "utf8");
	assert.equal(router.includes("projectsJsonDirect"), false);
	assert.equal(router.includes("Matched /api/projects (direct)"), false);
}

await assertProjectsRouteFailsClosedWithoutSession();
await assertProjectsRouteUsesAirtableProjectsTable();
await assertProjectReadResolvesAirtableRecordId();
await assertNonRecordProjectIdIsNotFound();
await assertProjectsCsvRouteStillWorks();
assertLegacyProjectsDirectHandlerIsAbsent();
