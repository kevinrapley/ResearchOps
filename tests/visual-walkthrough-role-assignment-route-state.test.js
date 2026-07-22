import assert from 'node:assert/strict';
import fs from 'node:fs';
import { publishedGovukPage } from './helpers/published-govuk-pages.mjs';

const walkthroughConfigSource = fs.readFileSync('visual-walkthrough.config.mjs', 'utf8');
const roleAssignmentScriptSource = fs.readFileSync('public/js/auth-role-assignment-page.js', 'utf8');
const roleAssignmentPageSource = await publishedGovukPage('public/pages/team/role-assignments/index.html');

function assertWalkthroughUsesCurrentRoleAssignmentCopy() {
	assert.match(walkthroughConfigSource, /id: 'team-role-assignments'/);
	assert.match(walkthroughConfigSource, /text: 'You can assign roles in teams you manage'/);
	assert.doesNotMatch(walkthroughConfigSource, /waitForText: 'You are assigning roles in'/);
}

function assertRoleAssignmentPageStillProvidesWalkthroughAnchor() {
	assert.match(roleAssignmentScriptSource, /You can assign roles in teams you manage/);
	assert.match(roleAssignmentScriptSource, /Your current team is/);
	assert.match(roleAssignmentPageSource, /id="auth-context"/);
	assert.match(roleAssignmentPageSource, /aria-live="polite"/);
}

assertWalkthroughUsesCurrentRoleAssignmentCopy();
assertRoleAssignmentPageStillProvidesWalkthroughAnchor();
