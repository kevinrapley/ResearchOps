import assert from "node:assert/strict";
import fs from "node:fs";
import worker from "../infra/cloudflare/src/worker.js";

const TEST_TEAM_ID = "team_daas";
const TEST_TEAM_NAME = "DaaS";
const TEST_USER_ID = "usr_project_contract";
const TEST_SESSION_TOKEN = "project-contract-session";
const DAAS_PROJECT_RECORD_ID = "recdMo80h1QaNQCBk";
const DAAS_PROJECT_NAME = "Third Country National Discovery";
const DAAS_CREATED_AT = "2026-06-24T10:10:00.000Z";
const DAAS_DESCRIPTION =
	"The Third Country National (TCN) Discovery is a Home Office Digital research and analysis phase focused on understanding and improving how criminal conviction data about non-EU nationals is identified, accessed, and shared between the UK and EU. It supports the UK's potential participation in the ECRIS-TCN system, which enables member states to identify where conviction data is held for third country nationals.";
const DAAS_OBJECTIVES = [
	"1. Understand the problem space\n- Establish a shared understanding of the TCN problem\n- Define the problem statement, goals, and assumptions\n- Align stakeholders on the scope and purpose of Discovery",
	'2. Build an "As-Is" view of the current system\n- Map end-to-end workflows (UK <-> EU)\n- Identify systems involved (e.g., LEDS, HOB, ACRO)\n- Understand data flows and formats\n- Capture process steps, timings, and responsibilities',
	"3. Identify users, stakeholders, and impacts\n- Understand who uses TCN data (direct and indirect users)\n- Map organisations involved across policing, borders, and justice\n- Assess who will be impacted by change",
];
const DAAS_USER_GROUPS = ["Law enforcement", "ACRO", "Borders and immigration", "Justice and legal", "Indirect operational users", "Technical and data users", "Policy and governance users"];
const DAAS_STAKEHOLDERS = [
	{ name: "Pam Thethi", role: "PSG - ILEC - Criminal Records Team", email: "pam.thethi@homeoffice.gov.uk" },
	{ name: "Chris Moffitt", role: "PSG - ILEC - Criminal Records Team", email: "christopher.moffitt@homeoffice.gov.uk" },
	{ name: "Maria Athayde", role: "PSG - ILEC - Criminal Records Team", email: "maria.athayde@homeoffice.gov.uk" },
];
const d1RunCalls = [];
let d1HasPartialProject = false;
let d1ProjectCacheRow = null;
let d1ProjectCacheRows = [];

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

function isRawGitHubContentUrl(value) {
	try {
		const url = new URL(String(value));
		return url.protocol === "https:" && url.hostname === "raw.githubusercontent.com";
	} catch {
		return false;
	}
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
	if (sql.includes("SELECT * FROM rops_projects_cache") && sql.includes("ORDER BY updated_at DESC")) {
		const includePartial = sql.includes("'airtable-partial'");
		return d1ProjectCacheRows.filter((row) => {
			if (row?.active === 0) return false;
			if (row?.source === "airtable-partial") return includePartial;
			return row?.source === "airtable" || row?.source === "preview-seed";
		});
	}

	if (sql.includes("FROM auth_team_memberships m") && sql.includes("membershipSource")) {
		return membershipTeamRows();
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

	if (sql.includes("SELECT id FROM rops_projects_cache") && sql.includes("source = 'airtable-partial'")) {
		return d1HasPartialProject ? { id: PROJECT_RECORD_IDS[0] } : null;
	}

	if (sql.includes("SELECT source FROM rops_projects_cache WHERE id = ?")) {
		return d1ProjectCacheRow ? { source: d1ProjectCacheRow.source || "airtable" } : null;
	}

	if (sql.includes("SELECT * FROM rops_projects_cache") && sql.includes("id = ?")) {
		return d1ProjectCacheRow;
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
			d1RunCalls.push({ sql, args });
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

function d1ProjectCacheRecord({ id = PROJECT_RECORD_IDS[2], source = "preview-seed", name = "Test Project 1", createdAt = "2026-06-24T09:00:00.000Z", project = {} } = {}) {
	const payload = {
		id,
		airtableId: id,
		recordId: id,
		name,
		description: "Test Project Description",
		createdAt,
		"rops:servicePhase": "Discovery",
		"rops:projectStatus": "Goal setting & problem defining",
		objectives: ["Test objective"],
		user_groups: ["Participants"],
		stakeholders: [],
		team_ids: [TEST_TEAM_ID],
		teamIds: [TEST_TEAM_ID],
		teamNames: [TEST_TEAM_NAME],
		teamName: TEST_TEAM_NAME,
		team_name: TEST_TEAM_NAME,
		team: TEST_TEAM_NAME,
		org: TEST_TEAM_NAME,
		...project,
	};
	return {
		id,
		name,
		org: TEST_TEAM_NAME,
		phase: "Discovery",
		status: "Goal setting & problem defining",
		active: 1,
		source,
		updated_at: createdAt,
		payload_json: JSON.stringify(payload),
	};
}

function createMockFetch(calls, { rejectProjectTeamFields = [], rejectProjectPatchStatus = 0 } = {}) {
	let projectTeamFieldRejections = 0;
	return async (resource, options = {}) => {
		const url = String(resource);
		calls.push({ url, options });

		if (url.includes("/Projects/rec")) {
			const recordId = decodeURIComponent(url.split("/Projects/")[1].split("?")[0]);
			const record = projectRecords().find((candidate) => candidate.id === recordId);
			if (!record) return jsonResponse({ error: { type: "NOT_FOUND" } }, { status: 404 });
			return jsonResponse(record);
		}

		if (url.endsWith("/Projects") && options.method === "POST") {
			const body = JSON.parse(String(options.body || "{}"));
			const fields = body.records?.[0]?.fields || {};
			const rejectedField = rejectProjectTeamFields[projectTeamFieldRejections] || "";
			if (rejectedField && Object.hasOwn(fields, rejectedField)) {
				projectTeamFieldRejections += 1;
				return jsonResponse(
					{
						error: {
							type: "UNKNOWN_FIELD_NAME",
							message: `Unknown field name: "${rejectedField}"`,
						},
					},
					{ status: 422 },
				);
			}
			return jsonResponse({
				records: [
					{
						id: PROJECT_RECORD_IDS[0],
						createdTime: "2026-06-15T10:00:00.000Z",
						fields,
					},
				],
			});
		}

		if (url.endsWith("/Projects") && options.method === "PATCH") {
			if (rejectProjectPatchStatus) {
				return jsonResponse(
					{
						error: {
							type: "RATE_LIMIT_REACHED",
							message: "Rate limit reached",
						},
					},
					{ status: rejectProjectPatchStatus },
				);
			}
			const body = JSON.parse(String(options.body || "{}"));
			const record = body.records?.[0] || {};
			return jsonResponse({
				records: [
					{
						id: record.id || PROJECT_RECORD_IDS[2],
						createdTime: "2026-06-24T10:00:00.000Z",
						fields: {
							...projectFields(record.id || PROJECT_RECORD_IDS[2], {
								Name: "Test Project 1",
								Description: "Test Project Description",
								Phase: "Discovery",
								Status: "Goal setting & problem defining",
							}),
							...(record.fields || {}),
						},
					},
				],
			});
		}

		if (url.includes("/Projects?")) {
			return jsonResponse({ records: projectRecords() });
		}

		if (url.endsWith("/Project%20Details") && options.method === "POST") {
			const body = JSON.parse(String(options.body || "{}"));
			return jsonResponse({
				records: [
					{
						id: "detailCreatedProject",
						createdTime: "2026-06-15T10:01:00.000Z",
						fields: body.records?.[0]?.fields || {},
					},
				],
			});
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
		assert.equal(Object.hasOwn(testProject, "lead_researcher"), false);
		assert.equal(Object.hasOwn(testProject, "lead_researcher_email"), false);
		assert.equal(Object.hasOwn(testProject, "notes"), false);

		assert.equal(
			calls.some(({ url }) => url.includes("/Projects?")),
			true,
		);
		assert.equal(
			calls.some(({ url }) => url.includes("/Project%20Details?")),
			false,
		);
	} finally {
		globalThis.fetch = originalFetch;
	}
}

async function assertPartialProjectCacheDoesNotShortCircuitProjectList() {
	const calls = [];
	const originalFetch = globalThis.fetch;
	d1HasPartialProject = true;
	globalThis.fetch = createMockFetch(calls);

	try {
		const response = await worker.fetch(authenticatedRequest("https://worker.test/api/projects"), env, {});
		assert.equal(response.status, 200);

		const payload = await response.json();
		assert.equal(payload.ok, true);
		assert.equal(payload.projects.length, 5);
		assert.equal(response.headers.get("x-rops-source"), "airtable");
		assert.equal(
			calls.some(({ url }) => url.includes("/Projects?")),
			true,
		);
	} finally {
		d1HasPartialProject = false;
		globalThis.fetch = originalFetch;
	}
}

async function assertProjectListUsesPreviewSeedD1WhenAirtableIsUnavailable() {
	const originalFetch = globalThis.fetch;
	d1ProjectCacheRows = [
		d1ProjectCacheRecord({ id: PROJECT_RECORD_IDS[2], source: "preview-seed", name: "Test Project 1", createdAt: "2026-05-17T23:30:00.000Z" }),
		d1ProjectCacheRecord({
			id: DAAS_PROJECT_RECORD_ID,
			source: "preview-seed",
			name: DAAS_PROJECT_NAME,
			createdAt: DAAS_CREATED_AT,
			project: {
				description: DAAS_DESCRIPTION,
				objectives: DAAS_OBJECTIVES,
				user_groups: DAAS_USER_GROUPS,
				stakeholders: DAAS_STAKEHOLDERS,
				lead_researcher: "Amy Everett",
				lead_researcher_email: "amy.everett@homeoffice.gov.uk",
			},
		}),
	];
	globalThis.fetch = createMockFetch([]);
	const d1OnlyEnv = {
		...env,
		AIRTABLE_BASE_ID: "",
		AIRTABLE_TABLE_PROJECTS: "",
		AIRTABLE_API_KEY: "",
	};

	try {
		const response = await worker.fetch(authenticatedRequest("https://worker.test/api/projects"), d1OnlyEnv, {});
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("x-rops-source"), "d1");

		const payload = await response.json();
		assert.equal(payload.ok, true);
		assert.equal(payload.projects.length, 2);
		assert.equal(payload.projects[0].id, DAAS_PROJECT_RECORD_ID);
		assert.equal(payload.projects[0].name, DAAS_PROJECT_NAME);
		assert.equal(payload.projects[0].teamName, TEST_TEAM_NAME);
		assert.equal(payload.projects[0].createdAt, DAAS_CREATED_AT);
		assert.equal(payload.projects[0].description, DAAS_DESCRIPTION);
		assert.deepEqual(payload.projects[0].objectives, DAAS_OBJECTIVES);
		assert.deepEqual(payload.projects[0].user_groups, DAAS_USER_GROUPS);
		assert.equal(payload.projects[0].stakeholders.length, 3);
		assert.equal(payload.projects[0].stakeholders[0].name, "Pam Thethi");
		assert.equal(payload.projects[0].stakeholders[1].name, "Chris Moffitt");
		assert.equal(payload.projects[0].stakeholders[2].name, "Maria Athayde");
		assert.equal(payload.projects[1].id, PROJECT_RECORD_IDS[2]);
	} finally {
		d1ProjectCacheRows = [];
		globalThis.fetch = originalFetch;
	}
}

async function assertPartialProjectCacheIsFallbackWhenAirtableIsUnavailable() {
	const originalFetch = globalThis.fetch;
	d1ProjectCacheRows = [d1ProjectCacheRecord({ source: "airtable-partial" })];
	globalThis.fetch = createMockFetch([]);
	const d1OnlyEnv = {
		...env,
		AIRTABLE_BASE_ID: "",
		AIRTABLE_TABLE_PROJECTS: "",
		AIRTABLE_API_KEY: "",
	};

	try {
		const response = await worker.fetch(authenticatedRequest("https://worker.test/api/projects"), d1OnlyEnv, {});
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("x-rops-source"), "d1");

		const payload = await response.json();
		assert.equal(payload.ok, true);
		assert.equal(payload.projects.length, 1);
		assert.equal(payload.projects[0].id, PROJECT_RECORD_IDS[2]);
	} finally {
		d1ProjectCacheRows = [];
		globalThis.fetch = originalFetch;
	}
}

async function assertAuthenticatedProjectCreateUsesSessionContext() {
	const calls = [];
	const originalFetch = globalThis.fetch;
	d1RunCalls.length = 0;
	globalThis.fetch = createMockFetch(calls);

	try {
		const response = await worker.fetch(
			new Request("https://worker.test/api/projects", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					cookie: `rops_session=${TEST_SESSION_TOKEN}`,
				},
				body: JSON.stringify({
					name: "Third Country National Discovery",
					description: "Discovery research project",
					phase: "Discovery",
					status: "Goal setting & problem defining",
					objectives: ["Understand the problem space", "Map end-to-end workflows"],
					user_groups: ["Law enforcement", "Borders and immigration"],
					stakeholders: [
						{
							name: "Pam Thethi",
							role: "PSG - ILEC - Criminal Records Team",
							email: "pam.thethi@homeoffice.gov.uk",
						},
					],
					lead_researcher: "Amy Everett",
					lead_researcher_email: "amy.everett@homeoffice.gov.uk",
					notes: "Created from the start-project check answers flow",
				}),
			}),
			env,
			{},
		);
		assert.equal(response.status, 201);

		const payload = await response.json();
		assert.equal(payload.ok, true);
		assert.notEqual(payload.error, "authentication_required");
		assert.equal(payload.project.name, "Third Country National Discovery");
		assert.equal(payload.project["rops:servicePhase"], "Discovery");
		assert.equal(payload.project["rops:projectStatus"], "Goal setting & problem defining");
		assert.equal(payload.project.teamName, TEST_TEAM_NAME);
		assert.equal(payload.project.lead_researcher, "Amy Everett");
		assert.equal(payload.project.lead_researcher_email, "amy.everett@homeoffice.gov.uk");
		assert.equal(payload.project.notes, "Created from the start-project check answers flow");

		const projectCreateCall = calls.find(({ url, options }) => url.endsWith("/Projects") && options.method === "POST");
		assert.ok(projectCreateCall);
		const projectCreateBody = JSON.parse(projectCreateCall.options.body);
		const fields = projectCreateBody.records[0].fields;
		assert.equal(fields.Name, "Third Country National Discovery");
		assert.equal(fields.Description, "Discovery research project");
		assert.equal(fields.Phase, "Discovery");
		assert.equal(fields.Status, "Goal setting & problem defining");
		assert.equal(fields.Objectives, "Understand the problem space\nMap end-to-end workflows");
		assert.equal(fields.UserGroups, "Law enforcement, Borders and immigration");
		assert.equal(fields.Org, TEST_TEAM_NAME);
		assert.equal(fields["Team ID"], TEST_TEAM_ID);
		assert.equal(fields["Team Name"], TEST_TEAM_NAME);
		assert.match(fields.Stakeholders, /Pam Thethi/);

		const detailCreateCall = calls.find(({ url, options }) => url.endsWith("/Project%20Details") && options.method === "POST");
		assert.ok(detailCreateCall);
		const detailCreateBody = JSON.parse(detailCreateCall.options.body);
		assert.deepEqual(detailCreateBody.records[0].fields.Project, [PROJECT_RECORD_IDS[0]]);
		assert.equal(detailCreateBody.records[0].fields["Lead Researcher"], "Amy Everett");
		assert.equal(detailCreateBody.records[0].fields["Lead Researcher Email"], "amy.everett@homeoffice.gov.uk");
		assert.equal(detailCreateBody.records[0].fields.Notes, "Created from the start-project check answers flow");

		assert.equal(
			d1RunCalls.some((call) => call.sql.includes("UPDATE rops_projects_cache SET active = 0")),
			false,
		);
		const cacheInsertCall = d1RunCalls.find((call) => call.sql.includes("INSERT INTO rops_projects_cache"));
		assert.ok(cacheInsertCall);
		assert.equal(cacheInsertCall.args[5], "airtable-partial");
		const cachedProject = JSON.parse(cacheInsertCall.args[7]);
		assert.deepEqual(cachedProject.objectives, ["Understand the problem space", "Map end-to-end workflows"]);
		assert.deepEqual(cachedProject.user_groups, ["Law enforcement", "Borders and immigration"]);
		assert.equal(cachedProject.stakeholders.length, 1);
		assert.equal(cachedProject.stakeholders[0].name, "Pam Thethi");
		assert.equal(cachedProject.lead_researcher, "Amy Everett");
		assert.equal(cachedProject.lead_researcher_email, "amy.everett@homeoffice.gov.uk");
	} finally {
		globalThis.fetch = originalFetch;
	}
}

async function assertProjectCreateDoesNotBlockWhenTeamFieldsAreMissing() {
	const calls = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = createMockFetch(calls, { rejectProjectTeamFields: ["Team ID", "Team Name"] });

	try {
		const response = await worker.fetch(
			new Request("https://worker.test/api/projects", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					cookie: `rops_session=${TEST_SESSION_TOKEN}`,
				},
				body: JSON.stringify({
					name: "Third Country National Discovery",
					description: "Discovery research project",
					phase: "Discovery",
					status: "Goal setting & problem defining",
					objectives: ["Understand the problem space"],
					user_groups: ["Law enforcement"],
				}),
			}),
			env,
			{},
		);
		assert.equal(response.status, 201);

		const payload = await response.json();
		assert.equal(payload.ok, true);
		assert.equal(payload.projectWarning, "project_team_fields_missing");
		assert.equal(payload.project.name, "Third Country National Discovery");
		assert.equal(payload.project.teamName, TEST_TEAM_NAME);

		const projectCreateCalls = calls.filter(({ url, options }) => url.endsWith("/Projects") && options.method === "POST");
		assert.equal(projectCreateCalls.length, 3);

		const rejectedFields = JSON.parse(projectCreateCalls[0].options.body).records[0].fields;
		assert.equal(rejectedFields.Org, TEST_TEAM_NAME);
		assert.equal(rejectedFields["Team ID"], TEST_TEAM_ID);
		assert.equal(rejectedFields["Team Name"], TEST_TEAM_NAME);

		const firstRetryFields = JSON.parse(projectCreateCalls[1].options.body).records[0].fields;
		assert.equal(firstRetryFields.Org, TEST_TEAM_NAME);
		assert.equal(Object.hasOwn(firstRetryFields, "Team ID"), false);
		assert.equal(firstRetryFields["Team Name"], TEST_TEAM_NAME);

		const secondRetryFields = JSON.parse(projectCreateCalls[2].options.body).records[0].fields;
		assert.equal(secondRetryFields.Org, TEST_TEAM_NAME);
		assert.equal(Object.hasOwn(secondRetryFields, "Team ID"), false);
		assert.equal(Object.hasOwn(secondRetryFields, "Team Name"), false);
		assert.equal(secondRetryFields.Name, "Third Country National Discovery");
	} finally {
		globalThis.fetch = originalFetch;
	}
}

async function assertProjectCreatePreservesSupportedTeamFields() {
	const calls = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = createMockFetch(calls, { rejectProjectTeamFields: ["Team ID"] });

	try {
		const response = await worker.fetch(
			new Request("https://worker.test/api/projects", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					cookie: `rops_session=${TEST_SESSION_TOKEN}`,
				},
				body: JSON.stringify({
					name: "Third Country National Discovery",
					description: "Discovery research project",
					phase: "Discovery",
					status: "Goal setting & problem defining",
					objectives: ["Understand the problem space"],
					user_groups: ["Law enforcement"],
				}),
			}),
			env,
			{},
		);
		assert.equal(response.status, 201);

		const payload = await response.json();
		assert.equal(payload.ok, true);
		assert.equal(payload.projectWarning, "project_team_fields_missing");
		assert.equal(payload.project.teamName, TEST_TEAM_NAME);

		const projectCreateCalls = calls.filter(({ url, options }) => url.endsWith("/Projects") && options.method === "POST");
		assert.equal(projectCreateCalls.length, 2);

		const retriedFields = JSON.parse(projectCreateCalls[1].options.body).records[0].fields;
		assert.equal(retriedFields.Org, TEST_TEAM_NAME);
		assert.equal(Object.hasOwn(retriedFields, "Team ID"), false);
		assert.equal(retriedFields["Team Name"], TEST_TEAM_NAME);
	} finally {
		globalThis.fetch = originalFetch;
	}
}

async function assertProjectCreateDoesNotBlockWhenOrgFieldIsMissing() {
	const calls = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = createMockFetch(calls, { rejectProjectTeamFields: ["Org"] });

	try {
		const response = await worker.fetch(
			new Request("https://worker.test/api/projects", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					cookie: `rops_session=${TEST_SESSION_TOKEN}`,
				},
				body: JSON.stringify({
					name: "Third Country National Discovery",
					description: "Discovery research project",
					phase: "Discovery",
					status: "Goal setting & problem defining",
					objectives: ["Understand the problem space"],
					user_groups: ["Law enforcement"],
				}),
			}),
			env,
			{},
		);
		assert.equal(response.status, 201);

		const payload = await response.json();
		assert.equal(payload.ok, true);
		assert.equal(payload.projectWarning, "project_team_fields_missing");
		assert.equal(payload.project.teamName, TEST_TEAM_NAME);

		const projectCreateCalls = calls.filter(({ url, options }) => url.endsWith("/Projects") && options.method === "POST");
		assert.equal(projectCreateCalls.length, 2);

		const rejectedFields = JSON.parse(projectCreateCalls[0].options.body).records[0].fields;
		assert.equal(rejectedFields.Org, TEST_TEAM_NAME);
		assert.equal(rejectedFields["Team ID"], TEST_TEAM_ID);
		assert.equal(rejectedFields["Team Name"], TEST_TEAM_NAME);

		const retriedFields = JSON.parse(projectCreateCalls[1].options.body).records[0].fields;
		assert.equal(Object.hasOwn(retriedFields, "Org"), false);
		assert.equal(retriedFields["Team ID"], TEST_TEAM_ID);
		assert.equal(retriedFields["Team Name"], TEST_TEAM_NAME);
	} finally {
		globalThis.fetch = originalFetch;
	}
}

async function assertProjectReadResolvesAirtableRecordId() {
	const calls = [];
	const originalFetch = globalThis.fetch;
	d1RunCalls.length = 0;
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
		assert.equal(project.lead_researcher_email, "lead.test@example.test");
		assert.equal(project.notes, "Joined detail notes");
		assert.equal(
			calls.some(({ url }) => url.includes(`/Projects/${PROJECT_RECORD_IDS[2]}`)),
			true,
		);
		assert.equal(
			calls.some(({ url }) => url.includes("/Projects?") && !url.includes("/Project%20Details?")),
			false,
		);
		const cacheInsertCall = d1RunCalls.find((call) => call.sql.includes("INSERT INTO rops_projects_cache"));
		assert.ok(cacheInsertCall);
		assert.equal(cacheInsertCall.args[5], "airtable-partial");
		const cachedProject = JSON.parse(cacheInsertCall.args[7]);
		assert.equal(cachedProject.lead_researcher, "Lead Test");
		assert.equal(cachedProject.lead_researcher_email, "lead.test@example.test");
		assert.equal(cachedProject.notes, "Joined detail notes");
	} finally {
		globalThis.fetch = originalFetch;
	}
}

async function assertProjectReadUsesPreviewSeedD1WhenAirtableIsUnavailable() {
	const originalFetch = globalThis.fetch;
	d1ProjectCacheRow = d1ProjectCacheRecord({
		id: DAAS_PROJECT_RECORD_ID,
		source: "preview-seed",
		name: DAAS_PROJECT_NAME,
		createdAt: DAAS_CREATED_AT,
		project: {
			description: DAAS_DESCRIPTION,
			objectives: DAAS_OBJECTIVES,
			user_groups: DAAS_USER_GROUPS,
			stakeholders: DAAS_STAKEHOLDERS,
			lead_researcher: "Amy Everett",
			lead_researcher_email: "amy.everett@homeoffice.gov.uk",
		},
	});
	globalThis.fetch = createMockFetch([]);
	const d1OnlyEnv = {
		...env,
		AIRTABLE_BASE_ID: "",
		AIRTABLE_TABLE_PROJECTS: "",
		AIRTABLE_API_KEY: "",
	};

	try {
		const response = await worker.fetch(authenticatedRequest(`https://worker.test/api/projects/${DAAS_PROJECT_RECORD_ID}`), d1OnlyEnv, {});
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("x-rops-source"), "d1");

		const project = await response.json();
		assert.equal(project.id, DAAS_PROJECT_RECORD_ID);
		assert.equal(project.name, DAAS_PROJECT_NAME);
		assert.equal(project.description, DAAS_DESCRIPTION);
		assert.equal(project.teamName, TEST_TEAM_NAME);
		assert.deepEqual(project.objectives, DAAS_OBJECTIVES);
		assert.deepEqual(project.user_groups, DAAS_USER_GROUPS);
		assert.equal(project.stakeholders.length, 3);
		assert.equal(project.stakeholders[0].name, "Pam Thethi");
		assert.equal(project.stakeholders[1].name, "Chris Moffitt");
		assert.equal(project.stakeholders[2].name, "Maria Athayde");
		assert.equal(project.lead_researcher, "Amy Everett");
		assert.equal(project.lead_researcher_email, "amy.everett@homeoffice.gov.uk");
	} finally {
		d1ProjectCacheRow = null;
		globalThis.fetch = originalFetch;
	}
}

async function assertProjectPatchUsesD1WhenAirtableIsRateLimited() {
	const calls = [];
	const waitUntilPromises = [];
	const originalFetch = globalThis.fetch;
	d1RunCalls.length = 0;
	d1ProjectCacheRow = {
		id: PROJECT_RECORD_IDS[2],
		name: "Test Project 1",
		org: TEST_TEAM_NAME,
		phase: "Discovery",
		status: "Goal setting & problem defining",
		active: 1,
		source: "airtable",
		updated_at: "2026-06-24T09:00:00.000Z",
		payload_json: JSON.stringify({
			id: PROJECT_RECORD_IDS[2],
			airtableId: PROJECT_RECORD_IDS[2],
			recordId: PROJECT_RECORD_IDS[2],
			name: "Test Project 1",
			description: "Test Project Description",
			"rops:servicePhase": "Discovery",
			"rops:projectStatus": "Goal setting & problem defining",
			objectives: ["Old objective"],
			user_groups: ["Participants"],
			stakeholders: [],
			team_ids: [TEST_TEAM_ID],
			teamIds: [TEST_TEAM_ID],
			teamNames: [TEST_TEAM_NAME],
			teamName: TEST_TEAM_NAME,
			team_name: TEST_TEAM_NAME,
			team: TEST_TEAM_NAME,
			org: TEST_TEAM_NAME,
		}),
	};
	globalThis.fetch = createMockFetch(calls, { rejectProjectPatchStatus: 429 });

	try {
		const response = await worker.fetch(
			new Request(`https://worker.test/api/projects/${PROJECT_RECORD_IDS[2]}`, {
				method: "PATCH",
				headers: {
					"content-type": "application/json",
					cookie: `rops_session=${TEST_SESSION_TOKEN}`,
				},
				body: JSON.stringify({
					description: "Updated project description",
					objectives: ["Understand the problem space", "Map the current system"],
				}),
			}),
			env,
			{
				waitUntil(promise) {
					waitUntilPromises.push(promise);
				},
			},
		);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("x-rops-source"), "d1");

		const payload = await response.json();
		assert.equal(payload.ok, true);
		assert.equal(payload.project.id, PROJECT_RECORD_IDS[2]);
		assert.equal(payload.project.description, "Updated project description");
		assert.deepEqual(payload.project.objectives, ["Understand the problem space", "Map the current system"]);
		assert.equal(payload.capture.airtable, "queued");

		const cacheInsertCall = d1RunCalls.find((call) => call.sql.includes("INSERT INTO rops_projects_cache"));
		assert.ok(cacheInsertCall);
		assert.equal(cacheInsertCall.args[5], "airtable");
		const cachedProject = JSON.parse(cacheInsertCall.args[7]);
		assert.equal(cachedProject.description, "Updated project description");
		assert.deepEqual(cachedProject.objectives, ["Understand the problem space", "Map the current system"]);

		const airtablePatchCall = calls.find(({ url, options }) => url.endsWith("/Projects") && options.method === "PATCH");
		assert.ok(airtablePatchCall);
		const airtablePatchBody = JSON.parse(String(airtablePatchCall.options.body || "{}"));
		assert.equal(airtablePatchBody.records[0].fields.Description, "Updated project description");
		assert.equal(airtablePatchBody.records[0].fields.Objectives, "Understand the problem space\nMap the current system");
		assert.equal(waitUntilPromises.length, 1);
		const captureResults = await Promise.allSettled(waitUntilPromises);
		assert.equal(captureResults[0].status, "fulfilled");
	} finally {
		d1ProjectCacheRow = null;
		globalThis.fetch = originalFetch;
	}
}

async function assertProjectPatchPreservesPreviewSeedD1SourceWhenAirtableIsRateLimited() {
	const calls = [];
	const originalFetch = globalThis.fetch;
	d1RunCalls.length = 0;
	d1ProjectCacheRow = d1ProjectCacheRecord({ source: "preview-seed" });
	globalThis.fetch = createMockFetch(calls, { rejectProjectPatchStatus: 429 });

	try {
		const response = await worker.fetch(
			new Request(`https://worker.test/api/projects/${PROJECT_RECORD_IDS[2]}`, {
				method: "PATCH",
				headers: {
					"content-type": "application/json",
					cookie: `rops_session=${TEST_SESSION_TOKEN}`,
				},
				body: JSON.stringify({
					objectives: ["Keep D1 preview seed visible"],
				}),
			}),
			env,
			{ waitUntil() {} },
		);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("x-rops-source"), "d1");

		const cacheInsertCall = d1RunCalls.find((call) => call.sql.includes("INSERT INTO rops_projects_cache"));
		assert.ok(cacheInsertCall);
		assert.equal(cacheInsertCall.args[5], "preview-seed");
	} finally {
		d1ProjectCacheRow = null;
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
			calls.some(({ url }) => isRawGitHubContentUrl(url)),
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

function assertPreviewMigrationSeedsDaaSProject() {
	const migration = fs.readFileSync("infra/cloudflare/migrations/preview/0002_seed_projects_cache.sql", "utf8");
	assert.equal(migration.includes(DAAS_PROJECT_RECORD_ID), true);
	assert.equal(migration.includes(DAAS_PROJECT_NAME), true);
	assert.equal(migration.includes('"createdAt":"2026-06-24T10:10:00.000Z"'), true);
	assert.equal(migration.includes("ECRIS-TCN system"), true);
	assert.equal(migration.includes("Establish a shared understanding of the TCN problem"), true);
	assert.equal(migration.includes("Map end-to-end workflows (UK <-> EU)"), true);
	assert.equal(migration.includes('"ACRO"'), true);
	assert.equal(migration.includes('"Policy and governance users"'), true);
	assert.equal(migration.includes("Chris Moffitt"), true);
	assert.equal(migration.includes("Maria Athayde"), true);
	assert.equal(migration.includes('"lead_researcher":"Amy Everett"'), true);
	assert.equal(migration.includes('"team_ids":["team_daas"]'), true);
	assert.equal(migration.includes('"teamName":"DaaS"'), true);
}

await assertProjectsRouteFailsClosedWithoutSession();
await assertProjectsRouteUsesAirtableProjectsTable();
await assertPartialProjectCacheDoesNotShortCircuitProjectList();
await assertProjectListUsesPreviewSeedD1WhenAirtableIsUnavailable();
await assertPartialProjectCacheIsFallbackWhenAirtableIsUnavailable();
await assertAuthenticatedProjectCreateUsesSessionContext();
await assertProjectCreateDoesNotBlockWhenTeamFieldsAreMissing();
await assertProjectCreatePreservesSupportedTeamFields();
await assertProjectCreateDoesNotBlockWhenOrgFieldIsMissing();
await assertProjectReadResolvesAirtableRecordId();
await assertProjectReadUsesPreviewSeedD1WhenAirtableIsUnavailable();
await assertProjectPatchUsesD1WhenAirtableIsRateLimited();
await assertProjectPatchPreservesPreviewSeedD1SourceWhenAirtableIsRateLimited();
await assertNonRecordProjectIdIsNotFound();
await assertProjectsCsvRouteStillWorks();
assertLegacyProjectsDirectHandlerIsAbsent();
assertPreviewMigrationSeedsDaaSProject();
