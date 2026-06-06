import { safeText } from "../../core/utils.js";
import { parseCsv } from "./csv.js";
import { displayText, normaliseLines, normaliseStakeholders, normaliseTeamIds, normaliseTeamNames, normaliseUserGroups, publicProjectId } from "./normalisation.js";

export async function fetchProjectsCsvFromGitHub(env) {
	const owner = env.GH_OWNER;
	const repo = env.GH_REPO;
	const branch = env.GH_BRANCH || "main";
	const path = env.GH_PATH_PROJECTS || "data/projects.csv";

	const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
	const headers = {};
	if (env.GH_TOKEN) headers.Authorization = `Bearer ${env.GH_TOKEN}`;

	const res = await fetch(rawUrl, { headers });
	const body = await res.text().catch(() => "");
	if (!res.ok) {
		throw Object.assign(new Error("github_csv_fetch_failed"), {
			status: res.status,
			body: safeText(body),
		});
	}
	return parseCsv(body);
}

export function coerceCsvRowToProject(r = {}) {
	const airtableId = displayText(r.AirtableId || r.airtableId || r.RecordId || r.recordId || "");
	const id = publicProjectId(r, { id: airtableId });
	let stakeholders = [];
	try {
		stakeholders = r.Stakeholders ? JSON.parse(r.Stakeholders) : [];
	} catch {
		/* noop */
	}

	const teamNames = normaliseTeamNames(r);
	const teamIds = normaliseTeamIds(r);
	const teamName = teamNames[0] || "";

	return {
		id,
		pid: id,
		localId: id,
		LocalId: id,
		airtableId,
		recordId: airtableId,
		name: displayText(r.Name || r["Project Name"] || r.Title || ""),
		description: displayText(r.Description || r.Summary || ""),
		"rops:servicePhase": displayText(r.Phase || r["Service Phase"] || ""),
		"rops:projectStatus": displayText(r.Status || r["Project Status"] || ""),
		objectives: normaliseLines(r.Objectives || r["Research Objectives"] || ""),
		user_groups: normaliseUserGroups(r.UserGroups || r["User Groups"] || ""),
		stakeholders: normaliseStakeholders(stakeholders),
		createdAt: displayText(r.CreatedAt || r.createdTime || ""),
		team_ids: teamIds,
		teamIds,
		teamNames,
		teamName,
		team_name: teamName,
		team: teamName,
		org: teamName || displayText(r.Org || r.org || ""),
	};
}
