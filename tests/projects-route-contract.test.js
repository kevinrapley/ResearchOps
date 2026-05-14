import assert from "node:assert/strict";
import fs from "node:fs";
import worker from "../infra/cloudflare/src/worker.js";

const TEST_TEAM_ID = "team_researchops_core";
const TEST_TEAM_NAME = "ResearchOps Core";
const TEST_USER_ID = "usr_project_contract";
const TEST_SESSION_TOKEN = "project-contract-session";

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

function projectFields(fields) {
	return {
		"Team ID": TEST_TEAM_ID,
		"Team Name": TEST_TEAM_NAME,
		...fields,
	};
}

function createMockFetch(calls) {
	return async (resource) => {
		const url = String(resource);
		calls.push(url);

		if (url.includes("/Projects?")) {
			return jsonResponse({
				records: [
					{
						id: "recBeta",
						createdTime: "2025-01-01T10:00:00.000Z",
						fields: projectFields({
							Name: "Beta project",
							Description: "Beta description",
							Phase: "Discovery",
							Status: "Planning research",
							Objectives: "Beta objective",
							UserGroups: "Analyst",
							Stakeholders: "[]",
						}),
					},
					{
						id: "recAlpha",
						createdTime: "2025-01-01T10:00:00.000Z",
						fields: projectFields({
							Name: "Alpha project",
							Description: "Alpha description",
							Phase: "Discovery",
							Status: "Planning research",
							Objectives: "Alpha objective",
							UserGroups: "Researcher",
							Stakeholders: "[]",
						}),
					},
					{
						id: "recNewest",
						createdTime: "2025-02-01T10:00:00.000Z",
						fields: projectFields({
							Name: "Newest project",
							Description: "Newest description",
							Phase: "Alpha",
							Status: "Conducting research",
							Objectives: "Newest objective",
							UserGroups: "Citizen",
							Stakeholders: "[]",
						}),
					},
				],
			});
		}

		if (url.includes("/Project%20Details?")) {
			return jsonResponse({
				records: [
					{
						id: "detailAlpha",
						createdTime: "2025-01-02T10:00:00.000Z",
						fields: {
							Project: ["recAlpha"],
							"Lead Researcher": "Lead Alpha",
							"Lead Researcher Email": "lead.alpha@example.test",
							Notes: "Joined detail notes",
						},
					},
				],
			});
		}

		if (url.includes("raw.githubusercontent.com")) {
			return csvResponse("LocalId,Name,CreatedAt\nrecCsv,Csv project,2025-01-01T00:00:00.000Z\n");
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

async function assertProjectsRouteUsesComposedService() {
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
		assert.deepEqual(
			payload.projects.map((project) => project.id),
			["recNewest", "recAlpha", "recBeta"],
		);

		const newest = payload.projects[0];
		assert.equal(newest.name, "Newest project");
		assert.equal(newest["rops:servicePhase"], "Alpha");
		assert.equal(newest["rops:projectStatus"], "Conducting research");
		assert.equal(newest.createdAt, "2025-02-01T10:00:00.000Z");
		assert.equal(newest.teamName, TEST_TEAM_NAME);
		assert.equal(Object.hasOwn(newest, "Name"), false);
		assert.equal(Object.hasOwn(newest, "Phase"), false);

		const alpha = payload.projects[1];
		assert.equal(alpha.lead_researcher, "Lead Alpha");
		assert.equal(alpha.lead_researcher_email, "lead.alpha@example.test");
		assert.equal(alpha.notes, "Joined detail notes");

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
await assertProjectsRouteUsesComposedService();
await assertProjectsCsvRouteStillWorks();
assertLegacyProjectsDirectHandlerIsAbsent();
