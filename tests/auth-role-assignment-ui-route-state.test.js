import assert from 'node:assert/strict';
import fs from 'node:fs';

const pageSource = fs.readFileSync('public/pages/team/role-assignments/index.html', 'utf8');
const scriptSource = fs.readFileSync('public/js/auth-role-assignment-page.js', 'utf8');
const styleSource = fs.readFileSync('public/css/auth-role-assignments.css', 'utf8');

function assertPageStructure() {
	assert.match(pageSource, /<title>Assign team roles — ResearchOps Demo Suite<\/title>/);
	assert.match(pageSource, /id="role-assignment-title"/);
	assert.match(pageSource, /id="auth-context"/);
	assert.match(pageSource, /id="role-assignment-error-summary"/);
	assert.match(pageSource, /id="role-assignment-form"/);
	assert.match(pageSource, /id="target-email"/);
	assert.match(pageSource, /id="target-user-id"/);
	assert.match(pageSource, /id="role-key"/);
	assert.match(pageSource, /id="requested-reason"/);
	assert.match(pageSource, /id="expires-at"/);
	assert.match(pageSource, /id="sensitive-role-confirmation"/);
	assert.match(pageSource, /id="safeguarding-confirmation"/);
	assert.match(pageSource, /id="role-assignment-result"/);
	assert.match(pageSource, /\/js\/auth-role-assignment-page\.js/);
	assert.match(pageSource, /\/css\/auth-role-assignments\.css/);
}

function assertRoleOptions() {
	assert.match(pageSource, /value="observer"/);
	assert.match(pageSource, /value="researcher"/);
	assert.match(pageSource, /value="research_lead"/);
	assert.match(pageSource, /value="approver"/);
	assert.match(pageSource, /value="safeguarding_lead"/);
	assert.match(pageSource, /value="team_admin"/);
}

function assertClientUsesAuthAndAssignmentEndpoints() {
	assert.match(scriptSource, /credentials: "include"/);
	assert.match(scriptSource, /fetchJson\("\/api\/me"\)/);
	assert.match(scriptSource, /fetchJson\("\/api\/auth\/role-assignments"/);
	assert.match(scriptSource, /permissions\.has\("role\.assign"\)/);
	assert.match(scriptSource, /setDisabled\(!canAssignRoles\)/);
}

function assertClientBuildsCorrectRequestContract() {
	assert.match(scriptSource, /targetEmail/);
	assert.match(scriptSource, /targetUserId/);
	assert.match(scriptSource, /roleKey/);
	assert.match(scriptSource, /requestedReason/);
	assert.match(scriptSource, /expiresAt/);
	assert.match(scriptSource, /sensitiveRoleConfirmation/);
	assert.match(scriptSource, /ASSIGN_SENSITIVE_ROLE/);
	assert.match(scriptSource, /safeguardingConfirmation/);
	assert.match(scriptSource, /ASSIGN_SAFEGUARDING_LEAD/);
}

function assertClientValidatesBeforePost() {
	assert.match(scriptSource, /function validate\(values\)/);
	assert.match(scriptSource, /Enter a team member email or user ID/);
	assert.match(scriptSource, /Select a role to assign/);
	assert.match(scriptSource, /Enter a reason of at least 12 characters/);
	assert.match(scriptSource, /Confirm the sensitive role assignment/);
	assert.match(scriptSource, /Confirm Safeguarding Lead access is required/);
}

function assertRoleMetadataIsVisibleClientSide() {
	assert.match(scriptSource, /const ROLE_DETAILS = Object\.freeze/);
	assert.match(scriptSource, /governed\.create/);
	assert.match(scriptSource, /governed\.edit/);
	assert.match(scriptSource, /governed\.review/);
	assert.match(scriptSource, /governed\.approve/);
	assert.match(scriptSource, /recommendation\.own/);
	assert.match(scriptSource, /safeguarding\.view/);
	assert.match(scriptSource, /safeguarding\.audit\.view/);
	assert.match(scriptSource, /team\.manage/);
	assert.match(scriptSource, /role\.assign/);
}

function assertStylesExist() {
	assert.match(styleSource, /\.auth-role-assignment-status__panel/);
	assert.match(styleSource, /\.auth-role-assignment-status__panel--ready/);
	assert.match(styleSource, /\.auth-role-assignment-status__panel--blocked/);
	assert.match(styleSource, /\.auth-role-assignment-summary/);
	assert.match(styleSource, /\.auth-role-assignment-sensitive/);
	assert.match(styleSource, /\.auth-role-assignment-result--success/);
	assert.match(styleSource, /\.auth-role-assignment-result--error/);
	assert.match(styleSource, /transparency begins in the cascade/);
}

assertPageStructure();
assertRoleOptions();
assertClientUsesAuthAndAssignmentEndpoints();
assertClientBuildsCorrectRequestContract();
assertClientValidatesBeforePost();
assertRoleMetadataIsVisibleClientSide();
assertStylesExist();
