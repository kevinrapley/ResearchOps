import assert from 'node:assert/strict';
import fs from 'node:fs';

const accessSource = fs.readFileSync('infra/cloudflare/src/core/auth/access.js', 'utf8');
const passwordlessSource = fs.readFileSync('infra/cloudflare/src/core/auth/passwordless.js', 'utf8');

function assertTeamQueryPrefersMostRecentRoleAssignment(source, label) {
	assert.match(source, /MAX\(ra\.approved_at\) AS most_recent_role_approved_at/, `${label} should expose approved role recency`);
	assert.match(source, /MAX\(ra\.created_at\) AS most_recent_role_created_at/, `${label} should expose created role recency`);
	assert.match(source, /m\.created_at AS membership_created_at/, `${label} should retain membership recency fallback`);
	assert.match(source, /LEFT JOIN auth_role_assignments ra ON ra\.user_id = m\.user_id/, `${label} should join role assignments to active memberships`);
	assert.match(source, /ra\.scope_type = 'team'/, `${label} should only consider team-scoped assignments`);
	assert.match(source, /ra\.scope_id = t\.id/, `${label} should rank the matching team scope`);
	assert.match(source, /ra\.assignment_status = 'active'/, `${label} should ignore inactive assignments`);
	assert.match(source, /COALESCE\(most_recent_role_approved_at, most_recent_role_created_at, membership_created_at\) DESC, t\.name ASC/, `${label} should order most recently assigned team first`);
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

assertTeamQueryPrefersMostRecentRoleAssignment(accessSource, 'Cloudflare Access context');
assertTeamQueryPrefersMostRecentRoleAssignment(passwordlessSource, 'passwordless context');
assertExplicitTeamHeaderStillOverridesFallback(accessSource, 'Cloudflare Access context');
assertExplicitTeamHeaderStillOverridesFallback(passwordlessSource, 'passwordless context');
assertPasswordlessNoLongerUsesAlphabeticalFirstTeamOnly();
