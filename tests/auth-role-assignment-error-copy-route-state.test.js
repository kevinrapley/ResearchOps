import assert from 'node:assert/strict';
import fs from 'node:fs';

const pageSource = fs.readFileSync('public/pages/team/role-assignments/index.html', 'utf8');
const scriptSource = fs.readFileSync('public/js/auth-role-assignment-page.js', 'utf8');

function assertRoleAssignmentErrorsAreUserFacing() {
	assert.match(scriptSource, /ROLE_ASSIGNMENT_SERVER_MESSAGES/);
	assert.match(scriptSource, /function roleAssignmentServerMessage\(data, status\)/);
	assert.match(scriptSource, /ResearchOps could not add this person to the team before assigning the role\. Try again later\./);
	assert.match(scriptSource, /ResearchOps cannot assign roles right now\. Try again later\./);
	assert.match(scriptSource, /ResearchOps could not find an account for this person\. Check their email address or ask them to request an account\./);
	assert.match(scriptSource, /You do not have permission to assign this role\./);
	assert.match(scriptSource, /ResearchOps could not assign this role\. Check the details and try again\./);
}

function assertRoleAssignmentErrorsDoNotExposeProgrammaticTerms() {
	const showServerErrorStart = scriptSource.indexOf('function showServerError(data, status)');
	const prepareReviewStart = scriptSource.indexOf('function prepareReview(event)');
	assert.ok(showServerErrorStart > -1, 'Expected showServerError function to exist');
	assert.ok(prepareReviewStart > showServerErrorStart, 'Expected prepareReview to follow showServerError');

	const showServerErrorSource = scriptSource.slice(showServerErrorStart, prepareReviewStart);

	assert.doesNotMatch(showServerErrorSource, /Error code:/);
	assert.doesNotMatch(showServerErrorSource, /<code>/);
	assert.doesNotMatch(showServerErrorSource, /data\?\.error/);
	assert.doesNotMatch(showServerErrorSource, /Request failed with status/);
	assert.doesNotMatch(showServerErrorSource, /target_not_team_member/);
}

function assertRoleAssignmentScriptCacheKeyWasRefreshed() {
	assert.match(pageSource, /auth-role-assignment-page\.js\?v=explicit-team-selection-20260513/);
}

assertRoleAssignmentErrorsAreUserFacing();
assertRoleAssignmentErrorsDoNotExposeProgrammaticTerms();
assertRoleAssignmentScriptCacheKeyWasRefreshed();
