import { normaliseKey } from "./normalisation.js";

export function teamsForAuthContext(authContext = {}) {
	return [...(authContext.teamMemberships || []), ...(authContext.memberTeams || []), ...(authContext.teams || []), authContext.activeTeam].filter(
		Boolean,
	);
}

export function isResearchOpsCoreTeam(team = {}) {
	const id = normaliseKey(team.id || team.teamId || team.team_id);
	const name = normaliseKey(team.name || team.teamName || team.team_name || team.label);
	return id === "team-researchops-core" || name === "researchops-core" || name === "researchops-core-team";
}

export function isResearchOpsCoreMember(authContext = {}) {
	return Boolean(authContext.isResearchOpsCoreTeamAdmin) || teamsForAuthContext(authContext).some(isResearchOpsCoreTeam);
}

export function authTeamKeys(authContext = {}) {
	return new Set(
		teamsForAuthContext(authContext)
			.flatMap((team) => [team.id, team.teamId, team.team_id, team.name, team.teamName, team.team_name, team.label].map(normaliseKey))
			.filter(Boolean),
	);
}

export function projectTeamKeys(project = {}) {
	return new Set(
		[...(project.team_ids || []), ...(project.teamIds || []), ...(project.teamNames || []), project.teamName, project.team_name, project.team, project.org]
			.map(normaliseKey)
			.filter(Boolean),
	);
}

export function userCanSeeProject(project = {}, authContext = {}) {
	if (isResearchOpsCoreMember(authContext)) return true;

	const projectKeys = projectTeamKeys(project);
	if (!projectKeys.size) return false;

	const userKeys = authTeamKeys(authContext);
	for (const projectKey of projectKeys) {
		if (userKeys.has(projectKey)) return true;
	}
	return false;
}

export function permissionsForAuthContext(authContext = {}) {
	return new Set((authContext.permissions || []).map((permission) => permission.code).filter(Boolean));
}

export function canStartProject(authContext = {}) {
	if (isResearchOpsCoreMember(authContext)) return true;
	if (permissionsForAuthContext(authContext).has("governed.create")) return true;

	return (authContext.roles || []).some((role) => {
		const key = role.key || role.roleKey;
		return key === "researcher" || key === "user_researcher" || key === "research_lead";
	});
}

export function activeTeamForCreate(authContext = {}) {
	if (authContext.activeTeam?.id || authContext.activeTeam?.name) return authContext.activeTeam;
	return authContext.teamMemberships?.[0] || authContext.memberTeams?.[0] || null;
}
