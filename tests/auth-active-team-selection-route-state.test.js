import assert from 'node:assert/strict';
import fs from 'node:fs';

const accessSource = fs.readFileSync('infra/cloudflare/src/core/auth/access.js', 'utf8');
const passwordlessSource = fs.readFileSync('infra/cloudflare/src/core/auth/passwordless.js', 'utf8');

function assertTeamQueryUsesMembershipsOnly(source, label) {
	assert.match(source, /m\.created_at AS membership_created_at/, `${label} should retain membership recency fallback`);
	assert.match(source, /FROM auth_team_memberships m/, `${label} should list team memberships`);
	assert.match(source, /m\.membership_status = 'active'/, `${label} should only use active memberships`);
	assert.match(source, /t\.team_status = 'active'/, `${label} should only use active teams`);
	assert.match(source, /ORDER BY m\.created_at DESC, t\.name ASC/, `${label} should order memberships without using role recency`);
	assert.doesNotMatch(source, /LEFT JOIN auth_role_assignments ra ON ra\.user_id = m\.user_id/, `${label} should not derive teams from role assignments`);
}

function assertRoleResolutionIsIndependentOfActiveTeam(source, label) {
	assert.match(source, /async function (?:listRoles|roles)\(db, userId\)/, `${label} should resolve roles by user`);
	assert.match(source, /async function (?:listPermissions|permissions)\(db, userId\)/, `${label} should resolve permissions by user`);
	assert.match(source, /dedupeRoles\(result\.results \|\| \[\]\)/, `${label} should dedupe roles across scopes`);
	assert.doesNotMatch(source, /async function listRoles\(db, userId, teamId\)/, `${label} should not require a team for roles`);
	assert.doesNotMatch(source, /async function listPermissions\(db, userId, teamId\)/, `${label} should not require a team for permissions`);
}

function assertExplicitTeamHeaderStillOverridesFallback(source, label) {
	assert.match(source, /function selectActiveTeam\(request, (?:teams|userTeams)\)/, `${label} should keep a single active team selector`);
	assert.match(source, /request\.headers\.get\('X-ResearchOps-Team-Id'\)/, `${label} should still accept explicit team selection`);
	assert.match(source, /find\(\(team\) => team\.id === requestedTeamId\) \|\| (?:teams|userTeams)\[0\] \|\| null/, `${label} should use requested team before recency fallback`);
}

function assertPasswordlessNoLongerUsesAlphabeticalFirstTeamOnly() {
	assert.doesNotMatch(passwordlessSource, /ORDER BY t\.name ASC\n\s*`\)\n\s*\.bind\(userId\)/);
	assert.doesNotMatch(passwordlessSource, /const activeTeam = userTeams\[0\] \|\| null/);
	assert.match(passwordlessSource, /const activeTeam = selectActiveTeam\(request, userTeams\)/);
}

assertTeamQueryUsesMembershipsOnly(accessSource, 'Cloudflare Access context');
assertTeamQueryUsesMembershipsOnly(passwordlessSource, 'passwordless context');
assertRoleResolutionIsIndependentOfActiveTeam(accessSource, 'Cloudflare Access context');
assertRoleResolutionIsIndependentOfActiveTeam(passwordlessSource, 'passwordless context');
assertExplicitTeamHeaderStillOverridesFallback(accessSource, 'Cloudflare Access context');
assertExplicitTeamHeaderStillOverridesFallback(passwordlessSource, 'passwordless context');
assertPasswordlessNoLongerUsesAlphabeticalFirstTeamOnly();
